# 🔍 Troubleshooting: Staging Tidak Update Setelah Push

## 📋 Masalah
Perubahan yang sudah di-push ke branch `staging` tidak muncul di VPS, meskipun GitHub Actions berhasil.

## 🔎 Langkah Diagnosis

### 1. Verifikasi Push Berhasil di GitHub

```bash
# Di local machine
git status
git log --oneline -5
git branch -v

# Pastikan:
# - Branch staging ada
# - Commit terakhir sudah di-push
# - Remote origin/staging sudah sama dengan local staging
```

### 2. Cek GitHub Actions

1. Buka repository di GitHub
2. Klik tab **Actions**
3. Cari workflow run terakhir untuk branch `staging`
4. Lihat status:
   - ✅ **Success** - Workflow berhasil
   - ❌ **Failed** - Ada error di deployment
   - 🟡 **In Progress** - Masih running
   - ⚪ **Skipped** - Workflow tidak dijalankan

### 3. Periksa Detail GitHub Actions Logs

Klik pada workflow run terakhir, dan cek setiap step:

#### **CI Job:**
- [ ] ✅ Checkout code
- [ ] ✅ Setup Node.js
- [ ] ✅ Install and test
- [ ] ✅ Client build

#### **Deploy-Staging Job:**
- [ ] ✅ Checkout code
- [ ] ✅ Install dependencies
- [ ] ✅ Build client
- [ ] ✅ Create deployment package
- [ ] ✅ Deploy to Staging VPS (SCP)
- [ ] ✅ Execute staging deployment script

**⚠️ PENTING:** Cek log pada step **"Execute staging deployment script on VPS"**

Cari output berikut:
```
✅ Client build verified: [jumlah] files
✅ PM2 process 'manufacturing-app-staging' is registered
✅ Staging health check passed!
✅ Nginx reloaded successfully
✅ Staging deployment completed!
```

Jika ada **❌ ERROR**, catat error message-nya.

### 4. Verifikasi File di VPS

SSH ke VPS dan periksa file deployment:

```bash
# SSH ke VPS
ssh foom@103.31.39.189

# Cek directory staging
ls -la /home/foom/deployments/manufacturing-app-staging/

# Cek timestamp file terbaru
ls -lt /home/foom/deployments/manufacturing-app-staging/client-build/static/js/*.js | head -3
ls -lt /home/foom/deployments/manufacturing-app-staging/client-build/static/css/*.css | head -3

# Lihat kapan terakhir diupdate (harus sesuai dengan waktu push terbaru)
stat /home/foom/deployments/manufacturing-app-staging/client-build/index.html
```

**Bandingkan timestamp:**
- Jika timestamp lama (lebih dari waktu push): File tidak terdeploy
- Jika timestamp baru (sesuai waktu push): File sudah terdeploy

### 5. Cek PM2 Status

```bash
# Cek PM2 processes
pm2 status

# Harus ada process: manufacturing-app-staging (port 5678)
# Status: online
```

Jika status **errored** atau **stopped**:

```bash
# Lihat logs error
pm2 logs manufacturing-app-staging --lines 50

# Lihat error logs
cat ~/.pm2/logs/manufacturing-app-staging-error.log
```

### 6. Cek Server Endpoint

```bash
# Test health endpoint
curl http://localhost:5678/health

# Test static files
curl -I http://localhost:5678/

# Response harus 200 OK
```

### 7. Cek Nginx Configuration

```bash
# Cek nginx config
sudo cat /etc/nginx/sites-enabled/manufacturing-app-staging.conf

# Test nginx config
sudo nginx -t

# Jika OK, reload
sudo systemctl reload nginx

# Cek nginx status
sudo systemctl status nginx
```

### 8. Cek Port Listening

```bash
# Cek port 5678
sudo netstat -tlnp | grep 5678

# Harus ada output:
# tcp6  0  0 :::5678  :::*  LISTEN  [PID]/node
```

### 9. Test Akses dari Browser

1. **Buka di Browser Biasa:**
   - URL: `http://staging.mpr.moof-set.web.id` atau `http://103.31.39.189:5678`
   - Buka Developer Tools (F12) > Network tab
   - Hard Reload: Ctrl+Shift+R (Windows) atau Cmd+Shift+R (Mac)
   - Lihat request untuk `main.*.js` dan `main.*.css`
   - Cek timestamp file

2. **Buka di Incognito/Private Window:**
   - Ini akan bypass cache browser
   - URL: `http://staging.mpr.moof-set.web.id`
   - Lihat apakah perubahan sudah muncul

## 🔧 Solusi Berdasarkan Masalah

### Masalah 1: GitHub Actions Gagal

**Symptom:** Workflow status ❌ Failed

**Solusi:**

1. **Lihat log error di GitHub Actions**
2. **Error umum:**

   **a. SSH Connection Failed:**
   ```
   Error: ssh: connect to host xxx.xxx.xxx.xxx port 22: Connection refused
   ```
   - ✅ Check GitHub Secrets: VPS_HOST, VPS_USER, VPS_SSH_KEY
   - ✅ Test SSH manual: `ssh foom@103.31.39.189`
   - ✅ Verify VPS firewall allows port 22

   **b. Build Failed:**
   ```
   Error: npm ERR! Failed at the client@1.0.0 build script
   ```
   - ✅ Test build di local: `cd client && npm run build`
   - ✅ Check untuk syntax errors atau dependencies issues
   - ✅ Commit fix dan push lagi

   **c. Deployment Package Failed:**
   ```
   Error: client/build directory not found
   ```
   - ✅ Verify client build berhasil di CI step
   - ✅ Check workflow yaml untuk copy command

### Masalah 2: Deployment Berhasil Tapi File Tidak Update

**Symptom:** GitHub Actions ✅ Success, tapi file di VPS masih lama

**Kemungkinan Penyebab:**

#### A. Deployment ke Directory Salah

```bash
# SSH ke VPS
ssh foom@103.31.39.189

# Cek apakah ada multiple directories
ls -la /home/foom/deployments/

# Pastikan hanya ada:
# - manufacturing-app (production, port 1234)
# - manufacturing-app-staging (staging, port 5678)
# - manufacturing-app-staging-backup-* (backups)

# Cek mana yang digunakan PM2
pm2 describe manufacturing-app-staging | grep cwd
```

#### B. PM2 Tidak Restart Setelah Deploy

```bash
# Restart manual
pm2 restart manufacturing-app-staging

# Cek logs
pm2 logs manufacturing-app-staging --lines 30

# Pastikan ada log:
# "📦 Serving static files from client-build (production)"
```

#### C. Server Serve dari Path Salah

```bash
# Cek environment variable
pm2 env manufacturing-app-staging | grep NODE_ENV

# Harus: NODE_ENV=staging

# Cek .env file
cat /home/foom/deployments/manufacturing-app-staging/server/.env

# Pastikan:
# NODE_ENV=staging
# PORT=5678
```

#### D. Extract Deployment Package Gagal

```bash
# Cek apakah deploy.tar.gz ada
ls -lh /home/foom/deployments/deploy.tar.gz

# Manual extract untuk test
cd /home/foom/deployments
tar -xzf deploy.tar.gz -C /tmp/
ls -la /tmp/deploy/

# Verify structure:
# /tmp/deploy/
#   ├── server/
#   │   ├── index.js
#   │   ├── package.json
#   │   └── ...
#   └── client-build/
#       ├── index.html
#       ├── static/
#       └── ...
```

### Masalah 3: Perubahan Tidak Muncul di Browser

**Symptom:** File sudah update di VPS, PM2 running, tapi browser masih show versi lama

**Penyebab: Browser/Nginx Cache**

**Solusi:**

#### A. Clear Browser Cache

1. **Hard Reload:**
   - Windows/Linux: Ctrl + Shift + R
   - Mac: Cmd + Shift + R

2. **Clear Cache Manual:**
   - Chrome: Settings > Privacy > Clear browsing data
   - Firefox: Settings > Privacy & Security > Clear Data

3. **Test di Incognito/Private Window**

#### B. Clear Nginx Cache

```bash
# SSH ke VPS
ssh foom@103.31.39.189

# Clear nginx cache
sudo rm -rf /var/cache/nginx/*

# Reload nginx
sudo systemctl reload nginx
```

#### C. Verify Cache Headers

```bash
# Test cache headers
curl -I http://localhost:5678/static/js/main.*.js

# Untuk staging, harus ada:
# Cache-Control: no-cache, no-store, must-revalidate

# Jika masih ada cache headers yang lama:
# 1. Update nginx config
# 2. Reload nginx
# 3. Restart PM2
```

### Masalah 4: PM2 Process Tidak Ada atau Crash

**Symptom:** `pm2 status` tidak show `manufacturing-app-staging`

**Solusi:**

```bash
# SSH ke VPS
ssh foom@103.31.39.189

# Check PM2 logs
pm2 logs --lines 50

# Manual start
cd /home/foom/deployments/manufacturing-app-staging/server

# Test manual start dulu
NODE_ENV=staging PORT=5678 node index.js

# Jika OK, stop (Ctrl+C) dan start dengan PM2
pm2 delete manufacturing-app-staging 2>/dev/null || true
pm2 start index.js \
  --name manufacturing-app-staging \
  --instances 1 \
  --cwd /home/foom/deployments/manufacturing-app-staging/server \
  --env NODE_ENV=staging \
  --env PORT=5678

# Save
pm2 save

# Verify
pm2 status
pm2 logs manufacturing-app-staging --lines 20
```

### Masalah 5: Health Check Gagal

**Symptom:** Log show "⚠️ Staging health check failed"

**Solusi:**

```bash
# SSH ke VPS
ssh foom@103.31.39.189

# Test health endpoint
curl http://localhost:5678/health

# Jika error, cek:

# 1. Database connection
sudo -u postgres psql -c "\l" | grep manufacturing_db

# 2. Environment variables
cat /home/foom/deployments/manufacturing-app-staging/server/.env

# 3. PM2 logs
pm2 logs manufacturing-app-staging --lines 50

# 4. Port sudah listen
sudo netstat -tlnp | grep 5678
```

## 🚀 Quick Fix Script

Jika Anda ingin quick fix, save script ini dan jalankan di VPS:

```bash
#!/bin/bash
# File: fix-staging-update.sh

set -e

STAGING_DIR="/home/foom/deployments/manufacturing-app-staging"
STAGING_PORT=5678

echo "🔍 Troubleshooting Staging Update..."
echo ""

# 1. Check directory
echo "1️⃣ Checking staging directory..."
if [ ! -d "$STAGING_DIR" ]; then
    echo "❌ ERROR: Staging directory not found: $STAGING_DIR"
    exit 1
fi
echo "   ✅ Directory exists"

# 2. Check files timestamp
echo ""
echo "2️⃣ Checking file timestamps..."
echo "   Last updated:"
ls -lh "$STAGING_DIR/client-build/index.html" 2>/dev/null || echo "   ❌ index.html not found"
echo ""
echo "   Latest JS files:"
ls -lt "$STAGING_DIR/client-build/static/js/"*.js 2>/dev/null | head -3 || echo "   ❌ JS files not found"

# 3. Check PM2
echo ""
echo "3️⃣ Checking PM2 status..."
if pm2 list | grep -q "manufacturing-app-staging"; then
    echo "   ✅ PM2 process exists"
    pm2 describe manufacturing-app-staging | grep -E "status|uptime|cwd"
else
    echo "   ❌ PM2 process not found"
fi

# 4. Check port
echo ""
echo "4️⃣ Checking port $STAGING_PORT..."
if sudo netstat -tlnp | grep -q ":$STAGING_PORT "; then
    echo "   ✅ Port $STAGING_PORT is listening"
    sudo netstat -tlnp | grep ":$STAGING_PORT "
else
    echo "   ❌ Port $STAGING_PORT not listening"
fi

# 5. Test health endpoint
echo ""
echo "5️⃣ Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s http://localhost:$STAGING_PORT/health || echo "failed")
if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    echo "   ✅ Health check passed"
    echo "   Response: $HEALTH_RESPONSE"
else
    echo "   ❌ Health check failed"
    echo "   Response: $HEALTH_RESPONSE"
fi

# 6. Check nginx
echo ""
echo "6️⃣ Checking nginx..."
if sudo nginx -t 2>&1 | grep -q "successful"; then
    echo "   ✅ Nginx config OK"
else
    echo "   ❌ Nginx config has errors"
    sudo nginx -t
fi

# 7. Suggest fixes
echo ""
echo "📋 Suggested Actions:"
echo ""

if ! pm2 list | grep -q "manufacturing-app-staging"; then
    echo "   🔧 PM2 process not running, try:"
    echo "      pm2 restart manufacturing-app-staging"
    echo "      # Or if not exists:"
    echo "      cd $STAGING_DIR/server && pm2 start index.js --name manufacturing-app-staging"
fi

echo ""
echo "   🔧 Force restart PM2:"
echo "      pm2 restart manufacturing-app-staging --update-env"
echo ""
echo "   🔧 Clear nginx cache:"
echo "      sudo rm -rf /var/cache/nginx/* && sudo systemctl reload nginx"
echo ""
echo "   🔧 Hard reload browser:"
echo "      Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)"
echo ""
echo "   🔧 Test in incognito window:"
echo "      http://staging.mpr.moof-set.web.id"
echo ""

# 8. Auto-fix option
read -p "Do you want to auto-fix (restart PM2 and clear cache)? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "🔧 Applying fixes..."
    
    # Restart PM2
    echo "   Restarting PM2..."
    pm2 restart manufacturing-app-staging --update-env
    sleep 3
    
    # Clear nginx cache
    echo "   Clearing nginx cache..."
    sudo rm -rf /var/cache/nginx/*
    sudo systemctl reload nginx
    
    echo ""
    echo "✅ Fixes applied!"
    echo ""
    echo "📊 New Status:"
    pm2 status | grep manufacturing-app-staging
    
    echo ""
    echo "🏥 Health Check:"
    curl http://localhost:$STAGING_PORT/health
    echo ""
    
    echo ""
    echo "✅ Done! Try accessing: http://staging.mpr.moof-set.web.id"
    echo "   Remember to hard reload browser: Ctrl+Shift+R"
fi
```

**Cara menggunakan:**

```bash
# SSH ke VPS
ssh foom@103.31.39.189

# Create script
nano fix-staging-update.sh
# Paste script di atas

# Make executable
chmod +x fix-staging-update.sh

# Run
./fix-staging-update.sh
```

## ✅ Checklist Verifikasi

Setelah push ke staging, verify:

- [ ] GitHub Actions workflow berhasil (✅ green checkmark)
- [ ] Log deployment menunjukkan "✅ Staging deployment completed!"
- [ ] File timestamp di VPS sesuai dengan waktu push
- [ ] PM2 status shows "manufacturing-app-staging" online
- [ ] Port 5678 listening: `sudo netstat -tlnp | grep 5678`
- [ ] Health check OK: `curl http://localhost:5678/health`
- [ ] Nginx config OK: `sudo nginx -t`
- [ ] Browser hard reload (Ctrl+Shift+R)
- [ ] Test di incognito window
- [ ] Perubahan sudah terlihat di staging

## 📞 Jika Masih Gagal

Jika semua langkah di atas sudah dilakukan tapi staging masih tidak update, **share informasi berikut**:

1. **GitHub Actions Log:**
   - Screenshot atau copy log dari step "Execute staging deployment script on VPS"

2. **VPS File Info:**
   ```bash
   ls -lh /home/foom/deployments/manufacturing-app-staging/client-build/index.html
   ls -lt /home/foom/deployments/manufacturing-app-staging/client-build/static/js/*.js | head -3
   ```

3. **PM2 Status:**
   ```bash
   pm2 status
   pm2 logs manufacturing-app-staging --lines 50
   ```

4. **Health Check:**
   ```bash
   curl http://localhost:5678/health
   ```

5. **Browser Info:**
   - Buka Developer Tools (F12) > Network tab
   - Screenshot request ke `main.*.js` 
   - Lihat Response Headers (khususnya Cache-Control)

## 🔗 Referensi

- [Staging Setup Guide](STAGING_SETUP.md)
- [Fix Staging Frontend Update](FIX_STAGING_FRONTEND_UPDATE.md)
- [Troubleshoot Staging Deploy](TROUBLESHOOT_STAGING_DEPLOY.md)
- [CI/CD Guide](CI_CD_GUIDE.md)

---

**Update terakhir:** 2026-01-18
