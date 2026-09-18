# Checkov baseline notes

Scans run against `helm/shop` with `security/.checkov.yaml`.

Intentionally skipped (student Minikube chart constraints):

| Check | Reason |
|-------|--------|
| CKV_K8S_21 | Default namespace concerns — deploy uses `-n shop` |
| CKV2_K8S_6 | NetworkPolicy — out of scope until later hardening |
| CKV_K8S_35 | Secrets as env — official postgres needs POSTGRES_* |
| CKV_K8S_43 | Image digest — Minikube local tags have no digest |
| CKV_K8S_40 | UID ≥ 10000 — postgres official image uses 999 |
| CKV_K8S_22 | readOnlyRootFilesystem — postgres needs writable FS |

Do **not** skip HIGH/CRITICAL findings without documenting here and updating the Jenkins hard-fail list. Do **not** globally soft-fail the scan.
