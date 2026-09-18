# DevSecOps Shop — DevOps

Helm chart (Phase 3) + **Jenkins CI/CD pipeline** (Phase 4) for the shop API.

Out of scope here: Terraform, Prometheus/Grafana stack.

## Layout

```
devsecops-shop-devops/
  helm/shop/                 # Minikube Helm chart (API + in-chart Postgres)
  jenkins/
    Jenkinsfile              # Declarative pipeline (12 stages)
    scripts/                 # Thin helpers (Trivy summary, SBOM fallback)
  security/
    .gitleaks.toml           # Secrets scan config + demo allowlist
    .checkov.yaml            # IaC scan config (hard-fail HIGH+)
    checkov/baseline.md      # Skipped-check rationale
    policies/README.md       # Hard gates & thresholds
  newman/
    shop-api.postman_collection.json
```

## Phase 4 — Jenkins pipeline

### Stages

| # | Stage | Hard gate? | Notes |
|---|-------|------------|-------|
| 1 | Checkout | — | SCM + short SHA tag |
| 2 | Lint | yes (flake8 / helm / hadolint error) | flake8 app; helm lint; hadolint |
| 3 | Test | **yes** | pytest + coverage **≥70%** |
| 4 | Secrets | **yes** | gitleaks detect — fail on findings |
| 5 | SAST | advisory | SonarQube if `SONAR_HOST_URL`; else **unstable** + WARN (not silent pass) |
| 6 | Build | yes | `docker build` → `shop-api:${GIT_COMMIT}` (+ BUILD_NUMBER, phase2) |
| 7 | Container scan | **yes** | Trivy — fail on **CRITICAL** |
| 8 | IaC scan | **yes** | Checkov on `helm/shop` — fail on **HIGH+** |
| 9 | SBOM | — | syft → `sbom.json` (fallback script if no syft); optional grype |
| 10 | Push | skippable | GHCR `ghcr.io/almog975/shop-api:...` when creds present |
| 11 | Deploy (dev) | skippable | `helm upgrade --install` + `values-dev` when cluster up |
| 12 | Verify | smoke | Newman/curl vs deploy URL **or** `helm template` smoke |

Hard-gate details: [`security/policies/README.md`](security/policies/README.md).

### How to run the Jenkinsfile

1. Install a Jenkins controller (LTS) with the **Pipeline** plugin.
2. Point a Multibranch Pipeline or Pipeline job at this monorepo; set **Script Path** to:
   ```
   devsecops-shop-devops/jenkins/Jenkinsfile
   ```
3. Use agent label `any` (or a Docker agent image that already has the tools below on `PATH`).
4. Build the `phase-4-jenkins-pipeline` branch (or `main` after merge).

Paths inside the Jenkinsfile are relative to the **monorepo root**.

### Credentials & environment

| Name | Type | Purpose |
|------|------|---------|
| `ghcr-creds` | Username/password | Docker login to `ghcr.io` (user `almog975`, PAT with `write:packages`) |
| `GHCR_TOKEN` | Env / secret text | Fallback token if Jenkins credential id missing |
| `GHCR_USER` | Env | Optional; defaults to `almog975` with token login |
| `SONAR_HOST_URL` | Env | SonarQube server; **omit** to skip SAST (marks build **UNSTABLE**) |
| `SONAR_TOKEN` | Secret text | SonarQube auth |
| Kubeconfig | Agent file / env | Needed for Deploy; Verify falls back to helm template |

### Agent tools (student Jenkins)

Install on the agent (or bake into the agent image) so they are on `PATH`:

| Tool | Used for |
|------|----------|
| `docker` | Build / tag / push |
| `helm` | Lint, deploy, template verify |
| `python3` + venv | flake8, pytest, helper scripts |
| `flake8` | App lint (also `pip install` in stage) |
| `hadolint` | Dockerfile lint |
| `gitleaks` | Secrets (hard gate) |
| `trivy` | Image scan (hard gate) |
| `checkov` | Helm IaC (hard gate) |
| `syft` | SBOM (fallback script if missing) |
| `newman` or `npx newman` | API verify |
| `kubectl` | Deploy / live verify |
| `sonar-scanner` | Optional SAST |
| `grype` | Optional SBOM vuln table |
| `curl` | Health smoke |

### SonarQube note

If `SONAR_HOST_URL` is **not** set, the SAST stage calls Jenkins `unstable()` and prints a clear WARN. That is intentional — do not treat a green build as “SAST passed” without Sonar configured.

Coverage follow-up: the Test stage already enforces `--cov-fail-under=70` via pytest-cov. If an agent cannot install pytest-cov, fall back to `pytest -q` and document the gap — current Jenkinsfile prefers the gate.

## Helm (Phase 3) — quick Minikube

```bash
# From monorepo root / this directory
minikube start && minikube addons enable ingress
# build/load image from ../devsecops-shop-app
helm upgrade --install shop ./helm/shop -f helm/shop/values-dev.yaml -n shop --create-namespace
echo "$(minikube ip) shop.local" | sudo tee -a /etc/hosts
curl -s http://shop.local/health
```

Smoke-render without a cluster:

```bash
helm template shop ./helm/shop -f helm/shop/values-dev.yaml -n shop
```

## Newman (local)

```bash
# API up on localhost:5000 (compose or port-forward)
newman run newman/shop-api.postman_collection.json --env-var baseUrl=http://localhost:5000
# or: npx newman run ...
```

Collection covers: `/health`, `/ready`, products CRUD, cart, orders, `GET /api/security/sbom`, `GET /api/security/scan-report`.

## Local pipeline-ish checks (no Jenkins)

```bash
# From monorepo root
cd devsecops-shop-app && python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt flake8
flake8 app wsgi.py --max-line-length=100
pytest -q --cov=app --cov-fail-under=70
cd ..
helm lint devsecops-shop-devops/helm/shop -f devsecops-shop-devops/helm/shop/values-dev.yaml
# if installed:
gitleaks detect --source . --config devsecops-shop-devops/security/.gitleaks.toml
checkov -d devsecops-shop-devops/helm/shop --framework helm \
  --config-file devsecops-shop-devops/security/.checkov.yaml
```
