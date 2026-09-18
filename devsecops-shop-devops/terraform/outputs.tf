output "enable_cloud" {
  description = "Cloud resources flag (always false in default demos)."
  value       = var.enable_cloud
}

output "enable_monitoring" {
  description = "Whether Helm monitoring releases were requested."
  value       = var.enable_monitoring
}

output "monitoring_namespace" {
  description = "Namespace used for the monitoring stack."
  value       = var.monitoring_namespace
}

output "grafana_admin_note" {
  description = "How to get Grafana admin password after apply."
  value       = var.enable_monitoring ? "kubectl -n ${var.monitoring_namespace} get secret kube-prometheus-stack-grafana -o jsonpath='{.data.admin-password}' | base64 -d; echo" : "enable_monitoring=false — nothing deployed"
}

output "shop_scrape_target" {
  description = "Expected shop-api scrape selector (Phase 3 Helm)."
  value       = "ns=${var.shop_namespace} labels: app.kubernetes.io/instance=${var.shop_release_name}, app.kubernetes.io/component=api path=/metrics port=http"
}
