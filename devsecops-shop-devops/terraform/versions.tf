terraform {
  required_version = ">= 1.5.0, < 2.0.0"

  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.32"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.15"
    }
  }

  # Default: local backend (no remote state / no cloud bill).
  # Copy envs/dev/backend.tf.example → backend.tf if you want an explicit backend block.
}
