# DevSecOps Shop — Frontend

Vite + React + TypeScript **admin dashboard** for the shop monolith API. No auth.
Client routing via `react-router-dom` (Overview, Products, Cart, Orders, Security, System).

In production / Minikube the built assets are served by Flask from `frontend/dist` (same origin — no CORS). There is **no** separate frontend microservice or `shop-web` chart.

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

`VITE_API_BASE_URL` defaults to empty (same origin), so the proxy is used automatically. The top bar shows a `same-origin` badge (or the configured base URL).

## Build

```bash
npm run build
```

Output: `frontend/dist/` (copied into the Docker image and served by Flask). Do not commit `dist` or `node_modules` — the Dockerfile multi-stage build produces them.

## Rebuild & redeploy (Minikube)

From the app repo root (`devsecops-shop-app/`), with the Helm release named `shop` in namespace `shop`:

```bash
minikube image build -t shop-api:phase2 .
kubectl -n shop rollout restart deploy/shop
# or: helm upgrade --install shop ../devsecops-shop-devops/helm/shop -f ../devsecops-shop-devops/helm/shop/values-dev.yaml -n shop
minikube service shop -n shop --url
```

Then open the printed URL (or `http://shop.local` if Ingress + `/etc/hosts` are set).

## Standalone preview against Minikube NodePort

If you open the SPA from Vite preview (or another host) instead of Flask:

```bash
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

## Dashboard pages

| Route | Purpose |
|-------|---------|
| `/` | Overview KPIs (product count, cart, last order, probes) |
| `/products` | Table + create / edit (PUT) / delete |
| `/cart` | User cart, add/remove, checkout → order |
| `/orders` | Fetch by id, place order, detail |
| `/security` | SBOM components + scan severity / vulns |
| `/system` | `/health`, `/ready`, `/metrics` snippet + Grafana hint |
