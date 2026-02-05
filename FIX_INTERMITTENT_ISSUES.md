# 🔧 Fix Intermittent Up/Down Issues

**Issue**: Service mengalami up dan down bergantian  
**Symptoms**: 
- Health score rendah (68-69%)
- Timeout errors: "timeout of 48000ms exceeded"
- Status bars menunjukkan mix of green, orange, red

---

## 🔍 Kemungkinan Penyebab

### 1. **Response Time Terlalu Lambat** ⚠️ PALING MUNGKIN
- Health endpoint membutuhkan waktu >48 detik untuk respond
- Database query lambat
- Application overloaded

### 2. **Database Connection Issues**
- Intermittent database connection failures
- Connection pool exhausted
- Database query timeout

### 3. **Application Crashes & Auto-Restart**
- PM2 restart count tinggi
- Memory leaks
- Unhandled errors

### 4. **Resource Constraints**
- Memory usage tinggi (>80%)
- CPU overloaded
- Disk I/O issues

### 5. **Network Issues**
- Port conflicts
- Firewall rules
- Network latency

---

## 🚀 Quick Diagnosis

### Option 1: Script Otomatis (Recommended)

```bash
# Upload diagnose-intermittent-issues.sh ke VPS
chmod +x diagnose-intermittent-issues.sh
./diagnose-intermittent-issues.sh
```

### Option 2: Manual Check

```bash
# 1. Check PM2 restart count (high = frequent crashes)
pm2 status

# 2. Test response time
time curl http://localhost:1234/health
time curl http://localhost:5678/health

# 3. Test database connection
psql -h localhost -U postgres -c "SELECT 1;"

# 4. Check memory usage
free -h

# 5. Check recent errors
pm2 logs --lines 50 --err --nostream
```

---

## 🔧 Solutions Berdasarkan Penyebab

### Solution 1: Optimize Response Time

**Jika response time >3 detik:**

```bash
# 1. Check database query performance
psql -h localhost -U postgres -c "EXPLAIN ANALYZE SELECT 1;"

# 2. Optimize health endpoint
# Edit server/index.js - simplify health check
```

**Atau increase monitoring timeout:**
- Di monitoring tool (Uptime Kuma), increase timeout dari 48s ke 60-90s
- Atau optimize application untuk respond lebih cepat

---

### Solution 2: Fix Database Connection Issues

```bash
# 1. Check PostgreSQL status
sudo systemctl status postgresql@16-main

# 2. Check connection pool settings
# Review database connection configuration in server/index.js

# 3. Restart PostgreSQL
sudo systemctl restart postgresql@16-main

# 4. Test connection stability
for i in {1..10}; do
    psql -h localhost -U postgres -c "SELECT 1;" && echo "OK" || echo "FAILED"
    sleep 1
done
```

**Fix di code:**
- Add connection retry logic
- Increase connection pool size
- Add connection timeout handling

---

### Solution 3: Fix Application Crashes

```bash
# 1. Check PM2 logs for errors
pm2 logs manufacturing-app --lines 100 --err
pm2 logs manufacturing-app-staging --lines 100 --err

# 2. Check restart count
pm2 status

# 3. Fix root cause (lihat error di logs)

# 4. Restart after fix
pm2 restart all
pm2 save
```

**Common causes:**
- Database connection errors → Fix database
- Memory leaks → Fix memory leaks
- Unhandled exceptions → Add error handling
- Missing dependencies → Install dependencies

---

### Solution 4: Reduce Resource Usage

```bash
# 1. Check current usage
free -h
uptime

# 2. Restart applications (clears memory)
pm2 restart all

# 3. Clean up if needed
# (Already done - disk usage down to 52.8%)

# 4. Monitor after restart
watch -n 5 'free -h && uptime'
```

**Jika masih tinggi:**
- Check for memory leaks
- Optimize application code
- Consider increasing server resources

---

### Solution 5: Increase Monitoring Timeout

**Jika response time konsisten lambat (>10s tapi <60s):**

1. **Di Uptime Kuma Dashboard:**
   - Edit monitor settings
   - Increase timeout dari 48s ke 60-90s
   - Atau adjust retry settings

2. **Atau optimize application:**
   - Simplify health check endpoint
   - Cache database queries
   - Optimize response time

---

## 📋 Step-by-Step Fix

### Step 1: Diagnose

```bash
./diagnose-intermittent-issues.sh > diagnosis-$(date +%Y%m%d-%H%M%S).log
```

### Step 2: Review Results

Lihat output untuk:
- High restart counts?
- Slow response times?
- Database connection issues?
- High memory usage?

### Step 3: Apply Fixes

Berdasarkan diagnosis, apply solutions di atas.

### Step 4: Verify

```bash
# Test response time (should be <3s)
time curl http://localhost:1234/health
time curl http://localhost:5678/health

# Check PM2 (should have low restart count)
pm2 status

# Monitor for 5 minutes
watch -n 10 'curl -s -o /dev/null -w "%{http_code} - %{time_total}s\n" http://localhost:1234/health'
```

---

## 🎯 Quick Fixes (Try These First)

### Fix 1: Restart Everything

```bash
pm2 restart all && pm2 save && sudo systemctl restart postgresql@16-main && sleep 5 && pm2 status
```

### Fix 2: Optimize Health Endpoint

Edit `server/index.js` - simplify health check:

```javascript
// Simple health check (no database query)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString()
  });
});
```

### Fix 3: Increase Monitoring Timeout

- Di Uptime Kuma: Edit monitor → Increase timeout to 60-90s

### Fix 4: Add Connection Retry

```javascript
// Add retry logic for database connections
// In database.js or index.js
```

---

## 📊 Monitoring After Fix

```bash
# Watch response time
watch -n 5 'curl -s -o /dev/null -w "Production: %{http_code} - %{time_total}s\n" http://localhost:1234/health && curl -s -o /dev/null -w "Staging: %{http_code} - %{time_total}s\n" http://localhost:5678/health'

# Watch PM2 status
watch -n 10 'pm2 status'

# Watch resources
watch -n 10 'free -h && uptime'
```

---

## 🔍 Advanced Troubleshooting

### Check Application Logs

```bash
# Real-time logs
pm2 logs manufacturing-app --lines 0

# Error logs only
pm2 logs --err --lines 100

# Search for timeout errors
pm2 logs --lines 500 | grep -i "timeout\|error\|failed"
```

### Check Database Performance

```bash
# Check active connections
psql -h localhost -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# Check slow queries
psql -h localhost -U postgres -c "SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"
```

### Check Network

```bash
# Test localhost response time
time curl http://localhost:1234/health

# Test from external (if accessible)
time curl http://your-domain.com/health

# Check port status
netstat -tlnp | grep -E "1234|5678"
```

---

## 💡 Prevention Tips

1. **Optimize Health Endpoint**
   - Keep it simple and fast
   - Don't query database if not necessary
   - Return immediately

2. **Add Connection Pooling**
   - Use connection pool for database
   - Set appropriate pool size
   - Handle connection errors gracefully

3. **Monitor Resources**
   - Setup alerts for high memory/CPU
   - Monitor PM2 restart counts
   - Track response times

4. **Regular Maintenance**
   - Weekly: Restart applications
   - Weekly: Check logs for errors
   - Monthly: Review and optimize

---

**Update terakhir**: 2026-01-30
