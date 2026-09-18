variable "enable_cloud" {
  description = "When true, would allow optional cloud resources. MUST stay false for student demos (no AWS/GCP/Azure bills)."
  type        = bool
  default     = false

  validation {
    condition     = var.enable_cloud == false
    error_message = "enable_cloud must remain false for this course demo — no AWS/GCP/Azure resources by default (no cloud bills)."
  }
}

variable "enable_monitoring" {
  description = "Deploy kube-prometheus-stack + Loki via Helm against the current cluster. Requires a live kubecontext (e.g. Minikube). Keep false for terraform validate without a cluster."
  type        = bool
  default     = false
}

variable "kubeconfig_path" {
  description = "Path to kubeconfig (Minikube default is fine)."
  type        = string
  default     = "~/.kube/config"
}

variable "kube_context" {
  description = "Optional kubecontext override. Empty = current context."
  type        = string
  default     = ""
}

variable "monitoring_namespace" {
  description = "Namespace for Prometheus / Grafana / Loki."
  type        = string
  default     = "monitoring"
}

variable "shop_namespace" {
  description = "Namespace where Phase 3 Helm release 'shop' runs."
  type        = string
  default     = "shop"
}

variable "shop_release_name" {
  description = "Phase 3 Helm release name (service labels use app.kubernetes.io/instance)."
  type        = string
  default     = "shop"
}

variable "kube_prometheus_stack_chart_version" {
  description = "Pinned kube-prometheus-stack chart version."
  type        = string
  default     = "65.1.0"
}

variable "loki_stack_chart_version" {
  description = "Pinned grafana/loki-stack chart version (Loki + Promtail)."
  type        = string
  default     = "2.10.2"
}

variable "values_dir" {
  description = "Path to monitoring Helm values (relative to terraform/)."
  type        = string
  default     = "../monitoring"
}
