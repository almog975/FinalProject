# DevSecOps Shop — DevOps (Phase 3 + Phase 5)

Presenter runbook (all phases): [`../DEMO.md`](../DEMO.md).

Helm chart for deploying the shop API + Postgres on **Minikube** (Phase 3), plus **Terraform + Prometheus/Grafana/Loki monitoring** (Phase 5).

Jenkins CI/CD (Phase 4) may live in sibling dirs / a separate PR (`jenkins/`, `security/`, `newman/`) and is **not required** to run Phase 3 or Phase 5 from `main`.

## Layout

```
devsecops-shop-devops/
  helm/shop/                 # Minikube Helm chart (API + in-chart Postgres) — Phase 3
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

### Build / load the API image

The chart defaults to `shop-api:phase2`. Build from the app directory and load into Minikube:

```bash
# From monorepo root
cd ../devsecops-shop-app   # or: cd devsecops-shop-app from FinalProject root

# Option A — Minikube build (preferred when docker points at the Minikube daemon)
minikube image build -t shop-api:phase2 .

# Option B — local Docker, then load into Minikube
docker build -t shop-api:phase2 .
minikube image load shop-api:phase2
```

Confirm the image is visible to the cluster:

```bash
minikube image ls | grep shop-api
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
curl -s http://shop.local/ready
curl -s http://shop.local/api/security/sbom | head
```

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
helm uninstall shop -n shop
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
