# Private registry

1. `kubectl apply -f ../namespaces.yaml -f registry.yaml`
2. Auth secret (CLI only): `../../scripts/create-secrets.sh registry` — generates an htpasswd
   entry with `htpasswd -nbB` and creates `registry/registry-htpasswd` + `ai-scan-repos/regcred`.
3. Copy `registries.yaml.example` to `/etc/rancher/k3s/registries.yaml`, fill credentials, restart k3s.
4. Push: `docker login localhost:30500 && docker push localhost:30500/ai-scan-repos/<image>:<tag>`.
