# Deploys kube-prometheus-stack (Prometheus + Grafana + Alertmanager) and
# grafana/loki-stack (Loki + Promtail) using checked-in values under monitoring/.

resource "helm_release" "kube_prometheus_stack" {
  name       = "kube-prometheus-stack"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "kube-prometheus-stack"
  version    = var.kube_prometheus_stack_chart_version
  namespace  = var.namespace
  timeout    = 900

  # Base values + lightweight TF overrides for shop ServiceMonitor selectors
  values = [
    file("${var.values_dir}/kube-prometheus-stack-values.yaml"),
    yamlencode({
      prometheus = {
        additionalServiceMonitors = [
          {
            name = "shop-api"
            namespaceSelector = {
              matchNames = [var.shop_namespace]
            }
            selector = {
              matchLabels = {
                "app.kubernetes.io/name"      = "shop"
                "app.kubernetes.io/instance"  = var.shop_release_name
                "app.kubernetes.io/component" = "api"
              }
            }
            endpoints = [
              {
                port     = "http"
                path     = "/metrics"
                interval = "15s"
              }
            ]
          }
        ]
      }
    }),
  ]

  depends_on = []
}

resource "helm_release" "loki_stack" {
  name       = "loki"
  repository = "https://grafana.github.io/helm-charts"
  chart      = "loki-stack"
  version    = var.loki_stack_chart_version
  namespace  = var.namespace
  timeout    = 600

  values = [
    file("${var.values_dir}/loki-values.yaml"),
  ]

  depends_on = [helm_release.kube_prometheus_stack]
}

# Grafana sidecar picks up ConfigMaps labeled grafana_dashboard=1
resource "kubernetes_config_map" "shop_api_dashboard" {
  metadata {
    name      = "shop-api-dashboard"
    namespace = var.namespace
    labels = {
      grafana_dashboard = "1"
    }
  }

  data = {
    "shop-api.json" = file(var.dashboard_json_path)
  }

  depends_on = [helm_release.kube_prometheus_stack]
}
