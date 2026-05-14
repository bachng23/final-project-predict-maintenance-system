#!/usr/bin/env bash
# Start backend + frontend for local development.
# Prerequisites: Tailscale connected to the lab server.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[dev]${NC} $*"; }
warn() { echo -e "${YELLOW}[dev]${NC} $*"; }
err()  { echo -e "${RED}[dev]${NC} $*"; }

# ── cleanup on Ctrl+C ────────────────────────────────────────────────────────
PIDS=()
cleanup() {
  warn "Shutting down..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  exit 0
}
trap cleanup INT TERM

# ── auto-create backend/.env ─────────────────────────────────────────────────
if [ ! -f "$BACKEND/.env" ]; then
  log "Creating backend/.env..."
  JWT_SECRET="$(openssl rand -hex 32)"
  cat > "$BACKEND/.env" <<EOF
PORT=8080
NODE_ENV=development
DATABASE_URL="postgresql://admin:123123@100.109.46.15:5432/predictive-maintenance-db?schema=public"
KAFKA_BROKERS=100.109.46.15:19092
JWT_SECRET="$JWT_SECRET"
EOF
  log "backend/.env created."
fi

# ── auto-create frontend/.env.local ─────────────────────────────────────────
if [ ! -f "$FRONTEND/.env.local" ]; then
  log "Creating frontend/.env.local..."
  cat > "$FRONTEND/.env.local" <<EOF
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=http://localhost:8080
EOF
fi

# ── install dependencies if needed ──────────────────────────────────────────
if [ ! -d "$BACKEND/node_modules" ]; then
  log "Installing backend dependencies..."
  (cd "$BACKEND" && npm install)
fi

if [ ! -d "$FRONTEND/node_modules" ]; then
  log "Installing frontend dependencies..."
  (cd "$FRONTEND" && npm install)
fi

# ── prisma generate ──────────────────────────────────────────────────────────
log "Running prisma generate..."
(cd "$BACKEND" && npm run prisma:generate)

# ── start services ───────────────────────────────────────────────────────────
log "Starting backend on port 8080..."
(cd "$BACKEND" && npm run dev) &
PIDS+=($!)

sleep 2

log "Starting frontend on port 3000..."
(cd "$FRONTEND" && npm run dev) &
PIDS+=($!)

echo ""
log "System is up:"
echo -e "  Frontend  → ${GREEN}http://localhost:3000${NC}"
echo -e "  Backend   → ${GREEN}http://localhost:8080${NC}"
echo ""
warn "Press Ctrl+C to stop all services."

wait
