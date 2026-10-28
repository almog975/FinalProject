#!/usr/bin/env bash
# Creates all runtime Secrets directly in the cluster. Values are generated or
# prompted for and are NEVER written to disk or git.
# Usage: scripts/create-secrets.sh [all|app|registry]
set -euo pipefail
NS=${NS:-ai-scan-repos}
WHAT=${1:-all}
gen() { openssl rand -hex 32; }
ask() { # ask VAR "prompt" [secret]
  local var=$1 prompt=$2; [ -n "${!var:-}" ] && return
  if [ "${3:-}" = secret ]; then read -rsp "$prompt: " val; echo; else read -rp "$prompt: " val; fi
  printf -v "$var" '%s' "$val"
}
apply_secret() { kubectl -n "$1" create secret generic "$2" "${@:3}" --dry-run=client -o yaml | kubectl apply -f -; }

app() {
  ask GITHUB_CLIENT_ID "GitHub OAuth client id"
  ask GITHUB_CLIENT_SECRET "GitHub OAuth client secret" secret
  GITHUB_WEBHOOK_SECRET=${GITHUB_WEBHOOK_SECRET:-$(gen)}
  INTERNAL_API_TOKEN=${INTERNAL_API_TOKEN:-$(gen)}
  POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-$(gen)}
  AI_KEYS_ENCRYPTION_KEY=${AI_KEYS_ENCRYPTION_KEY:-$(python3 -c 'import base64,os;print(base64.urlsafe_b64encode(os.urandom(32)).decode())')}
  local db="postgresql+psycopg://aiscan:${POSTGRES_PASSWORD}@postgres:5432/aiscan"
  apply_secret "$NS" postgres-credentials --from-literal=POSTGRES_PASSWORD="$POSTGRES_PASSWORD"
  apply_secret "$NS" gateway-env --from-literal=GITHUB_CLIENT_ID="$GITHUB_CLIENT_ID" \
    --from-literal=GITHUB_CLIENT_SECRET="$GITHUB_CLIENT_SECRET" --from-literal=GITHUB_WEBHOOK_SECRET="$GITHUB_WEBHOOK_SECRET" \
    --from-literal=INTERNAL_API_TOKEN="$INTERNAL_API_TOKEN" --from-literal=DATABASE_URL="$db"
  apply_secret "$NS" review-api-env --from-literal=INTERNAL_API_TOKEN="$INTERNAL_API_TOKEN" \
    --from-literal=AI_KEYS_ENCRYPTION_KEY="$AI_KEYS_ENCRYPTION_KEY" --from-literal=DATABASE_URL="$db"
  apply_secret "$NS" scanner-worker-env --from-literal=INTERNAL_API_TOKEN="$INTERNAL_API_TOKEN"
  echo "GitHub webhook secret (configure it in the GitHub App, shown once): $GITHUB_WEBHOOK_SECRET"
}
registry() {
  command -v htpasswd >/dev/null || { echo "install apache2-utils (htpasswd)"; exit 1; }
  REGISTRY_USER=${REGISTRY_USER:-aiscan}
  REGISTRY_PASSWORD=${REGISTRY_PASSWORD:-$(gen)}
  apply_secret registry registry-htpasswd --from-literal=htpasswd="$(htpasswd -nbB "$REGISTRY_USER" "$REGISTRY_PASSWORD")"
  for ns in "$NS" jenkins; do
    kubectl -n "$ns" create secret docker-registry regcred --docker-server=registry.registry.svc.cluster.local:5000 \
      --docker-username="$REGISTRY_USER" --docker-password="$REGISTRY_PASSWORD" --dry-run=client -o yaml | kubectl apply -f -
  done
  echo "Registry user: $REGISTRY_USER (password shown once): $REGISTRY_PASSWORD"
}
case "$WHAT" in app) app;; registry) registry;; all) registry; app;; *) echo "usage: $0 [all|app|registry]"; exit 2;; esac
