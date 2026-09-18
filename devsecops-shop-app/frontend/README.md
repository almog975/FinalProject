# DevSecOps Shop — Frontend

Vite + React + TypeScript SPA for the shop API. No auth.

In production / Minikube the built assets are served by Flask from `frontend/dist` (same origin — no CORS).

## Setup

```bash
cd frontend
npm install
```

## Local development (against Compose API)

1. Start the API (from `devsecops-shop-app/`):

   ```bash
   docker compose up --build
   ```

   API on `http://localhost:5000`.

2. Run the Vite dev server (proxies `/api`, `/health`, `/ready`, `/metrics` → `localhost:5000`):

   ```bash
   npm run dev
   ```

   Open the URL Vite prints (usually `http://localhost:5173`).

`VITE_API_BASE_URL` defaults to empty (same origin), so the proxy is used automatically.

## Build

```bash
npm run build
```

Output: `frontend/dist/` (copied into the Docker image and served by Flask).

## Standalone preview against Minikube NodePort

If you open the SPA from Vite preview (or another host) instead of Flask:

```bash
# Get the shop service URL, e.g. http://192.168.49.2:3xxxx
minikube service shop -n shop --url

export VITE_API_BASE_URL='http://<that-host-port>'
npm run build
npm run preview
```

Or for the Vite dev server:

```bash
VITE_API_BASE_URL='http://<minikube-nodeport>' npm run dev
```

When the UI is served by Flask (Compose image or Helm shop pod), leave `VITE_API_BASE_URL` unset so requests stay same-origin.

## Features

- Health strip — polls `GET /health` and `GET /ready`
- Products — list + create
- Cart for user `alice` — add / view / remove
- Orders — place order for `alice`, show last order
- Security cards — SBOM + scan-report summaries
