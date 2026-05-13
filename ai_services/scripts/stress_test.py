from __future__ import annotations

import argparse
import asyncio
import sys
import time
import tracemalloc
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from anomaly.anomaly_detector import AnomalyConfig, AnomalyDetector
from ingestion.producer import XJTUProducer
from predictor.inference import _hi_history
from shared.database import close_pool, get_pool


async def run_stress_test(bearing_ids: list[str], speed: float) -> None:
    tasks = [XJTUProducer(bearing_id=bid, speed=speed).run() for bid in bearing_ids]
    await asyncio.gather(*tasks)


async def assert_state_isolation(bearing_ids: list[str]) -> dict[str, int]:
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT b.bearing_id, COUNT(*) AS cnt
        FROM predictions p
        JOIN bearings b ON b.id = p.bearing_id
        WHERE b.bearing_id = ANY($1::text[])
        GROUP BY b.bearing_id
        """,
        bearing_ids,
    )
    counts = {row["bearing_id"]: row["cnt"] for row in rows}
    for bearing_id in bearing_ids:
        count = counts.get(bearing_id, 0)
        if count <= 0:
            raise AssertionError(f"{bearing_id}: no predictions found")
    return counts


def check_hi_history_growth(expected_bearings: int) -> None:
    size = len(_hi_history)
    if size > expected_bearings + 5:
        raise AssertionError(f"_hi_history has {size} entries, expected <= {expected_bearings + 5}")


def check_anomaly_detector_isolation(bearing_ids: list[str]) -> int:
    detector = AnomalyDetector(AnomalyConfig())
    for bearing_id in bearing_ids:
        detector.update(bearing_id, 1, 0.1, 1.0, 100.0)
    if len(detector._states) != len(bearing_ids):
        raise AssertionError("AnomalyDetector did not keep per-bearing isolated states")
    detector.update(bearing_ids[0], 1, 0.1, 1.0, 100.0)
    if len(detector._states) != len(bearing_ids):
        raise AssertionError("AnomalyDetector replay reset leaked into other bearings")
    return len(detector._states)


async def main_async(args: argparse.Namespace) -> int:
    started = time.perf_counter()
    tracemalloc.start()
    print("─" * 57)
    print(f"Multi-bearing Stress Test: {len(args.bearings)} bearings @ {args.speed:g}x speed")
    print("─" * 57)
    try:
        await run_stress_test(args.bearings, args.speed)
        counts = await assert_state_isolation(args.bearings)
        for bearing_id in args.bearings:
            print(f"[OK] {bearing_id}: {counts[bearing_id]} predictions (no state contamination)")
        check_hi_history_growth(len(args.bearings))
        print(f"[OK] _hi_history size: {len(_hi_history)} (expected <= {len(args.bearings) + 5})")
        state_count = check_anomaly_detector_isolation(args.bearings)
        print(f"[OK] AnomalyDetector states: {state_count} isolated instances")
        current, peak = tracemalloc.get_traced_memory()
        print(f"[OK] Memory: current={current / 1024 / 1024:.1f}MB peak={peak / 1024 / 1024:.1f}MB")
    except Exception as exc:
        print(f"[FAIL] {exc}")
        return 1
    finally:
        await close_pool()
        tracemalloc.stop()

    elapsed = time.perf_counter() - started
    print("─" * 57)
    print(f"STRESS TEST PASSED (elapsed: {elapsed:.0f}s)")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bearings", nargs="+", default=["Bearing2_4", "Bearing2_5", "Bearing3_1"])
    parser.add_argument("--speed", type=float, default=60.0)
    args = parser.parse_args()
    return asyncio.run(main_async(args))


if __name__ == "__main__":
    raise SystemExit(main())
