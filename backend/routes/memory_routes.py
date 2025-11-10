from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from ..dependencies import get_memory_store
from ..memory import MemoryStore
from ..models import MemoryAutoSuggestRequest, MemoryCreate, MemoryRecord
from ..services.injection import build_context
from ..services.embedding import search as vector_search

router = APIRouter()


class ContextPreviewRequest(BaseModel):
    selected_ids: List[str] = Field(default_factory=list)
    query: str = ""
    auto_suggest: bool = False


@router.get("/api/memories", response_model=List[MemoryRecord])
def list_memories(
    q: str | None = Query(default=None, description="Free-text search query."),
    tag: List[str] | None = Query(default=None, description="Filter by tag (repeatable)."),
    limit: int = Query(default=20, le=100),
    store: MemoryStore = Depends(get_memory_store),
) -> List[MemoryRecord]:
    if q or tag:
        return store.search_memories(query=q, tags=tag, limit=limit)
    return store.list_memories(limit=limit)


@router.post("/api/memories", response_model=MemoryRecord, status_code=201)
def create_memory(payload: MemoryCreate, store: MemoryStore = Depends(get_memory_store)) -> MemoryRecord:
    return store.add_memory(payload)


@router.post("/api/memories/auto_suggest")
def auto_suggest_memories(
    payload: MemoryAutoSuggestRequest,
    store: MemoryStore = Depends(get_memory_store),
) -> dict:
    query = payload.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query text required.")
    ids, scores = vector_search(query, payload.k)
    if not ids:
        return {"results": []}
    records = store.get_memories_by_ids(ids)
    lookup = {record.id: record for record in records}
    ordered = [lookup[mem_id] for mem_id in ids if mem_id in lookup]
    return {
        "results": [
            {
                "memory": record.model_dump(mode="json"),
                "score": scores[idx] if idx < len(scores) else None,
            }
            for idx, record in enumerate(ordered)
        ]
    }


@router.post("/api/memories/context")
def preview_context(
    payload: ContextPreviewRequest,
    store: MemoryStore = Depends(get_memory_store),
) -> dict:
    selected = store.get_memories_by_ids(payload.selected_ids)
    context, used_ids = build_context(
        selected,
        payload.query,
        use_vectors=payload.auto_suggest,
        fetch_memories_by_ids=store.get_memories_by_ids,
    )
    return {
        "context": context,
        "used_ids": used_ids,
    }
