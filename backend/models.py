from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, validator


class ChatMessage(BaseModel):
    role: str = Field(..., description="OpenAI-style chat role identifier (system|user|assistant).")
    content: str = Field(..., description="Natural language content of the message.")

    @validator("role")
    def _normalise_role(cls, value: str) -> str:
        role = value.strip().lower()
        if role not in {"system", "user", "assistant"}:
            raise ValueError("role must be one of system, user, assistant")
        return role

    @validator("content")
    def _content_not_empty(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("content cannot be empty")
        return value


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(..., description="Conversation history in chronological order.")
    model: Optional[str] = Field(None, description="Override model identifier; defaults to configured model.")
    include_memories: List[str] = Field(default_factory=list, description="Memory IDs to retrieve and inject.")
    inject_memories: bool = Field(True, description="If false, do not prepend memory content to the prompt.")
    stream: bool = Field(False, description="Enable streaming responses (future enhancement).")
    system: Optional[str] = Field(None, description="Optional system prompt prepended before context.")


class ChatResponse(BaseModel):
    model: str
    provider: Optional[str] = None
    content: str
    used_memories: List[str] = Field(default_factory=list)
    placeholder: bool = False
    stats: Optional["UsageStats"] = None


class MemoryCreate(BaseModel):
    content: str = Field(..., description="Core memory text snippet.")
    title: Optional[str] = Field(None, description="Optional short label for the memory.")
    tags: List[str] = Field(default_factory=list, description="Keyword tags (e.g. #project, #idea).")

    @validator("tags", each_item=True)
    def _normalise_tag(cls, tag: str) -> str:
        cleaned = tag.strip()
        if not cleaned:
            raise ValueError("tags cannot be blank")
        if not cleaned.startswith("#"):
            cleaned = f"#{cleaned}"
        return cleaned.lower()


class MemoryRecord(MemoryCreate):
    id: str
    created_at: datetime
    updated_at: datetime
    score: Optional[float] = Field(None, description="Optional similarity score when returned from search.")


class MemoryImportRecord(BaseModel):
    id: Optional[str] = None
    title: Optional[str] = None
    content: str
    tags: List[str] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class MemoryImportRequest(BaseModel):
    memories: List[MemoryImportRecord] = Field(default_factory=list)


class ModelInfo(BaseModel):
    name: str
    provider: str
    description: Optional[str] = None
    default: bool = False


class UsageStats(BaseModel):
    token_count: int
    model_limit: Optional[int] = None
    percent_used: Optional[float] = None


ChatResponse.model_rebuild()
