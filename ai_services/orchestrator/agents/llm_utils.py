from __future__ import annotations

import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from orchestrator.metrics import agent_llm_latency_seconds
from shared.config import settings
from shared.schemas import AgentTranscriptEntry, RecommendationAction

_PROMPT_DIR = Path(__file__).resolve().parents[1] / "prompts"
_VALID_ACTIONS: set[str] = {"CONTINUE", "INSPECT", "MAINTAIN", "STOP"}


@dataclass
class LLMProvider:
    name: str
    client: Any


class FallbackLLM:
    def __init__(self, providers: list[LLMProvider]):
        self._providers = providers

    @property
    def provider_names(self) -> list[str]:
        return [provider.name for provider in self._providers]

    def invoke(self, prompt: str):
        errors: list[str] = []
        for provider in self._providers:
            try:
                return provider.client.invoke(prompt)
            except Exception as exc:
                errors.append(f"{provider.name}: {exc}")
        raise RuntimeError("All LLM providers failed: " + " | ".join(errors))


def load_prompt(name: str) -> str:
    return (_PROMPT_DIR / name).read_text()


def make_llm(temperature: float = 0.3) -> Any:
    providers: list[LLMProvider] = []

    try:
        providers.append(LLMProvider(name="ollama", client=_make_ollama_llm(temperature)))
    except RuntimeError:
        pass

    try:
        providers.append(LLMProvider(name="openrouter", client=_make_openrouter_llm(temperature)))
    except RuntimeError:
        pass

    if not providers:
        raise RuntimeError("No LLM provider is configured")

    return FallbackLLM(providers)


def _make_ollama_llm(temperature: float) -> Any:
    try:
        from langchain_ollama import ChatOllama
    except ImportError as exc:
        raise RuntimeError("langchain_ollama is not installed") from exc

    return ChatOllama(
        base_url=settings.ollama_url,
        model=settings.OLLAMA_DEFAULT_MODEL,
        format="json",
        temperature=temperature,
    )


def _make_openrouter_llm(temperature: float) -> Any:
    if not settings.OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY is not configured")

    try:
        from langchain_openrouter import ChatOpenRouter
    except ImportError as exc:
        raise RuntimeError("langchain_openrouter is not installed") from exc

    return ChatOpenRouter(
        api_key=settings.OPENROUTER_API_KEY,
        model=settings.OPENROUTER_DEFAULT_MODEL,
        temperature=temperature,
        app_url=settings.OPENROUTER_APP_URL,
        app_title=settings.OPENROUTER_APP_TITLE,
        model_kwargs={"response_format": {"type": "json_object"}},
    )


def build_transcript_summary(entries: list[AgentTranscriptEntry]) -> str:
    if not entries:
        return "No prior agent messages."
    return "\n".join(
        f"- {entry.agent_name} {entry.message_type}: "
        f"{entry.action_candidate or 'NONE'} "
        f"({entry.confidence if entry.confidence is not None else 'n/a'}): "
        f"{entry.reasoning}"
        for entry in entries
    )


def parse_llm_response(content: str) -> tuple[RecommendationAction, float, str, dict]:
    data = json.loads(content)
    action = data.get("action", "INSPECT")
    if action not in _VALID_ACTIONS:
        action = "INSPECT"
    confidence = max(0.0, min(1.0, float(data.get("confidence", 0.5))))
    reasoning = str(data.get("reasoning") or "No reasoning provided.")
    return action, confidence, reasoning, data


def llm_entry(
    *,
    llm: Any,
    prompt: str,
    snapshot_id: str,
    round_no: int,
    agent_name: str,
    message_type: str,
    method: str,
    trace: Any | None = None,
    fallback_reasoning: str = "LLM parse error - defaulting to INSPECT",
) -> AgentTranscriptEntry:
    span = None
    if trace:
        span = trace.span(
            name=f"round_{round_no}/{agent_name}/{message_type.lower()}",
            input=prompt,
            metadata={
                "agent_name": agent_name,
                "round_no": round_no,
                "message_type": message_type,
                "snapshot_id": snapshot_id,
            },
        )

    start = time.perf_counter()
    try:
        response = llm.invoke(prompt)
        action, confidence, reasoning, data = parse_llm_response(response.content)
        if data.get("expected_costs"):
            reasoning = f"{reasoning} Expected costs: {data['expected_costs']}"
    except Exception as exc:
        action, confidence, reasoning = "INSPECT", 0.5, fallback_reasoning
        if "error" not in reasoning.lower():
            reasoning = f"{reasoning}: {exc}"
    finally:
        latency = time.perf_counter() - start
        agent_llm_latency_seconds.labels(agent_name=agent_name, method=method).observe(
            latency
        )
        if span:
            span.end(
                output={
                    "action": action,
                    "confidence": confidence,
                    "reasoning": reasoning,
                },
                metadata={"latency_s": round(latency, 3)},
            )

    return AgentTranscriptEntry(
        snapshot_id=snapshot_id,
        round_no=round_no,
        agent_name=agent_name,
        message_type=message_type,
        action_candidate=action,
        confidence=confidence,
        reasoning=reasoning,
    )
