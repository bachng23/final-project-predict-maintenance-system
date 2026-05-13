from __future__ import annotations

import argparse
import asyncio
import time
from datetime import datetime, timezone

import httpx


async def run_safety_veto_demo(url: str) -> int:
    snapshot = {
        "bearing_id": "demo-veto",
        "prediction_id": "demo-pred",
        "trigger_source": "ANOMALY_TRIGGER",
        "prediction": {
            "bearing_id": "demo-veto",
            "file_idx": 1,
            "sample_ts": datetime.now(timezone.utc).isoformat(),
            "rul_minutes": 10.0,
            "p_fail": 0.55,
            "health_score": 65.0,
            "model_version": "demo",
        },
        "safety_context": {
            "violated": ["vibration_rms_h"],
            "vibration_rms_h_actual": 22.5,
        },
    }

    start = time.perf_counter()
    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.post(f"{url.rstrip('/')}/negotiate", json=snapshot)
    elapsed_ms = (time.perf_counter() - start) * 1000.0
    resp.raise_for_status()
    result = resp.json()

    assert result["safety_veto"] is True
    assert result["recommended_action"] == "STOP"

    print("\n[Safety Veto Demo]")
    print(f"  Response: {result['recommended_action']} (veto={result['safety_veto']})")
    print(f"  Latency:  {elapsed_ms:.0f}ms (no LLM called)")
    print(f"  Reason:   {result['reasoning_summary']}")
    if elapsed_ms > 200:
        print("  WARNING: latency exceeded 200ms target")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://localhost:8001")
    args = parser.parse_args()
    return asyncio.run(run_safety_veto_demo(args.url))


if __name__ == "__main__":
    raise SystemExit(main())
