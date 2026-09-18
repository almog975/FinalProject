# Phase 5 — Terraform entrypoint (local / Minikube only by default)
#
# - enable_cloud=false  → never create AWS/GCP/Azure resources (validated)
# - enable_monitoring=false → safe for `terraform validate` without a cluster
# - enable_monitoring=true  → helm_release kube-prometheus-stack + loki-stack
#   against the current kubecontext (see README for Minikube steps)
#
# Prefer the documented Helm CLI path in ../monitoring/README.md if you do not
# want Terraform to talk to a live cluster.

resource "kubernetes_namespace" "monitoring" {
  count = var.enable_monitoring ? 1 : 0

  metadata {
    name = var.monitoring_namespace
    labels = {
      "app.kubernetes.io/part-of" = "devsecops-shop"
      "app.kubernetes.io/phase"   = "5-monitoring"
    }
  }
}

module "monitoring" {
  count  = var.enable_monitoring ? 1 : 0
  source = "./modules/monitoring"

  namespace                           = kubernetes_namespace.monitoring[0].metadata[0].name
  shop_namespace                      = var.shop_namespace
  shop_release_name                   = var.shop_release_name
  values_dir                          = abspath("${path.module}/${var.values_dir}")
  kube_prometheus_stack_chart_version = var.kube_prometheus_stack_chart_version
  loki_stack_chart_version            = var.loki_stack_chart_version
  dashboard_json_path                 = abspath("${path.module}/${var.values_dir}/grafana/dashboards/shop-api.json")
}
