# 📦 Panduan Update Sistem ke VPS (Dari Sistem Lama ke Sistem Baru)

Panduan lengkap untuk melakukan update sistem Manufacturing Process Production Authenticity dari versi lama ke versi baru di VPS.

## 📋 Daftar Isi

1. [Pre-Update Checklist](#pre-update-checklist)
2. [Backup Strategy](#backup-strategy)
3. [Perubahan yang Ada di Sistem Baru](#perubahan-yang-ada-di-sistem-baru)
4. [Step-by-Step Update Process](#step-by-step-update-process)
5. [Database Migration](#database-migration)
6. [Verification & Testing](#verification--testing)
7. [Rollback Plan](#rollback-plan)
8. [Troubleshooting](#troubleshooting)

---

## ✅ Pre-Update Checklist

Sebelum melakukan update, pastikan checklist berikut sudah dilakukan:

### 1. Backup Data
- [ ] **Backup Database SQLite** (PENTING!)
  ```bash
  # SSH ke VPS
  ssh foom@103.31.39.189
  
  # Backup database
  cd ~/deployments/manufacturing-app/server
  cp database.sqlite database.sqlite.backup-$(date +%Y%m%d-%H%M%S)
  
  # Backup juga file .wal dan .shm jika ada
  cp database.sqlite-wal database.sqlite-wal.backup-$(date +%Y%m%d-%H%M%S) 2>/dev/null || true
  cp database.sqlite-shm database.sqlite-shm.backup-$(date +%Y%m%d-%H%M%S) 2>/dev/null || true
  ```

- [ ] **Backup Deployment Folder**
  ```bash
  cd ~/deployments
  tar -czf manufacturing-app-backup-$(date +%Y%m%d-%H%M%S).tar.gz manufacturing-app/
  ```

- [ ] **Backup Environment Variables**
  ```bash
  cd ~/deployments/manufacturing-app/server
  cp .env .env.backup-$(date +%Y%m%d-%H%M%S) 2>/dev/null || true
  ```

### 2. Informasi Sistem Lama
- [ ] Catat versi Node.js yang digunakan
- [ ] Catat port yang digunakan (default: 1234)
- [ ] Catat lokasi deployment folder
- [ ] Catat konfigurasi PM2 yang ada
- [ ] Catat konfigurasi Nginx yang ada

### 3. Test di Local
- [ ] Test sistem baru di local machine terlebih dahulu
- [ ] Test semua fitur utama
- [ ] Test database migration script

### 4. Maintenance Window
- [ ] Tentukan waktu maintenance (low traffic period)
- [ ] Informasikan user tentang maintenance window
- [ ] Siapkan rollback plan

---

## 💾 Backup Strategy

### Automatic Backup Script

Buat script backup sebelum update:

```bash
#!/bin/bash
# backup-before-update.sh

BACKUP_DIR="/home/foom/backups/manufacturing-app"
DATE=$(date +%Y%m%d-%H%M%S)
mkdir -p $BACKUP_DIR

echo "🔄 Starting backup process..."

# Backup database
if [ -f ~/deployments/manufacturing-app/server/database.sqlite ]; then
  cp ~/deployments/manufacturing-app/server/database.sqlite $BACKUP_DIR/database_$DATE.sqlite
  echo "✅ Database backed up: database_$DATE.sqlite"
fi

# Backup WAL files
if [ -f ~/deployments/manufacturing-app/server/database.sqlite-wal ]; then
  cp ~/deployments/manufacturing-app/server/database.sqlite-wal $BACKUP_DIR/database_$DATE.sqlite-wal
  echo "✅ WAL file backed up"
fi

# Backup SHM files
if [ -f ~/deployments/manufacturing-app/server/database.sqlite-shm ]; then
  cp ~/deployments/manufacturing-app/server/database.sqlite-shm $BACKUP_DIR/database_$DATE.sqlite-shm
  echo "✅ SHM file backed up"
fi

# Backup entire deployment folder
cd ~/deployments
tar -czf $BACKUP_DIR/manufacturing-app-full_$DATE.tar.gz manufacturing-app/
echo "✅ Full deployment backed up: manufacturing-app-full_$DATE.tar.gz"

# Backup environment file
if [ -f ~/deployments/manufacturing-app/server/.env ]; then
  cp ~/deployments/manufacturing-app/server/.env $BACKUP_DIR/env_$DATE.env
  echo "✅ Environment file backed up"
fi

# Keep only last 10 backups
cd $BACKUP_DIR
ls -t | tail -n +11 | xargs rm -f 2>/dev/null || true

echo "✅ Backup completed! Files saved to: $BACKUP_DIR"
echo "📋 Backup list:"
ls -lh $BACKUP_DIR | grep $DATE
```

Simpan sebagai `backup-before-update.sh` dan jalankan:
```bash
chmod +x backup-before-update.sh
./backup-before-update.sh
```

---

## 🔄 Perubahan yang Ada di Sistem Baru

### Fitur Baru yang Ditambahkan:

1. **External API Integration**
   - ✅ Scheduler untuk mengirim MO list ke API eksternal (setiap 6 jam)
   - ✅ Auto-send data saat Input Authenticity Label Process (status: active)
   - ✅ Auto-send data saat MO disubmit (status: completed)
   - ✅ Konfigurasi URL API eksternal terpisah untuk active dan completed

2. **API Key Authentication** 🔐 **NEW**
   - ✅ Generate API key untuk mengamankan external API endpoints
   - ✅ Middleware authentication untuk semua external API endpoints
   - ✅ Optional authentication (backward compatible jika API key belum dikonfigurasi)
   - ✅ Secure key generation menggunakan crypto.randomBytes
   - ✅ Masked API key display di Admin panel
   - ✅ Copy-to-clipboard untuk API key yang baru di-generate

3. **Endpoint Baru**
   - ✅ `GET /api/external/manufacturing-data/status` - Cek status MO (active/completed)
   - ✅ `POST /api/admin/generate-api-key` - Generate API key baru

4. **Admin Configuration**
   - ✅ Konfigurasi External API URL (Active Status)
   - ✅ Konfigurasi External API URL (Completed Status)
   - ✅ Generate dan konfigurasi API Key
   - ✅ Dokumentasi lengkap di halaman Admin

5. **Database Schema**
   - ✅ Tabel `admin_config` dengan kolom baru:
     - `external_api_url_active`
     - `external_api_url_completed`
     - `api_key` (untuk autentikasi)
   - ✅ Semua tabel production sudah memiliki kolom `completed_at`

### Breaking Changes:

**TIDAK ADA BREAKING CHANGES** - Sistem baru 100% backward compatible dengan sistem lama.

- ✅ Semua endpoint lama tetap berfungsi
- ✅ Database schema menggunakan `ALTER TABLE` yang aman (jika kolom belum ada)
- ✅ Format data tetap sama
- ✅ **API Key Authentication bersifat opsional**: Jika API key belum dikonfigurasi, semua endpoint external API masih bisa diakses tanpa autentikasi (backward compatibility)
- ⚠️ **Setelah API key dikonfigurasi**, semua request ke external API endpoints **harus** menyertakan API key yang valid

---

## 🚀 Step-by-Step Update Process

### Method 1: Update via CI/CD (Recommended) ⭐

**Ini adalah cara TERMUDAH dan TERAMAN!**

#### Langkah-langkah:

1. **Di local machine, commit perubahan:**
   ```bash
   git add .
   git commit -m "Update: Add external API integration and new features"
   git push origin main
   ```

2. **GitHub Actions akan otomatis:**
   - ✅ Build client
   - ✅ Package deployment
   - ✅ Upload ke VPS
   - ✅ Backup deployment lama
   - ✅ Install dependencies
   - ✅ Restart aplikasi dengan PM2

3. **Monitor deployment:**
   - Buka: `https://github.com/Bearson-norm/manufacturing-process-production-authenticity/actions`
   - Lihat status deployment (hijau = sukses, merah = error)

4. **Setelah deployment selesai, lakukan database migration (jika diperlukan):**
   ```bash
   ssh foom@103.31.39.189
   cd ~/deployments/manufacturing-app/server
   
   # Database migration akan otomatis dilakukan saat app start
   # Tapi jika perlu manual, jalankan:
   node migrate-database.js
   ```

5. **Verify di VPS:**
   ```bash
   # Check PM2 status
   pm2 status
   
   # Check logs
   pm2 logs manufacturing-app --lines 50
   
   # Test endpoint
   curl http://localhost:1234/health
   curl http://localhost:1234/api/external/manufacturing-data/status?mo_number=PROD/MO/28246&completed_at=all
   ```

---

### Method 2: Update Manual (Jika CI/CD tidak tersedia)

#### Langkah 1: Backup (PENTING!)

```bash
# SSH ke VPS
ssh foom@103.31.39.189

# Jalankan backup script
cd ~
./backup-before-update.sh
```

#### Langkah 2: Pull Latest Code

```bash
# Pull code terbaru
cd /var/www/manufacturing-process-production-authenticity
git pull origin main

# Atau jika tidak menggunakan git, upload file baru via SCP/SFTP
```

#### Langkah 3: Build Client

```bash
cd /var/www/manufacturing-process-production-authenticity/client
npm install
npm run build
```

#### Langkah 4: Update Server Dependencies

```bash
cd /var/www/manufacturing-process-production-authenticity/server
npm install --production
```

#### Langkah 5: Backup Deployment Saat Ini

```bash
cd ~/deployments
if [ -d "manufacturing-app" ]; then
  mv manufacturing-app manufacturing-app-backup-$(date +%Y%m%d-%H%M%S)
fi
```

#### Langkah 6: Copy Files ke Deployment Directory

```bash
mkdir -p ~/deployments/manufacturing-app
mkdir -p ~/deployments/manufacturing-app/server
mkdir -p ~/deployments/manufacturing-app/client-build

# Copy server files
cp -r /var/www/manufacturing-process-production-authenticity/server/* ~/deployments/manufacturing-app/server/

# Copy client build
cp -r /var/www/manufacturing-process-production-authenticity/client/build/* ~/deployments/manufacturing-app/client-build/

# Copy database dari backup (jika ada)
if [ -f ~/deployments/manufacturing-app-backup-*/server/database.sqlite ]; then
  cp ~/deployments/manufacturing-app-backup-*/server/database.sqlite ~/deployments/manufacturing-app/server/database.sqlite
  echo "✅ Database copied from backup"
fi

# Copy environment file (jika ada)
if [ -f ~/deployments/manufacturing-app-backup-*/server/.env ]; then
  cp ~/deployments/manufacturing-app-backup-*/server/.env ~/deployments/manufacturing-app/server/.env
  echo "✅ Environment file copied"
fi
```

#### Langkah 7: Install Server Dependencies

```bash
cd ~/deployments/manufacturing-app/server
npm install --production
```

#### Langkah 8: Database Migration (Otomatis)

Database migration akan otomatis dilakukan saat aplikasi start karena menggunakan `CREATE TABLE IF NOT EXISTS` dan `ALTER TABLE` yang aman.

**Tapi jika ingin manual migration:**

```bash
cd ~/deployments/manufacturing-app/server
node migrate-database.js
```

#### Langkah 9: Restart Aplikasi

```bash
# Stop aplikasi lama
pm2 delete manufacturing-app || true

# Start aplikasi baru
cd ~/deployments/manufacturing-app/server
mkdir -p logs

# Gunakan ecosystem.config.js jika ada
if [ -f ecosystem.config.js ]; then
  pm2 start ecosystem.config.js
else
  pm2 start index.js --name manufacturing-app --instances max --exec-mode cluster
fi

pm2 save
```

#### Langkah 10: Verify

```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs manufacturing-app --lines 50

# Test health endpoint
curl http://localhost:1234/health

# Test new endpoint
curl "http://localhost:1234/api/external/manufacturing-data/status?mo_number=PROD/MO/28246&completed_at=all"

# Test via Nginx
curl -k https://mpr.moof-set.web.id/api/health
```

---

## 🗄️ Database Migration

### Automatic Migration

Sistem baru menggunakan `CREATE TABLE IF NOT EXISTS` dan `ALTER TABLE` yang aman, jadi migration akan otomatis dilakukan saat aplikasi start.

### Manual Migration (Jika Diperlukan)

Jika ada masalah dengan automatic migration, jalankan manual:

```bash
cd ~/deployments/manufacturing-app/server
node migrate-database.js
```

### Schema Changes

Tidak ada perubahan schema yang breaking. Semua perubahan menggunakan:
- `CREATE TABLE IF NOT EXISTS` - Aman, tidak akan overwrite tabel yang sudah ada
- `ALTER TABLE ... ADD COLUMN` - Aman, hanya menambah kolom jika belum ada

### New Tables/Columns

**Tabel Baru:**
- `admin_config` - Untuk menyimpan konfigurasi (sudah ada di sistem lama)

**Kolom Baru (jika belum ada):**
- `production_liquid.completed_at`
- `production_device.completed_at`
- `production_cartridge.completed_at`

Semua kolom ini akan otomatis ditambahkan saat aplikasi start.

---

## ✅ Verification & Testing

### 1. Check PM2 Status

```bash
pm2 status
# Harus menunjukkan: manufacturing-app | online
```

### 2. Check Logs

```bash
pm2 logs manufacturing-app --lines 50
# Check untuk error atau warning
# Pastikan tidak ada error database migration
```

### 3. Test Backend Health

```bash
curl http://localhost:1234/health
# Harus return: {"status":"healthy","database":"connected",...}
```

### 4. Test New Endpoint

```bash
# Test status endpoint
curl "http://localhost:1234/api/external/manufacturing-data/status?mo_number=PROD/MO/28246&completed_at=all"
# Harus return: {"status":"active"} atau {"status":"completed"}
```

### 5. Test Existing Endpoints

```bash
# Test existing endpoint
curl "http://localhost:1234/api/external/manufacturing-data?mo_number=PROD/MO/28246&completed_at=all"
# Harus return data seperti biasa
```

### 6. Test via Nginx

```bash
curl -k https://mpr.moof-set.web.id/api/health
curl -k https://mpr.moof-set.web.id/health
```

### 7. Test Website

```bash
# Test frontend
curl -I https://mpr.moof-set.web.id
# Harus return: HTTP/1.1 200 OK
```

### 8. Test Admin Configuration

1. Login ke admin panel
2. Buka halaman Admin
3. Verifikasi ada field "External API URL - Active Status" dan "External API URL - Completed Status"
4. Verifikasi dokumentasi External API Integration ada di halaman Admin

### 9. Test External API Integration

1. Lakukan Input Authenticity Label Process
2. Check log server untuk melihat apakah data dikirim ke external API
3. Submit MO number
4. Check log server untuk melihat apakah status "completed" dikirim ke external API

### 10. Test API Key Authentication

1. **Test tanpa API key (jika belum dikonfigurasi):**
   ```bash
   curl "http://localhost:1234/api/external/manufacturing-data?mo_number=PROD/MO/28246&completed_at=all"
   # Harus berhasil (backward compatibility)
   ```

2. **Generate API key di Admin panel**

3. **Test dengan API key yang valid:**
   ```bash
   curl -H "X-API-Key: your_generated_api_key" \
     "http://localhost:1234/api/external/manufacturing-data?mo_number=PROD/MO/28246&completed_at=all"
   # Harus berhasil
   ```

4. **Test tanpa API key (setelah dikonfigurasi):**
   ```bash
   curl "http://localhost:1234/api/external/manufacturing-data?mo_number=PROD/MO/28246&completed_at=all"
   # Harus return error 401: "API key is required"
   ```

5. **Test dengan API key yang salah:**
   ```bash
   curl -H "X-API-Key: wrong_key" \
     "http://localhost:1234/api/external/manufacturing-data?mo_number=PROD/MO/28246&completed_at=all"
   # Harus return error 403: "Invalid API key"
   ```

---

## ⏪ Rollback Plan

### Emergency Rollback (Jika Update Bermasalah)

```bash
# 1. Stop aplikasi
pm2 delete manufacturing-app

# 2. Rollback ke backup terakhir
cd ~/deployments
LATEST_BACKUP=$(ls -dt manufacturing-app-backup-* | head -1)
rm -rf manufacturing-app
mv $LATEST_BACKUP manufacturing-app

# 3. Restore database jika perlu
cd manufacturing-app/server
if [ -f database.sqlite.backup-* ]; then
  LATEST_DB_BACKUP=$(ls -t database.sqlite.backup-* | head -1)
  cp $LATEST_DB_BACKUP database.sqlite
  echo "✅ Database restored from backup"
fi

# 4. Start aplikasi
cd ~/deployments/manufacturing-app/server
if [ -f ecosystem.config.js ]; then
  pm2 start ecosystem.config.js
else
  pm2 start index.js --name manufacturing-app --instances max --exec-mode cluster
fi
pm2 save

# 5. Verify
pm2 status
curl http://localhost:1234/health
```

### Rollback via Git (Jika update manual)

```bash
cd /var/www/manufacturing-process-production-authenticity
git log --oneline  # Lihat commit history
git checkout <commit-hash>  # Rollback ke commit tertentu
# Lalu deploy ulang dengan method manual
```

---

## 🐛 Troubleshooting

### Problem: Update gagal, aplikasi tidak start

**Solution:**
```bash
# Check logs
pm2 logs manufacturing-app --err

# Check apakah ada error di code
cd ~/deployments/manufacturing-app/server
node index.js  # Run langsung untuk lihat error

# Rollback ke backup sebelumnya
# (lihat section Rollback di atas)
```

### Problem: Database migration error

**Solution:**
```bash
# Check database file
ls -lh ~/deployments/manufacturing-app/server/database.sqlite*

# Restore dari backup
cd ~/deployments/manufacturing-app/server
LATEST_DB_BACKUP=$(ls -t database.sqlite.backup-* | head -1)
cp $LATEST_DB_BACKUP database.sqlite

# Remove WAL dan SHM files
rm -f database.sqlite-wal database.sqlite-shm

# Restart aplikasi
pm2 restart manufacturing-app
```

### Problem: Client build tidak update

**Solution:**
```bash
# Rebuild client
cd /var/www/manufacturing-process-production-authenticity/client
rm -rf build node_modules
npm install
npm run build

# Copy ke deployment
cp -r build/* ~/deployments/manufacturing-app/client-build/

# Reload Nginx
sudo systemctl reload nginx
```

### Problem: Dependencies error

**Solution:**
```bash
# Clear cache dan reinstall
cd ~/deployments/manufacturing-app/server
rm -rf node_modules package-lock.json
npm install --production

# Restart
pm2 restart manufacturing-app
```

### Problem: Port sudah digunakan

**Solution:**
```bash
# Check apa yang menggunakan port 1234
sudo lsof -i :1234

# Kill process jika perlu
sudo kill -9 <PID>

# Restart PM2
pm2 restart manufacturing-app
```

### Problem: External API tidak mengirim data

**Solution:**
```bash
# Check konfigurasi External API URL di Admin panel
# Pastikan URL sudah dikonfigurasi dengan benar

# Check logs untuk error
pm2 logs manufacturing-app | grep "External API"

# Test koneksi ke external API
curl -X POST https://foom-dash.vercel.app/API \
  -H "Content-Type: application/json" \
  -d '{"status":"test"}'
```

---

## 📝 Post-Update Checklist

Setelah update selesai, pastikan:

- [ ] ✅ PM2 status menunjukkan aplikasi running
- [ ] ✅ Health endpoint merespons dengan baik
- [ ] ✅ Semua endpoint existing masih berfungsi
- [ ] ✅ Endpoint baru (`/api/external/manufacturing-data/status`) berfungsi
- [ ] ✅ Frontend dapat diakses dan berfungsi normal
- [ ] ✅ Admin panel dapat diakses
- [ ] ✅ Konfigurasi External API URL dapat diubah di Admin panel
- [ ] ✅ Dokumentasi External API Integration muncul di Admin panel
- [ ] ✅ Test Input Authenticity Label Process - data terkirim ke external API
- [ ] ✅ Test Submit MO - status "completed" terkirim ke external API
- [ ] ✅ Database migration berhasil (tidak ada error di log)
- [ ] ✅ Scheduler berjalan normal (check log setelah 6 jam)

---

## 🔍 Monitoring Setelah Update

### Check Logs Setelah 1 Jam

```bash
# Check untuk error
pm2 logs manufacturing-app --err --lines 100

# Check untuk external API calls
pm2 logs manufacturing-app | grep "External API"

# Check scheduler
pm2 logs manufacturing-app | grep "Scheduler"
```

### Check Scheduler (Setelah 6 Jam)

```bash
# Check apakah scheduler mengirim MO list
pm2 logs manufacturing-app | grep "Scheduler.*MO list"

# Harus ada log: "✅ [Scheduler] Successfully sent MO list"
```

---

## 📞 Support

Jika ada masalah:

1. **Check logs**: `pm2 logs manufacturing-app`
2. **Check Nginx logs**: `sudo tail -50 /var/log/nginx/manufacturing-app-error.log`
3. **Check GitHub Actions logs** (jika update via CI/CD)
4. **Rollback ke backup sebelumnya** (lihat section Rollback)
5. **Check dokumentasi**: `TROUBLESHOOTING.md`

---

## 🎯 Quick Reference

### Update via CI/CD (Recommended)
```bash
git add .
git commit -m "Update: description"
git push origin main
# Monitor: https://github.com/Bearson-norm/manufacturing-process-production-authenticity/actions
```

### Update Manual
```bash
ssh foom@103.31.39.189
cd /var/www/manufacturing-process-production-authenticity
./backup-before-update.sh
git pull origin main
cd client && npm install && npm run build && cd ..
cd server && npm install --production && cd ..
# Deploy dengan script atau manual
```

### Rollback
```bash
pm2 delete manufacturing-app
cd ~/deployments
LATEST_BACKUP=$(ls -dt manufacturing-app-backup-* | head -1)
rm -rf manufacturing-app && mv $LATEST_BACKUP manufacturing-app
cd manufacturing-app/server && pm2 start ecosystem.config.js && pm2 save
```

---

**Happy Updating! 🎉**

**PENTING**: Selalu backup database sebelum update!

