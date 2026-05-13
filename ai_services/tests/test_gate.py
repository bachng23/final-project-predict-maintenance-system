from datetime import datetime, timezone

import pytest

from orchestrator.gate import decision_gate
from shared.schemas import PredictionRecord, SnapshotPayload


def make_snapshot(
    *,
    p_fail: float,
    rul_uncertainty: float | None = 0.02,
    safety_context: dict | None = None,
) -> SnapshotPayload:
    prediction = PredictionRecord(
        bearing_id="bearing-1",
        file_idx=1,
        sample_ts=datetime.now(timezone.utc),
        rul_minutes=120.0,
        rul_uncertainty=rul_uncertainty,
        p_fail=p_fail,
        health_score=80.0,
        model_version="test-v0",
    )
    return SnapshotPayload(
        bearing_id="bearing-1",
        prediction_id="prediction-1",
        trigger_source="ANOMALY_TRIGGER",
        prediction=prediction,
        safety_context=safety_context or {},
    )


@pytest.mark.parametrize(
    ("snapshot", "expected_routing"),
    [
        (
            make_snapshot(
                p_fail=0.20,
                safety_context={"violated": ["vibration_rms_h"]},
            ),
            "STOP",
        ),
        (make_snapshot(p_fail=0.85), "STOP"),
        (make_snapshot(p_fail=0.15, rul_uncertainty=0.001), "CONTINUE"),
        (make_snapshot(p_fail=0.50, rul_uncertainty=0.06), "INSPECT"),
        (make_snapshot(p_fail=0.55, rul_uncertainty=0.02), "NEGOTIATE"),
    ],
)
def test_decision_gate_routes_by_priority(snapshot: SnapshotPayload, expected_routing: str):
    assert decision_gate(snapshot).routing == expected_routing


def test_decision_gate_marks_safety_veto_only_for_stop_rule():
    result = decision_gate(make_snapshot(p_fail=0.85))

    assert result.safety_veto is True
    assert result.priority == "CRITICAL"
