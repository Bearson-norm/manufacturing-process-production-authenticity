# ⚡ Quick Fix High CPU - Copy Paste

## 🚀 Immediate Fix

```bash
# Restart instance yang bermasalah (ID 9)
pm2 restart 9

# Monitor
watch -n 2 'pm2 status | grep manufacturing-app'
```

---

## 🔍 Quick Diagnosis

```bash
# Check CPU usage
pm2 status

# Get detailed info
pm2 describe 9

# Check what process is doing
ps aux | grep $(pm2 jlist | jq -r '.[] | select(.pm_id == 9) | .pid') | head -5
```

---

## 🛠️ If Restart Doesn't Help

```bash
# 1. Stop instance
pm2 stop 9

# 2. Check logs
pm2 logs manufacturing-app --lines 200 | tail -50

# 3. Look for patterns
pm2 logs manufacturing-app --lines 200 | grep -E "loop|while|for|processing" -i

# 4. After investigation, restart
pm2 start 9
```

---

## 📊 Monitor CPU Usage

```bash
# Watch CPU in real-time
watch -n 2 'pm2 status | grep manufacturing-app'

# Check system load
watch -n 5 'uptime && pm2 status | grep manufacturing-app'
```

---

## 🔧 Alternative Fixes

### Fix 1: Restart All Instances

```bash
pm2 restart manufacturing-app
pm2 save
```

### Fix 2: Stop and Investigate

```bash
# Stop problematic instance
pm2 stop 9

# Check system impact
uptime
free -h

# Check if other instance handles load
pm2 status

# Restart after fix
pm2 start 9
```

### Fix 3: Delete and Recreate Instance

```bash
# Delete instance
pm2 delete 9

# PM2 will auto-recreate in cluster mode
# Or manually start
pm2 start manufacturing-app
```

---

## ✅ Verify Fix

```bash
# Check CPU (should be <10% for each instance)
pm2 status

# Monitor for 5 minutes
watch -n 10 'pm2 status && uptime'
```

---

**Gunakan `fix-high-cpu.sh` untuk fix otomatis!**
