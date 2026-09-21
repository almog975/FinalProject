#!/usr/bin/env bash
# Install Argo CD (official manifests) + apply shop Application.
# Usage (from monorepo root or anywhere):
#   ./scripts/install-argocd.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_MANIFEST="$ROOT/devsecops-shop-devops/argocd/application-shop.yaml"
INSTALL_URL="https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml"

echo "==> Creating namespace argocd"
kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -

echo "==> Applying Argo CD install manifests"
kubectl apply -n argocd -f "$INSTALL_URL"

echo "==> Waiting for Argo CD pods to be Ready (up to 5m)"
kubectl -n argocd wait --for=condition=Ready pods --all --timeout=300s

if [[ ! -f "$APP_MANIFEST" ]]; then
  echo "ERROR: missing Application manifest: $APP_MANIFEST" >&2
  exit 1
fi

echo "==> Applying shop Application"
kubectl apply -f "$APP_MANIFEST"

echo
echo "==> Initial admin password (user: admin):"
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d
echo
echo
echo "==> Open UI (port-forward):"
echo "    kubectl -n argocd port-forward svc/argocd-server 8081:443"
echo "    → https://localhost:8081  (accept self-signed cert)"
echo
echo "==> Or NodePort:"
echo "    kubectl -n argocd patch svc argocd-server -p '{\"spec\":{\"type\":\"NodePort\"}}'"
echo "    minikube service argocd-server -n argocd --url"
echo
echo "==> Check Application:"
echo "    kubectl -n argocd get application shop"
echo "    # UI: shop → Synced / Healthy"
