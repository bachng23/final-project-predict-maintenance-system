from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

import numpy as np

from shared.messaging import (
    publish_feature,
)
from shared.schemas import FeatureRecord, VibrationRawMessage
from shared.storage import download_signal, upload_features
from signal_processor.feature_extractor import CONDITION_RPM, extract_features

logger = logging.getLogger(__name__)


async def handle_vibration_message(raw: bytes) -> None:
    """
    Process one `vibration.raw` Kafka message end-to-end.

    Steps:
      1. Deserialize VibrationRawMessage.
      2. Download the (2, N) signal array from MinIO.
      3. Extract features from the horizontal channel (row 0).
      4. Upload the feature vector to MinIO (for traceability).
      5. Publish FeatureRecord to `pdm.features`.
    """
    # 1. Deserialize
    try:
        data = json.loads(raw)
        msg = VibrationRawMessage(**data)
    except Exception:
        logger.exception("Failed to deserialize vibration.raw message — skipping")
        return

    bearing_id = msg.bearing_id
    file_idx = msg.file_idx

    # 2. Download signal from MinIO
    signal_arr = await download_signal(bearing_id, file_idx)
    if signal_arr is None:
        logger.error(
            "[%s] file_idx=%d — signal not found in MinIO (ref=%s). Skipping.",
            bearing_id, file_idx, msg.signal_window_ref,
        )
        return

    # 3. Feature extraction — pass both channels as (2, N) array
    #    RPM is derived from condition so fault bands are correct per condition.
    rpm = CONDITION_RPM.get(msg.condition, 2100)

    try:
        features = extract_features(signal_arr, rpm=float(rpm))
    except Exception:
        logger.exception(
            "[%s] file_idx=%d — feature extraction failed. Skipping.",
            bearing_id, file_idx,
        )
        return

    # 4. Upload feature vector to MinIO (ordered by FEATURE_ORDER for ML use)
    feature_values = np.array(list(features.values()), dtype=np.float32)
    feature_vector_ref = await upload_features(bearing_id, file_idx, feature_values)

    # 5. Build and publish FeatureRecord
    lifetime_pct = file_idx / max(msg.total_files, 1)

    record = FeatureRecord(
        bearing_id=bearing_id,
        file_idx=file_idx,
        sample_ts=msg.sample_ts if isinstance(msg.sample_ts, datetime)
                  else datetime.fromisoformat(str(msg.sample_ts)).replace(tzinfo=timezone.utc),
        lifetime_pct=lifetime_pct,
        features=features,
    )
    await publish_feature(record)

    logger.info(
        "[%s] file_idx=%d processed — lifetime_pct=%.3f, "
        "rms=%.4f, kurtosis=%.4f, feature_ref=%s",
        bearing_id, file_idx, lifetime_pct,
        features.get("rms", 0.0), features.get("kurtosis", 0.0),
        feature_vector_ref,
    )
