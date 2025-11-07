from __future__ import annotations

from typing import List, Optional, Tuple
from datetime import datetime

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
import json

from .config import get_settings
from .llm import LLMRouter
from .memory import MemoryStore
from .models import (
    ChatRequest,
    ChatResponse,
    MemoryCreate,
    MemoryImportRequest,
    MemoryRecord,
    ModelInfo,
)

app = FastAPI(title="Synapse Backend", version="0.1.0")
api_router = APIRouter(prefix="/api", tags=["api"])

settings = get_settings()
memory_store = MemoryStore(settings=settings)
llm_router = LLMRouter(settings=settings)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_memory_store() -> MemoryStore:
    return memory_store


def get_llm_router() -> LLMRouter:
    return llm_router


def _prepare_chat_messages(
    request: ChatRequest,
    store: MemoryStore,
) -> Tuple[List[dict], List[str]]:
    messages = [message.model_dump() for message in request.messages]
    used_memory_ids: List[str] = []

    if request.include_memories:
        selected = store.get_memories_by_ids(request.include_memories)
        if selected:
            used_memory_ids = [memory.id for memory in selected]
            if request.inject_memories:
                context_block = "\n\n".join(
                    f"[{memory.title or memory.id}]\n{memory.content}" for memory in selected
                )
                system_message = {
                    "role": "system",
                    "content": (
                        "The following context snippets were manually selected by the user.\n"
                        f"{context_block}"
                    ),
                }
                messages = [system_message] + messages

    return messages, used_memory_ids


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@api_router.get("/models", response_model=List[ModelInfo])
async def list_models(router: LLMRouter = Depends(get_llm_router)) -> List[ModelInfo]:
    return router.models


@api_router.get("/memories", response_model=List[MemoryRecord])
async def list_memories(
    q: Optional[str] = Query(default=None, description="Free-text search query."),
    tag: Optional[List[str]] = Query(default=None, description="Filter by tag (repeatable)."),
    limit: int = Query(default=20, le=100),
    store: MemoryStore = Depends(get_memory_store),
) -> List[MemoryRecord]:
    if q or tag:
        return store.search_memories(query=q, tags=tag, limit=limit)
    return store.list_memories(limit=limit)


@api_router.post("/memories", response_model=MemoryRecord, status_code=201)
async def create_memory(
    payload: MemoryCreate,
    store: MemoryStore = Depends(get_memory_store),
) -> MemoryRecord:
    return store.add_memory(payload)


@api_router.get("/memories/tags")
async def memory_tags(store: MemoryStore = Depends(get_memory_store)) -> List[dict]:
    return store.list_tags()


@api_router.get("/memories/export")
async def export_memories(store: MemoryStore = Depends(get_memory_store)) -> dict:
    records = store.export_memories()
    return {
        "exported_at": datetime.utcnow().isoformat() + "Z",
        "count": len(records),
        "memories": [record.model_dump(mode="json") for record in records],
    }


@api_router.post("/memories/import", response_model=List[MemoryRecord])
async def import_memories(
    payload: MemoryImportRequest,
    store: MemoryStore = Depends(get_memory_store),
) -> List[MemoryRecord]:
    if not payload.memories:
        raise HTTPException(status_code=400, detail="No memories provided for import.")
    return store.import_memories(payload.memories)


@api_router.delete("/memories/{memory_id}", status_code=204)
async def delete_memory(memory_id: str, store: MemoryStore = Depends(get_memory_store)) -> None:
    removed = store.delete_memory(memory_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Memory not found")


@api_router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    router: LLMRouter = Depends(get_llm_router),
    store: MemoryStore = Depends(get_memory_store),
) -> ChatResponse:
    messages, used_memory_ids = _prepare_chat_messages(request, store)
    result = await router.chat(messages=messages, model=request.model)

    return ChatResponse(
        model=result["model"],
        provider=result["provider"],
        content=result["content"],
        used_memories=used_memory_ids,
        placeholder=result.get("placeholder", False),
    )


@api_router.post("/chat/stream")
async def chat_stream(
    request: ChatRequest,
    router: LLMRouter = Depends(get_llm_router),
    store: MemoryStore = Depends(get_memory_store),
) -> StreamingResponse:
    messages, used_memory_ids = _prepare_chat_messages(request, store)

    async def event_generator():
        async for chunk in router.stream_chat(messages=messages, model=request.model):
            payload = {
                **chunk,
                "used_memories": used_memory_ids,
            }
            yield json.dumps(payload).encode("utf-8") + b"\n"

    return StreamingResponse(event_generator(), media_type="application/json")


@app.get("/")
async def root() -> JSONResponse:
    return JSONResponse({"service": "Synapse Backend", "version": "0.1.0"})


@app.get("/api/health")
async def api_health() -> dict:
    return {"status": "ok"}


app.include_router(api_router)
