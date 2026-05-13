from __future__ import annotations

import hashlib
from typing import Any

from langfuse import Langfuse

from shared.config import settings

_client: Langfuse | None = None


def get_langfuse() -> Langfuse:
    global _client
    if _client is None:
        _client = Langfuse(
            public_key=settings.LANGFUSE_PUBLIC_KEY,
            secret_key=settings.LANGFUSE_SECRET_KEY,
            host=settings.LANGFUSE_HOST,
        )
    return _client


def flush() -> None:
    if _client:
        _client.flush()


def create_trace(
    *,
    name: str,
    trace_id: str,
    metadata: dict[str, Any],
    input: dict[str, Any] | None = None,
) -> LangfuseTrace:
    return LangfuseTrace(get_langfuse(), name=name, trace_id=trace_id, metadata=metadata, input=input)


class LangfuseTrace:
    """Small compatibility wrapper around Langfuse v4 observations."""

    def __init__(
        self,
        client: Langfuse,
        *,
        name: str,
        trace_id: str,
        metadata: dict[str, Any],
        input: dict[str, Any] | None = None,
    ) -> None:
        self.client = client
        self.trace_id = _normalize_trace_id(trace_id)
        self.root = client.start_observation(
            name=name,
            trace_context={"trace_id": self.trace_id},
            as_type="span",
            input=input,
            metadata=metadata,
        )

    def span(self, *, name: str, metadata: dict[str, Any] | None = None, input: Any = None):
        return self.root.start_observation(
            name=name,
            as_type="span",
            input=input,
            metadata=metadata,
        )

    def update(self, *, output: Any = None, metadata: dict[str, Any] | None = None) -> None:
        self.root.update(output=output, metadata=metadata)
        self.root.end(output=output)


def _normalize_trace_id(value: str) -> str:
    compact = value.replace("-", "").lower()
    if len(compact) == 32 and all(char in "0123456789abcdef" for char in compact):
        return compact
    return hashlib.md5(value.encode("utf-8")).hexdigest()
