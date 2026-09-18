# Security hard gates & thresholds (Phase 4)

These gates **must fail** the Jenkins build (exit non-zero). Soft/advisory stages must not silently pass.

| Gate | Tool | Fail condition | Stage |
|------|------|----------------|-------|
| Unit tests | pytest (+ coverage) | Any test failure **or** coverage &lt; **70%** | Test |
| Secrets | gitleaks detect | **Any** finding | Secrets |
| Container vulns | trivy image | **CRITICAL** (exit-code 1; `--ignore-unfixed`) | Container scan |
| IaC | checkov (helm) | **HIGH** or **CRITICAL** | IaC scan |
| Lint (blocking) | flake8, helm lint, hadolint (error) | Tool non-zero exit | Lint |

## Advisory / skippable (must be visible)

| Check | Behavior when unavailable |
|-------|---------------------------|
| SonarQube SAST | If `SONAR_HOST_URL` unset → `unstable()` + WARN log (not green silent pass) |
| GHCR push | Skip with message if no `ghcr-creds` / `GHCR_TOKEN` |
| Deploy (dev) | Skip if `kubectl cluster-info` fails |
| Verify | Newman/curl against live URL **or** `helm template` smoke |
| grype | Optional after SBOM |
| hadolint missing | WARN skip (prefer install on agent) |

## Thresholds summary

- **Coverage**: ≥ 70% (`--cov-fail-under=70`)
- **Trivy**: fail on CRITICAL only (HIGH logged in JSON artifact)
- **Checkov**: hard-fail HIGH+; soft-fail LOW/MEDIUM
- **Gitleaks**: zero tolerance (allowlist only for demo placeholders — see `.gitleaks.toml`)

## Checkov intentional skips (Helm chart)

Documented skips in `security/.checkov.yaml` (not a global soft-fail): **CKV_K8S_21** / **CKV2_K8S_6** (NetworkPolicy / default-ns out of scope for Minikube v1), **CKV_K8S_35** (POSTGRES_* via secretKeyRef required by official postgres), **CKV_K8S_43** (local Minikube image tags without digests), **CKV_K8S_40** (postgres UID 999), and **CKV_K8S_22** (postgres needs a writable root FS). API pods are hardened to UID 10001 with read-only root + `/tmp` emptyDir.

## Local reproduction

```bash
# From monorepo root
gitleaks detect --source . --config devsecops-shop-devops/security/.gitleaks.toml
checkov -d devsecops-shop-devops/helm/shop --framework helm \
  --config-file devsecops-shop-devops/security/.checkov.yaml \
  --hard-fail-on HIGH,CRITICAL --soft-fail-on LOW,MEDIUM
trivy image --severity CRITICAL --exit-code 1 shop-api:<tag>
```
