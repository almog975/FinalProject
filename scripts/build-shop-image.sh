#!/usr/bin/env bash
# Build shop-api + shop-web images for Minikube demos.
# Prefers host Docker (then minikube image load); falls back to minikube image build.
# Usage: ./scripts/build-shop-image.sh [tag]
#   tag defaults to phase2 → shop-api:phase2 and shop-web:phase2
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="${ROOT}/devsecops-shop-app"
TAG="${1:-phase2}"
API_IMAGE="shop-api:${TAG}"
WEB_IMAGE="shop-web:${TAG}"

cd "${APP_DIR}"

build_with_docker() {
  echo "==> Path: docker build (host Docker usable)"
  docker build -t "${API_IMAGE}" -f Dockerfile .
  docker build -t "${WEB_IMAGE}" -f frontend/Dockerfile frontend
  if command -v minikube >/dev/null 2>&1 && minikube status >/dev/null 2>&1; then
    echo "==> Loading ${API_IMAGE} and ${WEB_IMAGE} into Minikube"
    minikube image load "${API_IMAGE}"
    minikube image load "${WEB_IMAGE}"
  else
    echo "==> minikube not available/running — images built locally only"
  fi
  echo "==> Done via docker build (+ optional minikube image load)"
}

build_with_minikube() {
  echo "==> Path: minikube image build (no usable host Docker)"
  minikube image build -t "${API_IMAGE}" -f Dockerfile .
  minikube image build -t "${WEB_IMAGE}" -f frontend/Dockerfile frontend
  echo "==> Done via minikube image build"
}

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  build_with_docker
  exit 0
fi

if command -v minikube >/dev/null 2>&1; then
  build_with_minikube
  exit 0
fi

echo "ERROR: neither usable Docker (docker info) nor minikube available" >&2
exit 1
