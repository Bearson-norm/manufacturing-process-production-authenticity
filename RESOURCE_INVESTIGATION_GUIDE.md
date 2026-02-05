# 🔍 Panduan Investigasi Konsumsi Resource VPS

**Tanggal**: 2026-01-29  
**Issue**: Disk usage 80.9%, perlu investigasi penyebab konsumsi resource berlebihan

---

## 📊 Status Sistem Saat Ini

```
System load:  1.29
Disk usage:   80.9% of 18.33GB  ⚠️ CRITICAL
Memory usage: 38%                ✅ OK
Swap usage:   0%                 ✅ OK
Processes:    182                ⚠️ Perlu dicek
```

---

## 🚀 Quick Start - Script Otomatis

### Option 1: Jalankan Script Lengkap

```bash
# SSH ke VPS
ssh -i "C:\Users\info\.ssh\github_actions_vps" foom@103.31.39.189

# Upload script (jika belum ada)
# Atau buat file langsung di VPS:
nano check-resource-usage.sh
# Copy-paste isi script dari file check-resource-usage.sh

# Berikan permission
chmod +x check-resource-usage.sh

# Jalankan script
./check-resource-usage.sh > resource-investigation-$(date +%Y%m%d-%H%M%S).log 2>&1

# Lihat hasil
cat resource-investigation-*.log
```

---

## 📋 Manual Commands - Copy Paste

### 1. Cek Disk Usage Detail

```bash
# Overview disk usage
df -h

# Cek direktori terbesar di home
du -h --max-depth=1 /home/foom | sort -hr | head -20

# Cek deployment directories
du -sh /home/foom/deployments/* 2>/dev/null | sort -hr

# Breakdown detail deployments
du -h --max-depth=2 /home/foom/deployments | sort -hr | head -30
```

### 2. Cek Node Modules (Biasanya Besar)

```bash
# Cari semua node_modules
find /home/foom -type d -name "node_modules" -exec du -sh {} \; | sort -hr

# Hitung total size node_modules
find /home/foom -type d -name "node_modules" -exec du -sk {} \; | awk '{sum+=$1} END {print sum/1024 " MB"}'
```

### 3. Cek Log Files

```bash
# Log files besar (>10MB)
find /home/foom -type f -name "*.log" -size +10M -exec ls -lh {} \;

# PM2 logs
du -sh ~/.pm2/logs
ls -lh ~/.pm2/logs/*.log | tail -10

# Nginx logs (perlu sudo)
sudo du -sh /var/log/nginx
sudo ls -lh /var/log/nginx/*.log | tail -5

# System logs
sudo du -sh /var/log
sudo ls -lh /var/log/*.log | tail -10
```

### 4. Cek Database Files

```bash
# SQLite databases
find /home/foom -type f -name "*.sqlite*" -exec ls -lh {} \;

# PostgreSQL (jika ada)
sudo du -sh /var/lib/postgresql 2>/dev/null
sudo du -sh /var/lib/postgresql/* 2>/dev/null
```

### 5. Cek Docker (Jika Ada)

```bash
# Docker disk usage
docker system df

# Detail Docker usage
docker system df -v

# Docker images size
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

# Docker volumes
docker volume ls
```

### 6. Cek Backups & Archives

```bash
# Cari file backup/archive
find /home/foom -type f \( -name "*.tar.gz" -o -name "*.zip" -o -name "*.bak" -o -name "*backup*" \) -exec ls -lh {} \; | awk '{print $5, $9}'

# Cek deploy.tar.gz (biasanya besar)
find /home/foom -name "deploy.tar.gz" -exec ls -lh {} \;
```

### 7. Cek Process Resource Usage

```bash
# Top processes by CPU
ps aux --sort=-%cpu | head -11

# Top processes by Memory
ps aux --sort=-%mem | head -11

# Node.js processes memory
ps aux | grep -E "node|PM2" | grep -v grep | awk '{print $2, $3"%", $4"%", $11, $12, $13, $14}'

# Total Node.js memory
ps aux | grep -E "node|PM2" | grep -v grep | awk '{sum+=$4} END {print "Total: " sum "%"}'
```

### 8. Cek PM2 Status

```bash
# PM2 status
pm2 status

# PM2 info detail
pm2 info manufacturing-app
pm2 info manufacturing-app-staging

# PM2 logs size
du -sh ~/.pm2/logs
```

### 9. Cek Large Files

```bash
# File besar (>100MB)
find /home/foom -type f -size +100M -exec ls -lh {} \; | awk '{print $5, $9}'

# File besar yang baru dimodifikasi (7 hari terakhir)
find /home/foom -type f -size +50M -mtime -7 -exec ls -lht {} \; | head -10
```

### 10. Cek Git Repositories

```bash
# Size .git directories
find /home/foom -type d -name ".git" -exec sh -c 'du -sh "$1"' _ {} \; | sort -hr
```

---

## 🧹 Cleanup Commands (Hati-Hati!)

### A. Clean PM2 Logs

```bash
# Flush semua PM2 logs (hapus semua)
pm2 flush

# Atau hapus manual (keep last 1000 lines per log)
cd ~/.pm2/logs
for file in *.log; do
    tail -1000 "$file" > "${file}.tmp" && mv "${file}.tmp" "$file"
done
```

### B. Clean Old Deployments

```bash
# Lihat dulu apa yang akan dihapus
cd /home/foom/deployments
ls -lt

# Hapus deployment lama (keep 2 terbaru)
cd /home/foom/deployments
ls -t | tail -n +3 | xargs -I {} rm -rf {}

# Atau backup dulu sebelum hapus
cd /home/foom/deployments
mkdir -p ../deployments-backup-$(date +%Y%m%d)
ls -t | tail -n +3 | xargs -I {} mv {} ../deployments-backup-$(date +%Y%m%d)/
```

### C. Clean Node Modules (Hati-Hati!)

```bash
# Cek dulu size
find /home/foom/deployments -type d -name "node_modules" -exec du -sh {} \; | sort -hr

# Hapus node_modules dari deployment lama (bukan yang aktif!)
# JANGAN hapus dari deployment yang sedang running!

# Contoh: hapus dari backup/old deployment
cd /home/foom/deployments
find . -type d -name "node_modules" -path "*/backup/*" -exec rm -rf {} \;
```

### D. Clean Docker (Jika Tidak Diperlukan)

```bash
# Hapus containers yang stopped
docker container prune -f

# Hapus images yang tidak digunakan
docker image prune -a -f

# Hapus volumes yang tidak digunakan
docker volume prune -f

# Full cleanup (HATI-HATI! Hapus semua yang tidak digunakan)
docker system prune -a --volumes -f
```

### E. Clean Log Files

```bash
# Nginx logs (perlu sudo)
sudo truncate -s 0 /var/log/nginx/access.log
sudo truncate -s 0 /var/log/nginx/error.log

# Atau rotate logs
sudo logrotate -f /etc/logrotate.d/nginx

# System logs (perlu sudo)
sudo journalctl --vacuum-time=7d  # Keep last 7 days
```

### F. Clean Old Backups

```bash
# Cari backup files
find /home/foom -type f \( -name "*.tar.gz" -o -name "*.zip" -o -name "*backup*" \) -mtime +30 -exec ls -lh {} \;

# Hapus backup lebih dari 30 hari (HATI-HATI!)
find /home/foom -type f \( -name "*.tar.gz" -o -name "*.zip" -o -name "*backup*" \) -mtime +30 -delete
```

---

## 📊 Analisis Hasil

### Disk Usage Breakdown Normal

```
/home/foom/
├── deployments/          ~5-8GB  (normal untuk 2-3 deployments)
│   ├── manufacturing-app/        ~2-3GB
│   └── manufacturing-app-staging/ ~2-3GB
├── node_modules/        ~1-2GB  (per deployment)
├── .pm2/logs/           ~100-500MB
├── database files/      ~100-500MB
└── other/              ~1-2GB
```

### Tanda Masalah

1. **Disk > 80%**: Perlu cleanup
2. **node_modules > 3GB**: Ada duplikasi atau terlalu banyak
3. **Logs > 1GB**: Perlu rotation
4. **Backups > 2GB**: Perlu hapus yang lama
5. **Docker > 5GB**: Perlu cleanup images/volumes

---

## 🎯 Action Plan Berdasarkan Hasil

### Jika Disk Usage dari Deployments

```bash
# 1. Cek size deployments
du -sh /home/foom/deployments/*

# 2. Hapus deployment lama (keep 2 terbaru)
cd /home/foom/deployments
ls -lt
# Hapus yang paling lama

# 3. Restart PM2 jika perlu
pm2 restart all
```

### Jika Disk Usage dari Logs

```bash
# 1. Flush PM2 logs
pm2 flush

# 2. Clean nginx logs
sudo truncate -s 0 /var/log/nginx/*.log

# 3. Clean system logs
sudo journalctl --vacuum-time=7d
```

### Jika Disk Usage dari Node Modules

```bash
# 1. Cek duplikasi
find /home/foom/deployments -type d -name "node_modules" -exec du -sh {} \;

# 2. Hapus dari backup/old deployment (BUKAN yang aktif!)
# Jangan hapus dari deployment yang sedang running
```

### Jika Disk Usage dari Docker

```bash
# 1. Cek Docker usage
docker system df

# 2. Clean unused
docker system prune -a --volumes -f
```

---

## ⚠️ Peringatan Penting

1. **JANGAN hapus deployment yang sedang running**
   - Cek dulu dengan `pm2 status`
   - Hanya hapus deployment lama/backup

2. **JANGAN hapus node_modules dari deployment aktif**
   - Akan menyebabkan aplikasi crash
   - Hanya hapus dari backup/old deployment

3. **Backup dulu sebelum cleanup besar**
   ```bash
   # Backup deployments
   tar -czf deployments-backup-$(date +%Y%m%d).tar.gz /home/foom/deployments
   ```

4. **Test setelah cleanup**
   ```bash
   # Cek aplikasi masih running
   pm2 status
   curl http://localhost:5678/health
   ```

---

## 📝 Checklist Investigasi

```
□ Jalankan script check-resource-usage.sh
□ Cek disk usage breakdown
□ Cek node_modules size
□ Cek log files size
□ Cek database size
□ Cek Docker usage (jika ada)
□ Cek old backups/archives
□ Cek process resource usage
□ Identifikasi penyebab utama
□ Lakukan cleanup sesuai kebutuhan
□ Verify aplikasi masih running
□ Monitor setelah cleanup
```

---

## 🔄 Monitoring Ongoing

```bash
# Watch disk usage
watch -n 60 'df -h /'

# Watch process count
watch -n 30 'ps aux | wc -l'

# Watch memory usage
watch -n 30 'free -h'

# PM2 monitoring
pm2 monit
```

---

## 📞 Next Steps

1. **Jalankan script investigasi**:
   ```bash
   ./check-resource-usage.sh > investigation-$(date +%Y%m%d-%H%M%S).log
   ```

2. **Analisis hasil** dan identifikasi penyebab utama

3. **Lakukan cleanup** sesuai rekomendasi

4. **Monitor** setelah cleanup untuk memastikan disk usage turun

5. **Setup log rotation** untuk mencegah masalah di masa depan

---

**Update terakhir**: 2026-01-29
