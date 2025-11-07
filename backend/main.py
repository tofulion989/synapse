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
    ConsolidateRequest,
    ContradictionRequest,
    ContradictionResponse,
    DuplicateCheckResponse,
    DuplicateGroup,
    MemoryCreate,
    MemoryImportRequest,
    MemoryRecord,
    MemorySuggestion,
    MemorySuggestionRequest,
    MemorySuggestionResponse,
    ModelListResponse,
    SummarizeRequest,
    SummarizeResponse,
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
    base_messages = [message.model_dump() for message in request.messages]
    messages: List[dict] = []
    used_memory_ids: List[str] = []

    if request.system and request.system.strip():
        messages.append({"role": "system", "content": request.system.strip()})

    context_message = None

    if request.include_memories:
        selected = store.get_memories_by_ids(request.include_memories)
        if selected:
            used_memory_ids = [memory.id for memory in selected]
            if request.inject_memories:
                context_block = "\n\n".join(
                    f"[{memory.title or memory.id}]\n{memory.content}" for memory in selected
                )
                context_message = {
                    "role": "system",
                    "content": (
                        "The following context snippets were manually selected by the user.\n"
                        f"{context_block}"
                    ),
                }

    if context_message:
        messages.append(context_message)

    messages.extend(base_messages)

    return messages, used_memory_ids


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@api_router.get("/ollama/status")
async def ollama_status(router: LLMRouter = Depends(get_llm_router)) -> dict:
    return {
        "online": router.ollama_online,
        "base_url": router.settings.ollama_base_url,
        "models": router.ollama_tags,
    }

@api_router.get("/models", response_model=ModelListResponse)
async def list_models(router: LLMRouter = Depends(get_llm_router)) -> ModelListResponse:
    payload = router.models
    return ModelListResponse(**payload)


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


@api_router.post("/memories/suggest", response_model=MemorySuggestionResponse)
async def suggest_memories(
    payload: MemorySuggestionRequest,
    store: MemoryStore = Depends(get_memory_store),
) -> MemorySuggestionResponse:
    suggestions = store.suggest_memories(payload.query, limit=payload.limit)
    wrapped = [MemorySuggestion(memory=suggestion, score=suggestion.score) for suggestion in suggestions]
    return MemorySuggestionResponse(suggestions=wrapped)


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


@api_router.get("/memories/deduplicate", response_model=DuplicateCheckResponse)
async def deduplicate_memories(
    threshold: float = Query(0.9, ge=0.0, le=1.0),
    store: MemoryStore = Depends(get_memory_store),
) -> DuplicateCheckResponse:
    duplicates = store.find_duplicates(threshold=threshold)
    wrapped = [DuplicateGroup(ids=item["ids"], score=item["score"]) for item in duplicates]
    return DuplicateCheckResponse(duplicates=wrapped)


@api_router.post("/memories/consolidate", response_model=MemoryRecord)
async def consolidate_memories(
    payload: ConsolidateRequest,
    store: MemoryStore = Depends(get_memory_store),
) -> MemoryRecord:
    if not payload.memory_ids:
        raise HTTPException(status_code=400, detail="Provide at least one memory id.")
    if not payload.summary.strip():
        raise HTTPException(status_code=400, detail="Summary text required.")
    return store.consolidate_memories(
        payload.memory_ids,
        payload.summary,
        delete_originals=payload.delete_originals,
        title=payload.title,
        tags=payload.tags,
    )


@api_router.post("/memories/contradictions", response_model=ContradictionResponse)
async def detect_contradictions(
    payload: ContradictionRequest,
    router: LLMRouter = Depends(get_llm_router),
    store: MemoryStore = Depends(get_memory_store),
) -> ContradictionResponse:
    memories = store.get_memories_by_ids(payload.memory_ids)
    if not memories:
        raise HTTPException(status_code=400, detail="No memories found for supplied IDs.")
    report = await router.analyze_memories(memories, mode="contradiction", model=payload.model)
    return ContradictionResponse(report=report)


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
        stats=result.get("stats"),
    )


@api_router.post("/chat/summarize", response_model=SummarizeResponse)
async def summarize_conversation(
    request: SummarizeRequest,
    router: LLMRouter = Depends(get_llm_router),
    store: MemoryStore = Depends(get_memory_store),
) -> SummarizeResponse:
    result = await router.summarize(
        [message.model_dump() for message in request.messages],
        mode=request.mode,
        model=request.model,
        max_tokens=request.max_tokens,
    )
    memory_id = None
    if request.persist:
        record = store.add_memory(
            MemoryCreate(
                title=request.title or "Summary",
                content=result["summary"],
                tags=request.tags or ["#summary"],
            ),
            source="summary",
        )
        memory_id = record.id
    return SummarizeResponse(summary=result["summary"], model=result["model"], memory_id=memory_id)


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
