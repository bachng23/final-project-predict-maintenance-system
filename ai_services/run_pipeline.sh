#!/usr/bin/env bash
# Run the full AI pipeline locally for demo/testing.
# Usage:
#   ./run_pipeline.sh                          # default bearing Bearing1_3, speed 15x
#   ./run_pipeline.sh Bearing2_4              # custom bearing
#   ./run_pipeline.sh Bearing2_4 30           # custom bearing + speed multiplier

set -euo pipefail

BEARING="${1:-Bearing1_3}"
SPEED="${2:-15}"
START="${3:-1}"
LOG_DIR="$(dirname "$0")/logs"
mkdir -p "$LOG_DIR"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[pipeline]${NC} $*"; }
warn() { echo -e "${YELLOW}[pipeline]${NC} $*"; }

# ── cleanup on Ctrl+C ────────────────────────────────────────────────────────
PIDS=()
cleanup() {
  warn "Shutting down all processes..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null
  warn "Done."
}
trap cleanup EXIT INT TERM

cd "$(dirname "$0")"

# ── 1. signal_processor ──────────────────────────────────────────────────────
log "Starting signal_processor → $LOG_DIR/signal_processor.log"
uv run python -m signal_processor.processor_runner \
  > "$LOG_DIR/signal_processor.log" 2>&1 &
PIDS+=($!)

sleep 1

# ── 2. predictor runner (Kafka consumer → inference → pdm.predictions) ───────
log "Starting predictor_runner → $LOG_DIR/predictor.log"
uv run python -m predictor.predictor_runner \
  > "$LOG_DIR/predictor.log" 2>&1 &
PIDS+=($!)

sleep 1

# ── 3. anomaly detector ──────────────────────────────────────────────────────
log "Starting anomaly detector → $LOG_DIR/anomaly.log"
uv run python -m anomaly.detector_runner \
  > "$LOG_DIR/anomaly.log" 2>&1 &
PIDS+=($!)

sleep 2

# ── 4. producer (foreground so you can see progress) ─────────────────────────
log "Starting producer: bearing=${BEARING}, speed=${SPEED}x"
log "Logs: signal_processor.log | predictor.log | anomaly.log"
log "Press Ctrl+C to stop everything."
echo ""

uv run python -m ingestion.producer_runner \
  --bearing "$BEARING" \
  --speed "$SPEED" \
  --start "$START" &
PIDS+=($!)

# Tail all logs to terminal so output is visible
tail -f \
  "$LOG_DIR/signal_processor.log" \
  "$LOG_DIR/predictor.log" \
  "$LOG_DIR/anomaly.log" &
PIDS+=($!)

# Wait for producer to finish (or Ctrl+C)
wait "${PIDS[2]}" 2>/dev/null || true
