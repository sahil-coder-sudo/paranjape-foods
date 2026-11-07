# Paranjape Foods — Kubernetes & Helm Architecture Guide

This guide explains how Paranjape Foods is organized into separate frontend and backend micro-services and deployed using **Docker**, **Docker Compose**, and **Helm 3**.

---

## 1. Directory Structure

```text
.
├── frontend/                     # Next.js 14 Web Application
│   ├── components/               # React components
│   ├── data/                     # Menu dataset (menuData.js)
│   ├── pages/                    # Web pages (menu, checkout, track, manager, delivery)
│   ├── styles/                   # Stylesheets & Tailwind/globals.css
│   ├── Dockerfile                # Multi-stage production build (Next.js standalone)
│   ├── .dockerignore
│   ├── next.config.mjs           # Next config with output: 'standalone'
│   └── package.json
│
├── backend/                      # Node.js Express API & SSE Broadcaster
│   ├── models/                   # Mongoose schemas (Order, Address, Customer, MenuItem)
│   ├── utils/                    # Logger & helpers
│   ├── scripts/                  # DB seed script
│   ├── server.js                 # Express server with live SSE event channels
│   ├── Dockerfile                # Lightweight Alpine Node image (non-root)
│   ├── .dockerignore
│   └── package.json
│
├── helm/
│   └── paranjape-foods/          # Helm 3 Chart
│       ├── Chart.yaml            # Chart metadata (v0.1.0)
│       ├── values.yaml           # Default values (staging/local)
│       ├── values-prod.yaml      # Production override values template
│       └── templates/
│           ├── _helpers.tpl      # Kubernetes standard labels & naming
│           ├── frontend-deployment.yaml
│           ├── frontend-service.yaml
│           ├── backend-deployment.yaml
│           ├── backend-service.yaml
│           ├── ingress.yaml      # Ingress with SSE buffering disabled
│           ├── configmap.yaml    # Non-sensitive environment config
│           ├── secret.yaml       # Database URI & staff passcodes
│           └── hpa.yaml          # Horizontal Pod Autoscalers (CPU/memory targets)
│
├── docker-compose.yml            # Local multi-container test harness
├── package.json                  # Root npm workspace for unified development
├── KUBERNETES.md                 # This guide
└── .github/workflows/deploy.yml  # Automated CI/CD pipeline
```

---

## 2. Local Development & Workspace Commands

From the root directory, you can manage both services using npm workspaces:

```bash
# Install all dependencies across both frontend and backend
npm install

# Run frontend in development mode (port 3000)
npm run dev

# Run backend API server in development mode (port 4000)
npm run dev:backend

# Run production build for frontend
npm run build

# Seed database with sample menu items
npm run seed
```

---

## 3. Local Container Testing (Docker Compose)

Before deploying to a Kubernetes cluster, you can verify both container images and their inter-service communication locally:

```bash
# Build and start both containers
docker compose up --build

# View real-time container logs
docker compose logs -f

# Shut down containers
docker compose down
```

- Frontend is accessible at: `http://localhost:3000`
- Backend API is accessible at: `http://localhost:4000/api/health`

---

## 4. Deploying to Kubernetes with Helm

### Prerequisites
- A running Kubernetes cluster (e.g. Minikube, Kind, GKE, EKS, DOKS, K3s)
- `kubectl` configured with cluster access
- `helm` v3 installed
- NGINX Ingress Controller installed in your cluster:
  ```bash
  helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
  helm repo update
  helm install ingress-nginx ingress-nginx/ingress-nginx
  ```

### Step 1: Lint the Helm Chart
```bash
helm lint ./helm/paranjape-foods
```

### Step 2: Dry Run & Preview Manifests
```bash
helm template my-release ./helm/paranjape-foods
```

### Step 3: Install or Upgrade Release
```bash
# For local / staging:
helm upgrade --install paranjape-foods ./helm/paranjape-foods

# For production (using values-prod.yaml):
helm upgrade --install paranjape-foods ./helm/paranjape-foods \
  -f ./helm/paranjape-foods/values-prod.yaml \
  --set secrets.mongodbUri="YOUR_ENCODED_MONGODB_URI" \
  --set secrets.managerPasscode="PROD_STAFF_PIN" \
  --set secrets.deliveryPasscode="PROD_RIDER_PIN"
```

### Step 4: Verify Deployment Status
```bash
# Check running pods
kubectl get pods -l app.kubernetes.io/instance=paranjape-foods

# Check services
kubectl get svc -l app.kubernetes.io/instance=paranjape-foods

# Check ingress status & assigned IP/hostname
kubectl get ingress paranjape-foods

# Inspect backend logs for SSE connections and MongoDB status
kubectl logs -l app.kubernetes.io/component=backend -f
```

---

## 5. Architectural Highlights

### Server-Sent Events (SSE) Proxy Configuration
The Ingress is configured with explicit annotations:
```yaml
nginx.ingress.kubernetes.io/proxy-buffering: "off"
nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
```
These prevent NGINX from buffering chunked SSE event streams, ensuring live updates for the Kitchen Manager (`/manager`), Delivery Partner (`/delivery`), and Customer Tracker (`/track`) arrive instantly.

### Multi-Stage Distroless / Standalone Next.js
The frontend `Dockerfile` leverages Next.js 14 `output: 'standalone'`. It traces and includes only active node dependencies, shrinking the container footprint to ~120MB and drastically accelerating deployment pull times.

### Security & Non-Root Execution
Both containers create and execute under dedicated non-root users (`nextjs:nodejs` on UID 1001 and `node:node` on UID 1000). Secrets (`MONGODB_URI`, `MANAGER_PASSCODE`, `DELIVERY_PASSCODE`) are mounted through Kubernetes Secrets rather than hardcoded in images or ConfigMaps.
