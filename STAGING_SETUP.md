# 🧪 Staging Environment Setup Guide

Panduan lengkap untuk setup dan menggunakan staging environment sebelum deploy ke production.

## 📋 Overview

Staging environment memungkinkan Anda untuk:
- ✅ Test perubahan sebelum deploy ke production
- ✅ Verify build dan dependencies tanpa risiko
- ✅ Test dengan data yang aman untuk di-reset
- ✅ Preview fitur baru sebelum production release

## 🔄 Workflow

```
Development → Staging Branch → Test → Main Branch → Production
```

### Branch Strategy

- **`staging`**: Branch untuk testing (auto-deploy ke staging environment)
- **`main`/`master`**: Branch production (auto-deploy ke production setelah CI pass)

## 🚀 Setup Awal Staging Environment

### 1. Setup Branch Staging

```bash
# Buat dan checkout branch staging
git checkout -b staging

# Push ke GitHub
git push -u origin staging
```

### 2. Setup Domain DNS (Optional)

Tambahkan DNS record untuk staging domain:

```
Type: A
Name: staging (atau stg)
Value: 103.31.39.189
TTL: 3600
```

Ini akan membuat `staging.mpr.moof-set.web.id` atau `stg.mpr.moof-set.web.id` mengarah ke VPS.

### 3. Setup Nginx Configuration di VPS

```bash
# SSH ke VPS
ssh foom@103.31.39.189

# Copy staging nginx config
sudo cp /home/foom/deployments/manufacturing-app/nginx/manufacturing-app-staging.conf /etc/nginx/sites-available/manufacturing-app-staging.conf

# Atau copy dari repository jika sudah ada di server
sudo nano /etc/nginx/sites-available/manufacturing-app-staging.conf
# Paste isi dari nginx/manufacturing-app-staging.conf

# Create symlink
sudo ln -s /etc/nginx/sites-available/manufacturing-app-staging.conf /etc/nginx/sites-enabled/

# Test nginx configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### 4. Setup Database Staging (Optional)

Jika ingin database terpisah untuk staging:

```bash
# SSH ke VPS
ssh foom@103.31.39.189

# Login ke PostgreSQL
sudo -u postgres psql

# Note: Staging menggunakan database yang sama dengan production (manufacturing_db)
# Tidak perlu create database terpisah untuk staging
# Jika ingin database terpisah untuk testing, uncomment dan ganti DB_NAME di .env:
# CREATE DATABASE manufacturing_db_staging;
# GRANT ALL PRIVILEGES ON DATABASE manufacturing_db_staging TO manufacturing_user;

# Exit PostgreSQL
\q
```

### 5. Verifikasi Setup

```bash
# Check PM2 untuk staging
pm2 status | grep manufacturing-app-staging

# Check nginx config
sudo nginx -t
sudo systemctl status nginx

# Test staging endpoint
curl http://localhost:5678/health
# atau jika sudah ada domain
curl http://staging.mpr.moof-set.web.id/health
```

## 🔄 Workflow Penggunaan

### Deploy ke Staging

1. **Buat/Update branch staging:**
   ```bash
   git checkout staging
   git merge develop  # atau branch lainnya
   # Atau langsung commit perubahan ke staging
   git add .
   git commit -m "Feature: New feature for testing"
   git push origin staging
   ```

2. **GitHub Actions akan otomatis:**
   - ✅ Run CI tests
   - ✅ Build client
   - ✅ Deploy ke staging VPS (port 5678)
   - ✅ Restart PM2 dengan name `manufacturing-app-staging`
   - ✅ Health check

3. **Akses Staging:**
   - Direct: `http://103.31.39.189:5678` (jika port dibuka)
   - Via Domain: `http://staging.mpr.moof-set.web.id` (setelah DNS setup)
   - Health Check: `http://staging.mpr.moof-set.web.id/health`

### Deploy ke Production

Setelah testing di staging berhasil:

1. **Merge ke main:**
   ```bash
   git checkout main
   git merge staging
   git push origin main
   ```

2. **GitHub Actions akan otomatis:**
   - ✅ Run CI tests (MUST PASS)
   - ✅ Build client
   - ✅ Deploy ke production VPS (port 1234)
   - ✅ Backup existing deployment
   - ✅ Health check (CRITICAL - jika gagal, auto rollback)
   - ✅ Restart PM2 dengan name `manufacturing-app`

## 🔍 Monitoring & Troubleshooting

### Check Staging Status

```bash
# SSH ke VPS
ssh foom@103.31.39.189

# PM2 Status
pm2 status
pm2 logs manufacturing-app-staging

# Check port
sudo netstat -tlnp | grep 5678

# Check nginx logs
sudo tail -f /var/log/nginx/manufacturing-app-staging-error.log
sudo tail -f /var/log/nginx/manufacturing-app-staging-access.log

# Health check
curl http://localhost:5678/health
```

### Manual Staging Deployment

Jika GitHub Actions gagal, deploy manual:

```bash
# Di local machine
git checkout staging
cd client && npm run build && cd ..
cd server && npm install --production && cd ..

# Copy ke VPS
scp -r client/build foom@103.31.39.189:/home/foom/deployments/manufacturing-app-staging/client-build
scp -r server foom@103.31.39.189:/home/foom/deployments/manufacturing-app-staging/

# Di VPS
ssh foom@103.31.39.189
cd /home/foom/deployments/manufacturing-app-staging/server
npm install --production

# Restart PM2
pm2 restart manufacturing-app-staging
```

### Reset Staging Database (Jika diperlukan)

```bash
# SSH ke VPS
ssh foom@103.31.39.189

# ⚠️ WARNING: Staging menggunakan database yang sama dengan production (manufacturing_db)
# Backup database production dulu sebelum reset:
pg_dump -U manufacturing_user -d manufacturing_db > ~/db_backup_$(date +%Y%m%d).sql

# Jika ingin reset database (HATI-HATI: ini akan menghapus data production juga!)
# sudo -u postgres psql -c "DROP DATABASE IF EXISTS manufacturing_db;"
# sudo -u postgres psql -c "CREATE DATABASE manufacturing_db;"
# sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE manufacturing_db TO manufacturing_user;"

# Aplikasi akan otomatis create tables saat restart
pm2 restart manufacturing-app-staging
```

## 📊 Perbedaan Staging vs Production

| Aspek | Staging | Production |
|-------|---------|------------|
| Branch | `staging` | `main`/`master` |
| Port | `5678` | `1234` |
| Domain | `staging.mpr.moof-set.web.id` | `mpr.moof-set.web.id` |
| Deploy Directory | `/home/foom/deployments/manufacturing-app-staging` | `/home/foom/deployments/manufacturing-app` |
| PM2 Name | `manufacturing-app-staging` | `manufacturing-app` |
| NODE_ENV | `staging` | `production` |
| Database | `manufacturing_db` (shared dengan production) | `manufacturing_db` |
| Auto Deploy | ✅ Yes (on push to staging) | ✅ Yes (on push to main, after CI pass) |
| Health Check | ⚠️ Warning jika gagal | ❌ CRITICAL - auto rollback jika gagal |
| Backup Retention | 3 backups | 5 backups |

## 🛡️ Safety Features

### Production Protection

1. **CI Must Pass**: Production deployment hanya jalan setelah CI tests pass
2. **Health Check**: Production deployment akan auto-rollback jika health check gagal setelah 5 attempts
3. **Backup Before Deploy**: Production selalu backup sebelum update
4. **Staging First**: Best practice adalah test di staging dulu sebelum merge ke main

### Staging Safety

1. **Separate Port**: Staging menggunakan port berbeda (5678) dari production (1234)
2. **Separate Directory**: Staging di directory terpisah
3. **Separate PM2 Process**: Tidak akan mengganggu production
4. **Optional Database**: Bisa pakai database terpisah atau sama

## 🔐 Environment Variables

### Staging `.env`

Di VPS, buat/update file `/home/foom/deployments/manufacturing-app-staging/server/.env`:

```env
NODE_ENV=staging
PORT=5678
DB_HOST=localhost
DB_PORT=5433
DB_NAME=manufacturing_db  # shared dengan production
DB_USER=manufacturing_user
# DB_PASSWORD akan di-set via secret atau env
```

### Production `.env`

File `/home/foom/deployments/manufacturing-app/server/.env`:

```env
NODE_ENV=production
PORT=1234
DB_HOST=localhost
DB_PORT=5433
DB_NAME=manufacturing_db
DB_USER=manufacturing_user
# DB_PASSWORD akan di-set via secret atau env
```

## 📝 Best Practices

1. **Always test di staging first**: Jangan langsung push ke main
2. **Review changes**: Pastikan semua perubahan sudah ditest dengan baik
3. **Monitor staging**: Check logs dan health check setelah staging deploy
4. **Clean merge**: Pastikan staging branch up-to-date sebelum merge ke main
5. **Document changes**: Catat perubahan penting yang dibuat

## 🆘 Troubleshooting

### Staging tidak deploy otomatis

1. Check GitHub Actions logs
2. Verify branch name adalah `staging`
3. Check GitHub Secrets (VPS_HOST, VPS_USER, VPS_SSH_KEY)

### Staging tidak accessible

1. Check PM2: `pm2 status manufacturing-app-staging`
2. Check port: `sudo netstat -tlnp | grep 5678`
3. Check nginx: `sudo nginx -t` dan `sudo systemctl status nginx`
4. Check firewall: `sudo ufw status`

### Production rollback otomatis

Jika production auto-rollback:
1. Check health endpoint: `curl http://localhost:1234/health`
2. Check PM2 logs: `pm2 logs manufacturing-app`
3. Check database connection
4. Fix issues di staging first, kemudian deploy ulang

## ✅ Checklist Setup Staging

- [ ] Branch `staging` dibuat dan pushed ke GitHub
- [ ] DNS record untuk staging domain (optional)
- [ ] Nginx config untuk staging sudah di-setup
- [ ] Database staging dibuat (optional)
- [ ] GitHub Actions workflow untuk staging sudah aktif
- [ ] Test deploy pertama ke staging
- [ ] Verifikasi staging accessible via domain/port
- [ ] Document staging credentials/access info untuk tim

## 📚 Referensi

- [Production Deployment Guide](DEPLOYMENT.md)
- [GitHub Actions CI/CD](.github/workflows/)
- [Nginx Configuration](nginx/)
- [Troubleshooting Guide](TROUBLESHOOTING.md)

---

**Catatan**: Staging environment dibuat untuk testing. Data di staging bisa di-reset kapan saja jika diperlukan. Jangan gunakan staging untuk data production!
