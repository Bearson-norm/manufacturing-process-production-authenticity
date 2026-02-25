# Analisis Penyebab Downtime - VPS

**Tanggal**: 2026-01-17  
**Uptime Status**: 67.33% (24h) | 93.65% (30d)  
**Avg Response**: 229.50 ms

---

## 🔴 Indikator Masalah dari Screenshot

### Uptime Kuma Dashboard:
- ✅ Current Response: **32 ms** (bagus)
- ⚠️ Average Response: **229.50 ms** (agak lambat)
- ❌ Uptime 24h: **67.33%** (BURUK - downtime 33%)
- ⚠️ Uptime 30d: **93.65%** (lumayan, tapi ada masalah)
- ⚠️ Check interval: 60 detik

### PM2 Status:
- ⚠️ manufacturing-app: cluster mode, instances tidak jelas (16 vs 2 yang terlihat)
- ✅ manufacturing-app-staging: fork, online
- ❌ warehouse-ui: **stopped** di PM2 (seharusnya di Docker)

---

## 🔍 Kemungkinan Penyebab Downtime

### 1. ❗ **Out of Memory (OOM) - PALING SERING**

**Gejala**:
- PM2 auto-restart apps karena memory limit tercapai
- Uptime Kuma detect sebagai downtime saat restart
- Response time meningkat sebelum crash

**Bukti dari Screenshot**:
```
manufacturing-app: 92.5mb, 96.6mb (per instance)
Total: ~92MB x 16 instances = ~1.5GB hanya untuk manufacturing-app
```

**Cara Cek**:
```bash
# Cek memory usage
free -h

# Cek memory per process
pm2 monit

# Lihat PM2 logs untuk OOM
pm2 logs --lines 100 | grep -i "memory\|restart\|kill"

# Cek system logs
dmesg | grep -i "out of memory\|oom"
sudo journalctl -xe | grep -i "oom"
```

**Solusi**:
```bash
# Kurangi max_memory_restart di ecosystem.config.js
# Atau kurangi jumlah instances cluster

# Temporary: restart dan clear logs
pm2 restart all
pm2 flush
```

---

### 2. 🔥 **CPU Overload**

**Gejala**:
- Response time meningkat drastis
- Request timeout
- Server tidak respond

**Cara Cek**:
```bash
# Real-time CPU monitoring
top -bn1 | head -20

# CPU usage per PM2 process
pm2 monit

# Check load average
uptime

# Cek CPU history
sar -u 1 5
```

**Solusi**:
```bash
# Kurangi instances cluster di ecosystem.config.js
# Dari 'max' (16) ke angka lebih rendah seperti 4 atau 8

instances: 4  # Instead of 'max'
```

---

### 3. 💾 **Disk Full**

**Gejala**:
- Database write error
- Log files tidak bisa ditulis
- Application crash
- PM2 tidak bisa restart

**Cara Cek**:
```bash
# Cek disk space
df -h

# Cek inode usage
df -i

# File terbesar
du -ah /home/foom | sort -rh | head -20

# Cek PM2 logs size
du -sh ~/.pm2/logs/*
```

**Solusi**:
```bash
# Clear PM2 logs
pm2 flush

# Clear old logs
find ~/.pm2/logs -type f -name "*.log" -mtime +7 -delete

# Clear journal logs
sudo journalctl --vacuum-time=7d
sudo journalctl --vacuum-size=500M

# Clear Docker logs
docker system prune -a --volumes
```

---

### 4. 🗄️ **Database Connection Issues**

**Gejala**:
- Health check endpoint return 503
- "Database disconnected" errors
- Connection pool exhausted

**Cara Cek**:
```bash
# Test database connection
docker exec -it postgres-container psql -U username -d database -c "SELECT 1"

# Cek PostgreSQL logs
docker logs postgres-container --tail 100

# Cek database connections
docker exec -it postgres-container psql -U username -d database -c "SELECT count(*) FROM pg_stat_activity"

# PM2 logs untuk database errors
pm2 logs manufacturing-app --lines 50 | grep -i "database\|postgres\|connection"
```

**Solusi**:
```bash
# Restart PostgreSQL
docker restart postgres-container

# Restart apps yang connect ke DB
pm2 restart all

# Cek dan optimize database connections di code
```

---

### 5. 🔌 **Network/Port Issues**

**Gejala**:
- Nginx tidak bisa connect ke backend
- Port already in use
- Connection refused

**Cara Cek**:
```bash
# Cek ports yang listen
netstat -tlnp | grep -E ":(1234|5678)"
ss -tlnp | grep -E ":(1234|5678)"

# Test backend endpoints
curl http://localhost:1234/health
curl http://localhost:5678/health

# Cek Nginx errors
sudo tail -100 /var/log/nginx/manufacturing-app-staging-error.log
sudo tail -100 /var/log/nginx/error.log

# Test dari Uptime Kuma perspective
curl -I http://127.0.0.1/health
curl -I http://127.0.0.1/api/health
```

**Solusi**:
```bash
# Restart Nginx
sudo systemctl restart nginx

# Restart PM2 apps
pm2 restart all

# Test health endpoints
curl http://localhost:1234/health
curl http://localhost:5678/health
```

---

### 6. ⚙️ **PM2 Auto-Restart Loop**

**Gejala**:
- Apps restart terus menerus
- Max restarts reached
- Unstable uptime

**Cara Cek**:
```bash
# Lihat restart count
pm2 status

# Cek logs untuk error patterns
pm2 logs manufacturing-app --lines 100 --err

# Cek untuk restart loops
pm2 logs --lines 200 | grep -i "restart\|starting\|stopped"
```

**Solusi**:
```bash
# Stop semua
pm2 stop all

# Cek dan fix error di logs
pm2 logs manufacturing-app --lines 50 --err

# Start one by one untuk isolate masalah
pm2 start manufacturing-app
# tunggu stabil
pm2 start manufacturing-app-staging
```

---

### 7. 📡 **Uptime Kuma Check Interval Too Aggressive**

**Gejala**:
- False positives
- Backend kewalahan dengan health checks
- Timeout karena concurrent checks

**Current Setting**: Check every **60 seconds**

**Rekomendasi**:
```
Check Interval: 60 seconds ✅ (sudah OK)
Retries: 3 ✅
Timeout: 48 seconds ✅

Tapi perlu pastikan health endpoint ringan!
```

---

## 🔧 Diagnosis Script - Jalankan Ini Dulu

```bash
#!/bin/bash
# diagnosis-downtime.sh

echo "======================================"
echo "DIAGNOSIS DOWNTIME - VPS"
echo "======================================"
echo ""

echo "=== 1. MEMORY STATUS ==="
free -h
echo ""

echo "=== 2. DISK SPACE ==="
df -h
echo ""

echo "=== 3. CPU & LOAD ==="
uptime
echo ""

echo "=== 4. PM2 STATUS ==="
pm2 status
echo ""

echo "=== 5. PM2 RESTART COUNT ==="
pm2 jlist | jq '.[] | {name: .name, restarts: .pm2_env.restart_time, uptime: .pm2_env.pm_uptime}'
echo ""

echo "=== 6. PORTS STATUS ==="
netstat -tlnp | grep -E ":(1234|5678|80|443|5432)"
echo ""

echo "=== 7. HEALTH CHECK - Production ==="
curl -s http://localhost:1234/health | jq .
echo ""

echo "=== 8. HEALTH CHECK - Staging ==="
curl -s http://localhost:5678/health | jq .
echo ""

echo "=== 9. DOCKER STATUS ==="
docker ps -a
echo ""

echo "=== 10. RECENT PM2 ERRORS ==="
pm2 logs --lines 50 --err --nostream | tail -20
echo ""

echo "=== 11. NGINX ERROR LOGS ==="
sudo tail -20 /var/log/nginx/error.log
echo ""

echo "=== 12. SYSTEM LOAD HISTORY ==="
sar -u 1 3 2>/dev/null || echo "sysstat not installed"
echo ""

echo "======================================"
echo "DIAGNOSIS COMPLETE"
echo "======================================"
```

---

## 📊 Interpretasi Hasil

### Jika Memory < 20% available:
→ **OOM adalah penyebab utama**
→ Kurangi instances atau tambah RAM

### Jika Load Average > CPU cores:
→ **CPU overload**
→ Kurangi instances cluster

### Jika Disk > 90% full:
→ **Disk penuh**
→ Clear logs dan temporary files

### Jika Health check return 503:
→ **Database connection issue**
→ Restart database dan apps

### Jika PM2 restart_time > 10:
→ **Application crashes berulang**
→ Cek error logs untuk root cause

---

## 🎯 Quick Fix Berdasarkan Gejala

### Gejala: Downtime Saat Peak Hours
**Penyebab**: Resource tidak cukup (RAM/CPU)
**Fix**:
```bash
# Kurangi instances di ecosystem.config.js
instances: 4  # dari 'max' (16)

# Restart
pm2 restart manufacturing-app
```

### Gejala: Downtime Random/Tidak Terprediksi
**Penyebab**: OOM Killer atau Database issue
**Fix**:
```bash
# Cek OOM logs
dmesg | tail -50 | grep -i oom

# Restart database
docker restart postgres-container

# Clear dan restart PM2
pm2 flush
pm2 restart all
```

### Gejala: Downtime Setelah Beberapa Jam
**Penyebab**: Memory leak
**Fix**:
```bash
# Monitor memory growth
watch -n 5 'pm2 status'

# Set max_memory_restart lebih rendah
max_memory_restart: '500M'  # di ecosystem.config.js
```

### Gejala: Response Time Tinggi Lalu Timeout
**Penyebab**: CPU overload atau slow query
**Fix**:
```bash
# Monitor CPU
pm2 monit

# Optimize database queries
# Add indexes ke database
# Cache frequently accessed data
```

---

## 🚨 Action Plan - Langkah Prioritas

### STEP 1: Diagnosis (Wajib)
```bash
# Copy script di atas ke file
nano diagnosis-downtime.sh
chmod +x diagnosis-downtime.sh
./diagnosis-downtime.sh > diagnosis-$(date +%Y%m%d-%H%M%S).log
```

### STEP 2: Quick Wins
```bash
# Clear logs
pm2 flush

# Restart semua
pm2 restart all
sudo systemctl restart nginx

# Monitor selama 5 menit
watch -n 5 'pm2 status'
```

### STEP 3: Monitoring Real-Time
```bash
# Terminal 1: PM2 monitoring
pm2 monit

# Terminal 2: System resources
htop

# Terminal 3: Logs
pm2 logs --lines 50
```

### STEP 4: Optimization (Jika Masih Downtime)
1. Kurangi instances cluster (16 → 8 → 4)
2. Tambahkan caching (Redis)
3. Optimize database queries
4. Tambah swap memory
5. Upgrade VPS specs

---

## 📈 Monitoring Jangka Panjang

### Setup PM2 Plus (Monitoring Advanced)
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 7
```

### Tambah Alert di Uptime Kuma
- Email notification saat downtime
- Webhook ke Telegram/Discord
- SMS alert untuk critical service

### Setup Grafana + Prometheus
- Visual metrics
- Historical data
- Alert rules
- Capacity planning

---

## ⚡ Prevention - Agar Tidak Downtime Lagi

1. **Resource Management**:
   - Set proper limits di ecosystem.config.js
   - Monitor dengan pm2 monit
   - Setup alerts sebelum resource habis

2. **Log Management**:
   - Auto-rotate logs
   - Clear old logs regularly
   - Monitor disk space

3. **Health Checks**:
   - Pastikan /health endpoint ringan
   - Tidak hit database terlalu berat
   - Response time < 100ms

4. **Database**:
   - Connection pooling
   - Query optimization
   - Regular maintenance

5. **Graceful Degradation**:
   - Fallback mechanisms
   - Circuit breakers
   - Retry logic

---

## 📞 Next Steps

1. **Jalankan diagnosis script** dan kirim hasilnya
2. **Cek PM2 logs** untuk error patterns
3. **Monitor real-time** selama beberapa menit
4. **Implement fixes** based on diagnosis

Kirim hasil diagnosis-nya, saya akan bantu analisis lebih detail! 🚀
