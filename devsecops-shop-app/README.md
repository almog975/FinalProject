# DevSecOps Shop App

Flask e-commerce REST API for Technion DevOps Final Project 15.

Stack: Flask + Flask-RESTful + Flask-Migrate + Flask-SQLAlchemy, PostgreSQL 15+, Prometheus metrics, Docker multi-stage build.

Phase 1: products / cart / orders.  
Phase 2: security report endpoints that serve the latest SBOM and vulnerability scan summary.

## Layout

```
app/           # create_app factory, models, API, services, CLI, SPA static
frontend/      # Vite + React + TypeScript SPA (served from dist by Flask)
samples/       # bundled demo SBOM + scan-report (compose works without a pipeline)
tests/         # pytest suite
Dockerfile     # multi-stage: Node SPA build + python:3.11.9-slim runtime
docker-compose.yml
requirements.txt
requirements-dev.txt
```

## Frontend (React admin dashboard)

Vite + React + TypeScript **admin dashboard** under `frontend/` (Overview, Products, Cart, Orders, Security, System). **Delivered via Flask** (same origin): `npm run build` → `frontend/dist`, served by the API process. No separate nginx / shop-web Deployment — not a microservices split.

### Local UI against Compose

```bash
# Terminal 1 — API
docker compose up --build

# Terminal 2 — Vite (proxies /api, /health, /ready, /metrics → :5000)
cd frontend && npm install && npm run dev
```

### Production / Minikube rebuild

The multi-stage `Dockerfile` builds the SPA with Node, then copies `dist` into `/app/frontend/dist`. Flask serves `/` (and client-route fallback). After rebuild/redeploy:

```bash
# From monorepo root: ../scripts/build-shop-image.sh   (or minikube image build below)
minikube image build -t shop-api:phase2 .
kubectl -n shop rollout restart deploy/shop
# or: helm upgrade --install shop ../devsecops-shop-devops/helm/shop \
#       -f ../devsecops-shop-devops/helm/shop/values-dev.yaml -n shop
minikube service shop -n shop --url
```

Open the printed URL (UI at `/`; `/api/*` unchanged). Details: [`frontend/README.md`](frontend/README.md).

## Quick start (Docker Compose)

```bash
cp .env.example .env
docker compose up --build
```

API listens on `http://localhost:5000`. Postgres is exposed on `5432`.

Security endpoints return bundled `samples/` JSON until a pipeline (or `flask security-ingest`) provides real artifacts.

## Run tests (no Docker required)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
pytest
```

Tests use an in-memory SQLite database when `DATABASE_URL` is unset.

## Security artifacts (Phase 2)

### Endpoints

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/security/sbom` | Latest SBOM (200 + JSON envelope) |
| GET | `/api/security/scan-report` | Latest vuln summary (200 + JSON envelope) |

Response envelope:

```json
{
  "source": "file|db|samples",
  "kind": "sbom|scan",
  "path": "/artifacts/sbom.json",
  "created_at": "2026-09-18T12:00:00+00:00",
  "artifact": { }
}
```

`artifact` is the raw Syft/Trivy (or sample) JSON document.

### Resolution order

1. **`SECURITY_ARTIFACTS_DIR`** — files named `sbom.json` and `scan-report.json`
2. **DB table `security_artifacts`** — latest row per `kind` (`sbom` | `scan`)
3. **Bundled `samples/`** — always present for local demo / compose without CI

### Artifact paths (for future Jenkins)

Set `SECURITY_ARTIFACTS_DIR` (Compose/Dockerfile default: `/artifacts`) and drop pipeline output there:

```bash
# After image build / scan stages (examples)
syft packages dir:. -o cyclonedx-json > "$SECURITY_ARTIFACTS_DIR/sbom.json"
trivy image --format json --output "$SECURITY_ARTIFACTS_DIR/scan-report.json" "$IMAGE"
```

Mount the same directory into the API pod/container (Compose already uses volume `security-artifacts` → `/artifacts`). The next `GET` will pick up `source: "file"`.

### Ingest (CLI)

Prefer the Flask CLI when copying artifacts into the DB (and optionally mirroring into `SECURITY_ARTIFACTS_DIR`):

```bash
export FLASK_APP=wsgi:app
# optional: export SECURITY_ARTIFACTS_DIR=/artifacts

flask security-ingest sbom /path/to/sbom.json
flask security-ingest scan /path/to/scan-report.json
# aliases for scan: scan-report
```

**Host-side caveat:** running `flask security-ingest` on the host needs a reachable `DATABASE_URL`.
The Compose hostname `postgres` only resolves **inside** the compose network, so a host shell with
`DATABASE_URL=...@postgres:5432/...` (from `.env.example`) will fail DNS. Prefer ingesting inside
the API container for local demos:

```bash
docker compose exec api flask security-ingest sbom /artifacts/sbom.json
docker compose exec api flask security-ingest scan /artifacts/scan-report.json
```

If you must run on the host, point `DATABASE_URL` at `localhost` (Compose publishes Postgres on `5432`)
or another reachable address — not the compose service name.

## Example curls

```bash
# Health / readiness / metrics
curl -s http://localhost:5000/health
curl -s http://localhost:5000/ready
curl -s http://localhost:5000/metrics | head

# Products
curl -s -X POST http://localhost:5000/api/products \
  -H 'Content-Type: application/json' \
  -d '{"name":"Widget","price":19.99,"stock":10,"description":"A widget"}'

curl -s http://localhost:5000/api/products

curl -s -X PUT http://localhost:5000/api/products/1 \
  -H 'Content-Type: application/json' \
  -d '{"name":"Widget Plus","price":24.99,"stock":8}'

# Cart
curl -s -X POST http://localhost:5000/api/cart \
  -H 'Content-Type: application/json' \
  -d '{"user_id":"alice","product_id":1,"quantity":2}'

curl -s http://localhost:5000/api/cart/alice

curl -s -X DELETE http://localhost:5000/api/cart/alice/item/1

# Orders (checkout cart → order)
curl -s -X POST http://localhost:5000/api/orders \
  -H 'Content-Type: application/json' \
  -d '{"user_id":"alice"}'

curl -s http://localhost:5000/api/orders/1

# Security reports (Phase 2 — samples until pipeline drops files)
curl -s http://localhost:5000/api/security/sbom | jq .
curl -s http://localhost:5000/api/security/scan-report | jq .
```

## API summary

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/products` | List products |
| POST | `/api/products` | Create (`name`, `price`, `stock` required) |
| PUT | `/api/products/<id>` | Update |
| DELETE | `/api/products/<id>` | Delete |
| POST | `/api/cart` | Add/update line (`user_id`, `product_id`, `quantity`) |
| GET | `/api/cart/<user_id>` | Cart contents |
| DELETE | `/api/cart/<user_id>/item/<product_id>` | Remove line |
| POST | `/api/orders` | Checkout (`user_id`) — validates stock, clears cart |
| GET | `/api/orders/<order_id>` | Order detail |
| GET | `/health` | Liveness |
| GET | `/ready` | Readiness (DB ping) |
| GET | `/metrics` | Prometheus |
| GET | `/api/security/sbom` | Latest SBOM JSON envelope |
| GET | `/api/security/scan-report` | Latest vuln scan summary envelope |

## Local run without Docker

```bash
export DATABASE_URL=postgresql://shop:shop@localhost:5432/shopdb   # or omit for sqlite
pip install -r requirements.txt
python -m flask --app wsgi:app run --host 0.0.0.0 --port 5000
```

## Suggested remote

```bash
git remote add origin https://github.com/almog975/FinalProject
```

## Metrics note

PyPI currently only publishes `prometheus-flask-instrumentator==4.1.1` (requires Flask &lt;2).
This project targets Flask 3, so `app/instrumentator.py` provides an API-compatible
`Instrumentator` built on `prometheus_client` and exposes `GET /metrics`.
