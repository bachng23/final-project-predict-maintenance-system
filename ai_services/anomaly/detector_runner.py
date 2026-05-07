"""
Anomaly detector runner.

Subscribes to pdm.predictions, feeds each PredictionRecord through
AnomalyDetector, and triggers snapshot build when anomaly is detected.
"""
from __future__ import annotations

import asyncio
import json
import logging
import signal
from pathlib import Path

import yaml

from anomaly.anomaly_detector import AnomalyConfig, AnomalyDetector
from anomaly.snapshot_builder import build_and_persist
from shared.database import close_pool
from shared.messaging import TOPIC_PREDICTIONS, consume_loop, close_producer
from shared.schemas import PredictionRecord

log = logging.getLogger(__name__)

THRESHOLDS_PATH = Path(__file__).parent.parent / "configs" / "thresholds.yaml"

_running = True


def _load_config() -> AnomalyConfig:
    if THRESHOLDS_PATH.exists():
        with open(THRESHOLDS_PATH) as f:
            raw = yaml.safe_load(f) or {}
        cfg = AnomalyConfig.from_thresholds(raw)
        log.info("Loaded thresholds from %s", THRESHOLDS_PATH)
    else:
        cfg = AnomalyConfig()
        log.warning("thresholds.yaml not found — using defaults (run compute_baseline.py first)")
    return cfg


async def run() -> None:
    cfg      = _load_config()
    detector = AnomalyDetector(cfg)
    log.info(
        "AnomalyDetector ready — tau=%.2f K=%d cooldown=%d",
        cfg.tau, cfg.K_consecutive, cfg.cooldown_cycles,
    )

    async def handle(raw: bytes) -> None:
        try:
            data = json.loads(raw)
            pred = PredictionRecord.model_validate(data)
        except Exception as exc:
            log.warning("Malformed prediction message: %s", exc)
            return

        rms = pred.health_score   # health_score ~ inverse of RMS anomaly; use p_fail path instead
        # Extract RMS from features if available; fall back to 0 (c2 will be 0)
        rms_val = 0.0

        trigger = detector.update(
            bearing_id  = pred.bearing_id,
            file_idx    = pred.file_idx,
            p_fail      = pred.p_fail,
            rms         = rms_val,
            rul_minutes = pred.rul_minutes,
        )

        if trigger:
            log.info(
                "ANOMALY TRIGGERED bearing=%s file=%d hybrid=%.3f escalation=%s",
                trigger.bearing_id, trigger.file_idx,
                trigger.hybrid_score, trigger.escalation,
            )
            try:
                await build_and_persist(pred, trigger)
            except Exception as exc:
                log.error("Snapshot build failed for %s: %s", pred.bearing_id, exc)

    await consume_loop(
        topic    = TOPIC_PREDICTIONS,
        group_id = "anomaly-detector",
        handler  = handle,
    )


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

    loop = asyncio.new_event_loop()

    def _shutdown(sig, frame):
        log.info("Shutdown signal received")
        loop.stop()

    signal.signal(signal.SIGTERM, _shutdown)
    signal.signal(signal.SIGINT,  _shutdown)

    try:
        loop.run_until_complete(run())
    finally:
        loop.run_until_complete(close_pool())
        loop.run_until_complete(close_producer())
        loop.close()
        log.info("Anomaly detector stopped")


if __name__ == "__main__":
    main()
