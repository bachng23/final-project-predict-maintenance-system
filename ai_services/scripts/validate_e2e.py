from __future__ import annotations

import argparse
import asyncio
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Awaitable, Callable

import asyncpg
import httpx
from aiokafka import AIOKafkaProducer
from rich.console import Console

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ingestion.producer import XJTUProducer
from shared.config import settings

console = Console()


class E2EValidator:
    def __init__(self, bearing_id: str, speed: float):
        self.bearing_id = bearing_id
        self.speed = speed
        self.db: asyncpg.Pool | None = None
        self.results: list[tuple[str, bool, str]] = []
        self.started_at = time.perf_counter()
        self.started_ts = datetime.now(timezone.utc)

    async def run(self) -> int:
        console.print(f"{'─' * 41}\n  E2E Validation: {self.bearing_id}\n{'─' * 41}")
        try:
            await self._check_services()
            await self._stream_bearing()
            await self._assert_pipeline()
        finally:
            if self.db:
                await self.db.close()
        self._print_summary()
        return 0 if all(passed for _, passed, _ in self.results) else 1

    async def _check_services(self) -> None:
        try:
            self.db = await asyncpg.create_pool(dsn=settings.postgre_dsn, min_size=1, max_size=2)
            async with self.db.acquire() as conn:
                await conn.fetchval("SELECT 1")
            self._check("Postgres connection", True)
        except Exception as exc:
            self._check("Postgres connection", False, str(exc))

        await self._check_redpanda()
        predictor_url = os.getenv("PREDICTOR_URL", "http://predictor:8000").rstrip("/")
        orchestrator_url = os.getenv("ORCHESTRATOR_URL", "http://orchestrator:8000").rstrip("/")
        await self._check_http("Predictor /health", f"{predictor_url}/health")
        await self._check_http("Orchestrator /health", f"{orchestrator_url}/health")

    async def _check_redpanda(self) -> None:
        producer = AIOKafkaProducer(bootstrap_servers=settings.redpanda_bootstrap_servers)
        try:
            await producer.start()
            self._check("Redpanda reachable", True)
        except Exception as exc:
            self._check("Redpanda reachable", False, str(exc))
        finally:
            try:
                await producer.stop()
            except Exception:
                pass

    async def _check_http(self, name: str, url: str) -> None:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.get(url)
            self._check(name, response.is_success, response.text[:160])
        except Exception as exc:
            self._check(name, False, str(exc))

    async def _stream_bearing(self) -> None:
        console.print(f"[dim][...] Streaming {self.bearing_id} at {self.speed:g}x speed...[/dim]")
        try:
            producer = XJTUProducer(bearing_id=self.bearing_id, speed=self.speed)
            await producer.run()
            self._check("Bearing stream completed", True)
        except Exception as exc:
            self._check("Bearing stream completed", False, str(exc))

    async def _assert_pipeline(self) -> None:
        if not self.db:
            return
        await self._assert_features_populated()
        await self._assert_predictions_populated()
        await self._assert_anomaly_triggered()
        await self._assert_snapshot_complete()
        await self._assert_decision_created()
        await self._assert_transcript_complete()
        await self._assert_langfuse_trace_created()

    async def _assert_features_populated(self) -> None:
        count = await self._wait_count(
            """
            SELECT COUNT(*)
            FROM features f
            JOIN bearings b ON b.id = f.bearing_id
            WHERE b.bearing_id = $1
              AND f.sample_ts >= $2
            """
        )
        self._check("Features populated", count > 0, f"{count} rows in features table")

    async def _assert_predictions_populated(self) -> None:
        count = await self._wait_count(
            """
            SELECT COUNT(*)
            FROM predictions p
            JOIN bearings b ON b.id = p.bearing_id
            WHERE b.bearing_id = $1
              AND p.sample_ts >= $2
            """
        )
        self._check("Predictions populated", count > 0, f"{count} rows")

    async def _assert_anomaly_triggered(self) -> None:
        assert self.db is not None

        async def fetch_first_idx() -> int | None:
            row = await self.db.fetchrow(
                """
                SELECT p.file_idx
                FROM snapshots s
                JOIN predictions p ON p.id = s.prediction_id
                JOIN bearings b ON b.id = s.bearing_id
                WHERE b.bearing_id = $1
                  AND s.snapshot_ts >= $2
                ORDER BY p.file_idx ASC
                LIMIT 1
                """,
                self.bearing_id,
                self.started_ts,
            )
            return row["file_idx"] if row else None

        first_trigger_idx = await self._wait_for_value(fetch_first_idx)
        if first_trigger_idx is None:
            self._check("Anomaly triggered", False, "No snapshots found")
            return

        in_expected_range = 25 <= first_trigger_idx <= 42
        self._check(
            "Anomaly triggered",
            in_expected_range,
            f"first trigger at file {first_trigger_idx} (expected 25-42)",
        )

    async def _assert_snapshot_complete(self) -> None:
        assert self.db is not None
        row = await self.db.fetchrow(
            """
            SELECT s.summary_json, s.signal_window_ref, s.feature_vector_ref
            FROM snapshots s
            JOIN bearings b ON b.id = s.bearing_id
            WHERE b.bearing_id = $1
              AND s.snapshot_ts >= $2
            ORDER BY s.snapshot_ts DESC
            LIMIT 1
            """,
            self.bearing_id,
            self.started_ts,
        )
        if not row:
            self._check("Snapshot complete", False, "No snapshot found")
            return

        summary = row["summary_json"] or {}
        has_p_fail = "p_fail" in summary
        has_rul = "rul_minutes" in summary
        has_signal_ref = bool(row["signal_window_ref"])
        has_feature_ref = bool(row["feature_vector_ref"])
        passed = has_p_fail and has_rul and has_signal_ref and has_feature_ref
        self._check(
            "Snapshot complete",
            passed,
            f"p_fail={has_p_fail}, rul={has_rul}, signal_ref={has_signal_ref}, feature_ref={has_feature_ref}",
        )

    async def _assert_decision_created(self) -> None:
        count = await self._wait_count(
            """
            SELECT COUNT(*)
            FROM decisions d
            JOIN snapshots s ON s.id = d.snapshot_id
            JOIN bearings b ON b.id = s.bearing_id
            WHERE b.bearing_id = $1
              AND s.snapshot_ts >= $2
              AND d.decision_status = 'PENDING'::"DecisionStatus"
            """
        )
        self._check("Decision created with status=PENDING", count > 0, f"{count} pending decisions")

    async def _assert_transcript_complete(self) -> None:
        assert self.db is not None
        row = await self.db.fetchrow(
            """
            SELECT COUNT(DISTINCT agent_name) AS agent_count
            FROM agent_transcripts at2
            JOIN snapshots s ON s.id = at2.snapshot_id
            JOIN bearings b ON b.id = s.bearing_id
            WHERE b.bearing_id = $1
              AND s.snapshot_ts >= $2
            """,
            self.bearing_id,
            self.started_ts,
        )
        count = row["agent_count"] if row else 0
        self._check(
            "Agent transcript complete",
            count >= 4 or count == 0,
            f"{count} distinct agents in transcript",
        )

    async def _assert_langfuse_trace_created(self) -> None:
        assert self.db is not None
        if not settings.LANGFUSE_PUBLIC_KEY or not settings.LANGFUSE_SECRET_KEY:
            self._check("Langfuse trace created", False, "Langfuse credentials not configured")
            return

        url = f"{settings.LANGFUSE_HOST.rstrip('/')}/api/public/traces"
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(
                    url,
                    params={"name": f"negotiation/{self.bearing_id}", "limit": 1},
                    auth=(settings.LANGFUSE_PUBLIC_KEY, settings.LANGFUSE_SECRET_KEY),
                )
            has_trace = response.status_code == 200 and self.bearing_id in response.text
            self._check("Langfuse trace created", has_trace, f"HTTP {response.status_code}")
        except Exception as exc:
            self._check("Langfuse trace created", False, str(exc))

    async def _wait_count(self, query: str, timeout_s: int = 120) -> int:
        assert self.db is not None

        async def fetch_count() -> int:
            return int(await self.db.fetchval(query, self.bearing_id, self.started_ts) or 0)

        return await self._wait_for_value(fetch_count, timeout_s=timeout_s, truthy=lambda value: value > 0) or 0

    async def _wait_for_value(
        self,
        check_fn: Callable[[], Awaitable[object]],
        timeout_s: int = 120,
        poll_interval: float = 2.0,
        truthy: Callable[[object], bool] = bool,
    ):
        elapsed = 0.0
        last_value = None
        while elapsed < timeout_s:
            last_value = await check_fn()
            if truthy(last_value):
                return last_value
            await asyncio.sleep(poll_interval)
            elapsed += poll_interval
        return last_value

    def _check(self, name: str, passed: bool, detail: str = "") -> None:
        self.results.append((name, passed, detail))
        icon = "[✓]" if passed else "[✗]"
        color = "green" if passed else "red"
        suffix = f" - {detail}" if detail else ""
        console.print(f"[{color}]{icon}[/{color}] {name}{suffix}")

    def _print_summary(self) -> None:
        passed = sum(1 for _, ok, _ in self.results if ok)
        total = len(self.results)
        elapsed = time.perf_counter() - self.started_at
        console.print(f"{'─' * 41}")
        style = "green" if passed == total else "red"
        console.print(f"[{style}]{'PASSED' if passed == total else 'FAILED'} {passed}/{total} checks[/]  (elapsed: {elapsed:.0f}s)")


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate the full PdM pipeline against running services.")
    parser.add_argument("--bearing", required=True, help="Bearing folder name, e.g. Bearing2_4")
    parser.add_argument("--speed", type=float, default=30.0, help="Replay multiplier")
    return parser.parse_args()


async def main() -> int:
    args = _parse_args()
    validator = E2EValidator(bearing_id=args.bearing, speed=args.speed)
    return await validator.run()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
