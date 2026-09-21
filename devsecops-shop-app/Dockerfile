# Multi-stage build: Flask API only (SPA served by separate shop-web nginx image)
# Stage 1: Python dependency builder
FROM python:3.11.9-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Stage 2: runtime (non-root UID 10001 for Checkov CKV_K8S_40 / K8S hardening)
FROM python:3.11.9-slim AS runtime

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -g 10001 appuser \
    && useradd -u 10001 -g 10001 --create-home --shell /bin/bash appuser \
    && mkdir -p /artifacts /tmp \
    && chown -R 10001:10001 /artifacts /app /tmp

COPY --from=builder /install /usr/local
COPY app/ ./app/
COPY samples/ ./samples/
COPY wsgi.py .

RUN chown -R 10001:10001 /app /artifacts

ENV FLASK_APP=wsgi:app \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    SECURITY_ARTIFACTS_DIR=/artifacts

USER 10001

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

CMD ["python", "-m", "flask", "--app", "wsgi:app", "run", "--host", "0.0.0.0", "--port", "5000"]
