from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from pathlib import Path

# Allow running from repo root without installing
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ingestion.producer import XJTUProducer, _CONDITION_RPM, _parse_condition

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("demo_runner")


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Stream an XJTU-SY bearing run into the pipeline.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--bearing",
        required=True,
        metavar="BEARING_ID",
        help="Bearing folder name, e.g. 'Bearing2_4' or 'bearing2_4'",
    )
    parser.add_argument(
        "--speed",
        type=float,
        default=1.0,
        metavar="MULTIPLIER",
        help=(
            "Replay multiplier: 1.0 = real-time (1 file / 60 s), "
            "15.0 = 15× faster (1 file / 4 s)"
        ),
    )
    parser.add_argument(
        "--start",
        type=int,
        default=1,
        metavar="FILE_IDX",
        help="Resume from this 1-based file index",
    )
    return parser.parse_args()


async def main() -> None:
    args = _parse_args()
    bearing_id: str = args.bearing

    # Validate bearing id and show info before starting
    try:
        condition = _parse_condition(bearing_id)
    except ValueError as exc:
        logger.error(str(exc))
        sys.exit(1)

    rpm = _CONDITION_RPM[condition]
    interval = 60.0 / args.speed

    print(
        f"\n{'─' * 55}\n"
        f"  Demo replay for: {bearing_id}\n"
        f"  Condition       : {condition}  ({rpm} RPM)\n"
        f"  Speed           : {args.speed:.1f}×  (interval ≈ {interval:.1f} s / file)\n"
        f"  Starting at     : file {args.start}\n"
        f"{'─' * 55}\n",
        flush=True,
    )

    producer = XJTUProducer(bearing_id=bearing_id, speed=args.speed)
    try:
        await producer.run(start_idx=args.start)
    except FileNotFoundError as exc:
        logger.error(str(exc))
        sys.exit(1)
    except KeyboardInterrupt:
        print("\nInterrupted. Bye!", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
