from __future__ import annotations

import asyncio
from typing import Any, Dict, Mapping, Sequence, Union, List, Optional, Tuple

import logging
import time

import requests
from litellm import completion, model_cost, token_counter

from .config import Settings, get_settings
from .models import ChatMessage, MemoryRecord, ModelInfo


class LLMRouter:
    """Thin wrapper around LiteLLM to keep model routing logic in one place."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()
        self.ollama_online = False
        self.ollama_tags: List[str] = []
        self._probe_ollama(initial=True)

    @property
    def models(self) -> List[ModelInfo]:
        self._probe_ollama()
        infos: List[ModelInfo] = []
        candidates = list(self.settings.allowed_models)
        if self.ollama_online:
            for tag in self.ollama_tags:
                candidate = f"ollama/{tag}"
                if candidate not in candidates:
                    candidates.append(candidate)

        seen = set()
        for name in candidates:
            provider = self._provider_from_model(name)
            description = None
            if provider == "ollama" and not self.ollama_online:
                description = "Ollama offline"
            if name in seen:
                continue
            seen.add(name)
            category = "local" if provider == "ollama" else "cloud"
            context_limit = self._model_limit(name)
            cost = self._model_cost(name)
            infos.append(
                ModelInfo(
                    name=name,
                    provider=provider,
                    default=name == self.settings.default_model,
                    description=description or f"{provider} model ({name})",
                    category=category,
                    context_limit=context_limit,
                    cost_per_1k=cost,
                )
            )

        if self.ollama_online and not self.ollama_tags:
            infos.append(
                ModelInfo(
                    name="ollama/—",
                    provider="ollama",
                    description="No local models installed",
                    default=False,
                )
            )

        if not self.ollama_online:
            infos.append(
                ModelInfo(
                    name="ollama/offline",
                    provider="ollama",
                    description="Ollama offline",
                    default=False,
                )
            )
        return infos

    async def chat(
        self,
        messages: Sequence[Union[ChatMessage, Mapping[str, Any]]],
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        model_name = model or self.settings.default_model
        if self._provider_from_model(model_name) == "ollama" and not self.ollama_online:
            self._probe_ollama()
        normalised = []
        for message in messages:
            if isinstance(message, ChatMessage):
                normalised.append(message.model_dump())
            else:
                normalised.append({**message})

        provider = self._provider_from_model(model_name)

        payload = {
            "model": model_name,
            "messages": normalised,
        }
        stats = self._context_stats(normalised, model_name)

        api_key = self.settings.provider_keys.get(provider)
        if api_key:
            payload["api_key"] = api_key

        provider_api_base = self.settings.provider_api_bases.get(provider)

        if provider == "ollama" and not provider_api_base:
            provider_api_base = self.settings.ollama_base_url

        if provider_api_base:
            payload["api_base"] = provider_api_base
        elif self.settings.litellm_api_base:
            payload["api_base"] = self.settings.litellm_api_base

        try:
            response = await self._complete(payload)
        except Exception as exc:  # pragma: no cover
            return self._placeholder_payload(normalised, model_name, exc, stats)

        choice = response["choices"][0] if isinstance(response, dict) else response.choices[0]
        message = choice["message"] if isinstance(choice, dict) else choice.message
        content = message["content"] if isinstance(message, dict) else message.content

        result = {
            "content": content,
            "model": model_name,
            "provider": provider,
            "placeholder": False,
            "stats": stats,
        }

        usage = getattr(response, "usage", None) if hasattr(response, "usage") else None
        if usage is None and isinstance(response, dict):
            usage = response.get("usage")
        if usage and isinstance(usage, dict):
            prompt_tokens = usage.get("prompt_tokens") or usage.get("total_tokens")
            if prompt_tokens:
                stats["token_count"] = prompt_tokens
                if stats.get("model_limit"):
                    stats["percent_used"] = self._percent(stats["token_count"], stats["model_limit"])

        return result


    async def stream_chat(
        self,
        messages: Sequence[Union[ChatMessage, Mapping[str, Any]]],
        model: Optional[str] = None,
    ):
        result = await self.chat(messages, model=model)
        content = result["content"]
        provider = result.get("provider")
        model_name = result["model"]
        placeholder = result.get("placeholder", False)
        stats = result.get("stats")

        for token in self._chunk_content(content):
            yield {"event": "token", "content": token}
            await asyncio.sleep(0)

        yield {
            "event": "complete",
            "content": content,
            "model": model_name,
            "provider": provider,
            "placeholder": placeholder,
            "stats": stats,
        }

    async def summarize(
        self,
        messages: Sequence[Mapping[str, Any]],
        mode: str = "summary",
        model: Optional[str] = None,
        max_tokens: int = 512,
    ) -> Dict[str, str]:
        summary_model = model or self.settings.summary_model
        instructions = (
            "You are a careful note taker. Provide a crisp summary that captures facts, decisions, "
            "and follow-ups. Avoid embellishing."
            if mode == "summary"
            else "Compress the conversation to essential bullet points while preserving key instructions."
        )
        payload = {
            "model": summary_model,
            "messages": [
                {"role": "system", "content": instructions},
                {
                    "role": "user",
                    "content": "\n\n".join(f"{msg['role']}: {msg['content']}" for msg in messages),
                },
            ],
            "max_tokens": max_tokens,
        }
        response = await self._complete(payload)
        choice = response["choices"][0] if isinstance(response, dict) else response.choices[0]
        message = choice["message"] if isinstance(choice, dict) else choice.message
        content = message["content"] if isinstance(message, dict) else message.content
        return {"summary": content.strip(), "model": summary_model}

    async def analyze_memories(
        self,
        memories: Sequence[MemoryRecord],
        mode: str,
        model: Optional[str] = None,
    ) -> str:
        analysis_model = model or self.settings.analysis_model
        if not memories:
            return "No memories supplied."

        prompt_lines = []
        for memory in memories:
            prompt_lines.append(f"- ({memory.id}) {memory.content}")

        if mode == "contradiction":
            instruction = (
                "Identify any statements that contradict each other. Report the conflicting IDs and details."
            )
        else:
            instruction = "List possible duplicates or highly similar entries with their IDs."

        payload = {
            "model": analysis_model,
            "messages": [
                {"role": "system", "content": instruction},
                {"role": "user", "content": "\n".join(prompt_lines)},
            ],
        }
        response = await self._complete(payload)
        choice = response["choices"][0] if isinstance(response, dict) else response.choices[0]
        message = choice["message"] if isinstance(choice, dict) else choice.message
        return (message["content"] if isinstance(message, dict) else message.content).strip()

    async def _complete(self, payload: Dict[str, Any]):
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: completion(**payload))

    def _provider_from_model(self, model: str) -> str:
        if "/" in model:
            return model.split("/")[0]
        if ":" in model:
            return model.split(":")[0]
        return "openai"  # default guess; adjust as required.

    def _placeholder_payload(
        self,
        messages: Sequence[Mapping[str, Any]],
        model_name: str,
        error: Exception | None = None,
        stats: Optional[dict] = None,
    ) -> Dict[str, Any]:
        last_user = ""
        for message in reversed(messages):
            if message.get("role") == "user":
                last_user = message.get("content", "")
                break

        summary = last_user[:160].strip().replace("\n", " ")
        if last_user and len(last_user) > 160:
            summary += "…"

        base_message = (
            "Placeholder response: upstream model is unavailable right now. "
            "The system received your request"
        )
        if summary:
            base_message += f": \"{summary}\""
        else:
            base_message += "."

        if error:
            base_message += " (diagnostic note: " + str(error) + ")"

        return {
            "content": base_message,
            "model": model_name,
            "provider": "placeholder",
            "placeholder": True,
            "stats": stats or self._context_stats(messages, model_name),
        }

    def _chunk_content(self, text: str, chunk_size: int = 24) -> List[str]:
        if not text:
            return [""]

        words = text.split()
        if not words:
            return [text]

        chunks: List[str] = []
        current: List[str] = []
        current_len = 0

        for word in words:
            if current_len + len(word) + 1 > chunk_size and current:
                chunks.append(" ".join(current) + " ")
                current = [word]
                current_len = len(word)
            else:
                current.append(word)
                current_len += len(word) + (1 if current_len else 0)

        if current:
            chunks.append(" ".join(current))

        return chunks

    def _context_stats(self, messages: Sequence[Mapping[str, Any]], model_name: str) -> Dict[str, Any]:
        token_count = 0
        try:
            token_count = token_counter(messages=list(messages), model=model_name)
        except Exception:
            token_count = sum(len(message.get("content", "").split()) for message in messages)

        model_limit = self._model_limit(model_name)
        percent_used = self._percent(token_count, model_limit)
        return {
            "token_count": int(token_count),
            "model_limit": model_limit,
            "percent_used": percent_used,
        }

    def _model_limit(self, model_name: str) -> Optional[int]:
        if model_name in model_cost:
            limit = model_cost[model_name].get("max_input_tokens")
            if limit:
                return int(limit)

        provider = self._provider_from_model(model_name)
        provider_defaults = {
            "openai": 128000,
            "anthropic": 200000,
            "groq": 128000,
            "ollama": 8000,
        }
        return provider_defaults.get(provider, 128000)

    def _percent(self, token_count: Optional[int], model_limit: Optional[int]) -> Optional[float]:
        if not token_count or not model_limit:
            return None
        return round((token_count / model_limit) * 100, 1)

    def _model_cost(self, model_name: str) -> Optional[float]:
        info = model_cost.get(model_name)
        if not info:
            return None
        cost = info.get("input_cost_per_token")
        if cost:
            return round(cost * 1000, 6)
        return None

    def _probe_ollama(self, initial: bool = False) -> None:
        base_url = self.settings.ollama_base_url.rstrip("/")
        tags_endpoint = f"{base_url}/api/tags"
        attempts = 2 if initial else 1
        for attempt in range(attempts):
            try:
                response = requests.get(tags_endpoint, timeout=2)
                response.raise_for_status()
                data = response.json()
                models = data.get("models", [])
                parsed = []
                for model in models:
                    name = model.get("name") or model.get("tag")
                    if name:
                        parsed.append(name)
                self.ollama_tags = parsed
                self.ollama_online = True
                logging.info("Ollama models discovered: %s", parsed or ["<none>"])
                return
            except Exception as exc:
                logging.warning("Ollama ping failed (%s). Attempt %s/%s", exc, attempt + 1, attempts)
                self.ollama_tags = []
                self.ollama_online = False
                if attempt + 1 < attempts:
                    time.sleep(3)
