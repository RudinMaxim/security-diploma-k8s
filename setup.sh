#!/bin/bash
# scripts/deploy.sh - Безопасное развертывание

set -e

echo "🚀 Развертывание безопасного приложения в minikube"

# Проверка minikube
if ! minikube status &>/dev/null; then
    echo "❌ minikube не запущен. Запустите: minikube start"
    exit 1
fi

# Сборка образов
echo "📦 Сборка образов..."
eval $(minikube docker-env)

# Backend
docker build -t secure-app/backend:latest apps/backend/

# Frontend (простой nginx)
cat >apps/frontend/Dockerfile <<'EOF'
FROM nginx:alpine
COPY public/ /usr/share/nginx/html/
RUN addgroup -g 101 -S nginx && \
    adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx
USER nginx
EOF

mkdir -p apps/frontend/public
cat >apps/frontend/public/index.html <<'EOF'
<!DOCTYPE html>
<html>
<head><title>Secure K8s App</title></head>
<body>
    <h1>Secure Kubernetes Application</h1>
    <div id="users"></div>
    <script>
        fetch('/api/users')
            .then(r => r.json())
            .then(users => {
                document.getElementById('users').innerHTML = 
                    users.map(u => `<p>${u.name} - ${u.email}</p>`).join('');
            });
    </script>
</body>
</html>
EOF

docker build -t secure-app/frontend:latest apps/frontend/

# Применение манифестов
echo "🔧 Применение Kubernetes манифестов..."
kubectl apply -f k8s/01-namespace.yaml
kubectl apply -f k8s/05-secrets/
kubectl apply -f k8s/06-storage/
kubectl apply -f k8s/03-rbac/
kubectl apply -f k8s/04-security/
kubectl apply -f k8s/02-network-policies/
kubectl apply -f k8s/07-apps/

# Ожидание готовности
echo "⏳ Ожидание готовности подов..."
kubectl wait --for=condition=ready pod -l app=postgres -n secure-app --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis -n secure-app --timeout=300s
kubectl wait --for=condition=ready pod -l app=backend -n secure-app --timeout=300s

# Настройка доступа
echo "🌐 Настройка доступа..."
kubectl expose deployment backend --type=NodePort --port=3000 -n secure-app --dry-run=client -o yaml | kubectl apply -f -

# Получение URL
BACKEND_URL=$(minikube service backend --url -n secure-app)
echo "✅ Приложение развернуто!"
echo "Backend URL: $BACKEND_URL"
echo "Health check: curl $BACKEND_URL/health"

---
#!/bin/bash
# scripts/security-test.sh - Тестирование безопасности

set -e

echo "🔍 Анализ безопасности Kubernetes"

# Проверка Pod Security Standards
echo "1️⃣ Проверка Pod Security Standards..."
kubectl get pods -n secure-app -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.securityContext}{"\n"}{end}'

# Сканирование образов с Trivy
echo "2️⃣ Сканирование контейнеров..."
if command -v trivy &>/dev/null; then
    trivy image --exit-code 1 secure-app/backend:latest
    trivy image --exit-code 1 postgres:15-alpine
    trivy image --exit-code 1 redis:7-alpine
else
    echo "⚠️ Trivy не установлен. Установите: curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin"
fi

# Проверка RBAC
echo "3️⃣ Анализ RBAC..."
kubectl auth can-i --list --as=system:serviceaccount:secure-app:backend-sa -n secure-app

# Проверка Network Policies
echo "4️⃣ Проверка Network Policies..."
kubectl get networkpolicies -n secure-app -o wide

# Kube-bench (требует установки)
echo "5️⃣ CIS Kubernetes Benchmark..."
if kubectl get job kube-bench -n default &>/dev/null; then
    kubectl logs job/kube-bench -n default
else
    echo "Запуск kube-bench..."
    kubectl apply -f - <<'EOF'
apiVersion: batch/v1
kind: Job
metadata:
  name: kube-bench
spec:
  template:
    spec:
      hostPID: true
      nodeSelector:
        kubernetes.io/os: linux
      tolerations:
      - key: node-role.kubernetes.io/master
        operator: Exists
        effect: NoSchedule
      containers:
      - name: kube-bench
        image: aquasec/kube-bench:latest
        command: ["kube-bench"]
        volumeMounts:
        - name: var-lib-etcd
          mountPath: /var/lib/etcd
          readOnly: true
        - name: var-lib-kubelet
          mountPath: /var/lib/kubelet
          readOnly: true
        - name: etc-kubernetes
          mountPath: /etc/kubernetes
          readOnly: true
      restartPolicy: Never
      volumes:
      - name: var-lib-etcd
        hostPath:
          path: "/var/lib/etcd"
      - name: var-lib-kubelet
        hostPath:
          path: "/var/lib/kubelet"
      - name: etc-kubernetes
        hostPath:
          path: "/etc/kubernetes"
EOF
    sleep 30
    kubectl logs job/kube-bench
fi

# Falco для runtime security
echo "6️⃣ Runtime Security Monitoring..."
if ! kubectl get ds falco -n kube-system &>/dev/null; then
    echo "Установка Falco..."
    helm repo add falcosecurity https://falcosecurity.github.io/charts
    helm repo update
    helm install falco falcosecurity/falco \
        --namespace kube-system \
        --set falco.grpc.enabled=true \
        --set falco.grpcOutput.enabled=true
fi

echo "✅ Анализ безопасности завершен"

---
#!/bin/bash
# security/scanning/attack-simulation.sh - Симуляция атак

echo "⚠️ СИМУЛЯЦИЯ АТАК - ТОЛЬКО ДЛЯ ТЕСТИРОВАНИЯ"

NAMESPACE="secure-app"
BACKEND_URL=$(minikube service backend --url -n $NAMESPACE)

# 1. Тест изоляции сети
echo "1️⃣ Тест изоляции сети..."
kubectl run test-pod --image=busybox --rm -it --restart=Never -n $NAMESPACE -- /bin/sh -c "
    echo 'Попытка подключения к внешнему сервису...'
    wget -O- --timeout=5 google.com || echo 'Заблокировано ✅'
    
    echo 'Попытка подключения к другому namespace...'
    nslookup kubernetes.default.svc.cluster.local || echo 'DNS заблокирован ✅'
"

# 2. Тест privilege escalation
echo "2️⃣ Тест privilege escalation..."
kubectl run privileged-test --image=alpine --rm -it --restart=Never -n $NAMESPACE \
    --overrides='{"spec":{"securityContext":{"runAsUser":0},"containers":[{"name":"test","image":"alpine","command":["whoami"],"securityContext":{"privileged":true}}]}}' ||
    echo "Privileged контейнеры заблокированы ✅"

# 3. Тест доступа к host filesystem
echo "3️⃣ Тест доступа к host filesystem..."
kubectl run host-access-test --image=alpine --rm -it --restart=Never -n $NAMESPACE \
    --overrides='{"spec":{"containers":[{"name":"test","image":"alpine","command":["ls","/host"],"volumeMounts":[{"name":"host","mountPath":"/host"}]}],"volumes":[{"name":"host","hostPath":{"path":"/"}}]}}' ||
    echo "Host filesystem заблокирован ✅"

# 4. Тест RBAC
echo "4️⃣ Тест RBAC..."
kubectl auth can-i create pods --as=system:serviceaccount:$NAMESPACE:backend-sa -n $NAMESPACE &&
    echo "❌ Слишком широкие права" || echo "✅ RBAC работает корректно"

# 5. Resource exhaustion test
echo "5️⃣ Тест исчерпания ресурсов..."
kubectl run resource-bomb --image=progrium/stress --rm -it --restart=Never -n $NAMESPACE \
    -- --cpu 8 --timeout 10s || echo "✅ Resource limits защищают от DoS"

echo "🏁 Тестирование атак завершено"
