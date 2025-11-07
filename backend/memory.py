from __future__ import annotations

import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime
from typing import Iterable, List, Optional
from uuid import uuid4

try:
    import chromadb
    from chromadb.api import Collection
except ImportError:  # pragma: no cover - chromadb is an explicit dependency.
    chromadb = None
    Collection = None  # type: ignore

from .config import Settings, get_settings
from .models import MemoryCreate, MemoryImportRecord, MemoryRecord


def _timestamp() -> str:
    return datetime.utcnow().isoformat(timespec="seconds")


def _serialise_tags(tags: Iterable[str]) -> str:
    return ",".join(sorted(set(tag.strip().lower() for tag in tags if tag.strip())))


def _deserialise_tags(raw: str | None) -> List[str]:
    if not raw:
        return []
    return [tag for tag in raw.split(",") if tag]


class MemoryStore:
    """
    Hybrid memory storage spanning SQLite metadata and optional ChromaDB vectors.
    The SQLite connection is thread-safe via a lock because FastAPI may service multiple requests.
    """

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()
        self._lock = threading.Lock()
        self._db = sqlite3.connect(self.settings.sqlite_db, check_same_thread=False)
        self._db.row_factory = sqlite3.Row
        self._init_db()

        self._vector_client = None
        self._collection: Optional[Collection] = None
        if chromadb is not None:
            try:
                self._vector_client = chromadb.PersistentClient(path=str(self.settings.chroma_path))
                self._collection = self._vector_client.get_or_create_collection(name="memories")
            except Exception:
                # Defer vector initialisation failures; SQLite path remains available.
                self._collection = None

    def _init_db(self) -> None:
        with self._transaction() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS memories (
                    id TEXT PRIMARY KEY,
                    title TEXT,
                    content TEXT NOT NULL,
                    tags TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    source TEXT DEFAULT 'user'
                )
                """
            )
            try:
                cur.execute("ALTER TABLE memories ADD COLUMN source TEXT DEFAULT 'user'")
            except sqlite3.OperationalError:
                pass

    @contextmanager
    def _transaction(self):
        with self._lock:
            cursor = self._db.cursor()
            try:
                yield cursor
                self._db.commit()
            except Exception:
                self._db.rollback()
                raise
            finally:
                cursor.close()

    # ------------------------------------------------------------------ public API

    def add_memory(self, payload: MemoryCreate, *, source: str = "user") -> MemoryRecord:
        memory_id = uuid4().hex
        now = _timestamp()
        tags_serialised = _serialise_tags(payload.tags)

        with self._transaction() as cur:
            cur.execute(
                """
                INSERT INTO memories (id, title, content, tags, created_at, updated_at, source)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (memory_id, payload.title, payload.content, tags_serialised, now, now, source),
            )

        self._upsert_vector(memory_id, payload, metadata={"tags": tags_serialised})

        return MemoryRecord(
            id=memory_id,
            title=payload.title,
            content=payload.content,
            tags=_deserialise_tags(tags_serialised),
            created_at=datetime.fromisoformat(now),
            updated_at=datetime.fromisoformat(now),
            source=source,
        )

    def upsert_memory(self, record: MemoryImportRecord, *, source: str = "user") -> MemoryRecord:
        memory_id = record.id or uuid4().hex
        created_at = record.created_at.isoformat() if isinstance(record.created_at, datetime) else record.created_at
        updated_at = record.updated_at.isoformat() if isinstance(record.updated_at, datetime) else record.updated_at

        now = _timestamp()
        created = created_at or now
        updated = updated_at or now
        tags_serialised = _serialise_tags(record.tags)

        with self._transaction() as cur:
            cur.execute(
                """
                INSERT INTO memories (id, title, content, tags, created_at, updated_at, source)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    title=excluded.title,
                    content=excluded.content,
                    tags=excluded.tags,
                    updated_at=excluded.updated_at,
                    source=excluded.source
                """,
                (memory_id, record.title, record.content, tags_serialised, created, updated, source),
            )

        self._upsert_vector(
            memory_id,
            MemoryCreate(content=record.content, title=record.title, tags=record.tags),
            metadata={"tags": tags_serialised},
        )

        return MemoryRecord(
            id=memory_id,
            title=record.title,
            content=record.content,
            tags=_deserialise_tags(tags_serialised),
            created_at=datetime.fromisoformat(created),
            updated_at=datetime.fromisoformat(updated),
            source=source,
        )

    def export_memories(self) -> List[MemoryRecord]:
        return self.list_memories(limit=5000)

    def import_memories(self, records: List[MemoryImportRecord]) -> List[MemoryRecord]:
        imported: List[MemoryRecord] = []
        for record in records:
            imported.append(self.upsert_memory(record, source=record.source or "user"))
        return imported

    def get_memory(self, memory_id: str) -> Optional[MemoryRecord]:
        with self._transaction() as cur:
            cur.execute("SELECT * FROM memories WHERE id = ?", (memory_id,))
            row = cur.fetchone()

        if not row:
            return None

        return self._row_to_record(row)

    def delete_memory(self, memory_id: str) -> bool:
        with self._transaction() as cur:
            cur.execute("DELETE FROM memories WHERE id = ?", (memory_id,))
            removed = cur.rowcount > 0

        if removed and self._collection is not None:
            try:
                self._collection.delete(ids=[memory_id])
            except Exception:
                pass

        return removed

    def list_memories(self, limit: int = 50, offset: int = 0) -> List[MemoryRecord]:
        with self._transaction() as cur:
            cur.execute(
                "SELECT * FROM memories ORDER BY datetime(created_at) DESC LIMIT ? OFFSET ?",
                (limit, offset),
            )
            rows = cur.fetchall()

        return [self._row_to_record(row) for row in rows]

    def list_tags(self) -> List[dict]:
        with self._transaction() as cur:
            cur.execute("SELECT tags FROM memories")
            rows = cur.fetchall()

        counts = {}
        for row in rows:
            for tag in _deserialise_tags(row["tags"]):
                counts[tag] = counts.get(tag, 0) + 1

        return [
            {"tag": tag, "count": counts[tag]}
            for tag in sorted(counts, key=lambda t: counts[t], reverse=True)
        ]

    def search_memories(
        self,
        query: Optional[str] = None,
        tags: Optional[List[str]] = None,
        limit: int = 10,
    ) -> List[MemoryRecord]:
        if query and self._collection is not None:
            try:
                results = self._collection.query(query_texts=[query], n_results=limit)
                ids = results.get("ids", [[]])[0]
                scores = results.get("distances", [[]])[0]
                matched: List[MemoryRecord] = []
                for memory_id, score in zip(ids, scores):
                    record = self.get_memory(memory_id)
                    if record is None:
                        continue
                    if not self._tags_match(record.tags, tags):
                        continue
                    record.score = float(score) if score is not None else None
                    matched.append(record)
                return matched
            except Exception:
                pass  # fall back to SQLite scan

        sql = "SELECT *, 0 as score FROM memories"
        conditions = []
        params: List[str] = []

        if query:
            conditions.append("content LIKE ?")
            params.append(f"%{query}%")

        if tags:
            tag_conditions = []
            for tag in tags:
                tag_conditions.append("tags LIKE ?")
                params.append(f"%{tag.lower()}%")
            conditions.append("(" + " OR ".join(tag_conditions) + ")")

        if conditions:
            sql += " WHERE " + " AND ".join(conditions)

        sql += " ORDER BY datetime(created_at) DESC LIMIT ?"
        params.append(limit)

        with self._transaction() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()

        return [self._row_to_record(row) for row in rows]

    def get_memories_by_ids(self, ids: List[str]) -> List[MemoryRecord]:
        if not ids:
            return []
        placeholders = ",".join("?" for _ in ids)
        query = f"SELECT * FROM memories WHERE id IN ({placeholders})"
        with self._transaction() as cur:
            cur.execute(query, ids)
            rows = cur.fetchall()
        return [self._row_to_record(row) for row in rows]

    def suggest_memories(self, query: str, limit: int = 5) -> List[MemoryRecord]:
        return self.search_memories(query=query, limit=limit)

    def consolidate_memories(
        self,
        memory_ids: List[str],
        summary: str,
        delete_originals: bool = False,
        title: Optional[str] = None,
        tags: Optional[List[str]] = None,
    ) -> MemoryRecord:
        record = self.add_memory(
            MemoryCreate(title=title or "Summary", content=summary, tags=tags or ["#summary"]),
            source="summary",
        )
        if delete_originals and memory_ids:
            self.delete_memories(memory_ids)
        return record

    def delete_memories(self, memory_ids: List[str]) -> None:
        if not memory_ids:
            return
        placeholders = ",".join("?" for _ in memory_ids)
        with self._transaction() as cur:
            cur.execute(f"DELETE FROM memories WHERE id IN ({placeholders})", memory_ids)

    def find_duplicates(self, threshold: float = 0.9) -> List[List[str]]:
        memories = self.list_memories(limit=500)
        embeddings = {memory.id: self._cheap_embedding(memory.content) for memory in memories}
        duplicates = []
        seen_pairs = set()

        for i, mem_a in enumerate(memories):
            emb_a = embeddings[mem_a.id]
            for mem_b in memories[i + 1 :]:
                pair = tuple(sorted((mem_a.id, mem_b.id)))
                if pair in seen_pairs:
                    continue
                score = self._cosine_similarity(emb_a, embeddings[mem_b.id])
                if score >= threshold:
                    duplicates.append(list(pair))
                    seen_pairs.add(pair)
        return duplicates

    # ------------------------------------------------------------------ helpers

    def _row_to_record(self, row: sqlite3.Row) -> MemoryRecord:
        record = MemoryRecord(
            id=row["id"],
            title=row["title"],
            content=row["content"],
            tags=_deserialise_tags(row["tags"]),
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
            source=row["source"] if "source" in row.keys() else "user",
        )
        if "score" in row.keys():
            try:
                record.score = float(row["score"]) if row["score"] is not None else None
            except (TypeError, ValueError):
                record.score = None
        return record

    def _tags_match(self, record_tags: List[str], filter_tags: Optional[List[str]]) -> bool:
        if not filter_tags:
            return True
        canonical = {tag.lower().strip() for tag in filter_tags}
        return any(tag in canonical for tag in record_tags)

    def _upsert_vector(self, memory_id: str, payload: MemoryCreate, metadata: Optional[dict] = None) -> None:
        if self._collection is None:
            return

        try:
            embedding = self._cheap_embedding(payload.content)
            self._collection.upsert(
                ids=[memory_id],
                documents=[payload.content],
                metadatas=[metadata or {}],
                embeddings=[embedding],
            )
        except Exception:
            # Vector persistence is best effort; failures should not interrupt writes.
            pass

    def _cheap_embedding(self, text: str, dimensions: int = 64) -> List[float]:
        """
        Deterministic bag-of-words embedding to avoid heavyweight downloads
        during scaffolding. Replace with a proper embedding function later.
        """
        vector = [0.0] * dimensions
        if not text:
            return vector
        for token in text.lower().split():
            index = hash(token) % dimensions
            vector[index] += 1.0
        length = sum(value * value for value in vector) ** 0.5 or 1.0
        return [value / length for value in vector]

    def _cosine_similarity(self, a: List[float], b: List[float]) -> float:
        return sum(x * y for x, y in zip(a, b)) / (
            (sum(x * x for x in a) ** 0.5 or 1.0) * (sum(y * y for y in b) ** 0.5 or 1.0)
        )
