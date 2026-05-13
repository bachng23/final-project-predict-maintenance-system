from __future__ import annotations

from typing import Any

from orchestrator.agents.base import BaseAgent
from orchestrator.agents.llm_utils import build_transcript_summary, llm_entry, load_prompt, make_llm
from shared.schemas import AgentTranscriptEntry, SnapshotPayload


class CostAgent(BaseAgent):
    name = "cost_agent"

    def __init__(self, thresholds: dict | None = None, agent_cfg: dict | None = None):
        self._thresholds = thresholds or {}
        self._cfg = agent_cfg or {}
        try:
            self._llm = make_llm(temperature=0.2)
        except RuntimeError:
            self._llm = None
        self._prompt = load_prompt("cost.txt")

    def propose(self, snapshot: SnapshotPayload, round_no: int, trace: Any | None = None) -> AgentTranscriptEntry:
        return self._call(snapshot, round_no, "PROPOSE", "propose", trace=trace)

    def critique(
        self,
        snapshot: SnapshotPayload,
        round_no: int,
        other_proposals: list[AgentTranscriptEntry],
        trace: Any | None = None,
    ) -> AgentTranscriptEntry:
        return self._call(
            snapshot,
            round_no,
            "CRITIQUE",
            "critique",
            extra_context=f"\nOther proposals:\n{build_transcript_summary(other_proposals)}",
            trace=trace,
        )

    def vote(
        self,
        snapshot: SnapshotPayload,
        round_no: int,
        all_critiques: list[AgentTranscriptEntry],
        trace: Any | None = None,
    ) -> AgentTranscriptEntry:
        return self._call(
            snapshot,
            round_no,
            "VOTE",
            "vote",
            extra_context=f"\nCritiques heard:\n{build_transcript_summary(all_critiques)}",
            trace=trace,
        )

    def _call(
        self,
        snapshot: SnapshotPayload,
        round_no: int,
        message_type: str,
        method: str,
        extra_context: str = "",
        trace: Any | None = None,
    ) -> AgentTranscriptEntry:
        prompt = self._format_prompt(snapshot) + extra_context
        return llm_entry(
            llm=self._llm,
            prompt=prompt,
            snapshot_id=snapshot.snapshot_id,
            round_no=round_no,
            agent_name=self.name,
            message_type=message_type,
            method=method,
            trace=trace,
        )

    def _format_prompt(self, snapshot: SnapshotPayload) -> str:
        costs = self._expected_costs(snapshot)
        p = snapshot.prediction
        return self._prompt.format(
            bearing_id=snapshot.bearing_id,
            p_fail=p.p_fail,
            rul_minutes=p.rul_minutes,
            **costs,
        )

    def _expected_costs(self, snapshot: SnapshotPayload) -> dict[str, float]:
        ctx = snapshot.cost_context
        c_planned = float(ctx.get("C_planned", 1000))
        c_emergency = float(ctx.get("C_emergency", c_planned * self._cfg.get("failure_cost_multiplier", 8.0)))
        c_inspect = float(ctx.get("C_inspect", 200))
        p_fail = snapshot.prediction.p_fail
        return {
            "e_continue": p_fail * c_emergency,
            "e_inspect": c_inspect + (p_fail * 0.3 * c_emergency),
            "e_maintain": c_planned,
            "e_stop": c_planned * 0.5,
        }
