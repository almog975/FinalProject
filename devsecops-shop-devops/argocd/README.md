# Argo CD — GitOps for the shop Helm chart (Phase B)

Windows **Minikube**-friendly install. Argo CD watches Git and keeps the
`shop` namespace synced to [`../helm/shop`](../helm/shop) with `values-dev.yaml`.

> **Risk (dev only):** this Application uses **auto-sync + selfHeal + prune**.
> That is convenient for demos; do **not** use that combo on production without
> review gates / AppProjects / RBAC.

Manifest: [`application-shop.yaml`](application-shop.yaml).  
Optional helper (from monorepo root): [`../../scripts/install-argocd.sh`](../../scripts/install-argocd.sh).

---

## Prerequisites

- Minikube running (`minikube start --memory=4096 --cpus=2` recommended)
- `kubectl` pointing at that cluster
- Shop images already in Minikube (same as Phase 3):

  ```bash
  # From monorepo root
  ./scripts/build-shop-image.sh
  ```

- GitHub repo `https://github.com/almog975/FinalProject` reachable from the
  cluster (public repo — no credentials required)

---

## 1. Install Argo CD (official manifests)

Prefer the upstream install YAML (works the same on Windows Minikube / WSL / Linux):

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

Wait until controller / server pods are Ready:

```bash
kubectl -n argocd get pods
kubectl -n argocd wait --for=condition=Ready pods --all --timeout=300s
```

---

## 2. Apply the shop Application

From this directory (or monorepo root with the path below):

```bash
# From monorepo root
kubectl apply -f devsecops-shop-devops/argocd/application-shop.yaml
```

Argo CD will create namespace `shop` (`CreateNamespace=true`) and sync the Helm
chart from `main` / path `devsecops-shop-devops/helm/shop` with `values-dev.yaml`.

Check sync:

```bash
kubectl -n argocd get application shop
# or in the UI: Applications → shop → Synced / Healthy
kubectl -n shop get pods,svc,ingress
```

---

## 3. Access the Argo CD UI

### Option A — port-forward (simplest)

```bash
kubectl -n argocd port-forward svc/argocd-server 8081:443
```

Open **https://localhost:8081** (accept the self-signed cert warning).

### Option B — NodePort (Windows Minikube friendly)

```bash
kubectl -n argocd patch svc argocd-server -p '{"spec":{"type":"NodePort"}}'
minikube service argocd-server -n argocd --url
```

Open the printed HTTPS URL (self-signed cert — proceed anyway).

---

## 4. Initial admin password

Username: **`admin`**

```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
echo
```

(On Windows PowerShell you can use the same `kubectl` command inside WSL / Git Bash,
or decode with `[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(...))`.)

---

## Confirm shop Synced / Healthy

1. UI → **Applications** → **shop** → status **Synced** and **Healthy**.
2. CLI:

   ```bash
   kubectl -n argocd get app shop -o jsonpath='{.status.sync.status}{" / "}{.status.health.status}{"\n"}'
   kubectl -n shop get pods
   minikube service shop-web -n shop --url   # UI NodePort via values-dev
   ```

If sync fails with ImagePullBackOff, rebuild/load images (`./scripts/build-shop-image.sh`)
and click **Refresh** / wait for selfHeal.

---

## What this does / does not do

| Does | Does not |
|------|----------|
| GitOps CD for the **shop** Helm chart | Replace Jenkins (CI hard gates stay in Phase 4) |
| Auto-sync + self-heal drift in **dev** | App-of-Apps for monitoring / Jenkins |
| Create `shop` namespace on first sync | Split into microservices |

**Defense one-liner:** Jenkins = CI hard gates (secrets / Trivy / Checkov / coverage);
Argo CD = GitOps CD that reconciles cluster state to Git and self-heals manual drift.

---

## Cleanup

```bash
kubectl delete -f application-shop.yaml --ignore-not-found
# Optional: remove Argo CD itself
kubectl delete namespace argocd --ignore-not-found
# Shop ns may remain if finalizer not set — uninstall chart if needed:
helm uninstall shop -n shop 2>/dev/null || true
kubectl delete namespace shop --ignore-not-found
```
