# DevSecOps Shop — Frontend

Vite + React + TypeScript **admin dashboard** for the shop API. No auth.
Client routing via `react-router-dom` (Overview, Products, Cart, Orders, Security, System).

In Minikube / Helm the built assets are served by the **`shop-web`** nginx image (`frontend/Dockerfile`). nginx proxies `/api/`, `/health`, `/ready`, and `/metrics` to the Flask API Service (default upstream `shop:5000`). Same-origin from the browser — no CORS.

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

Output: `frontend/dist/` (copied into the **shop-web** Docker image). Do **not** commit `dist` or `node_modules` — the frontend Dockerfile multi-stage build produces them.

## nginx (shop-web)

- `nginx.conf.template` — used by the image; `${API_UPSTREAM}` substituted at start (default `shop:5000`)
- `nginx.conf` — same config with default upstream expanded (reference / local tests)
- `Dockerfile` — `npm ci` + `npm run build` → `nginx:alpine`, listens on **8080** (non-root); Helm Service still exposes port **80**

## Rebuild & redeploy (Minikube)

From the app repo root (`devsecops-shop-app/`), with Helm release `shop` in namespace `shop`:

```bash
minikube image build -t shop-api:phase2 -f Dockerfile .
minikube image build -t shop-web:phase2 -f frontend/Dockerfile frontend
helm upgrade --install shop ../devsecops-shop-devops/helm/shop \
  -f ../devsecops-shop-devops/helm/shop/values-dev.yaml -n shop --create-namespace
minikube service shop-web -n shop --url
```

Or from monorepo root: `./scripts/build-shop-image.sh` then the same `helm upgrade`.

Open the printed URL (or `http://shop.local` if Ingress + `/etc/hosts` are set). Ingress targets **shop-web** when `web.enabled` is true.

## Standalone preview against Minikube NodePort

If you open the SPA from Vite preview (or another host) instead of shop-web:

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

When the UI is served by shop-web (Helm), leave `VITE_API_BASE_URL` unset so requests stay same-origin (nginx proxies to the API).

## Dashboard pages

| Route | Purpose |
|-------|---------|
| `/` | Overview KPIs (product count, cart, last order, probes) |
| `/products` | Table + create / edit (PUT) / delete |
| `/cart` | User cart, add/remove, checkout → order |
| `/orders` | Fetch by id, place order, detail |
| `/security` | SBOM components + scan severity / vulns |
| `/system` | `/health`, `/ready`, `/metrics` snippet + Grafana hint |
