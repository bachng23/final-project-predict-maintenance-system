from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal

import yaml

from shared.schemas import PriorityLevel, SnapshotPayload

GateRouting = Literal["STOP", "CONTINUE", "INSPECT", "NEGOTIATE"]

_CONFIG_PATH = Path(__file__).parent.parent / "configs" / "thresholds.yaml"


@dataclass(frozen=True)
class GateResult:
    routing: GateRouting
    reason: str
    safety_veto: bool
    priority: PriorityLevel


def _load_thresholds() -> dict:
    with open(_CONFIG_PATH) as f:
        return yaml.safe_load(f)


def decision_gate(snapshot: SnapshotPayload) -> GateResult:
    cfg = _load_thresholds()
    prediction = snapshot.prediction
    p_fail = prediction.p_fail
    violated = snapshot.safety_context.get("violated", [])

    safety_veto_threshold = cfg["negotiation"]["safety_veto_threshold"]
    if violated or p_fail >= safety_veto_threshold:
        reason = (
            f"Safety redline violated: {violated}"
            if violated
            else f"P_fail {p_fail:.2f} exceeds safety veto threshold {safety_veto_threshold:.2f}"
        )
        return GateResult(
            routing="STOP",
            reason=reason,
            safety_veto=True,
            priority="CRITICAL",
        )

    p_fail_high = cfg["anomaly"]["p_fail_high"]
    if p_fail < p_fail_high and prediction.uncertainty_label == "low":
        return GateResult(
            routing="CONTINUE",
            reason="Low failure probability with low uncertainty.",
            safety_veto=False,
            priority="LOW",
        )

    if prediction.uncertainty_label == "high":
        return GateResult(
            routing="INSPECT",
            reason="High model uncertainty requires inspection.",
            safety_veto=False,
            priority="HIGH",
        )

    return GateResult(
        routing="NEGOTIATE",
        reason="Risk requires multi-agent negotiation.",
        safety_veto=False,
        priority=_determine_priority(p_fail, cfg),
    )


def _determine_priority(p_fail: float, cfg: dict) -> PriorityLevel:
    priority_cfg = cfg["priority"]
    if p_fail >= priority_cfg["critical_p_fail"]:
        return "CRITICAL"
    if p_fail >= priority_cfg["high_p_fail"]:
        return "HIGH"
    if p_fail >= priority_cfg["medium_p_fail"]:
        return "MEDIUM"
    return "LOW"
