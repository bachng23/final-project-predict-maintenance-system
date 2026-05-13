from __future__ import annotations

from typing import Any, Optional

from orchestrator.agents.base import BaseAgent
from shared.schemas import AgentTranscriptEntry, RecommendationAction, SnapshotPayload


class SafetyAgent(BaseAgent):
    name = "safety_agent"

    def __init__(self, thresholds: dict, agent_cfg: dict):
        self._thresholds = thresholds
        self._cfg = agent_cfg
        self._my_proposal: AgentTranscriptEntry | None = None

    def propose(
        self,
        snapshot: SnapshotPayload,
        round_no: int,
        trace: Any | None = None,
    ) -> AgentTranscriptEntry:
        action, confidence, reasoning = self._evaluate_snapshot(snapshot)
        self._my_proposal = self._entry(
            snapshot=snapshot,
            round_no=round_no,
            message_type="PROPOSE",
            action_candidate=action,
            confidence=confidence,
            reasoning=reasoning,
        )
        return self._my_proposal

    def critique(
        self,
        snapshot: SnapshotPayload,
        round_no: int,
        other_proposals: list[AgentTranscriptEntry],
        trace: Any | None = None,
    ) -> AgentTranscriptEntry:
        proposal = self._ensure_proposal(snapshot)
        action = proposal.action_candidate
        underestimated = action in {"STOP", "INSPECT"} and any(
            entry.action_candidate == "CONTINUE" for entry in other_proposals
        )

        if underestimated:
            return self._entry(
                snapshot=snapshot,
                round_no=round_no,
                message_type="CRITIQUE",
                action_candidate=action,
                confidence=proposal.confidence,
                reasoning=f"Safety constraint overrides production/cost considerations. {proposal.reasoning}",
            )

        return self._entry(
            snapshot=snapshot,
            round_no=round_no,
            message_type="CRITIQUE",
            action_candidate=None,
            confidence=None,
            reasoning="No safety objection to current proposals.",
        )

    def vote(
        self,
        snapshot: SnapshotPayload,
        round_no: int,
        all_critiques: list[AgentTranscriptEntry],
        trace: Any | None = None,
    ) -> AgentTranscriptEntry:
        proposal = self._ensure_proposal(snapshot)
        return self._entry(
            snapshot=snapshot,
            round_no=round_no,
            message_type="VOTE",
            action_candidate=proposal.action_candidate,
            confidence=proposal.confidence,
            reasoning=proposal.reasoning,
        )

    def _check_violations(self, snapshot: SnapshotPayload) -> list[str]:
        violated = snapshot.safety_context.get("violated", [])
        return list(violated) if violated else []

    def _evaluate_snapshot(
        self,
        snapshot: SnapshotPayload,
    ) -> tuple[RecommendationAction, float, str]:
        prediction = snapshot.prediction
        violated = self._check_violations(snapshot)

        if violated:
            return "STOP", 1.0, f"Safety redline violated: {violated}"

        safety_veto_threshold = self._thresholds["negotiation"]["safety_veto_threshold"]
        if prediction.p_fail >= safety_veto_threshold:
            return (
                "STOP",
                1.0,
                f"P_fail {prediction.p_fail:.2f} exceeds safety veto threshold {safety_veto_threshold:.2f}",
            )

        p_fail_high = self._thresholds["anomaly"]["p_fail_high"]
        rul_critical_min = self._thresholds["anomaly"]["rul_critical_min"]
        if prediction.p_fail >= p_fail_high and prediction.rul_minutes < rul_critical_min:
            return (
                "INSPECT",
                0.90,
                f"High failure probability with critical RUL {prediction.rul_minutes:.0f} min",
            )

        health_score_low = self._thresholds["anomaly"]["health_score_low"]
        if prediction.health_score < health_score_low:
            return (
                "INSPECT",
                0.80,
                f"Health score {prediction.health_score:.1f} below safety threshold {health_score_low:.1f}",
            )

        return "CONTINUE", 0.70, "No safety concerns detected."

    def _ensure_proposal(self, snapshot: SnapshotPayload) -> AgentTranscriptEntry:
        if self._my_proposal is None:
            action, confidence, reasoning = self._evaluate_snapshot(snapshot)
            self._my_proposal = self._entry(
                snapshot=snapshot,
                round_no=1,
                message_type="PROPOSE",
                action_candidate=action,
                confidence=confidence,
                reasoning=reasoning,
            )
        return self._my_proposal

    def _entry(
        self,
        snapshot: SnapshotPayload,
        round_no: int,
        message_type: str,
        action_candidate: Optional[RecommendationAction],
        confidence: Optional[float],
        reasoning: str,
    ) -> AgentTranscriptEntry:
        return AgentTranscriptEntry(
            snapshot_id=snapshot.snapshot_id,
            round_no=round_no,
            agent_name=self.name,
            message_type=message_type,
            action_candidate=action_candidate,
            confidence=confidence,
            reasoning=reasoning,
        )
