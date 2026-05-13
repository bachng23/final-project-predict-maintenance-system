"""
Predictor runner: consumes pdm.features, runs inference in-process,
publishes results to pdm.predictions.

Runs the full inference pipeline locally — no HTTP hop needed.
"""
from __future__ import annotations

import asyncio
import json
import logging
import signal
import sys

from predictor import model_loader as ml
from predictor.fault_detector import detect as detect_fault
from predictor.inference import BearingContext, predict
from shared.database import close_pool, upsert_prediction
from shared.messaging import (
    TOPIC_FEATURES,
    close_producer,
    consume_loop,
    publish_prediction,
)
from shared.schemas import FeatureRecord

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

_stop = asyncio.Event()


async def handle_feature_message(raw: bytes) -> None:
    data = json.loads(raw)
    record = FeatureRecord(**data)

    ctx = BearingContext(
        rpm=record.features.get("rpm", 2100.0),
        load_kn=record.features.get("load_kn", 12.0),
        elapsed_minutes=record.features.get("elapsed_minutes", 0.0),
    )

    prediction = predict(record, ctx)

    fault_type, fault_conf = detect_fault(record.features)
    prediction = prediction.model_copy(update={
        "fault_type": fault_type,
        "fault_confidence": fault_conf,
        "rms_h": record.features.get("h_rms"),
    })

    await publish_prediction(prediction)

    log.info(
        "[%s] file_idx=%d → rul=%.0f min  p_fail=%.3f  health=%.1f  fault=%s",
        prediction.bearing_id,
        prediction.file_idx,
        prediction.rul_minutes,
        prediction.p_fail,
        prediction.health_score,
        fault_type,
    )

    try:
        await upsert_prediction(prediction)
    except Exception as exc:
        log.warning("DB write failed (non-fatal): %s", exc)


async def main() -> None:
    log.info("Loading models…")
    ml.load_all_models()
    log.info("Models loaded. Predictor runner starting — consuming topic '%s'", TOPIC_FEATURES)

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, _stop.set)

    consumer_task = asyncio.create_task(
        consume_loop(TOPIC_FEATURES, "predictor-runner", handle_feature_message)
    )

    await _stop.wait()
    consumer_task.cancel()
    await close_producer()
    await close_pool()
    log.info("Predictor runner stopped.")


if __name__ == "__main__":
    asyncio.run(main())
