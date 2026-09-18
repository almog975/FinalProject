# Phase 5 — Monitoring (Minikube)

Prometheus + Grafana (+ Alertmanager) via **kube-prometheus-stack**, and **Loki + Promtail** via **loki-stack**.

Targets the Phase 3 Helm release:

| Item | Value |
|------|--------|
| Release | `shop` |
| Namespace | `shop` |
| Ingress | `shop.local` |
| Metrics | `GET /metrics` (`flask_http_request_total`, `flask_http_request_duration_seconds`) |
| Service labels | `app.kubernetes.io/name=shop`, `app.kubernetes.io/instance=shop`, `app.kubernetes.io/component=api` |
| Port | `http` (5000) |

## Prerequisites

1. Minikube running with ingress (Phase 3 app installed — see root devops README).
2. Helm 3.
3. Enough Minikube memory (recommend `minikube start --memory=4096 --cpus=2` or higher).

## Install with Helm CLI (copy-paste)

```bash
# From monorepo: FinalProject/devsecops-shop-devops
cd "$(git rev-parse --show-toplevel)/devsecops-shop-devops"

kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --version 65.1.0 \
  -f monitoring/kube-prometheus-stack-values.yaml \
  --wait --timeout 15m

helm upgrade --install loki grafana/loki-stack \
  --namespace monitoring \
  --version 2.10.2 \
  -f monitoring/loki-values.yaml \
  --wait --timeout 10m

# Load shop-api Grafana dashboard (sidecar label grafana_dashboard=1)
kubectl -n monitoring create configmap shop-api-dashboard \
  --from-file=shop-api.json=monitoring/grafana/dashboards/shop-api.json \
  --dry-run=client -o yaml \
  | kubectl label --local -f - grafana_dashboard=1 -o yaml \
  | kubectl apply -f -
```

## Install with Terraform (optional)

See [`../terraform/README.md`](../terraform/README.md). Set `enable_monitoring=true` only when Minikube is up; default is `false` so `validate` works offline.

## Access Grafana / Prometheus

```bash
# Grafana (admin / prom-operator — demo password in values; change locally)
# Preferred on Minikube (NodePort in values):
minikube service kube-prometheus-stack-grafana -n monitoring --url
# Or:
kubectl -n monitoring port-forward svc/kube-prometheus-stack-grafana 3000:80
# open http://localhost:3000  → dashboard "DevSecOps Shop API"

# Prometheus UI
kubectl -n monitoring port-forward svc/kube-prometheus-stack-prometheus 9090:9090
# Status → Targets → look for serviceMonitor/monitoring/shop-api
```

Generate traffic so panels populate:

```bash
curl -s http://shop.local/health
curl -s http://shop.local/api/products
# or: newman run newman/shop-api.postman_collection.json --env-var baseUrl=http://shop.local
```

## Verify scrape

```bash
kubectl -n shop get svc,pods -l app.kubernetes.io/component=api
kubectl -n shop port-forward svc/shop 5000:5000
# other terminal:
curl -s http://127.0.0.1:5000/metrics | grep flask_http_request
```

In Prometheus, try:

```promql
sum(rate(flask_http_request_total[1m])) by (method, path)
histogram_quantile(0.95, sum(rate(flask_http_request_duration_seconds_bucket[5m])) by (le))
```

## Uninstall

```bash
helm uninstall loki -n monitoring
helm uninstall kube-prometheus-stack -n monitoring
kubectl delete namespace monitoring
```

## Optional future Jenkins stage

A later CI stage could `helm upgrade` this stack or run a smoke check against Prometheus targets. **Not implemented in Phase 4/5** — mention only.

## Out of scope

- Multi-cloud / paid APM / Vault

Demo runbook: [`../../DEMO.md`](../../DEMO.md).
