# ⚡ Quick Resource Check Commands - Copy Paste

## 🚀 Quick Check (1 Menit)

Copy-paste semua command ini sekaligus ke VPS:

```bash
echo "=== DISK USAGE ===" && df -h / && echo "" && echo "=== MEMORY ===" && free -h && echo "" && echo "=== TOP DIRECTORIES ===" && du -h --max-depth=1 /home/foom 2>/dev/null | sort -hr | head -10 && echo "" && echo "=== DEPLOYMENTS ===" && du -sh /home/foom/deployments/* 2>/dev/null | sort -hr && echo "" && echo "=== NODE_MODULES ===" && find /home/foom -type d -name "node_modules" -exec du -sh {} \; 2>/dev/null | sort -hr | head -5
```

---

## 📊 Detailed Check (5 Menit)

### 1. Disk & Memory Overview
```bash
df -h && free -h && uptime
```

### 2. Largest Directories
```bash
du -h --max-depth=1 /home/foom 2>/dev/null | sort -hr | head -20
```

### 3. Deployments Size
```bash
du -sh /home/foom/deployments/* 2>/dev/null | sort -hr
```

### 4. Node Modules
```bash
find /home/foom -type d -name "node_modules" -exec du -sh {} \; 2>/dev/null | sort -hr
```

### 5. Log Files
```bash
du -sh ~/.pm2/logs && find /home/foom -type f -name "*.log" -size +10M -exec ls -lh {} \; 2>/dev/null
```

### 6. Large Files
```bash
find /home/foom -type f -size +100M -exec ls -lh {} \; 2>/dev/null | awk '{print $5, $9}'
```

### 7. Backups/Archives
```bash
find /home/foom -type f \( -name "*.tar.gz" -o -name "*.zip" -o -name "*backup*" \) -exec ls -lh {} \; 2>/dev/null | head -10
```

### 8. Process Resource
```bash
ps aux --sort=-%mem | head -11 && echo "" && ps aux --sort=-%cpu | head -11
```

---

## 🧹 Quick Cleanup (Hati-Hati!)

### Clean PM2 Logs
```bash
pm2 flush
```

### Clean Old Deployments (Keep 2 terbaru)
```bash
cd /home/foom/deployments && ls -t | tail -n +3 | xargs rm -rf
```

### Clean Nginx Logs
```bash
sudo truncate -s 0 /var/log/nginx/*.log
```

### Clean Docker (Jika ada)
```bash
docker system prune -a --volumes -f
```

---

## 📋 All-in-One Diagnostic

Jalankan semua sekaligus dan save ke file:

```bash
{
echo "=== SYSTEM INFO ==="
df -h / && free -h && uptime
echo ""
echo "=== TOP DIRECTORIES ==="
du -h --max-depth=1 /home/foom 2>/dev/null | sort -hr | head -20
echo ""
echo "=== DEPLOYMENTS ==="
du -sh /home/foom/deployments/* 2>/dev/null | sort -hr
echo ""
echo "=== NODE_MODULES ==="
find /home/foom -type d -name "node_modules" -exec du -sh {} \; 2>/dev/null | sort -hr
echo ""
echo "=== LOG FILES ==="
du -sh ~/.pm2/logs 2>/dev/null
find /home/foom -type f -name "*.log" -size +10M -exec ls -lh {} \; 2>/dev/null
echo ""
echo "=== LARGE FILES ==="
find /home/foom -type f -size +100M -exec ls -lh {} \; 2>/dev/null | awk '{print $5, $9}'
echo ""
echo "=== BACKUPS ==="
find /home/foom -type f \( -name "*.tar.gz" -o -name "*.zip" -o -name "*backup*" \) -exec ls -lh {} \; 2>/dev/null | head -10
echo ""
echo "=== PM2 STATUS ==="
pm2 status
echo ""
echo "=== TOP PROCESSES ==="
ps aux --sort=-%mem | head -11
} | tee resource-check-$(date +%Y%m%d-%H%M%S).log
```

---

## 🎯 Most Common Issues & Fixes

### Issue: Disk 80%+ dari deployments
```bash
# Fix: Hapus deployment lama
cd /home/foom/deployments
ls -lt
# Hapus yang paling lama (bukan yang sedang running!)
```

### Issue: Disk 80%+ dari logs
```bash
# Fix: Clean logs
pm2 flush
sudo truncate -s 0 /var/log/nginx/*.log
```

### Issue: Disk 80%+ dari node_modules
```bash
# Fix: Hapus dari backup/old deployment (BUKAN yang aktif!)
find /home/foom/deployments -type d -name "node_modules" -path "*/backup/*" -exec rm -rf {} \;
```

### Issue: Disk 80%+ dari Docker
```bash
# Fix: Clean Docker
docker system prune -a --volumes -f
```

---

## ⚠️ Safety Check Sebelum Cleanup

```bash
# 1. Cek PM2 status (jangan hapus yang running!)
pm2 status

# 2. Cek deployment mana yang aktif
cd /home/foom/deployments
ls -lt

# 3. Cek health endpoint
curl http://localhost:5678/health
```

---

**Gunakan dengan hati-hati! Selalu backup dulu sebelum cleanup besar.**
