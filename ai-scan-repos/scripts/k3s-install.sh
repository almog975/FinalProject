#!/usr/bin/env bash
# Single-node K3s install (Traefik + local-path included) and base namespaces.
set -euo pipefail
K3S_VERSION=${K3S_VERSION:-v1.30.6+k3s1}
curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION="$K3S_VERSION" sh -s - --write-kubeconfig-mode 0600 --secrets-encryption
mkdir -p ~/.kube && sudo cat /etc/rancher/k3s/k3s.yaml > ~/.kube/config && chmod 600 ~/.kube/config
kubectl wait --for=condition=Ready node --all --timeout=180s
kubectl apply -f "$(dirname "$0")/../k8s/namespaces.yaml"
echo "Next: kubectl apply -f k8s/registry/registry.yaml && scripts/create-secrets.sh && scripts/deploy.sh"
