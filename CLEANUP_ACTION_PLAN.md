# 🧹 Action Plan: Cleanup Disk Usage (82% → Target: <70%)

**Tanggal**: 2026-01-29  
**Status Saat Ini**: Disk 82% (15GB dari 19GB)  
**Target**: <70% (sekitar 13GB)

---

## 📊 Analisis Hasil Investigasi

### Penyebab Utama Disk Usage:

| Item | Size | Priority | Action |
|------|------|----------|--------|
| **Docker Unused Images** | **5.892GB** | 🔴 **HIGH** | Clean unused images |
| **Old Deployments (2 backup)** | **906MB** | 🟡 **MEDIUM** | Hapus backup lama |
| **NPM Cache** | **92MB** | 🟢 **LOW** | Clean npm cache |
| **Nginx Logs** | **17MB** | 🟢 **LOW** | Rotate logs |
| **Other backups** | **~100MB** | 🟢 **LOW** | Hapus backup kecil |

**Total Reclaimable: ~6.9GB**  
**Expected Result: 82% → ~48%** ✅

---

## 🎯 Action Plan (Prioritas)

### Priority 1: Clean Docker (5.892GB) ⚠️ **PALING BESAR!**

**Impact**: Menghemat **5.892GB** (dari 5.892GB reclaimable)

```bash
# 1. Cek dulu apa yang akan dihapus
docker system df

# 2. Hapus unused images (AMAN - hanya yang tidak digunakan)
docker image prune -a -f

# 3. Hapus build cache
docker builder prune -f

# 4. Verify hasil
docker system df
df -h /
```

**Expected**: Disk usage turun dari 82% → ~52%

---

### Priority 2: Hapus Old Deployments (906MB)

**Impact**: Menghemat **906MB**

**Backup yang akan dihapus:**
- `manufacturing-app-backup-20260122-164024` (453M)
- `manufacturing-app-backup-20260122-162129` (453M)

**⚠️ PENTING**: Pastikan deployment aktif tidak dihapus!

```bash
# 1. Cek PM2 status - pastikan deployment aktif
pm2 status

# Deployment aktif (JANGAN HAPUS):
# - manufacturing-app (11M) ✅
# - manufacturing-app-staging (11M) ✅

# 2. Hapus backup lama (22 Januari - sudah 7 hari)
cd /home/foom/deployments
rm -rf manufacturing-app-backup-20260122-164024
rm -rf manufacturing-app-backup-20260122-162129

# 3. Verify
du -sh /home/foom/deployments/*
df -h /
```

**Expected**: Disk usage turun dari ~52% → ~48%

---

### Priority 3: Clean NPM Cache (92MB)

**Impact**: Menghemat **92MB**

```bash
# Clean npm cache
npm cache clean --force

# Verify
du -sh ~/.npm
```

**Expected**: Disk usage turun dari ~48% → ~47%

---

### Priority 4: Clean Nginx Logs (17MB)

**Impact**: Menghemat **17MB**

```bash
# Rotate nginx logs (perlu sudo)
sudo truncate -s 0 /var/log/nginx/*.log
sudo systemctl reload nginx

# Atau setup log rotation
sudo logrotate -f /etc/logrotate.d/nginx
```

**Expected**: Disk usage turun dari ~47% → ~47%

---

### Priority 5: Clean Other Small Backups (Optional)

**Impact**: Menghemat **~100MB**

Backup kecil yang bisa dihapus (jika tidak diperlukan):
- `manufacturing-app-backup-20260107-070725` (39M)
- `manufacturing-app-staging-backup-20260129-085443` (11M)
- `manufacturing-app-backup-20260129-094401` (11M)
- `manufacturing-app-staging-backup-20260129-092648` (10M)
- `manufacturing-app-staging-backup-20260121-152000` (10M)
- `manufacturing-app-backup-20260129-143600` (10M)

```bash
# Hapus backup kecil (HATI-HATI - pastikan tidak diperlukan!)
cd /home/foom/deployments
rm -rf manufacturing-app-backup-20260107-070725
# ... (hapus yang lain jika diperlukan)
```

---

## 🚀 Quick Cleanup Script (All-in-One)

**⚠️ BACA DULU SEBELUM JALANKAN!**

Script ini akan:
1. ✅ Clean Docker unused images (5.892GB)
2. ✅ Hapus 2 backup lama (906MB)
3. ✅ Clean npm cache (92MB)
4. ✅ Rotate nginx logs (17MB)

**Total: ~6.9GB**

```bash
#!/bin/bash
# Quick Cleanup Script - Manufacturing App VPS
# WARNING: Review before running!

set -e

echo "=========================================="
echo "QUICK CLEANUP SCRIPT"
echo "=========================================="
echo ""

# Safety check: Verify PM2 status
echo "=== Safety Check: PM2 Status ==="
pm2 status
echo ""
read -p "Are deployments running correctly? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted. Please check PM2 status first."
    exit 1
fi

# 1. Clean Docker (5.892GB)
echo ""
echo "=== 1. Cleaning Docker (5.892GB) ==="
docker system df
echo ""
read -p "Proceed with Docker cleanup? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker image prune -a -f
    docker builder prune -f
    echo "✅ Docker cleaned"
    docker system df
fi

# 2. Remove old deployments (906MB)
echo ""
echo "=== 2. Removing Old Deployments (906MB) ==="
cd /home/foom/deployments
echo "Current deployments:"
ls -lh | grep backup
echo ""
read -p "Remove backups from 2026-01-22? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf manufacturing-app-backup-20260122-164024
    rm -rf manufacturing-app-backup-20260122-162129
    echo "✅ Old deployments removed"
    du -sh /home/foom/deployments/*
fi

# 3. Clean npm cache (92MB)
echo ""
echo "=== 3. Cleaning NPM Cache (92MB) ==="
npm cache clean --force
echo "✅ NPM cache cleaned"

# 4. Rotate nginx logs (17MB)
echo ""
echo "=== 4. Rotating Nginx Logs (17MB) ==="
sudo truncate -s 0 /var/log/nginx/*.log
sudo systemctl reload nginx
echo "✅ Nginx logs rotated"

# Final check
echo ""
echo "=========================================="
echo "CLEANUP COMPLETE"
echo "=========================================="
echo ""
echo "=== Final Disk Usage ==="
df -h /
echo ""
echo "=== Final Deployments Size ==="
du -sh /home/foom/deployments/*
echo ""
echo "✅ Done!"
```

---

## 📋 Manual Commands (Copy-Paste)

### Step 1: Safety Check

```bash
# Cek PM2 status - pastikan semua running
pm2 status

# Cek deployment aktif (JANGAN HAPUS!)
cd /home/foom/deployments
ls -lh | grep -E "manufacturing-app$|manufacturing-app-staging$"
```

### Step 2: Clean Docker (5.892GB)

```bash
# Cek dulu
docker system df

# Hapus unused images
docker image prune -a -f

# Hapus build cache
docker builder prune -f

# Verify
docker system df
df -h /
```

### Step 3: Remove Old Deployments (906MB)

```bash
cd /home/foom/deployments

# Hapus backup lama (22 Januari)
rm -rf manufacturing-app-backup-20260122-164024
rm -rf manufacturing-app-backup-20260122-162129

# Verify
du -sh /home/foom/deployments/*
df -h /
```

### Step 4: Clean NPM Cache (92MB)

```bash
npm cache clean --force
du -sh ~/.npm
```

### Step 5: Rotate Nginx Logs (17MB)

```bash
sudo truncate -s 0 /var/log/nginx/*.log
sudo systemctl reload nginx
```

### Step 6: Final Verification

```bash
# Check disk usage
df -h /

# Check deployments
du -sh /home/foom/deployments/*

# Check PM2 still running
pm2 status

# Test health endpoint
curl http://localhost:5678/health
```

---

## ⚠️ Safety Checklist

Sebelum cleanup, pastikan:

- [ ] PM2 status menunjukkan semua aplikasi **online**
- [ ] Deployment aktif (`manufacturing-app` dan `manufacturing-app-staging`) **TIDAK** dihapus
- [ ] Health endpoint masih berfungsi: `curl http://localhost:5678/health`
- [ ] Backup penting sudah di-backup (jika diperlukan)
- [ ] Docker containers yang running **TIDAK** akan terpengaruh

---

## 📊 Expected Results

### Before Cleanup:
- Disk: **82%** (15GB dari 19GB)
- Available: **3.5GB**

### After Cleanup:
- Disk: **~48%** (9.1GB dari 19GB)
- Available: **~9.9GB**
- **Freed: ~6.9GB** ✅

---

## 🔄 Monitoring After Cleanup

```bash
# Monitor disk usage
watch -n 60 'df -h /'

# Monitor PM2
pm2 monit

# Check if apps still running
pm2 status
curl http://localhost:5678/health
```

---

## 🆘 Rollback (Jika Ada Masalah)

Jika setelah cleanup ada masalah:

### Docker:
```bash
# Docker images sudah terhapus, tidak bisa rollback
# Tapi containers yang running tidak terpengaruh
```

### Deployments:
```bash
# Backup sudah terhapus, tidak bisa rollback
# Tapi deployment aktif tidak terpengaruh
```

### PM2:
```bash
# Restart jika perlu
pm2 restart all
```

---

## 💡 Tips untuk Masa Depan

1. **Setup automatic cleanup**:
   - Docker: `docker system prune -a --volumes --force` (weekly cron)
   - Deployments: Keep hanya 2-3 backup terbaru
   - Logs: Setup log rotation

2. **Monitor disk usage**:
   ```bash
   # Add to cron
   0 0 * * * df -h / | mail -s "Daily Disk Usage" your@email.com
   ```

3. **Preventive measures**:
   - Hapus backup otomatis setelah 7 hari
   - Clean Docker images setelah build
   - Rotate logs secara berkala

---

**Update terakhir**: 2026-01-29
