# Checkov baseline notes

Scans run against `helm/shop` with `security/.checkov.yaml`.

Intentionally skipped (student Minikube chart constraints):

| Check | Reason |
|-------|--------|
| NetworkPolicy (CKV2_K8S_6) | Out of scope until later hardening |
| Default namespace concerns | Deploy uses `-n shop` |

Do **not** skip HIGH/CRITICAL findings without documenting here and updating the Jenkins hard-fail list.
