# Build context: ./ai_services  (set in docker-compose)
FROM python:3.12-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy

# ── Layer 1: install dependencies (cached as long as lockfile unchanged) ──
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# ── Layer 2: copy source & install project ────────────────────────────────
COPY . .
RUN uv sync --frozen --no-dev

CMD ["uv", "run", "python", "-m", "anomaly.detector_runner"]
