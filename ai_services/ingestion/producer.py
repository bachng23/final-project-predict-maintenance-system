from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from shared.config import settings
from shared.messaging import close_producer, publish_vibration_raw
from shared.schemas import VibrationRawMessage
from shared.storage import ensure_buckets, upload_signal

_CONDITION_RPM: dict[int, int] = {1: 2100, 2: 2250, 3: 2400}

# Actual subfolder names inside DATA_ROOT
_CONDITION_FOLDER: dict[int, str] = {
    1: "35Hz12kN",
    2: "37.5Hz11kN",
    3: "40Hz10kN",
}

logger = logging.getLogger(__name__)

# Seconds between files in real-time mode (1 sample per minute in XJTU-SY)
_REAL_INTERVAL: float = 60.0


def _parse_condition(bearing_id: str) -> int:
    """
    Derive operating condition from bearing folder name.

    'Bearing1_x' → 1,  'Bearing2_x' → 2,  'Bearing3_x' → 3
    Raises ValueError for unknown patterns.
    """
    parts = bearing_id.split("_")
    try:
        cond = int(parts[0].replace("Bearing", "").replace("bearing", ""))
        if cond not in _CONDITION_RPM:
            raise ValueError
        return cond
    except (IndexError, ValueError):
        raise ValueError(
            f"Cannot derive condition from bearing_id='{bearing_id}'. "
            "Expected format: Bearing<1|2|3>_<n>"
        )


def _load_csv(path: Path) -> np.ndarray:
    """
    Load one XJTU-SY CSV file.

    Returns shape (2, 32768) float32 array — row 0 = horizontal, row 1 = vertical.
    """
    data = np.genfromtxt(path, delimiter=",", dtype=np.float32, skip_header=1)
    if data.ndim == 1:
        # Single-channel fallback (shouldn't happen with XJTU-SY)
        data = np.stack([data, data])
    else:
        data = data.T  # (32768, 2) → (2, 32768)
    return data


class XJTUProducer:
    """
    Replay a single XJTU-SY bearing run as an IoT data stream.

    Args:
        bearing_id: Folder name, e.g. 'Bearing2_4'.
        speed:      Replay multiplier — 1.0 = real-time (1 file / 60 s),
                    15.0 = 15× faster (1 file / 4 s), etc.
    """

    def __init__(self, bearing_id: str, speed: float = 1.0) -> None:
        self.bearing_id = bearing_id
        self.speed = max(speed, 0.1)  # guard against division by zero
        self.condition = _parse_condition(bearing_id)
        self.rpm = _CONDITION_RPM[self.condition]
        condition_folder = _CONDITION_FOLDER[self.condition]
        self._data_dir = Path(settings.DATA_ROOT) / condition_folder / bearing_id

    # ── Discovery ────────────────────────────────────────────────────────────

    def _csv_files(self) -> list[Path]:
        """Return CSV files sorted numerically by file index."""
        files = sorted(
            self._data_dir.glob("*.csv"),
            key=lambda p: int(p.stem),
        )
        if not files:
            raise FileNotFoundError(
                f"No CSV files found in {self._data_dir}. "
                "Check DATA_ROOT and bearing_id."
            )
        return files

    # ── Main loop ────────────────────────────────────────────────────────────

    async def run(self, start_idx: int = 1) -> None:
        """
        Stream all CSV files starting from start_idx.

        Progress is printed to stdout (and logged) so demo_runner can tail it.
        """
        await ensure_buckets()

        files = self._csv_files()
        total = len(files)
        interval = _REAL_INTERVAL / self.speed

        logger.info(
            "[%s] Starting replay: %d files, condition %d (%d RPM), "
            "interval=%.1fs (speed=%.1fx)",
            self.bearing_id, total, self.condition, self.rpm, interval, self.speed,
        )

        for file_path in files:
            file_idx = int(file_path.stem)
            if file_idx < start_idx:
                continue

            await self._process_file(file_path, file_idx, total)

            progress = f"[{self.bearing_id}] file {file_idx}/{total} sent"
            print(progress, flush=True)
            logger.info(progress)

            if file_idx < total:
                await asyncio.sleep(interval)

        logger.info("[%s] Replay finished (%d files).", self.bearing_id, total)
        await close_producer()

    async def _process_file(
        self,
        file_path: Path,
        file_idx: int,
        total_files: int,
    ) -> None:
        signal_arr = await asyncio.to_thread(_load_csv, file_path)

        # Upload both channels as a single (2, N) array
        signal_window_ref = await upload_signal(
            self.bearing_id, file_idx, signal_arr
        )

        sample_ts = datetime.now(timezone.utc)

        msg = VibrationRawMessage(
            bearing_id=self.bearing_id,
            condition=self.condition,
            rpm=self.rpm,
            file_idx=file_idx,
            total_files=total_files,
            sample_ts=sample_ts,
            signal_window_ref=signal_window_ref,
        )
        await publish_vibration_raw(msg)
        logger.debug("[%s] Published file_idx=%d", self.bearing_id, file_idx)
