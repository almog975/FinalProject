# DevSecOps Shop App

Flask e-commerce REST API for Technion DevOps Final Project 15 (Phase 1 scaffold).

Stack: Flask + Flask-RESTful + Flask-Migrate + Flask-SQLAlchemy, PostgreSQL 15+, Prometheus metrics, Docker multi-stage build.

## Layout

```
app/           # create_app factory, models, API, services
tests/         # pytest suite
Dockerfile     # multi-stage, python:3.11.9-slim
docker-compose.yml
requirements.txt
requirements-dev.txt
```

## Quick start (Docker Compose)

```bash
cp .env.example .env
docker compose up --build
```

API listens on `http://localhost:5000`. Postgres is exposed on `5432`.

## Run tests (no Docker required)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
pytest
```

Tests use an in-memory SQLite database when `DATABASE_URL` is unset.

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

# Security stubs (Phase 2)
curl -s http://localhost:5000/api/security/sbom
curl -s http://localhost:5000/api/security/scan-report
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
| GET | `/api/security/sbom` | Stub (404 + TODO) |
| GET | `/api/security/scan-report` | Stub (404 + TODO) |

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
