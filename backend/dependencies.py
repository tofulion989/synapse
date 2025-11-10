from __future__ import annotations

from .config import get_settings
from .llm import LLMRouter
from .memory import MemoryStore

settings = get_settings()
memory_store = MemoryStore(settings=settings)
llm_router = LLMRouter(settings=settings)


def get_memory_store() -> MemoryStore:
    return memory_store


def get_llm_router() -> LLMRouter:
    return llm_router
