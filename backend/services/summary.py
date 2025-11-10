from __future__ import annotations

import logging

try:  # pragma: no cover
    from litellm import completion
except ImportError:  # pragma: no cover
    completion = None

DEFAULT_MODEL = "gpt-4o-mini"


def summarize(text: str, model: str = DEFAULT_MODEL) -> str:
    """Return a concise summary for long memories."""
    if not text:
        return ""
    if len(text) < 500 or completion is None:
        return text
    prompt = f"Summarize this memory in <= 100 words while preserving concrete facts:\n\n{text}"
    try:
        response = completion(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=220,
            temperature=0,
        )
        choice = response["choices"][0] if isinstance(response, dict) else response.choices[0]
        message = choice["message"] if isinstance(choice, dict) else choice.message
        content = message["content"] if isinstance(message, dict) else message.content
        return (content or "").strip() or text[:400]
    except Exception as exc:  # pragma: no cover - network/LLM failures
        logging.warning("Memory summary generation failed: %s", exc)
        return text[:400]
