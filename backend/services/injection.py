from __future__ import annotations

import json
from typing import Callable, Iterable, List, Optional, Sequence, Tuple

from ..models import MemoryRecord
from .embedding import search as vector_search


def build_context(
    selected_memories: Sequence[MemoryRecord],
    query: Optional[str],
    *,
    use_vectors: bool = False,
    fetch_memories_by_ids: Optional[Callable[[Iterable[str]], List[MemoryRecord]]] = None,
    max_auto: int = 5,
) -> Tuple[str, List[str]]:
    """
    Build a context string describing the memories being injected.
    Returns the rendered context plus the IDs that contributed to it.
    """
    query = (query or "").strip()
    used_ids: List[str] = []

    if use_vectors and query and fetch_memories_by_ids:
        vector_ids, _ = vector_search(query, max_auto)
        if vector_ids:
            vector_records = fetch_memories_by_ids(vector_ids)
            ordered = {record.id: record for record in vector_records}
            ordered_records = [ordered[mem_id] for mem_id in vector_ids if mem_id in ordered]
            summaries = [
                (record.summary or (record.content[:200] if record.content else "")).strip()
                for record in ordered_records
            ]
            summaries = [summary for summary in summaries if summary]
            if summaries:
                used_ids = [record.id for record in ordered_records]
                context = "Relevant Memory Summaries:\n" + "\n".join(f"- {summary}" for summary in summaries)
                return context, used_ids

    if not selected_memories:
        return "", []

    structured = [
        {"category": memory.category, "intent": memory.intent, "content": memory.content}
        for memory in selected_memories
    ]
    used_ids = [memory.id for memory in selected_memories]
    context = f"Relevant Memories (JSON): {json.dumps(structured, ensure_ascii=False)}"
    return context, used_ids
