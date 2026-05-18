from __future__ import annotations

import json
import time
from collections import Counter, defaultdict
from typing import Any

from orchestrator.agents.llm_utils import build_transcript_summary, load_prompt, make_llm
from orchestrator.metrics import agent_llm_latency_seconds
from orchestrator.gate import _determine_priority, _load_thresholds
from shared.schemas import AgentTranscriptEntry, NegotiationRecord, SnapshotPayload


class ManagerAgent:
    name = "manager_agent"

    def __init__(self, thresholds: dict | None = None):
        self._thresholds = thresholds or _load_thresholds()
        try:
            self._llm = make_llm(temperature=0.4)
        except RuntimeError:
            self._llm = None
        self._prompt = load_prompt("manager.txt")

    def aggregate(
        self,
        snapshot: SnapshotPayload,
        votes: list[AgentTranscriptEntry],
        transcript: list[AgentTranscriptEntry],
        round_no: int,
        trace: Any | None = None,
    ) -> NegotiationRecord:
        weighted_scores = self._aggregate_votes(votes)
        prompt = self._format_prompt(snapshot, weighted_scores, transcript)
        manager_span = None
        child_trace = trace
        if trace:
            manager_span = trace.span(
                name="manager/aggregate",
                input=prompt,
                metadata={
                    "agent_name": self.name,
                    "round_no": round_no,
                    "snapshot_id": snapshot.snapshot_id,
                    "vote_count": len(votes),
                },
            )
            child_trace = _SpanTrace(manager_span)
        action, llm_confidence, reasoning = self._self_consistency_decision(
            prompt,
            k=3,
            trace=child_trace,
            snapshot_id=snapshot.snapshot_id,
            round_no=round_no,
        )

        if weighted_scores:
            top_action, top_score = max(weighted_scores.items(), key=lambda item: item[1])
            if llm_confidence < 0.67 or action not in weighted_scores:
                action = top_action
                confidence = top_score
                reasoning = (
                    f"LLM self-consistency was inconclusive. Using weighted agent consensus: "
                    f"{top_action} ({top_score:.2f})."
                )
            else:
                confidence = min(llm_confidence, weighted_scores.get(action, 0.0))
        else:
            confidence = llm_confidence

        safety_veto = any(
            vote.agent_name == "safety_agent"
            and vote.action_candidate == "STOP"
            and (vote.confidence or 0.0) >= 1.0
            for vote in votes
        )

        result = NegotiationRecord(
            snapshot_id=snapshot.snapshot_id,
            recommended_action=action,
            recommended_confidence=confidence,
            priority="CRITICAL" if safety_veto else _determine_priority(snapshot.prediction.p_fail, self._thresholds),
            safety_veto=safety_veto,
            reasoning_summary=reasoning,
            rounds_taken=round_no,
            transcript=transcript,
        )
        if manager_span:
            manager_span.end(
                output={
                    "recommended_action": result.recommended_action,
                    "recommended_confidence": result.recommended_confidence,
                    "safety_veto": result.safety_veto,
                }
            )
        return result

    def _aggregate_votes(self, votes: list[AgentTranscriptEntry]) -> dict[str, float]:
        scores = defaultdict(float)
        for vote in votes:
            if vote.action_candidate and vote.confidence is not None:
                weight = 1.0 / (1.0 - vote.confidence + 1e-6)
                scores[vote.action_candidate] += weight

        total = sum(scores.values()) or 1.0
        return {action: score / total for action, score in scores.items()}

    def _self_consistency_decision(
        self,
        prompt: str,
        k: int = 3,
        trace: Any | None = None,
        snapshot_id: str | None = None,
        round_no: int | None = None,
    ) -> tuple[str, float, str]:
        decisions: list[tuple[str, str]] = []
        llm_available = self._llm is not None
        for idx in range(k):
            # Only open a Langfuse span when an LLM call will actually happen.
            # Otherwise we'd pollute traces with k empty "fallback" spans every
            # time Ollama is offline.
            span = None
            if trace and llm_available:
                span = trace.span(
                    name=f"manager/aggregate/self_consistency_{idx + 1}",
                    input=prompt,
                    metadata={
                        "agent_name": self.name,
                        "round_no": round_no,
                        "message_type": "SUMMARY",
                        "snapshot_id": snapshot_id,
                        "sample": idx + 1,
                    },
                )
            start = time.perf_counter()
            try:
                if not llm_available:
                    raise RuntimeError("LLM unavailable")
                response = self._llm.invoke(prompt)
                data = json.loads(response.content)
                action = data.get("action", "INSPECT")
                reasoning = data.get("reasoning", "")
            except Exception as exc:
                action = "INSPECT"
                reasoning = f"LLM unavailable or parse error - defaulting to INSPECT: {exc}"
            finally:
                latency = time.perf_counter() - start
                agent_llm_latency_seconds.labels(agent_name=self.name, method="aggregate").observe(latency)
                if span:
                    span.end(
                        output={"action": action, "reasoning": reasoning},
                        metadata={"latency_s": round(latency, 3)},
                    )
            decisions.append((action, reasoning))

        counter = Counter(action for action, _ in decisions)
        final_action, count = counter.most_common(1)[0]
        reasoning = next(
            (reason for action, reason in decisions if action == final_action),
            "Manager selected the majority action.",
        )
        return final_action, count / k, reasoning or "Manager selected the majority action."

    def _format_prompt(
        self,
        snapshot: SnapshotPayload,
        weighted_scores: dict[str, float],
        transcript: list[AgentTranscriptEntry],
    ) -> str:
        p = snapshot.prediction
        weighted_scores_text = "\n".join(
            f"- {action}: {score:.2f}" for action, score in sorted(weighted_scores.items())
        ) or "No valid votes."
        return self._prompt.format(
            bearing_id=snapshot.bearing_id,
            p_fail=p.p_fail,
            rul_minutes=p.rul_minutes,
            health_score=p.health_score,
            weighted_scores_text=weighted_scores_text,
            transcript_summary=build_transcript_summary(transcript),
        )


class _SpanTrace:
    def __init__(self, span: Any) -> None:
        self._span = span

    def span(self, *, name: str, metadata: dict[str, Any] | None = None, input: Any = None):
        return self._span.start_observation(
            name=name,
            as_type="span",
            input=input,
            metadata=metadata,
        )
