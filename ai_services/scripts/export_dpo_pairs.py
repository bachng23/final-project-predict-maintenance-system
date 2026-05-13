from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from orchestrator.metrics import override_rate
from shared.database import close_pool, get_pool


def _json_default(value: Any) -> str:
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _as_dict(value: Any) -> dict:
    if value is None:
        return {}
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        return json.loads(value)
    return dict(value)


async def _update_override_rate_gauge(pool) -> None:
    row = await pool.fetchrow(
        """
        SELECT
            COUNT(*) FILTER (WHERE action = 'OVERRIDE') AS overrides,
            COUNT(*) AS total
        FROM decision_actions
        WHERE submitted_at > NOW() - INTERVAL '1 hour'
        """
    )
    total = row["total"] if row else 0
    override_rate.set((row["overrides"] / total) if total else 0.0)


async def export_dpo_pairs(output_path: Path, min_confidence_gap: float = 0.0) -> list[dict]:
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT
            op.snapshot_id,
            b.bearing_id,
            op.ai_recommended_action,
            op.human_selected_action,
            op.override_reason,
            op.confidence_gap,
            d.reason_summary,
            s.summary_json,
            op.created_at
        FROM override_preferences op
        JOIN decisions d ON d.id = op.decision_id
        JOIN snapshots s ON s.id = op.snapshot_id
        JOIN bearings b ON b.id = s.bearing_id
        WHERE op.human_selected_action != op.ai_recommended_action
          AND op.override_reason IS NOT NULL
          AND COALESCE(op.confidence_gap, 0) >= $1
        ORDER BY op.created_at DESC
        """,
        min_confidence_gap,
    )

    pairs: list[dict] = []
    for row in rows:
        summary = _as_dict(row["summary_json"])
        if not summary:
            continue
        pair = {
            "snapshot_id": str(row["snapshot_id"]),
            "bearing_id": row["bearing_id"],
            "timestamp": row["created_at"].isoformat(),
            "context": {
                "p_fail": summary.get("p_fail"),
                "rul_minutes": summary.get("rul_minutes"),
                "health_score": summary.get("health_score"),
                "fault_type": summary.get("fault_type"),
                "hybrid_score": summary.get("hybrid_score"),
                "uncertainty": summary.get("uncertainty"),
            },
            "ai_reasoning": row["reason_summary"],
            "chosen": {
                "action": row["human_selected_action"],
                "source": "operator_override",
                "reason": row["override_reason"],
            },
            "rejected": {
                "action": row["ai_recommended_action"],
                "source": "ai_recommendation",
                "confidence_gap": row["confidence_gap"],
            },
        }
        pairs.append(pair)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        for pair in pairs:
            f.write(json.dumps(pair, default=_json_default) + "\n")

    await _update_override_rate_gauge(pool)
    print(f"Exported {len(pairs)} DPO pairs -> {output_path}")
    return pairs


async def main_async(args: argparse.Namespace) -> int:
    try:
        await export_dpo_pairs(args.output, args.min_confidence_gap)
    finally:
        await close_pool()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("dpo_pairs.jsonl"))
    parser.add_argument("--min-confidence-gap", type=float, default=0.0)
    args = parser.parse_args()
    return asyncio.run(main_async(args))


if __name__ == "__main__":
    raise SystemExit(main())
