#!/bin/bash

# Minikube setup script for security testing environment
set -e

echo "🚀 Setting up Minikube environment..."

# Check if minikube is installed
if ! command -v minikube &>/dev/null; then
    echo "❌ Minikube not found. Install it first:"
    echo "curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64"
    echo "sudo install minikube-linux-amd64 /usr/local/bin/minikube"
    exit 1
fi

# Start minikube with specific resources
echo "🔧 Starting Minikube..."
minikube start \
    --memory=3200 \
    --cpus=2 \
    --disk-size=20g \
    --driver=docker \
    --addons=ingress,metrics-server

# Enable necessary addons
echo "🔌 Enabling addons..."
minikube addons enable dashboard
minikube addons enable storage-provisioner

# Build and load custom images
echo "🏗️ Building application images..."
eval $(minikube docker-env)

# Build backend
docker build -f docker/Dockerfile.prod.backend -t apps-backend:latest .

# Build frontend
docker build -f docker/Dockerfile.prod.frontend -t apps-frontend:latest .

echo "📦 Images built and loaded into Minikube"

# Apply k8s manifests
echo "⚙️ Applying Kubernetes manifests..."

# Create namespace first
kubectl apply -f k8s/namespace.yaml

# Apply secrets
kubectl apply -f k8s/secrets/

# Apply configmaps
kubectl apply -f k8s/configmaps/

# Apply PV and PVC
kubectl apply -f k8s/storage/

# Apply deployments
kubectl apply -f k8s/deployments/

# Apply network policies
kubectl apply -f k8s/network-policies/

# Wait for deployments
echo "⏳ Waiting for deployments..."
kubectl wait --for=condition=available --timeout=300s deployment --all -n test-app

# Get external access info
echo "🌐 Getting external access information..."
minikube service nginx -n test-app --url

echo "✅ Setup complete!"
echo "🔍 Access dashboard: minikube dashboard"
echo "📊 Check status: kubectl get all -n test-app"
