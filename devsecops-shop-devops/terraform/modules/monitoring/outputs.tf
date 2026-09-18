output "prometheus_release" {
  value = helm_release.kube_prometheus_stack.name
}

output "loki_release" {
  value = helm_release.loki_stack.name
}

output "dashboard_configmap" {
  value = kubernetes_config_map.shop_api_dashboard.metadata[0].name
}
