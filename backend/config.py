from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from threading import Lock
from typing import Dict, List

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - optional dependency
    load_dotenv = None

_ENV_LOADED = False
_ENV_LOCK = Lock()


def _load_env_file(path: str = ".env") -> None:
    """
    Load environment variables from .env, preferring python-dotenv if available
    to honour quoting and unicode handling.
    """
    global _ENV_LOADED
    if _ENV_LOADED:
        return

    with _ENV_LOCK:
        if _ENV_LOADED:
            return

        env_path = Path(path)
        if load_dotenv is not None:
            load_dotenv(env_path, override=True)
        elif env_path.exists():
            for line in env_path.read_text().splitlines():
                stripped = line.strip()
                if not stripped or stripped.startswith("#"):
                    continue
                key, _, value = stripped.partition("=")
                key = key.strip()
                if not key:
                    continue
                value = value.strip().strip("'\"")
                os.environ[key] = value

        _ENV_LOADED = True


@dataclass(slots=True)
class Settings:
    """Centralised runtime configuration."""

    default_model: str = field(init=False)
    allowed_models: List[str] = field(init=False)
    litellm_api_base: str | None = field(init=False)
    chroma_path: Path = field(init=False)
    sqlite_db: Path = field(init=False)
    memory_raw_dir: Path = field(init=False)
    memory_manual_dir: Path = field(init=False)
    conversation_dir: Path = field(init=False)
    ollama_base_url: str = field(init=False)
    ollama_model: str = field(init=False)
    provider_keys: Dict[str, str] = field(init=False)
    provider_api_bases: Dict[str, str] = field(init=False)

    def __post_init__(self) -> None:
        _load_env_file()

        self.default_model = os.getenv("DEFAULT_MODEL", "ollama/mistral")
        self.ollama_base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self.ollama_model = os.getenv("OLLAMA_MODEL", "mistral")

        allowed_raw = [
            model.strip()
            for model in os.getenv("ALLOWED_MODELS", "").split(",")
            if model.strip()
        ]

        self.litellm_api_base = os.getenv("LITELLM_API_BASE") or None

        base_data_dir = Path(os.getenv("DATA_ROOT", "./data")).resolve()

        chroma_env = os.getenv("CHROMA_PATH")
        sqlite_env = os.getenv("SQLITE_DB")
        raw_env = os.getenv("MEMORY_RAW_DIR")
        manual_env = os.getenv("MEMORY_MANUAL_DIR")
        convo_env = os.getenv("CONVERSATION_DIR")

        self.chroma_path = Path(chroma_env).resolve() if chroma_env else (base_data_dir / "vector_store").resolve()
        self.sqlite_db = Path(sqlite_env).resolve() if sqlite_env else (base_data_dir / "synapse.db").resolve()
        self.memory_raw_dir = Path(raw_env).resolve() if raw_env else (base_data_dir / "memories/raw").resolve()
        self.memory_manual_dir = Path(manual_env).resolve() if manual_env else (base_data_dir / "memories/manual").resolve()
        self.conversation_dir = Path(convo_env).resolve() if convo_env else (base_data_dir / "conversations").resolve()

        self.provider_keys = {}
        for provider, env_var in [
            ("openai", "OPENAI_API_KEY"),
            ("anthropic", "ANTHROPIC_API_KEY"),
            ("groq", "GROQ_API_KEY"),
        ]:
            value = os.getenv(env_var)
            if value:
                self.provider_keys[provider] = value
                os.environ[env_var] = value  # ensure downstream libs (LiteLLM) see the key

        self.provider_api_bases = {}
        for provider, env_var in [
            ("openai", "OPENAI_API_BASE"),
            ("anthropic", "ANTHROPIC_API_BASE"),
            ("groq", "GROQ_API_BASE"),
        ]:
            value = os.getenv(env_var)
            if value:
                self.provider_api_bases[provider] = value
                os.environ[env_var] = value

        self.allowed_models = self._derive_allowed_models(allowed_raw)

        self._ensure_directories()

    def _ensure_directories(self) -> None:
        for directory in {self.chroma_path, self.memory_raw_dir, self.memory_manual_dir, self.conversation_dir, self.sqlite_db.parent}:
            directory.mkdir(parents=True, exist_ok=True)

    def _derive_allowed_models(self, explicit: List[str]) -> List[str]:
        models: List[str] = []

        if explicit:
            models.extend(explicit)

        # Always include default model
        if self.default_model not in models:
            models.append(self.default_model)

        # Ollama default
        if f"ollama/{self.ollama_model}" not in models:
            models.append(f"ollama/{self.ollama_model}")

        provider_defaults = {
            "openai": ["openai/gpt-4o", "openai/gpt-4o-mini", "openai/gpt-4.1-mini"],
            "anthropic": ["anthropic/claude-3-5-sonnet", "anthropic/claude-3-opus"],
            "groq": ["groq/llama-3.1-70b", "groq/llama-3.1-8b"],
        }

        for provider, defaults in provider_defaults.items():
            if provider in self.provider_keys:
                for model in defaults:
                    if model not in models:
                        models.append(model)

        # Deduplicate while preserving order
        seen = set()
        unique_models = []
        for model in models:
            if model in seen:
                continue
            seen.add(model)
            unique_models.append(model)
        return unique_models


_settings_instance: Settings | None = None
_settings_lock = Lock()


def get_settings() -> Settings:
    """Return a singleton Settings instance."""
    global _settings_instance
    if _settings_instance is None:
        with _settings_lock:
            if _settings_instance is None:
                _settings_instance = Settings()
    return _settings_instance
