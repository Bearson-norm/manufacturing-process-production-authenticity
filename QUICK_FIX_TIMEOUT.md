# ⚡ Quick Fix Timeout Issues - Copy Paste

## 🚀 Quick Fixes (Try These First)

### Fix 1: Restart All Services

```bash
pm2 restart all && pm2 save && sudo systemctl restart postgresql@16-main && sleep 5 && pm2 status
```

### Fix 2: Test Response Time

```bash
echo "Production:" && time curl http://localhost:1234/health && echo "" && echo "Staging:" && time curl http://localhost:5678/health
```

### Fix 3: Check PM2 Restart Count

```bash
pm2 status | grep -E "restart|errored"
```

### Fix 4: Check Recent Errors

```bash
pm2 logs --lines 50 --err --nostream | tail -20
```

---

## 🔍 Quick Diagnosis

```bash
# All-in-one check
echo "=== PM2 Status ===" && pm2 status && echo "" && echo "=== Response Time ===" && time curl -s http://localhost:1234/health > /dev/null && time curl -s http://localhost:5678/health > /dev/null && echo "" && echo "=== Memory ===" && free -h | grep Mem && echo "" && echo "=== Restart Counts ===" && pm2 jlist 2>/dev/null | jq -r '.[] | "\(.name): \(.pm2_env.restart_time) restarts"' || pm2 list
```

---

## 🔧 Fix Based on Issue

### If Response Time > 3 seconds:

```bash
# 1. Check database
psql -h localhost -U postgres -c "SELECT 1;"

# 2. Restart PostgreSQL
sudo systemctl restart postgresql@16-main

# 3. Restart applications
pm2 restart all
```

### If High Restart Count:

```bash
# 1. Check error logs
pm2 logs --lines 100 --err --nostream

# 2. Fix the error (lihat di logs)

# 3. Restart
pm2 restart all
```

### If Memory High:

```bash
# 1. Restart to clear memory
pm2 restart all

# 2. Check after restart
free -h
```

---

## 📊 Monitor Response Time (5 minutes)

```bash
# Watch response time every 10 seconds
watch -n 10 'curl -s -o /dev/null -w "Production: %{http_code} - %{time_total}s\n" http://localhost:1234/health && curl -s -o /dev/null -w "Staging: %{http_code} - %{time_total}s\n" http://localhost:5678/health'
```

---

## 🎯 Increase Monitoring Timeout (Uptime Kuma)

**Jika response time konsisten lambat tapi <60s:**

1. Buka Uptime Kuma dashboard
2. Edit monitor yang bermasalah
3. Increase timeout dari 48s ke 60-90s
4. Save changes

**Atau optimize application:**
- Simplify health endpoint
- Remove database query dari health check
- Cache responses

---

## ✅ Verify Fix

```bash
# Test 10 times
for i in {1..10}; do
    echo "Test $i:"
    curl -s -o /dev/null -w "  Production: %{http_code} - %{time_total}s\n" http://localhost:1234/health
    curl -s -o /dev/null -w "  Staging: %{http_code} - %{time_total}s\n" http://localhost:5678/health
    sleep 1
done
```

---

**Gunakan `diagnose-intermittent-issues.sh` untuk diagnosis lengkap!**
