# 🧪 Setup Staging Environment di VPS - Panduan Step by Step

Panduan lengkap untuk setup staging environment di VPS dari awal.

## 📋 Prerequisites

- ✅ Akses SSH ke VPS (103.31.39.189)
- ✅ User `foom` dengan sudo access
- ✅ Nginx sudah terinstall
- ✅ PM2 sudah terinstall
- ✅ Node.js sudah terinstall

## 🚀 Setup Step by Step

### Step 1: Copy Nginx Config ke VPS

Anda tidak perlu checkout branch staging untuk ini. File `manufacturing-app-staging.conf` sudah ada di repository di branch `main`, jadi bisa langsung di-copy.

**Opsi A: Copy langsung dari local (Recommended)**

Jika Anda sudah punya file di local:

```bash
# Dari local machine (Windows PowerShell)
scp nginx/manufacturing-app-staging.conf foom@103.31.39.189:/tmp/manufacturing-app-staging.conf

# Kemudian di VPS
ssh foom@103.31.39.189
sudo cp /tmp/manufacturing-app-staging.conf /etc/nginx/sites-available/manufacturing-app-staging.conf
```

**Opsi B: Download dari repository (Jika file belum ada di local)**

```bash
# Download file dari GitHub (jika sudah di-push ke main)
# Atau copy langsung content file dan create di VPS
ssh foom@103.31.39.189
sudo nano /etc/nginx/sites-available/manufacturing-app-staging.conf
# Paste isi dari nginx/manufacturing-app-staging.conf
```

**Opsi C: Clone repository (Jika belum ada di VPS)**

```bash
ssh foom@103.31.39.189
cd ~
git clone <repository-url> temp-repo || true
sudo cp temp-repo/nginx/manufacturing-app-staging.conf /etc/nginx/sites-available/
rm -rf temp-repo
```

### Step 2: Setup Nginx Configuration

```bash
# SSH ke VPS
ssh foom@103.31.39.189

# Copy config ke sites-available (jika belum)
sudo cp /tmp/manufacturing-app-staging.conf /etc/nginx/sites-available/manufacturing-app-staging.conf
# Atau create manual jika belum ada:
# sudo nano /etc/nginx/sites-available/manufacturing-app-staging.conf

# Create symlink ke sites-enabled
sudo ln -s /etc/nginx/sites-available/manufacturing-app-staging.conf /etc/nginx/sites-enabled/

# Test nginx configuration
sudo nginx -t

# Jika test berhasil, reload nginx
sudo systemctl reload nginx
```

### Step 3: Setup Directory Staging

```bash
# SSH ke VPS
ssh foom@103.31.39.189

# Create staging directory
mkdir -p ~/deployments/manufacturing-app-staging
mkdir -p ~/deployments/manufacturing-app-staging/server
mkdir -p ~/deployments/manufacturing-app-staging/client-build

# Set permissions (optional)
chmod 755 ~/deployments/manufacturing-app-staging
```

### Step 4: Setup Environment Variables untuk Staging

```bash
# SSH ke VPS
ssh foom@103.31.39.189

# Create .env file untuk staging
cat > ~/deployments/manufacturing-app-staging/server/.env << 'EOF'
NODE_ENV=staging
PORT=5678
DB_HOST=localhost
DB_PORT=5433
DB_NAME=manufacturing_db_staging
DB_USER=manufacturing_user
EOF

# Jika ingin menggunakan database yang sama dengan production (untuk testing)
# Ganti DB_NAME menjadi: DB_NAME=manufacturing_db
```

### Step 5: Setup Database Staging (Optional - Recommended)

Jika ingin database terpisah untuk staging:

```bash
# SSH ke VPS
ssh foom@103.31.39.189

# Login ke PostgreSQL
sudo -u postgres psql

# Create staging database
CREATE DATABASE manufacturing_db_staging;

# Grant permissions
GRANT ALL PRIVILEGES ON DATABASE manufacturing_db_staging TO manufacturing_user;

# Exit PostgreSQL
\q
```

**Note**: Jika Anda belum tahu user PostgreSQL atau password, cek file `.env` di production directory:

```bash
cat ~/deployments/manufacturing-app/server/.env
```

### Step 6: Setup DNS (Optional - Untuk Domain)

Jika ingin menggunakan domain `staging.mpr.moof-set.web.id`:

1. Login ke DNS provider (di mana domain `moof-set.web.id` di-manage)
2. Tambahkan A record baru:
   ```
   Type: A
   Name: staging (atau stg)
   Value: 103.31.39.189
   TTL: 3600 (atau default)
   ```
3. Tunggu beberapa menit hingga DNS propagate

**Alternative**: Bisa akses langsung via IP dan port jika DNS belum setup

### Step 7: Test Setup

```bash
# SSH ke VPS
ssh foom@103.31.39.189

# Check nginx config
sudo nginx -t

# Check nginx status
sudo systemctl status nginx

# Check if port 5678 is available (harus kosong untuk sekarang)
sudo netstat -tlnp | grep 5678

# Check directory
ls -la ~/deployments/manufacturing-app-staging/

# Check .env file
cat ~/deployments/manufacturing-app-staging/server/.env
```

### Step 8: Setup Branch Staging (Di Local)

Setelah VPS setup, buat branch staging di repository:

```bash
# Di local machine
git checkout main  # atau master
git pull origin main  # Pastikan up-to-date

# Buat branch staging
git checkout -b staging

# Push branch staging ke GitHub
git push -u origin staging
```

### Step 9: Test Deploy Pertama ke Staging

Setelah branch staging dibuat, test deploy:

```bash
# Di local machine, pastikan Anda di branch staging
git checkout staging

# Buat perubahan kecil untuk test (atau tidak usah, langsung push)
git add .
git commit -m "Initial staging setup"
git push origin staging
```

**Monitor di GitHub Actions:**
1. Buka repository di GitHub
2. Klik tab **Actions**
3. Pilih workflow run **Deploy to Staging**
4. Monitor progress

### Step 10: Verifikasi Deployment

Setelah deploy selesai:

```bash
# SSH ke VPS
ssh foom@103.31.39.189

# Check PM2
pm2 status
# Harus ada: manufacturing-app-staging

# Check logs
pm2 logs manufacturing-app-staging --lines 50

# Check port
sudo netstat -tlnp | grep 5678
# Harus ada process listening di port 5678

# Health check
curl http://localhost:5678/health
# Harus return JSON dengan status: healthy
```

**Akses Staging:**
- Via IP (jika port dibuka): `http://103.31.39.189:5678`
- Via Domain (jika DNS sudah setup): `http://staging.mpr.moof-set.web.id`
- Health Check: `http://staging.mpr.moof-set.web.id/health`

## 🔍 Troubleshooting

### Nginx Config Tidak Ditemukan

Jika file `manufacturing-app-staging.conf` tidak ada di repository Anda:

**Solusi**: Copy dari file yang sudah dibuat, atau create manual:

```bash
# Di VPS
ssh foom@103.31.39.189
sudo nano /etc/nginx/sites-available/manufacturing-app-staging.conf
```

Kemudian paste isi dari file `nginx/manufacturing-app-staging.conf` di repository ini.

**Atau**: Copy dari local jika Anda sudah punya:

```bash
# Dari local machine
scp nginx/manufacturing-app-staging.conf foom@103.31.39.189:/tmp/
```

### Nginx Test Gagal

```bash
# Check syntax
sudo nginx -t

# Check error logs
sudo tail -f /var/log/nginx/error.log

# Common issues:
# - Port sudah digunakan: Change port di config atau stop service yang menggunakan port tersebut
# - Permission error: sudo chown root:root /etc/nginx/sites-available/manufacturing-app-staging.conf
```

### PM2 Tidak Start Staging App

```bash
# Check PM2
pm2 status

# Check logs
pm2 logs manufacturing-app-staging

# Manual start (untuk testing)
cd ~/deployments/manufacturing-app-staging/server
NODE_ENV=staging PORT=5678 node index.js
```

### Port 5678 Sudah Digunakan

```bash
# Check apa yang menggunakan port 5678
sudo netstat -tlnp | grep 5678

# Stop service yang menggunakan port tersebut (jika tidak diperlukan)
# Atau ganti port di staging .env dan nginx config
```

### Database Connection Error

```bash
# Check database exists
sudo -u postgres psql -c "\l" | grep staging

# Check database user permissions
sudo -u postgres psql -c "\du" | grep manufacturing_user

# Test connection
psql -h localhost -p 5433 -U manufacturing_user -d manufacturing_db_staging
```

## ✅ Checklist Setup

Gunakan checklist ini untuk memastikan semua sudah setup:

- [ ] Nginx config `manufacturing-app-staging.conf` sudah di-copy ke `/etc/nginx/sites-available/`
- [ ] Symlink sudah dibuat ke `/etc/nginx/sites-enabled/`
- [ ] Nginx test berhasil (`sudo nginx -t`)
- [ ] Nginx sudah di-reload (`sudo systemctl reload nginx`)
- [ ] Directory `~/deployments/manufacturing-app-staging` sudah dibuat
- [ ] File `.env` sudah dibuat di `~/deployments/manufacturing-app-staging/server/`
- [ ] Database staging sudah dibuat (optional)
- [ ] DNS record untuk staging domain sudah ditambahkan (optional)
- [ ] Branch `staging` sudah dibuat dan di-push ke GitHub
- [ ] Test deploy pertama ke staging berhasil
- [ ] PM2 process `manufacturing-app-staging` berjalan
- [ ] Health check accessible: `curl http://localhost:5678/health`

## 📝 Quick Setup Script

Jika Anda ingin setup semua sekaligus, gunakan script ini (run di VPS):

```bash
#!/bin/bash
# Quick setup staging environment

set -e

echo "🚀 Setting up staging environment..."

# 1. Create directories
echo "📁 Creating directories..."
mkdir -p ~/deployments/manufacturing-app-staging/server
mkdir -p ~/deployments/manufacturing-app-staging/client-build

# 2. Create .env file
echo "📝 Creating .env file..."
cat > ~/deployments/manufacturing-app-staging/server/.env << 'EOF'
NODE_ENV=staging
PORT=5678
DB_HOST=localhost
DB_PORT=5433
DB_NAME=manufacturing_db_staging
DB_USER=manufacturing_user
EOF

# 3. Note about nginx config
echo ""
echo "⚠️  NOTE: Nginx config harus di-setup manual:"
echo "   1. Copy manufacturing-app-staging.conf ke /etc/nginx/sites-available/"
echo "   2. Create symlink: sudo ln -s /etc/nginx/sites-available/manufacturing-app-staging.conf /etc/nginx/sites-enabled/"
echo "   3. Test: sudo nginx -t"
echo "   4. Reload: sudo systemctl reload nginx"
echo ""
echo "✅ Staging directories created!"
echo "📍 Directory: ~/deployments/manufacturing-app-staging"
```

**Save sebagai `setup-staging.sh` dan jalankan:**

```bash
chmod +x setup-staging.sh
./setup-staging.sh
```

## 🎯 Ringkasan

**Tidak perlu checkout branch staging dulu untuk setup VPS!**

1. ✅ **Copy nginx config** ke VPS (dari repository atau local)
2. ✅ **Setup nginx** (copy, symlink, test, reload)
3. ✅ **Create directory** staging di VPS
4. ✅ **Create .env** file untuk staging
5. ✅ **Setup database** staging (optional)
6. ✅ **Setup DNS** (optional)
7. ✅ **Create branch staging** di repository (di local)
8. ✅ **Test deploy** dengan push ke branch staging

Setelah setup selesai, setiap push ke branch `staging` akan auto-deploy ke staging environment!

## 📚 Referensi

- [Staging Setup Guide](STAGING_SETUP.md) - Detailed staging documentation
- [CI/CD Guide](CI_CD_GUIDE.md) - Complete CI/CD documentation
- [Nginx Staging Config](nginx/manufacturing-app-staging.conf) - Nginx configuration file

---

**Pertanyaan?** Check troubleshooting section atau referensi di atas! 🆘
