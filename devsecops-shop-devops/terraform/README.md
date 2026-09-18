# Phase 5 — Terraform (local / Minikube)

Demo-safe Terraform for the DevSecOps Shop monitoring stack.

| Flag | Default | Effect |
|------|---------|--------|
| `enable_cloud` | `false` | **Must stay false** — no AWS/GCP/Azure (validation error if true) |
| `enable_monitoring` | `false` | When `true`, deploys kube-prometheus-stack + loki-stack via Helm to the current kubecontext |

State backend: **local** (see `envs/dev/backend.tf.example`). No remote backend / no cloud bill by default.

## Layout

```
terraform/
  versions.tf providers.tf variables.tf outputs.tf main.tf
  modules/monitoring/     # helm_release + dashboard ConfigMap
  envs/dev/
    terraform.tfvars.example
    backend.tf.example
```

Helm values and the Grafana dashboard live under [`../monitoring/`](../monitoring/).

## Prerequisites

- Terraform >= 1.5
- For **apply** with monitoring: Minikube (or any cluster) + Helm provider access to kubeconfig
- Phase 3 shop release recommended before scraping (`helm upgrade --install shop ... -n shop`)

## Commands (copy-paste)

```bash
cd "$(git rev-parse --show-toplevel)/devsecops-shop-devops/terraform"

# Init (no backend config required — local state)
terraform init -backend=false
# or: terraform init

terraform fmt -check -recursive   # or: terraform fmt -recursive
terraform validate

# Plan with defaults (no cluster writes — enable_monitoring=false)
terraform plan

# --- only with Minikube running ---
terraform plan  -var='enable_monitoring=true'
terraform apply -var='enable_monitoring=true'
terraform destroy -var='enable_monitoring=true'
```

Using the example tfvars:

```bash
cp envs/dev/terraform.tfvars.example envs/dev/terraform.tfvars
# edit: enable_monitoring = true
terraform plan -var-file=envs/dev/terraform.tfvars
```

Optional local backend path:

```bash
cp envs/dev/backend.tf.example backend.tf
terraform init
```

## Helm-only alternative

If you prefer not to run Terraform against a live cluster, apply the same values with Helm CLI — see [`../monitoring/README.md`](../monitoring/README.md).

## What gets created when `enable_monitoring=true`

1. Namespace `monitoring`
2. `helm_release` **kube-prometheus-stack** (Prometheus, Grafana, Alertmanager) + ServiceMonitor for shop-api
3. `helm_release` **loki** (loki-stack: Loki + Promtail)
4. ConfigMap `shop-api-dashboard` (Grafana sidecar)

## Secrets

Do not commit real credentials. Demo Grafana password is in `monitoring/kube-prometheus-stack-values.yaml` for local Minikube only — override locally / via `--set` for anything else.
