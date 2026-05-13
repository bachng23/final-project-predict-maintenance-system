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
    parser.add_argument(
        "--scenario",
        choices=["a", "b", "c"],
        help=(
            "Print expected thesis demo flow before streaming. "
            "a=rapid degradation, b=safety veto, c=borderline negotiation."
        ),
    )
    return parser.parse_args()


def _print_scenario_a_diagram() -> None:
    print(
        "\nScenario A - Rapid Degradation\n"
        "File 1-20:  Gate -> CONTINUE  (healthy phase, p_fail < 0.45)\n"
        "File 21-30: Gate -> NEGOTIATE (degradation starts)\n"
        "             health: INSPECT, production: CONTINUE, cost: INSPECT, safety: INSPECT\n"
        "             manager: INSPECT (confidence ~0.72)\n"
        "File 31-40: Gate -> NEGOTIATE (rapid degradation)\n"
        "             health: STOP, production: MAINTAIN, cost: MAINTAIN, safety: STOP\n"
        "             manager: MAINTAIN (confidence ~0.81)\n"
        "File 41-42: Gate -> STOP (p_fail >= 0.80 OR health < 20)\n"
        "             safety veto, no LLM called\n",
        flush=True,
    )


def _print_scenario_b_diagram() -> None:
    print(
        "\nScenario B - Safety Veto (Imminent Failure)\n"
        "Demonstrates the hard safety cut-off path — no LLM agents called.\n"
        "\n"
        "File 1-35:  Gate -> CONTINUE / NEGOTIATE  (normal degradation)\n"
        "File 36-40: Gate -> NEGOTIATE              (p_fail rising, safety borderline)\n"
        "             health: STOP, production: MAINTAIN, cost: INSPECT, safety: STOP\n"
        "             manager: STOP (confidence ~0.85)\n"
        "File 41+:   Gate -> STOP (safety redline violated: vibration_rms > 20g)\n"
        "             safety veto active — recommended_action=STOP in <5ms, no LLM\n"
        "\n"
        "Key metric to show: latency <200ms when safety_veto=true vs ~5-30s for NEGOTIATE.\n",
        flush=True,
    )


def _print_scenario_c_diagram() -> None:
    print(
        "\nScenario C - Borderline Multi-Agent Negotiation\n"
        "Demonstrates PROPOSE -> CRITIQUE -> VOTE rounds with agent disagreement.\n"
        "\n"
        "File 1-25:  Gate -> CONTINUE  (healthy phase)\n"
        "File 26-35: Gate -> NEGOTIATE (p_fail in mid-range, low-medium uncertainty)\n"
        "  Round 1 PROPOSE:\n"
        "             health:     INSPECT  (0.71) — outer race fault progressing\n"
        "             production: CONTINUE (0.62) — 4.5h shift remaining, meets RUL\n"
        "             cost:       INSPECT  (0.74) — E[cost|CONTINUE] > E[cost|INSPECT]\n"
        "             safety:     INSPECT  (0.90) — borderline, no redline breach\n"
        "  Round 1 CRITIQUE:\n"
        "             production challenges health: RUL CI lower bound still > 60 min\n"
        "             health challenges production: fault confidence 0.78, progression risk\n"
        "  Round 1 VOTE -> INSPECT majority\n"
        "  Manager (self-consistency N=3): INSPECT (confidence ~0.74)\n"
        "File 36+:   Gate -> NEGOTIATE (fast degradation, possible STOP escalation)\n"
        "\n"
        "Key metric to show: rounds_taken, per-agent confidence, manager rationale.\n",
        flush=True,
    )


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
    if args.scenario == "a":
        _print_scenario_a_diagram()
    elif args.scenario == "b":
        _print_scenario_b_diagram()
    elif args.scenario == "c":
        _print_scenario_c_diagram()

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
