# Demo runbook — Technion DevOps Final Project 15

Student / presenter **copy-paste** guide for the grading defense.
Monorepo: [`almog975/FinalProject`](https://github.com/almog975/FinalProject).

| Phase | What you show |
|-------|----------------|
| 1–2 | Docker Compose shop API + security artifacts + `/metrics` |
| 3 | Minikube Helm (`shop` ns, `shop.local`) |
| 4 | Jenkins Script Path + hard gates (document even if Jenkins is offline) |
| 5 | Prometheus / Grafana / Loki (Helm **or** Terraform) |
| 6 | This runbook + root overview |

Optional helper: [`scripts/demo.sh`](scripts/demo.sh) prints the ordered commands.

> **Phase 4:** Jenkins assets live under `devsecops-shop-devops/jenkins/` (Script Path below).

---

## 0. Clone & prerequisites

```bash
git clone https://github.com/almog975/FinalProject.git
cd FinalProject
```

**Required for most demos**

| Tool | Used for |
|------|----------|
| Docker + Compose v2 | Phase 1–2 local app |
| Python 3.11+ + venv | pytest / local Flask |
| Minikube | Phase 3 / 5 cluster |
| Helm 3 | Chart + monitoring installs |
| kubectl | Pods, port-forward, Ingress |

**Optional (Phase 4 agent / local pipeline-ish checks)**

`gitleaks`, `trivy`, `checkov`, `syft`, `hadolint`, `flake8`, `newman` (or `npx newman`), Jenkins LTS + Pipeline plugin.

**Suggested Minikube size** (Phase 5 stack is heavy):

```bash
minikube start --memory=4096 --cpus=2
# or higher if the host allows
```

---

## Phase 1–2 — Compose app + security + metrics

```bash
cd devsecops-shop-app
cp .env.example .env          # if .env missing
docker compose up --build -d
```

API: `http://localhost:5000` · Postgres: `localhost:5432`.

### Curl checklist

```bash
# Health / ready / Prometheus
curl -s http://localhost:5000/health
curl -s http://localhost:5000/ready
curl -s http://localhost:5000/metrics | head

# Products
curl -s -X POST http://localhost:5000/api/products \
  -H 'Content-Type: application/json' \
  -d '{"name":"Widget","price":19.99,"stock":10,"description":"A widget"}'
curl -s http://localhost:5000/api/products

# Cart + order
curl -s -X POST http://localhost:5000/api/cart \
  -H 'Content-Type: application/json' \
  -d '{"user_id":"alice","product_id":1,"quantity":2}'
curl -s http://localhost:5000/api/cart/alice
curl -s -X POST http://localhost:5000/api/orders \
  -H 'Content-Type: application/json' \
  -d '{"user_id":"alice"}'
curl -s http://localhost:5000/api/orders/1

# Phase 2 security (bundled samples/ until pipeline drops files)
curl -s http://localhost:5000/api/security/sbom | head
curl -s http://localhost:5000/api/security/scan-report | head
```

**Tests without Docker**

```bash
cd devsecops-shop-app
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
pytest -q --cov=app --cov-fail-under=70
```

Details: [`devsecops-shop-app/README.md`](devsecops-shop-app/README.md).

---

## Phase 3 — Minikube + Helm (`shop`)

From **monorepo root** (or `devsecops-shop-devops` as noted):

```bash
# Cluster + ingress
minikube start --memory=4096 --cpus=2
minikube addons enable ingress

# Build / load API image (chart default: shop-api:phase2)
cd devsecops-shop-app
minikube image build -t shop-api:phase2 .
# OR: docker build -t shop-api:phase2 . && minikube image load shop-api:phase2
minikube image ls | grep shop-api
cd ..

# Install chart
cd devsecops-shop-devops
helm upgrade --install shop ./helm/shop \
  -f helm/shop/values-dev.yaml \
  -n shop --create-namespace

# Host mapping
echo "$(minikube ip) shop.local" | sudo tee -a /etc/hosts
# Or without /etc/hosts: minikube service shop -n shop --url

curl -s http://shop.local/health
curl -s http://shop.local/ready
curl -s http://shop.local/api/security/sbom | head
kubectl -n shop get pods,svc,ingress
```

### UI dashboard (admin SPA)

The React admin dashboard is built into the **same** `shop-api:phase2` image and served by Flask at `/` (no separate frontend service). Curl API demos above still apply.

```bash
# Rebuild image (includes Vite SPA) and restart the Helm deployment
cd devsecops-shop-app
minikube image build -t shop-api:phase2 .
kubectl -n shop rollout restart deploy/shop
# or: helm upgrade --install shop ../devsecops-shop-devops/helm/shop \
#       -f ../devsecops-shop-devops/helm/shop/values-dev.yaml -n shop

minikube service shop -n shop --url
# Open the printed URL (or http://shop.local) — UI at /
```

Pages (left sidebar): **Overview** | **Products** | **Cart** | **Orders** | **Security** | **System**.

Local Compose + Vite: `cd devsecops-shop-app/frontend && npm run dev` (API via `docker compose up`).

Smoke-render **without** a cluster:

```bash
helm template shop ./helm/shop -f helm/shop/values-dev.yaml -n shop
```

Chart path: `devsecops-shop-devops/helm/shop` · values: `values-dev.yaml` · ns: `shop` · host: `shop.local`.

Details: [`devsecops-shop-devops/README.md`](devsecops-shop-devops/README.md).

---

## Phase 4 — Jenkins hard gates (document even if offline)

### Job setup

1. Jenkins LTS with the **Pipeline** plugin (Multibranch or Pipeline job).
2. Point SCM at this monorepo.
3. Set **Script Path** to:

   ```text
   devsecops-shop-devops/jenkins/Jenkinsfile
   ```

4. Build branch `main`.

Paths inside the Jenkinsfile are relative to the **monorepo root**.

### Hard gates (must FAIL the build)

| Gate | Tool | Fail when |
|------|------|-----------|
| Tests + coverage | pytest | Any failure **or** coverage **&lt; 70%** |
| Secrets | gitleaks | **Any** finding |
| Container vulns | trivy image | **CRITICAL** (`--ignore-unfixed`) |
| IaC | checkov (Helm chart) | **HIGH** or **CRITICAL** |
| Lint (blocking) | flake8 / helm lint / hadolint error | Non-zero exit |

Policy detail: `devsecops-shop-devops/security/policies/README.md` (on the Phase 4 branch / after merge).

Advisory / skippable (must be **visible**, not silent green): SonarQube if `SONAR_HOST_URL` unset → `unstable()`; GHCR push without creds; Deploy if no cluster.

### Local “pipeline-ish” checks (no Jenkins)

```bash
# From monorepo root — after Phase 4 files are present
cd devsecops-shop-app
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt flake8
flake8 app wsgi.py --max-line-length=100
pytest -q --cov=app --cov-fail-under=70
cd ..
helm lint devsecops-shop-devops/helm/shop \
  -f devsecops-shop-devops/helm/shop/values-dev.yaml

# If tools installed:
gitleaks detect --source . --config devsecops-shop-devops/security/.gitleaks.toml
checkov -d devsecops-shop-devops/helm/shop --framework helm \
  --config-file devsecops-shop-devops/security/.checkov.yaml \
  --hard-fail-on HIGH,CRITICAL --soft-fail-on LOW,MEDIUM
```

You do **not** need a live Jenkins controller for the oral defense if you can show the Jenkinsfile, the gates table, and local pytest/helm/gitleaks/checkov evidence.

---

## Phase 5 — Monitoring (Helm **or** Terraform)

Prereq: Phase 3 shop release in namespace `shop` (scrape target `GET /metrics`).

Dashboard JSON: `devsecops-shop-devops/monitoring/grafana/dashboards/shop-api.json`  
(“DevSecOps Shop API”). Values: `monitoring/kube-prometheus-stack-values.yaml`, `monitoring/loki-values.yaml`.

### Option A — Helm CLI

```bash
cd devsecops-shop-devops

kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  -n monitoring --version 65.1.0 \
  -f monitoring/kube-prometheus-stack-values.yaml --wait --timeout 15m

helm upgrade --install loki grafana/loki-stack \
  -n monitoring --version 2.10.2 \
  -f monitoring/loki-values.yaml --wait --timeout 10m

kubectl -n monitoring create configmap shop-api-dashboard \
  --from-file=shop-api.json=monitoring/grafana/dashboards/shop-api.json \
  --dry-run=client -o yaml \
  | kubectl label --local -f - grafana_dashboard=1 -o yaml \
  | kubectl apply -f -
```

### Option B — Terraform

Defaults are demo-safe: `enable_cloud=false`, `enable_monitoring=false` (no cluster writes / no cloud bills).

```bash
cd devsecops-shop-devops/terraform
terraform init -backend=false
terraform fmt -recursive
terraform validate
terraform plan                                    # no cluster writes

# Only with Minikube up + Phase 3 shop installed:
terraform apply -var='enable_monitoring=true'
```

See [`devsecops-shop-devops/terraform/README.md`](devsecops-shop-devops/terraform/README.md).

### Grafana access (Minikube)

```bash
minikube service kube-prometheus-stack-grafana -n monitoring --url
```

Or port-forward:


```bash
kubectl -n monitoring port-forward svc/kube-prometheus-stack-grafana 3000:80
# http://localhost:3000  — admin / prom-operator (demo only)
# Open dashboard: "DevSecOps Shop API"
```

Generate traffic, then refresh panels:

```bash
curl -s http://shop.local/health
curl -s http://shop.local/api/products
```

Prometheus (optional):

```bash
kubectl -n monitoring port-forward svc/kube-prometheus-stack-prometheus 9090:9090
# Targets → serviceMonitor for shop-api
```

Details: [`devsecops-shop-devops/monitoring/README.md`](devsecops-shop-devops/monitoring/README.md).

---

## Expected screenshots / grading checklist

Use this as a defense punch-list:

- [ ] **Compose**: `docker compose up` healthy; `/health`, `/ready`, products/cart/orders curls
- [ ] **Security**: `/api/security/sbom` + `/api/security/scan-report` return JSON envelopes
- [ ] **Metrics**: `/metrics` shows `flask_http_request_*` (or instrumentator metrics)
- [ ] **pytest**: coverage ≥ 70%
- [ ] **Helm**: pods Running in `shop`; Ingress `shop.local`; `/health` via Ingress
- [ ] **UI dashboard**: browser at `/` — Overview | Products | Cart | Orders | Security | System
- [ ] **Jenkins**: Script Path screenshot + hard-gates table (secrets / CRITICAL / HIGH / coverage)
- [ ] **Monitoring**: Grafana “DevSecOps Shop API” dashboard; Prometheus target UP (or scrape proof via port-forward)
- [ ] **Terraform**: `validate` / `plan` with `enable_cloud=false`; mention `enable_monitoring` opt-in
- [ ] **Repo story**: phases linked from root [`README.md`](README.md)

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Docker permission / cannot connect to daemon | Add user to `docker` group, or use `sudo`; ensure Docker Desktop / dockerd is running. Compose needs access to the Docker socket. |
| Minikube OOM / CrashLoop on monitoring | Restart with more RAM: `minikube delete && minikube start --memory=4096 --cpus=2` (try 6144/8192 if needed). |
| Ingress 404 / connection refused to `shop.local` | `minikube addons enable ingress`; wait for ingress-nginx pods; confirm `kubectl -n shop get ingress`; refresh `/etc/hosts` with current `minikube ip`. |
| `/etc/hosts` stale after Minikube restart | Re-run `echo "$(minikube ip) shop.local" \| sudo tee -a /etc/hosts` (or edit the old line). |
| ImagePullBackOff for `shop-api:phase2` | Rebuild/load into Minikube (`minikube image build` or `docker build` + `minikube image load`); chart uses `pullPolicy: IfNotPresent`. |
| Host `flask security-ingest` DNS fail on `postgres` | Hostname only resolves **inside** Compose; use `docker compose exec api flask security-ingest ...` or point `DATABASE_URL` at `localhost`. |
| Grafana empty panels | Hit the API a few times; confirm ServiceMonitor / `/metrics` scrape; wait 1–2 minutes. |
| Terraform wants cloud | Keep `enable_cloud=false` (validation error if true). Use Helm option A if you prefer not to apply TF to the cluster. |
| Phase 4 paths missing | Confirm you are on latest `main` (Jenkins under `devsecops-shop-devops/jenkins/`). |

---

## Cleanup (optional)

```bash
# Monitoring
helm uninstall loki -n monitoring 2>/dev/null || true
helm uninstall kube-prometheus-stack -n monitoring 2>/dev/null || true
kubectl delete namespace monitoring --ignore-not-found

# Shop
helm uninstall shop -n shop 2>/dev/null || true
kubectl delete namespace shop --ignore-not-found

# Compose
cd devsecops-shop-app && docker compose down -v
```
