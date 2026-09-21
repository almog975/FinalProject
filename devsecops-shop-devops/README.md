# DevSecOps Shop — DevOps (Phases 3–5)

Presenter runbook (all phases): [`../DEMO.md`](../DEMO.md).

Helm chart for Minikube (Phase 3), **Jenkins CI/CD with hard gates** (Phase 4), and **Terraform + Prometheus/Grafana/Loki** (Phase 5).

## Layout

```
devsecops-shop-devops/
  helm/shop/                 # Minikube Helm chart (API + in-chart Postgres) — Phase 3
  jenkins/                   # Declarative Jenkinsfile + pod-templates/ + helper scripts — Phase 4
  security/                  # gitleaks / checkov / policies — Phase 4
  newman/                    # Postman collection — Phase 4
  terraform/                 # Local/Minikube Terraform (no cloud bills by default) — Phase 5
  monitoring/                # kube-prometheus-stack + Loki values + Grafana dashboard — Phase 5
```

---

## Phase 3 — Helm (Minikube)

### Why in-chart Postgres (not Bitnami)

v1 ships a simple Postgres `Deployment` + `Service` + optional PVC / `emptyDir` inside this chart.

- Fewer moving parts for student Minikube demos
- No external chart repository pull (works offline / air-gapped)
- Placeholders only for DB credentials — override via values / `--set` for anything beyond local demo

### Prerequisites

- Minikube
- Helm 3
- Docker (to build the API image)
- Ingress addon (nginx)

### Build / load API + web images

The chart defaults to `shop-api:phase2` and `shop-web:phase2`. From the **monorepo root**, prefer the helper (builds **both**, auto-selects Docker vs Minikube):

```bash
./scripts/build-shop-image.sh              # tag defaults to phase2
# ./scripts/build-shop-image.sh mytag

# Manual equivalents (from devsecops-shop-app):
# Option A — Minikube build (when host Docker is broken / unavailable)
minikube image build -t shop-api:phase2 -f Dockerfile .
minikube image build -t shop-web:phase2 -f frontend/Dockerfile frontend

# Option B — local Docker, then load into Minikube
docker build -t shop-api:phase2 -f Dockerfile .
docker build -t shop-web:phase2 -f frontend/Dockerfile frontend
minikube image load shop-api:phase2
minikube image load shop-web:phase2
```

Confirm the images are visible to the cluster:

```bash
minikube image ls | grep -E 'shop-api|shop-web'
```

### Minikube install (copy-paste)

```bash
minikube start
minikube addons enable ingress
# build/load image from ../devsecops-shop-app (see above)
helm upgrade --install shop ./helm/shop -f helm/shop/values-dev.yaml -n shop --create-namespace
```

Map the Ingress host (after install):

```bash
echo "$(minikube ip) shop.local" | sudo tee -a /etc/hosts
curl -s http://shop.local/health
# Or UI: minikube service shop-web -n shop --url   # NodePort via values-dev.yaml
curl -s http://shop.local/ready
curl -s http://shop.local/api/security/sbom | head
```

### Shop UI (shop-web)

The React SPA runs in a separate **`shop-web`** nginx Deployment/Service (`web.enabled`, default true). Ingress `shop.local` points at **shop-web**; nginx proxies `/api/`, `/health`, `/ready`, `/metrics` to the API Service (`web.apiUpstream`, default `shop:5000`). After rebuild + `helm upgrade`, open:

```bash
minikube service shop-web -n shop --url
# Direct API NodePort (optional): minikube service shop -n shop --url
```

Or `http://shop.local/` when Ingress + `/etc/hosts` are set.

### Smoke-render without a cluster

```bash
helm template shop ./helm/shop -f helm/shop/values-dev.yaml -n shop
```

### Security artifacts in the chart

Sample SBOM + scan-report JSON under `helm/shop/files/` are mounted into the API so `/api/security/*` works in demos.

### Useful commands

```bash
kubectl -n shop get pods,svc,ingress
kubectl -n shop logs -l app.kubernetes.io/component=api -f
kubectl -n shop logs -l app.kubernetes.io/component=web -f
helm uninstall shop -n shop
```

---

## Phase 4 — Jenkins pipeline

### Stages

| # | Stage | Hard gate? | Notes |
|---|-------|------------|-------|
| 1 | Checkout | — | SCM + short SHA tag |
| 2 | Lint | yes (flake8 / helm / hadolint error) | flake8 app; helm lint; hadolint |
| 3 | Test | **yes** | pytest + coverage **≥70%** |
| 4 | Secrets | **yes** | gitleaks detect — fail on findings |
| 5 | SAST | advisory | SonarQube if `SONAR_HOST_URL`; else **unstable** + WARN (not silent pass) |
| 6 | Build | when Docker agent | `USE_DOCKER_AGENT` → `docker build` tags; else unstable skip (default Minikube) |
| 7 | Container scan | **yes** (if image) | Trivy — fail on **CRITICAL**; skipped unless `IMAGE_BUILT=true` |
| 8 | IaC scan | **yes** | Checkov on `helm/shop` — fail on **HIGH+** |
| 9 | SBOM | — | syft → `sbom.json` (fallback script if no syft); optional grype |
| 10 | Push | skippable | GHCR when `IMAGE_BUILT` + `ghcr-creds` / `GHCR_TOKEN` |
| 11 | Deploy (dev) | skippable | `helm upgrade --install` + `values-dev` when cluster up |
| 12 | Verify | smoke | Newman/curl vs deploy URL **or** `helm template` smoke |

Hard-gate details: [`security/policies/README.md`](security/policies/README.md).

### How to run the Jenkinsfile

1. Install a Jenkins controller (LTS) with the **Pipeline** + **Kubernetes** plugins (Minikube Jenkins chart is fine).
2. Point a Multibranch Pipeline or Pipeline job at this monorepo; set **Script Path** to:
   ```
   devsecops-shop-devops/jenkins/Jenkinsfile
   ```
3. Build the `main` branch. The pipeline uses `agent none` + a Kubernetes pod agent (see templates below).
4. Paths inside the Jenkinsfile are relative to the **monorepo root**.

### Dual-path Docker agent (`USE_DOCKER_AGENT`)

| Param | Default | Pod template | When to use |
|-------|---------|--------------|-------------|
| `USE_DOCKER_AGENT=false` | **yes** | [`jenkins/pod-templates/default.yaml`](jenkins/pod-templates/default.yaml) | Student Minikube / broken host Docker — **no** `docker.sock` |
| `USE_DOCKER_AGENT=true` | no | [`jenkins/pod-templates/with-docker.yaml`](jenkins/pod-templates/with-docker.yaml) | Node has a real `/var/run/docker.sock` (Docker Desktop / Linux dockerd / `minikube docker-env`) |

- **Default is safe:** no docker container and no Socket hostPath (a missing sock on Windows Minikube previously blocked the whole agent at ContainerCreating).
- **Enable Docker later:** check **USE_DOCKER_AGENT** on the job **and** ensure the K8s node exposes `/var/run/docker.sock`. If the sock is missing, the pod stays Pending.
- Sidecars (both templates): `python`, `gitleaks`, `checkov`, `trivy`, `helm` (low resource requests). Opt-in adds `docker:27-cli` + `docker-sock` volumeMount.

### Credentials & environment

| Name | Type | Purpose |
|------|------|---------|
| `ghcr-creds` | Username/password | Docker login to `ghcr.io` (user `almog975`, PAT with `write:packages`) |
| `GHCR_TOKEN` | Env / secret text | Fallback token if Jenkins credential id missing |
| `GHCR_USER` | Env | Optional; defaults to `almog975` with token login |
| `SONAR_HOST_URL` | Env | SonarQube server; **omit** to skip SAST (marks build **UNSTABLE**) |
| `SONAR_TOKEN` | Secret text | SonarQube auth |
| Kubeconfig | Agent file / env | Needed for Deploy; Verify falls back to helm template |

### Agent tools (student Jenkins)

Most tools ship as **Kubernetes sidecars** in the pod templates (no install on the JNLP container). For a non-K8s agent, install on `PATH`:

| Tool | Used for |
|------|----------|
| `docker` | Build / tag / push |
| `helm` | Lint, deploy, template verify |
| `python3` + venv | flake8, pytest, helper scripts |
| `flake8` | App lint (also `pip install` in stage) |
| `hadolint` | Dockerfile lint |
| `gitleaks` | Secrets (hard gate) |
| `trivy` | Image scan (hard gate) |
| `checkov` | Helm IaC (hard gate) |
| `syft` | SBOM (fallback script if missing) |
| `newman` or `npx newman` | API verify |
| `kubectl` | Deploy / live verify |
| `sonar-scanner` | Optional SAST |
| `grype` | Optional SBOM vuln table |
| `curl` | Health smoke |

### SonarQube note

If `SONAR_HOST_URL` is **not** set, the SAST stage calls Jenkins `unstable()` and prints a clear WARN. That is intentional — do not treat a green build as “SAST passed” without Sonar configured.

Coverage follow-up: the Test stage already enforces `--cov-fail-under=70` via pytest-cov. If an agent cannot install pytest-cov, fall back to `pytest -q` and document the gap — current Jenkinsfile prefers the gate.

## Newman (local)

```bash
# API up on localhost:5000 (compose or port-forward)
newman run newman/shop-api.postman_collection.json --env-var baseUrl=http://localhost:5000
# or: npx newman run ...
```

Collection covers: `/health`, `/ready`, products CRUD, cart, orders, `GET /api/security/sbom`, `GET /api/security/scan-report`.

## Local pipeline-ish checks (no Jenkins)

```bash
# From monorepo root
cd devsecops-shop-app && python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt flake8
flake8 app wsgi.py --max-line-length=100
pytest -q --cov=app --cov-fail-under=70
cd ..
helm lint devsecops-shop-devops/helm/shop -f devsecops-shop-devops/helm/shop/values-dev.yaml
# if installed:
gitleaks detect --source . --config devsecops-shop-devops/security/.gitleaks.toml
checkov -d devsecops-shop-devops/helm/shop --framework helm \
  --config-file devsecops-shop-devops/security/.checkov.yaml
```

---

## Phase 5 — Terraform + monitoring

Adds a **demo-safe** Terraform stack and Helm values to run Prometheus, Grafana, Alertmanager, Loki, and Promtail on Minikube. Scrapes the Phase 3 shop API at `GET /metrics` (metrics: `flask_http_request_total`, `flask_http_request_duration_seconds`).

| Piece | Path |
|-------|------|
| Terraform | [`terraform/`](terraform/) — `enable_cloud=false`, `enable_monitoring=false` by default |
| Helm values | [`monitoring/kube-prometheus-stack-values.yaml`](monitoring/kube-prometheus-stack-values.yaml), [`monitoring/loki-values.yaml`](monitoring/loki-values.yaml) |
| Grafana dashboard | [`monitoring/grafana/dashboards/shop-api.json`](monitoring/grafana/dashboards/shop-api.json) (“DevSecOps Shop API”) |
| How-to | [`monitoring/README.md`](monitoring/README.md), [`terraform/README.md`](terraform/README.md) |

### Terraform (validate offline / apply on Minikube)

```bash
cd terraform
terraform init -backend=false
terraform fmt -recursive
terraform validate
terraform plan                                    # no cluster writes (enable_monitoring=false)

# With Minikube up and Phase 3 shop installed:
terraform apply -var='enable_monitoring=true'
terraform destroy -var='enable_monitoring=true'
```

### Helm CLI monitoring install (no Terraform required)

```bash
# From this directory (devsecops-shop-devops)
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

kubectl -n monitoring port-forward svc/kube-prometheus-stack-grafana 3000:80
# Grafana: admin / prom-operator (demo only) → dashboard "DevSecOps Shop API"
```

Optional later: a Jenkins stage could deploy or smoke-check this stack — **not implemented** here.

---

## Out of scope

- Multi-cloud Terraform, Vault, paid APM
- NetworkPolicy (skipped for Helm v1)

Phase 6 demo runbook: [`../DEMO.md`](../DEMO.md).
