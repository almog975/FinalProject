#!/usr/bin/env bash
# helm upgrade --install the chart. Usage: scripts/deploy.sh [k3s|dev] [extra helm args]
set -euo pipefail
ENV=${1:-k3s}; shift || true
CHART="$(dirname "$0")/../helm/ai-scan-repos"
for s in gateway-env review-api-env scanner-worker-env postgres-credentials; do
  kubectl -n ai-scan-repos get secret "$s" >/dev/null || { echo "missing secret $s: run scripts/create-secrets.sh"; exit 1; }
done
helm upgrade --install ai-scan-repos "$CHART" -n ai-scan-repos \
  -f "$CHART/values.yaml" -f "$CHART/values-$ENV.yaml" --wait --timeout 10m "$@"
