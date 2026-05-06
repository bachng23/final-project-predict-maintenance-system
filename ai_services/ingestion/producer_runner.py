from __future__ import annotations

import argparse
import asyncio
import logging
import sys

from ingestion.producer import XJTUProducer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Replay an XJTU-SY bearing run as a Kafka stream.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--bearing",
        required=True,
        metavar="BEARING_ID",
        help="Bearing folder name, e.g. 'Bearing2_4'",
    )
    parser.add_argument(
        "--speed",
        type=float,
        default=1.0,
        metavar="MULTIPLIER",
        help="Replay speed multiplier (1.0 = real-time, 15.0 = 15× faster)",
    )
    parser.add_argument(
        "--start",
        type=int,
        default=1,
        metavar="FILE_IDX",
        help="Start from this 1-based file index (resume support)",
    )
    return parser.parse_args()


async def main() -> None:
    args = _parse_args()
    producer = XJTUProducer(bearing_id=args.bearing, speed=args.speed)
    try:
        await producer.run(start_idx=args.start)
    except FileNotFoundError as exc:
        logger.error(str(exc))
        sys.exit(1)
    except KeyboardInterrupt:
        logger.info("Interrupted by user. Shutting down.")


if __name__ == "__main__":
    asyncio.run(main())
