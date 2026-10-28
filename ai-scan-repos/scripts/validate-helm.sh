#!/usr/bin/env bash
# Lint + render + schema-validate + Checkov the chart for every values file.
set -euo pipefail
cd "$(dirname "$0")/../helm"
OUT=$(mktemp -d)
for v in values values-dev values-k3s; do
  helm lint ai-scan-repos -f "ai-scan-repos/$v.yaml"
  helm template ais ai-scan-repos -n ai-scan-repos -f "ai-scan-repos/$v.yaml" > "$OUT/$v.yaml"
done
kubeconform -strict -summary -schema-location default \
  -schema-location 'https://raw.githubusercontent.com/datreeio/CRDs-catalog/main/{{.Group}}/{{.ResourceKind}}_{{.ResourceAPIVersion}}.json' \
  "$OUT"/*.yaml
# Resource-level skips live in checkov.io/skip annotations (each with a reason).
checkov -f "$OUT/values.yaml" -f "$OUT/values-k3s.yaml" --framework kubernetes --compact --quiet
# values-dev uses imagePullPolicy IfNotPresent on purpose (images imported locally with k3d/ctr, no registry).
checkov -f "$OUT/values-dev.yaml" --framework kubernetes --compact --quiet --skip-check CKV_K8S_15
echo "helm validation OK"
