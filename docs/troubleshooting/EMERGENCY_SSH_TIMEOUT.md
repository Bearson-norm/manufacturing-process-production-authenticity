# EMERGENCY - SSH Connection Timeout & Unstable Access

**Tanggal**: 2026-01-17 06:22 UTC  
**Status**: 🔴 CRITICAL - SSH timeout, connection reset, domain unstable  
**Root Cause**: **Manufacturing-app restart 16x** + Network/SSH issues

---

## 🚨 MASALAH YANG TERIDENTIFIKASI

### 1. ❌ SSH Connection Timeout & Reset
```
kex_exchange_identification: read: Connection timed out
client_loop: send disconnect: Connection reset
```

### 2. ❌ Manufacturing-app Restart 16 Kali
```
manufacturing-app │ cluster │ 16 │ online
```
**INI PENYEBAB UTAMA!** App crash 16x, consuming resources berlebihan.

### 3. ⚠️ Domain Kadang Bisa Kadang Tidak
Website unstable - kemungkinan:
- Backend crash
- Nginx overload
- Resource spike saat restart

### 4. ✅ VPS Status Terlihat Normal (Saat Bisa Akses)
- Load: 0.25
- Memory: 27%
- Processes: 154 (turun dari 165!)

---

## 🔍 ROOT CAUSE ANALYSIS

### **Manufacturing-app Restart 16x = Crash Loop!**

**Ini penyebabnya**:

1. **App crash → PM2 auto-restart**
2. **Saat restart → resource spike (CPU/Memory/Network)**
3. **Resource spike → SSH timeout & connection drop**
4. **SSH daemon kewalahan handle connections**
5. **Domain unstable karena backend restart terus**

**Crash loop cycle**:
```
App crash → Restart → Resource spike → Network congestion → SSH timeout
     ↑                                                              ↓
     └──────────────────── App crash lagi ───────────────────────┘
```

---

## 🎯 KENAPA MANUFACTURING-APP CRASH?

Kemungkinan penyebab crash:

### 1. **Database Connection Error** (Paling Sering)
- PostgreSQL connection pool habis
- Database locked
- Slow query timeout

### 2. **Memory Leak**
- App consume memory terus sampai OOM
- PM2 kill karena max_memory_restart
- Restart, leak lagi, cycle berulang

### 3. **Unhandled Exception**
- Error di code yang tidak di-catch
- Promise rejection
- Async error

### 4. **Port Already in Use**
- Port 1234 conflict
- Multiple instances trying bind same port
- Restart terus karena cannot bind

### 5. **Cluster Mode Issue**
- Worker crash
- Master process issue
- IPC communication error

---

## 🚑 EMERGENCY FIX - JALANKAN SEGERA

### **STEP 1: Stop Crash Loop (PRIORITY!)**

Kalau bisa SSH (tunggu momen bisa masuk):

```bash
# STOP manufacturing-app dulu untuk stabilkan server
pm2 stop manufacturing-app

# Tunggu 30 detik
sleep 30

# Cek apakah SSH stabil sekarang
# Kalau stabil, lanjut investigasi
```

### **STEP 2: Check Error Logs**

```bash
# Lihat error yang menyebabkan crash
pm2 logs manufacturing-app --lines 200 --err

# Save ke file
pm2 logs manufacturing-app --lines 500 --err --nostream > crash-logs.txt

# Cari pattern error
grep -i "error\|exception\|crash\|fatal" crash-logs.txt
```

### **STEP 3: Check Database**

```bash
# Test database connection
docker exec -it whac-postgres psql -U your_username -d your_database -c "SELECT 1"

# Check database connections
docker exec -it whac-postgres psql -U your_username -d your_database -c "SELECT count(*) FROM pg_stat_activity"

# Restart database jika perlu
docker restart whac-postgres
```

### **STEP 4: Start dengan Instances Minimal**

Edit ecosystem.config.js:

```bash
cd /home/foom/deployments/manufacturing-app/server
nano ecosystem.config.js
```

Change:
```javascript
// TEMPORARY: dari cluster max ke fork mode dulu
{
  name: 'manufacturing-app',
  script: './index.js',
  instances: 1,           // CHANGE: dari 'max' ke 1
  exec_mode: 'fork',      // CHANGE: dari 'cluster' ke 'fork'
  env: {
    NODE_ENV: 'production',
    PORT: 1234
  }
}
```

Start kembali:
```bash
pm2 restart manufacturing-app
pm2 save

# Monitor logs
pm2 logs manufacturing-app --lines 50
```

### **STEP 5: Monitor Stability**

```bash
# Watch PM2 status setiap 5 detik
watch -n 5 'pm2 status'

# Jika restart count naik terus = masih crash
# Jika stabil di restart 0-1 = fixed!
```

---

## 🔧 SSH CONNECTION FIXES

### Fix 1: Increase SSH Connection Limits

```bash
sudo nano /etc/ssh/sshd_config
```

Add/modify:
```
MaxStartups 20:30:100
MaxSessions 100
LoginGraceTime 60
ClientAliveInterval 60
ClientAliveCountMax 3
```

Restart SSH:
```bash
sudo systemctl restart sshd
```

### Fix 2: Check Fail2ban

```bash
# Check if your IP is banned
sudo fail2ban-client status sshd

# Unban your IP jika banned
sudo fail2ban-client set sshd unbanip 180.243.2.44
```

### Fix 3: Check Firewall

```bash
# Check iptables rules
sudo iptables -L -n -v

# Check if SSH port open
sudo ufw status | grep 22
```

### Fix 4: Check Network Connections

```bash
# Check established connections
netstat -an | grep :22 | wc -l

# Check TIME_WAIT connections
netstat -an | grep TIME_WAIT | wc -l

# If too many, tune TCP settings
sudo sysctl -w net.ipv4.tcp_fin_timeout=30
sudo sysctl -w net.ipv4.tcp_tw_reuse=1
```

---

## 📊 DIAGNOSIS SCRIPT (Saat Bisa SSH)

```bash
#!/bin/bash
# emergency-diagnosis.sh

echo "=== EMERGENCY DIAGNOSIS ==="
echo ""

echo "1. PM2 Status:"
pm2 status
echo ""

echo "2. PM2 Restarts:"
pm2 jlist | jq -r '.[] | "\(.name): \(.pm2_env.restart_time) restarts"'
echo ""

echo "3. Last 30 Error Lines:"
pm2 logs manufacturing-app --lines 30 --err --nostream
echo ""

echo "4. Database Status:"
docker ps | grep postgres
echo ""

echo "5. Network Connections:"
netstat -an | grep :1234 | wc -l
echo ""

echo "6. SSH Connections:"
netstat -an | grep :22 | grep ESTABLISHED | wc -l
echo ""

echo "7. System Load:"
uptime
echo ""

echo "8. Memory:"
free -h
echo ""

echo "9. Recent System Errors:"
sudo journalctl -p err -n 20 --no-pager
echo ""
```

---

## 🎯 IMMEDIATE ACTION PLAN

### Option A: VPS Bisa Diakses (Recommended)

```bash
# 1. Stop crash loop
pm2 stop manufacturing-app

# 2. Check logs
pm2 logs manufacturing-app --lines 200 --err > crash-$(date +%Y%m%d-%H%M%S).log

# 3. Fix ecosystem config (reduce instances)
cd ~/deployments/manufacturing-app/server
nano ecosystem.config.js
# Change: instances: 'max' → instances: 1
# Change: exec_mode: 'cluster' → exec_mode: 'fork'

# 4. Restart database
docker restart whac-postgres

# 5. Start app dengan config baru
pm2 delete manufacturing-app
pm2 start ecosystem.config.js --only manufacturing-app
pm2 save

# 6. Monitor
pm2 logs manufacturing-app
```

### Option B: VPS Tidak Bisa Diakses (Emergency)

**Pakai VPS provider console/dashboard**:
1. Login ke IDCloudHost dashboard
2. Access console/VNC
3. Login via console
4. Run: `pm2 stop manufacturing-app`
5. Wait untuk SSH stabil
6. Login via SSH dan fix

### Option C: Nuclear Option (Last Resort)

```bash
# Restart VPS
sudo reboot

# Setelah up:
# 1. Stop manufacturing-app
pm2 stop manufacturing-app

# 2. Start staging only (lebih ringan)
pm2 start manufacturing-app-staging

# 3. Investigate manufacturing-app issue
pm2 logs manufacturing-app --lines 500 --err
```

---

## 🔍 WHAT TO LOOK FOR IN LOGS

### Error Patterns yang Harus Dicari:

```bash
# Database errors
grep -i "database\|postgres\|connection\|econnrefused" crash-logs.txt

# Memory errors
grep -i "memory\|heap\|oom" crash-logs.txt

# Port errors
grep -i "eaddrinuse\|port.*already" crash-logs.txt

# Unhandled errors
grep -i "unhandled\|rejection\|uncaught" crash-logs.txt

# Timeout errors
grep -i "timeout\|etimedout" crash-logs.txt
```

---

## 📱 TEMPORARY WORKAROUND

Jika manufacturing-app terus crash:

### Use Staging Only

```bash
# Stop production yang crash
pm2 stop manufacturing-app
pm2 delete manufacturing-app

# Start staging with production port
# Edit staging config:
nano ecosystem.config.js

# Change staging port 5678 → 1234
# Restart staging
pm2 restart manufacturing-app-staging
pm2 save
```

### Update Nginx

```bash
# Point production nginx ke staging port
sudo nano /etc/nginx/sites-available/manufacturing-app

# Change proxy_pass dari http://localhost:1234 ke http://localhost:5678
# Restart nginx
sudo systemctl restart nginx
```

---

## 🚨 PREVENTION

Setelah stabilkan:

### 1. Add Crash Monitoring

```javascript
// In ecosystem.config.js
{
  name: 'manufacturing-app',
  // ... other configs
  max_restarts: 5,        // Stop after 5 restarts
  min_uptime: '30s',      // Must stay up 30s to count as stable
  restart_delay: 5000,    // Wait 5s before restart
  exp_backoff_restart_delay: 100  // Exponential backoff
}
```

### 2. Add Error Handling in Code

```javascript
// In server/index.js
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit, just log
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Graceful shutdown
  process.exit(1);
});
```

### 3. Database Connection Pooling

```javascript
// Add connection pool limits
const pool = {
  max: 10,
  min: 2,
  idle: 10000,
  acquire: 30000
}
```

---

## 📞 NEXT STEPS

**PRIORITY ORDER**:

1. ⚡ **URGENT**: Stop manufacturing-app untuk stabilkan SSH
2. 🔍 **CHECK**: Logs untuk root cause
3. 🔧 **FIX**: Reduce instances, fix code issue
4. 🚀 **RESTART**: Dengan config yang aman
5. 👀 **MONITOR**: Stability selama 1 jam

---

## 💬 Analisis Pribadi

Ini **BUKAN masalah 165 processes**. Ini **manufacturing-app crash loop**!

**Timeline**:
1. Semalam staging di-up → OK
2. Pagi ini manufacturing-app crash → restart 16x
3. Crash cycle → resource spike → SSH timeout
4. SSH unstable → connection reset
5. Domain unstable → backend restart terus

**Root cause**: Ada bug di manufacturing-app yang menyebabkan crash.

**Quick fix**: Stop production, pakai staging dulu, investigate logs.

---

**Sekarang prioritas: STABILKAN SSH dengan stop manufacturing-app!** 🚨
