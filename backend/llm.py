from __future__ import annotations

import asyncio
from typing import Any, Dict, Mapping, Sequence, Union, List, Optional

from litellm import completion, model_cost, token_counter

from .config import Settings, get_settings
from .models import ChatMessage, ModelInfo


class LLMRouter:
    """Thin wrapper around LiteLLM to keep model routing logic in one place."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()

    @property
    def models(self) -> List[ModelInfo]:
        infos: List[ModelInfo] = []
        for name in self.settings.allowed_models:
            provider = self._provider_from_model(name)
            infos.append(
                ModelInfo(
                    name=name,
                    provider=provider,
                    default=name == self.settings.default_model,
                    description=f"{provider} model ({name})",
                )
            )
        return infos

    async def chat(
        self,
        messages: Sequence[Union[ChatMessage, Mapping[str, Any]]],
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        model_name = model or self.settings.default_model
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

        loop = asyncio.get_running_loop()
        try:
            response = await loop.run_in_executor(None, lambda: completion(**payload))
        except Exception as exc:  # pragma: no cover - explicit runtime feedback for operators.
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

        usage = None
        if isinstance(response, dict):
            usage = response.get("usage")
        elif hasattr(response, "usage"):
            usage = getattr(response, "usage")
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
