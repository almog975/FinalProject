# FinalProject — Technion DevOps Final Project 15

**DevSecOps Pipeline with Full Security Scanning** — Flask shop API + React admin dashboard, SBOM/scan reports, Minikube Helm, Jenkins hard gates, Argo CD GitOps CD, and Prometheus/Grafana/Loki on Minikube.

| | |
|-|-|
| **Student** | Almog Rabinovich (`almog975`) |
| **Remote** | https://github.com/almog975/FinalProject |
| **Live demo** | **[`DEMO.md`](DEMO.md)** — copy-paste runbook for the grading defense |

---

## What we built (grading-oriented)

| Phase | Deliverable | Location |
|-------|-------------|----------|
| **1** | Flask shop API (products, cart, orders) + **React admin dashboard** (Vite/TS, **shop-web** nginx), Docker Compose, health/ready/metrics | [`devsecops-shop-app/`](devsecops-shop-app/) |
| **2** | SBOM + vulnerability scan-report endpoints (`/api/security/*`), samples + ingest | same app + `samples/` |
| **3** | Helm chart for Minikube (API + **shop-web** + in-chart Postgres), Ingress `shop.local` → web | [`devsecops-shop-devops/helm/shop`](devsecops-shop-devops/helm/shop) |
| **4** | Jenkins declarative pipeline with **hard gates** (secrets / Trivy CRITICAL / Checkov HIGH / coverage ≥70%) | [`devsecops-shop-devops/jenkins/`](devsecops-shop-devops/jenkins/) |
| **5** | Terraform (local, `enable_cloud=false`) + kube-prometheus-stack / Loki / Grafana dashboard | [`terraform/`](devsecops-shop-devops/terraform/), [`monitoring/`](devsecops-shop-devops/monitoring/) |
| **B** | Argo CD GitOps Application for shop Helm chart (auto-sync / self-heal, **dev only**) | [`devsecops-shop-devops/argocd/`](devsecops-shop-devops/argocd/) |
| **6** | Demo runbook + project overview (this README) | [`DEMO.md`](DEMO.md) |

---

## Architecture

```mermaid
flowchart TB
  subgraph local["Local / CI"]
    Dev[Developer]
    Jenkins[Jenkins Pipeline<br/>hard gates]
    Compose[Docker Compose<br/>api + postgres]
    Git[(GitHub main)]
  end

  subgraph mk["Minikube"]
    Argo[Argo CD<br/>GitOps CD]
    Ingress[Ingress nginx<br/>shop.local]
    Web[shop-web nginx<br/>SPA + /api proxy]
    API[shop-api Deployment]
    PG[(Postgres)]
    SM[ServiceMonitor]
    Prom[Prometheus]
    Graf[Grafana]
    Loki[Loki + Promtail]
  end

  Dev --> Compose
  Dev --> Jenkins
  Dev --> Git
  Jenkins -->|docker build / trivy / syft| API
  Jenkins -->|helm upgrade optional| API
  Jenkins -->|helm upgrade optional| Web
  Git -->|Application sync| Argo
  Argo -->|helm shop + values-dev| API
  Argo -->|helm shop + values-dev| Web
  Compose --> API
  Ingress --> Web
  Web -->|/api /health /ready /metrics| API
  API --> PG
  API -->|GET /metrics| SM
  SM --> Prom
  Prom --> Graf
  API -.->|logs| Loki
  Loki --> Graf
```

**Request path (demo):** browser → `shop.local` (Ingress) → **shop-web** (nginx SPA) → proxies `/api/*` to shop-api → Postgres. Flask is **API-only**; UI is a separate nginx container (still one Helm chart — not a microservices product split).  
**Observability:** shop-api exposes `GET /metrics` → scraped by Prometheus (API ServiceMonitor, not web) → Grafana dashboard *DevSecOps Shop API*.  
**CI vs CD (defense):** **Jenkins** is the CI path with hard gates (secrets, Trivy CRITICAL, Checkov HIGH+, coverage ≥70%). **Argo CD** is GitOps CD: it reconciles the cluster to the Helm chart in Git (`main` + `values-dev.yaml`) and self-heals drift in the student Minikube demo (auto-sync + prune is **dev only** — not a production recommendation).

---

## Repo layout

```
FinalProject/
  README.md                      # this file
  DEMO.md                        # Phase 6 presenter runbook
  scripts/demo.sh                # ordered demo command printer
  scripts/install-argocd.sh      # Argo CD install + shop Application
  devsecops-shop-app/            # Phase 1–2 Flask API + React dashboard
    app/ frontend/ Dockerfile docker-compose.yml samples/ tests/
  devsecops-shop-devops/         # Phase 3–5 + B (Helm, Jenkins, Terraform, monitoring, Argo)
    helm/shop/                   # Minikube chart + values-dev.yaml
    jenkins/                     # Jenkinsfile + helper scripts (Phase 4)
    argocd/                      # Argo CD Application + README (Phase B GitOps)
    security/                    # gitleaks / checkov / policies (Phase 4)
    newman/                      # Postman collection (Phase 4)
    terraform/                   # enable_cloud=false; enable_monitoring opt-in
    monitoring/                  # kube-prometheus-stack + Loki values + dashboard JSON
```

---

## Quick links by phase

- **Demo everything:** [`DEMO.md`](DEMO.md) · helper [`scripts/demo.sh`](scripts/demo.sh)
- **App (1–2):** [`devsecops-shop-app/README.md`](devsecops-shop-app/README.md)
- **DevOps overview (3–5):** [`devsecops-shop-devops/README.md`](devsecops-shop-devops/README.md)
- **Terraform:** [`devsecops-shop-devops/terraform/README.md`](devsecops-shop-devops/terraform/README.md)
- **Monitoring:** [`devsecops-shop-devops/monitoring/README.md`](devsecops-shop-devops/monitoring/README.md)
- **Hard gates (4):** [`devsecops-shop-devops/security/policies/README.md`](devsecops-shop-devops/security/policies/README.md)
- **Argo CD GitOps (B):** [`devsecops-shop-devops/argocd/README.md`](devsecops-shop-devops/argocd/README.md)

### One-liners (see DEMO for full sequences)

```bash
# Phase 1–2
cd devsecops-shop-app && cp -n .env.example .env && docker compose up --build

# Phase 3
minikube start --memory=4096 --cpus=2 && minikube addons enable ingress
# build/load shop-api:phase2 + shop-web:phase2 (./scripts/build-shop-image.sh), then:
helm upgrade --install shop ./devsecops-shop-devops/helm/shop \
  -f ./devsecops-shop-devops/helm/shop/values-dev.yaml -n shop --create-namespace
# UI: minikube service shop-web -n shop --url

# Phase 5 (Helm path)
# → commands in DEMO.md / monitoring/README.md
# Grafana: kubectl -n monitoring port-forward svc/kube-prometheus-stack-grafana 3000:80
```

---

## Design choices (short)

- **In-chart Postgres** for Minikube demos (no Bitnami dependency / offline-friendly).
- **Security artifacts** resolve file → DB → bundled `samples/` so Compose demos work without CI.
- **Jenkins hard gates** fail the build on secrets, CRITICAL image CVEs, HIGH+ IaC, and coverage &lt; 70%.
- **Argo CD GitOps** syncs `devsecops-shop-devops/helm/shop` from `main` (auto-sync / selfHeal / prune for **dev demos only**).
- **Terraform defaults** never open a cloud bill (`enable_cloud=false`) and never write to the cluster until `enable_monitoring=true`.

---

## Out of scope

Multi-cloud deploy, Vault, paid APM, NetworkPolicy v1, new product features beyond the shop API, replacing Jenkins, App-of-Apps for monitoring/Jenkins, microservices split.
