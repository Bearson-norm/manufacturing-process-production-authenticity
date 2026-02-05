# ⚡ Quick Service Test - Copy Paste

## 🚀 Test Satu Service (Quick)

```bash
# 1. Get baseline
echo "=== BEFORE ===" && uptime && free -h | grep Mem

# 2. Stop service
pm2 stop manufacturing-app

# 3. Wait 30 seconds
sleep 30

# 4. Check impact
echo "=== AFTER ===" && uptime && free -h | grep Mem

# 5. Restart
pm2 start manufacturing-app
```

---

## 📋 Test All PM2 Services

```bash
# List all services
pm2 list

# Test each one
for service in $(pm2 list | awk 'NR>3 {print $4}'); do
    echo "=== Testing: $service ==="
    echo "Before: $(uptime | awk -F'load average:' '{print $2}')"
    pm2 stop $service
    sleep 30
    echo "After: $(uptime | awk -F'load average:' '{print $2}')"
    read -p "Did it help? (y/n): " response
    if [ "$response" != "y" ]; then
        pm2 start $service
    fi
    echo ""
done
```

---

## 🐳 Test Docker Containers

```bash
# List containers
docker ps

# Test each one
for container in $(docker ps --format "{{.Names}}"); do
    echo "=== Testing: $container ==="
    echo "Before: $(uptime | awk -F'load average:' '{print $2}')"
    docker stop $container
    sleep 30
    echo "After: $(uptime | awk -F'load average:' '{print $2}')"
    read -p "Did it help? (y/n): " response
    if [ "$response" != "y" ]; then
        docker start $container
    fi
    echo ""
done
```

---

## 📊 Monitor While Testing

```bash
# Terminal 1: Watch system metrics
watch -n 5 'uptime && free -h | grep Mem'

# Terminal 2: Test services
./test-services-individually.sh

# Terminal 3: Watch logs
pm2 logs --lines 0
```

---

## ✅ Quick Check: Which Service is Using Most Resources?

```bash
# Top processes by CPU
ps aux --sort=-%cpu | head -10

# Top processes by Memory
ps aux --sort=-%mem | head -10

# PM2 resource usage
pm2 status

# Docker resource usage
docker stats --no-stream
```

---

## 🎯 Test Specific Service

```bash
# Test manufacturing-app
./stop-service-test.sh manufacturing-app pm2

# Test staging
./stop-service-test.sh manufacturing-app-staging pm2

# Test Docker container
./stop-service-test.sh pzem-monitoring-dashboard docker
```

---

**Gunakan `test-services-individually.sh` untuk testing interaktif yang lebih lengkap!**
