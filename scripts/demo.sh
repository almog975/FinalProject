#!/usr/bin/env bash
# Phase 6 — print (default) or lightly run ordered demo commands.
# Usage:
#   ./scripts/demo.sh                 # print runbook commands
#   ./scripts/demo.sh --run-compose   # bring up Compose (Phase 1–2)
#   ./scripts/demo.sh --pytest        # run app tests with coverage gate
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

print_runbook() {
  echo "# === FinalProject demo commands (also see DEMO.md) ==="
  echo "# Monorepo root: $ROOT"
  echo
  cat <<'CMDS'
# --- Prerequisites ---
# docker, minikube, helm, kubectl, python3/venv
# optional: gitleaks trivy checkov syft newman jenkins

# --- Phase 1–2: Compose ---
cd devsecops-shop-app
cp -n .env.example .env 2>/dev/null || true
docker compose up --build -d
curl -s http://localhost:5000/health
curl -s http://localhost:5000/ready
curl -s http://localhost:5000/metrics | head
curl -s http://localhost:5000/api/products
curl -s http://localhost:5000/api/security/sbom | head
curl -s http://localhost:5000/api/security/scan-report | head
cd ..

# --- Phase 3: Minikube + Helm ---
minikube start --memory=4096 --cpus=2
minikube addons enable ingress
./scripts/build-shop-image.sh              # builds shop-api + shop-web
# (alt) cd devsecops-shop-app && \
#   minikube image build -t shop-api:phase2 -f Dockerfile . && \
#   minikube image build -t shop-web:phase2 -f frontend/Dockerfile frontend
cd devsecops-shop-devops
helm upgrade --install shop ./helm/shop -f helm/shop/values-dev.yaml -n shop --create-namespace
echo "$(minikube ip) shop.local"   # add to /etc/hosts with sudo
curl -s http://shop.local/health
# UI dashboard (shop-web nginx; Ingress → web):
minikube service shop-web -n shop --url
# API NodePort (optional): minikube service shop -n shop --url
# Open printed URL → /  (Overview | Products | Cart | Orders | Security | System)
cd ..

# --- Phase 4: Jenkins (document / configure) ---
# Script Path: devsecops-shop-devops/jenkins/Jenkinsfile
# USE_DOCKER_AGENT=false by default (no docker.sock). Check only when node has sock.
# Hard gates: gitleaks any finding | Trivy CRITICAL | Checkov HIGH+ | coverage <70%

# --- Phase 5: Monitoring (Helm) ---
cd devsecops-shop-devops
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
# helm repo add + upgrade kube-prometheus-stack / loki — see DEMO.md
kubectl -n monitoring port-forward svc/kube-prometheus-stack-grafana 3000:80
# Dashboard JSON: monitoring/grafana/dashboards/shop-api.json
cd ..

# --- Phase 5 alt: Terraform ---
cd devsecops-shop-devops/terraform
terraform init -backend=false && terraform validate && terraform plan
# terraform apply -var='enable_monitoring=true'   # only with Minikube up
cd ../..
CMDS
  echo
  echo "# Tip: ./scripts/demo.sh --pytest   or   ./scripts/demo.sh --run-compose"
  echo "# Full narrative: DEMO.md"
}

run_compose() {
  echo "==> Phase 1–2: docker compose up --build"
  cd "$ROOT/devsecops-shop-app"
  cp -n .env.example .env 2>/dev/null || true
  docker compose up --build -d
  echo "==> Waiting for /health ..."
  for _ in $(seq 1 30); do
    if curl -sf http://localhost:5000/health >/dev/null; then
      curl -s http://localhost:5000/health; echo
      curl -s http://localhost:5000/ready; echo
      exit 0
    fi
    sleep 2
  done
  echo "WARN: /health not ready yet — check: docker compose logs api" >&2
  exit 1
}

run_pytest() {
  echo "==> pytest with coverage gate ≥70%"
  cd "$ROOT/devsecops-shop-app"
  if [[ ! -d .venv ]]; then
    python3 -m venv .venv
  fi
  # shellcheck disable=SC1091
  source .venv/bin/activate
  pip install -q -r requirements-dev.txt
  pytest -q --cov=app --cov-fail-under=70
}

case "${1:-}" in
  --run-compose) run_compose ;;
  --pytest) run_pytest ;;
  -h|--help)
    echo "Usage: $0 [--run-compose|--pytest]"
    echo "  (no args)     print ordered demo commands"
    echo "  --run-compose lightly start Compose and curl /health"
    echo "  --pytest      run unit tests with coverage gate"
    ;;
  "")
    print_runbook
    ;;
  *)
    echo "Unknown option: $1 (try --help)" >&2
    exit 2
    ;;
esac
