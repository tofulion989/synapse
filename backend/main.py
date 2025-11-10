from __future__ import annotations

from datetime import datetime
import logging
from typing import List, Optional, Tuple

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
import json

from .llm import LLMRouter
from .dependencies import get_llm_router, get_memory_store, settings
from .services.injection import build_context
from .routes.memory_routes import router as memory_router
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
    ModelPreferenceRequest,
    SummarizeRequest,
    SummarizeResponse,
)

app = FastAPI(title="Synapse Backend", version="0.1.0")
api_router = APIRouter(prefix="/api", tags=["api"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _prepare_chat_messages(
    request: ChatRequest,
    store: MemoryStore,
) -> Tuple[List[dict], List[str], str]:
    base_messages = [message.model_dump() for message in request.messages]
    messages: List[dict] = []
    used_memory_ids: List[str] = []

    if request.system and request.system.strip():
        messages.append({"role": "system", "content": request.system.strip()})

    context_message = None
    context_preview = ""

    selected = store.get_memories_by_ids(request.include_memories) if request.include_memories else []
    if selected:
        used_memory_ids = [memory.id for memory in selected]

    latest_user_query = ""
    for message in reversed(request.messages):
        if message.role == "user":
            latest_user_query = message.content
            break

    context_source = selected if request.inject_memories and not request.auto_suggest else []
    context_preview, auto_ids = build_context(
        context_source,
        latest_user_query,
        use_vectors=request.auto_suggest,
        fetch_memories_by_ids=store.get_memories_by_ids,
    )

    if context_preview:
        context_message = {
            "role": "system",
            "content": context_preview,
        }

    if auto_ids:
        used_memory_ids.extend(auto_ids)
        deduped = []
        seen = set()
        for memory_id in used_memory_ids:
            if memory_id in seen:
                continue
            deduped.append(memory_id)
            seen.add(memory_id)
        used_memory_ids = deduped

    if context_message:
        messages.append(context_message)

    messages.extend(base_messages)

    return messages, used_memory_ids, context_preview


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
async def list_models(
    force: bool = Query(False),
    router: LLMRouter = Depends(get_llm_router),
) -> ModelListResponse:
    try:
        payload = router.get_models(force=force)
        for model in payload.models:
            if not model.type:
                model.type = "local" if model.provider == "ollama" else "cloud"
        logging.info(
            "Model list returned with status %s, models=%s",
            payload.ollama_status,
            len(payload.models),
        )
        return payload
    except Exception as exc:  # pragma: no cover
        logging.exception("Failed to load models")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@api_router.post("/models/preferences")
async def update_model_preferences(
    request: ModelPreferenceRequest,
    router: LLMRouter = Depends(get_llm_router),
) -> dict:
    router.update_preferences(request.preferences)
    return {"status": "ok", "updated": len(request.preferences)}


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
    messages, used_memory_ids, context_preview = _prepare_chat_messages(request, store)
    result = await router.chat(messages=messages, model=request.model)

    return ChatResponse(
        model=result["model"],
        provider=result["provider"],
        content=result["content"],
        used_memories=used_memory_ids,
        placeholder=result.get("placeholder", False),
        stats=result.get("stats"),
        context_preview=context_preview,
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
    messages, used_memory_ids, context_preview = _prepare_chat_messages(request, store)

    async def event_generator():
        async for chunk in router.stream_chat(messages=messages, model=request.model):
            payload = {
                **chunk,
                "used_memories": used_memory_ids,
                "context_preview": context_preview,
            }
            yield json.dumps(payload).encode("utf-8") + b"\n"

    return StreamingResponse(event_generator(), media_type="application/json")


@app.get("/")
async def root() -> JSONResponse:
    return JSONResponse({"service": "Synapse Backend", "version": "0.1.0"})


@app.get("/api/health")
async def api_health() -> dict:
    return {"status": "ok"}


app.include_router(memory_router)
app.include_router(api_router)
