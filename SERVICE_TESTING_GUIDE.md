# 🔍 Panduan Testing Service Satu Per Satu

**Tujuan**: Mengidentifikasi service mana yang menyebabkan masalah (high load, errors, dll)

---

## 🚀 Quick Start

### Option 1: Script Interaktif (Recommended)

```bash
# Upload test-services-individually.sh ke VPS
chmod +x test-services-individually.sh
./test-services-individually.sh
```

Script akan:
- Menampilkan semua PM2 processes dan Docker containers
- Stop satu per satu dan monitor impact
- Tanya apakah stopping membantu
- Restart otomatis jika tidak membantu

### Option 2: Test Satu Service

```bash
# Test PM2 service
./stop-service-test.sh manufacturing-app pm2

# Test Docker container
./stop-service-test.sh pzem-monitoring-dashboard docker
```

---

## 📋 Manual Testing Steps

### Step 1: List Semua Services

```bash
# PM2 processes
pm2 list

# Docker containers
docker ps
```

### Step 2: Get Baseline Metrics

```bash
# System metrics
uptime
free -h
top -bn1 | head -5

# Health endpoints
curl http://localhost:1234/health
curl http://localhost:5678/health
```

### Step 3: Stop Satu Service

```bash
# Stop PM2 service
pm2 stop manufacturing-app

# Atau stop Docker container
docker stop pzem-monitoring-dashboard
```

### Step 4: Monitor Impact (30 detik - 2 menit)

```bash
# Watch metrics
watch -n 5 'uptime && free -h'

# Atau monitor logs
pm2 logs --lines 0

# Check health endpoints
watch -n 5 'curl -s http://localhost:1234/health && echo "" && curl -s http://localhost:5678/health'
```

### Step 5: Evaluate

**Tanyakan pada diri sendiri:**
- Apakah load average turun?
- Apakah memory usage turun?
- Apakah errors berkurang?
- Apakah health endpoints masih OK?

### Step 6: Restart atau Keep Stopped

```bash
# Jika tidak membantu, restart
pm2 start manufacturing-app
# atau
docker start pzem-monitoring-dashboard

# Jika membantu, keep stopped dan catat
# (restart nanti setelah fix)
```

---

## 🎯 Testing Strategy

### Strategy 1: Test by Priority (Recommended)

**Test yang paling mungkin menyebabkan masalah dulu:**

1. **Manufacturing App Production** (banyak errors di logs)
   ```bash
   pm2 stop manufacturing-app
   # Monitor 2 menit
   pm2 start manufacturing-app
   ```

2. **Manufacturing App Staging** (banyak errors di logs)
   ```bash
   pm2 stop manufacturing-app-staging
   # Monitor 2 menit
   pm2 start manufacturing-app-staging
   ```

3. **MO Reporting** (ada SQLite readonly error)
   ```bash
   pm2 stop mo-reporting
   # Monitor 2 menit
   pm2 start mo-reporting
   ```

4. **Docker Containers** (jika ada)
   ```bash
   docker stop <container-name>
   # Monitor 2 menit
   docker start <container-name>
   ```

### Strategy 2: Test All Systematically

```bash
# Test semua PM2 processes
for service in $(pm2 list | awk 'NR>3 {print $4}'); do
    echo "Testing: $service"
    pm2 stop $service
    sleep 30
    # Evaluate impact
    pm2 start $service
    sleep 10
done
```

---

## 📊 What to Monitor

### 1. System Metrics

```bash
# Load average (should decrease if problematic service stopped)
uptime

# Memory usage (should decrease)
free -h

# CPU usage (should decrease)
top -bn1 | head -5
```

### 2. Application Health

```bash
# Health endpoints (should still work for other services)
curl http://localhost:1234/health
curl http://localhost:5678/health
```

### 3. Error Logs

```bash
# Check if errors decrease
pm2 logs --lines 50 --err --nostream | grep -i error | wc -l

# Before stopping: note the count
# After stopping: compare the count
```

### 4. Process Count

```bash
# Check if process count decreases
ps aux | wc -l

# Check specific process
ps aux | grep <service-name>
```

---

## 🔍 Identifying Problematic Services

### Signs a Service is Problematic:

1. **Load Average Drops** when stopped
   - Load average turun signifikan (>0.5)
   - System feels more responsive

2. **Memory Usage Drops** when stopped
   - Memory usage turun signifikan (>100MB)
   - More memory available

3. **Errors Decrease** when stopped
   - Error logs berkurang
   - No more timeout/connection errors

4. **CPU Usage Drops** when stopped
   - CPU usage turun
   - System less busy

5. **Other Services Work Better** when stopped
   - Health endpoints respond faster
   - No more intermittent issues

---

## 🛠️ After Identifying Problematic Service

### Step 1: Document Findings

```bash
# Note which service caused issues
echo "Problematic service: manufacturing-app" >> /tmp/service-test-results.txt
echo "Impact: Load dropped from 2.79 to 1.2" >> /tmp/service-test-results.txt
```

### Step 2: Investigate the Service

```bash
# Check logs
pm2 logs manufacturing-app --lines 100

# Check resource usage
pm2 monit

# Check configuration
cat /home/foom/deployments/manufacturing-app/server/.env
```

### Step 3: Fix the Service

Berdasarkan findings:
- **High load**: Optimize code, reduce processes
- **Memory leak**: Fix memory leaks
- **Errors**: Fix error causes
- **Database issues**: Fix database connection
- **DNS issues**: Fix DNS resolution

### Step 4: Restart and Monitor

```bash
# Restart after fix
pm2 restart manufacturing-app

# Monitor for improvements
watch -n 10 'uptime && free -h && pm2 status'
```

---

## ⚠️ Safety Tips

1. **Test During Low Traffic** (if possible)
   - Minimize impact on users
   - Easier to see differences

2. **Keep One Service Stopped at a Time**
   - Don't stop multiple services
   - Harder to identify which one caused issues

3. **Restart Quickly if Critical**
   - If stopping causes major issues, restart immediately
   - Don't leave critical services down

4. **Document Everything**
   - Note which service you stopped
   - Note the impact
   - Note the time

5. **Have Backup Plan**
   - Know how to restart services
   - Have access to restart manually if needed

---

## 📝 Example Testing Session

```bash
# 1. Baseline
$ uptime
  load average: 2.79, 1.44, 0.93

# 2. Stop manufacturing-app
$ pm2 stop manufacturing-app

# 3. Wait 30 seconds
$ sleep 30

# 4. Check impact
$ uptime
  load average: 1.20, 1.30, 0.85  # ← DROPPED! This service is problematic

# 5. Restart
$ pm2 start manufacturing-app

# 6. Document
# manufacturing-app is causing high load
# Need to investigate: check logs, optimize code
```

---

## 🎯 Quick Commands Reference

```bash
# List services
pm2 list
docker ps

# Stop service
pm2 stop <name>
docker stop <name>

# Start service
pm2 start <name>
docker start <name>

# Monitor
watch -n 5 'uptime && free -h'

# Check health
curl http://localhost:1234/health
curl http://localhost:5678/health

# Check logs
pm2 logs <name> --lines 50
docker logs <name> --tail 50
```

---

**Update terakhir**: 2026-01-30
