variable "namespace" {
  type        = string
  description = "Monitoring namespace"
}

variable "shop_namespace" {
  type = string
}

variable "shop_release_name" {
  type = string
}

variable "values_dir" {
  type        = string
  description = "Absolute path to monitoring/ values directory"
}

variable "kube_prometheus_stack_chart_version" {
  type = string
}

variable "loki_stack_chart_version" {
  type = string
}

variable "dashboard_json_path" {
  type        = string
  description = "Absolute path to shop-api Grafana dashboard JSON"
}
