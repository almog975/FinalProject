# Multi-stage build: Vite React SPA + Flask API (SPA served by Flask)
# Stage 1: frontend
FROM node:20.19-alpine AS frontend

WORKDIR /frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Stage 2: Python dependency builder
FROM python:3.11.9-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Stage 3: runtime
FROM python:3.11.9-slim AS runtime

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --shell /bin/bash appuser \
    && mkdir -p /artifacts /app/frontend/dist \
    && chown appuser:appuser /artifacts /app/frontend/dist

COPY --from=builder /install /usr/local
COPY app/ ./app/
COPY samples/ ./samples/
COPY wsgi.py .
COPY --from=frontend /frontend/dist ./frontend/dist

ENV FLASK_APP=wsgi:app \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    SECURITY_ARTIFACTS_DIR=/artifacts \
    FRONTEND_DIST=/app/frontend/dist

USER appuser

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

CMD ["python", "-m", "flask", "--app", "wsgi:app", "run", "--host", "0.0.0.0", "--port", "5000"]
