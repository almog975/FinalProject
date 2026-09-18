# DevSecOps Shop — DevOps (Phase 3)

Helm chart for deploying the shop API + Postgres on **Minikube**.

Jenkins, Terraform, and Prometheus stack are out of scope for this phase.

## Why in-chart Postgres (not Bitnami)

v1 ships a simple Postgres `Deployment` + `Service` + optional PVC / `emptyDir` inside this chart.

- Fewer moving parts for student Minikube demos
- No external chart repository pull (works offline / air-gapped)
- Placeholders only for DB credentials — override via values / `--set` for anything beyond local demo

## Layout

```
helm/shop/
  Chart.yaml
  values.yaml          # defaults (image shop-api:phase2)
  values-dev.yaml      # Minikube-oriented overrides
  files/               # bundled sample SBOM + scan-report (ConfigMap mount)
  templates/           # api, postgres, ingress, secrets, configmaps
```

## Prerequisites

- Minikube
- Helm 3
- Docker (to build the API image)
- Ingress addon (nginx)

## Build / load the API image

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

## Minikube install (copy-paste)

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

## Smoke-render without a cluster

```bash
helm template shop ./helm/shop -f helm/shop/values-dev.yaml -n shop
```

## Security artifacts in the chart

Sample `files/sbom.json` and `files/scan-report.json` are packaged into a ConfigMap and mounted read-only at `/artifacts` so `GET /api/security/sbom` and `GET /api/security/scan-report` work with `source: "file"` on Minikube demos (same filenames the app expects under `SECURITY_ARTIFACTS_DIR`).

To use an empty volume instead (pipeline drops files later), set in values:

```yaml
api:
  securityArtifacts:
    source: emptyDir
```

## Useful commands

```bash
kubectl -n shop get pods,svc,ingress
kubectl -n shop logs -l app.kubernetes.io/component=api -f
helm uninstall shop -n shop
```

## Out of scope (later phases)

- Jenkins CI/CD
- Terraform
- Prometheus / Grafana stack
- NetworkPolicy (skipped for v1)
