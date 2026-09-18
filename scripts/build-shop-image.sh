#!/usr/bin/env bash
# Build shop-api image for Minikube demos.
# Prefers host Docker (then minikube image load); falls back to minikube image build.
# Usage: ./scripts/build-shop-image.sh [tag]
#   tag defaults to phase2 → shop-api:phase2
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="${ROOT}/devsecops-shop-app"
TAG="${1:-phase2}"
IMAGE="shop-api:${TAG}"

cd "${APP_DIR}"

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo "==> Path: docker build (host Docker usable)"
  docker build -t "${IMAGE}" .
  if command -v minikube >/dev/null 2>&1 && minikube status >/dev/null 2>&1; then
    echo "==> Loading ${IMAGE} into Minikube"
    minikube image load "${IMAGE}"
  else
    echo "==> minikube not available/running — image built locally only (${IMAGE})"
  fi
  echo "==> Done via docker build (+ optional minikube image load)"
  exit 0
fi

if command -v minikube >/dev/null 2>&1; then
  echo "==> Path: minikube image build (no usable host Docker)"
  minikube image build -t "${IMAGE}" .
  echo "==> Done via minikube image build"
  exit 0
fi

echo "ERROR: neither usable Docker (docker info) nor minikube available" >&2
exit 1
