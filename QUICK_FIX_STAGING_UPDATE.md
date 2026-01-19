git add# 🚀 Quick Guide: Staging Tidak Update - Langkah Cepat

## 📋 Masalah
Sudah push ke branch `staging` tapi perubahan tidak muncul di VPS.

## ⚡ Langkah Cepat (5-10 menit)

### Langkah 1: Cek dari Local Machine

```powershell
# Di Windows PowerShell
.\check-staging-status.ps1

# Atau manual check:
# 1. Verify git push berhasil
git log origin/staging --oneline -3

# 2. Test staging endpoint
curl http://staging.mpr.moof-set.web.id/health

# 3. Check GitHub Actions
# Buka: https://github.com/[USERNAME]/[REPO]/actions
# Lihat workflow terakhir untuk branch staging
```

**✅ Jika health check berhasil:** Lanjut ke Langkah 3 (masalah cache)
**❌ Jika health check gagal:** Lanjut ke Langkah 2 (masalah di VPS)

### Langkah 2: Cek di VPS (Jika Health Check Gagal)

```bash
# SSH ke VPS
ssh foom@103.31.39.189

# Run troubleshoot script
./fix-staging-update.sh

# Script akan:
# - Check file timestamps
# - Check PM2 status
# - Check nginx
# - Offer auto-fix option
```

**Ikuti saran dari script**, biasanya:
- Restart PM2
- Clear nginx cache
- Check logs

### Langkah 3: Clear Cache (Jika Health Check OK tapi Browser Tidak Update)

#### A. Clear di VPS (via SSH)
```bash
ssh foom@103.31.39.189

# Clear nginx cache
sudo rm -rf /var/cache/nginx/*
sudo systemctl reload nginx

# Force restart PM2
pm2 restart manufacturing-app-staging --update-env
```

#### B. Clear di Browser
1. **Hard Reload:**
   - Windows/Linux: `Ctrl + Shift + R`
   - Mac: `Cmd + Shift + R`

2. **Test Incognito Window:**
   - Open: http://staging.mpr.moof-set.web.id
   - Jika berhasil di incognito = masalah cache browser

3. **Clear Browser Cache:**
   - Chrome: Settings > Privacy > Clear browsing data
   - Firefox: Settings > Privacy & Security > Clear Data
   - Select "Cached images and files"

### Langkah 4: Verify Hasil

```bash
# Di VPS, check timestamp files
ls -lt /home/foom/deployments/manufacturing-app-staging/client-build/static/js/*.js | head -3

# Timestamp harus match dengan waktu push terbaru
```

Di browser:
1. Open Developer Tools (F12)
2. Network tab
3. Hard reload (Ctrl+Shift+R)
4. Check timestamp file `main.*.js` dan `main.*.css`

## 🔍 Diagnosis Cepat

### Skenario 1: GitHub Actions Gagal

**Symptom:** Workflow status ❌ di GitHub Actions

**Fix:**
1. Buka GitHub Actions log
2. Cari error message
3. Fix error di code
4. Commit dan push lagi

**Error umum:**
- Build failed → Check syntax error di code
- SSH failed → Check GitHub Secrets (VPS_HOST, VPS_USER, VPS_SSH_KEY)
- Deployment failed → Check VPS disk space

### Skenario 2: PM2 Tidak Running

**Symptom:** `pm2 status` tidak show `manufacturing-app-staging`

**Fix:**
```bash
ssh foom@103.31.39.189

# Start PM2
cd /home/foom/deployments/manufacturing-app-staging/server
pm2 start index.js --name manufacturing-app-staging
pm2 save
```

### Skenario 3: Health Check Gagal

**Symptom:** `curl http://localhost:5678/health` return error

**Fix:**
```bash
# Check PM2 logs
pm2 logs manufacturing-app-staging --lines 50

# Common issues:
# - Database connection error
# - Missing .env file
# - Port already in use

# Restart PM2
pm2 restart manufacturing-app-staging
```

### Skenario 4: File Tidak Update di VPS

**Symptom:** File timestamp masih lama, GitHub Actions success

**Fix:**
```bash
# Manual check deployment
ssh foom@103.31.39.189
cd /home/foom/deployments

# Check deploy.tar.gz
ls -lh deploy.tar.gz

# Extract manual
tar -xzf deploy.tar.gz
ls -la deploy/

# Copy manual jika perlu
rm -rf manufacturing-app-staging-backup-manual
mv manufacturing-app-staging manufacturing-app-staging-backup-manual
mv deploy manufacturing-app-staging

# Restart PM2
pm2 restart manufacturing-app-staging
```

### Skenario 5: Browser Cache

**Symptom:** File sudah update di VPS, PM2 running, tapi browser show versi lama

**Fix:**
1. Hard reload: Ctrl+Shift+R
2. Clear browser cache
3. Test incognito window
4. Clear nginx cache di VPS (see Langkah 3A)

## 🛠️ Tools yang Tersedia

### 1. check-staging-status.ps1
**Lokasi:** Local machine (Windows)
**Fungsi:** Quick check staging status dari local
**Usage:**
```powershell
.\check-staging-status.ps1
```

### 2. fix-staging-update.sh
**Lokasi:** VPS
**Fungsi:** Comprehensive troubleshooting di VPS dengan auto-fix option
**Usage:**
```bash
ssh foom@103.31.39.189
./fix-staging-update.sh
```

### 3. STAGING_NOT_UPDATING_TROUBLESHOOT.md
**Lokasi:** Repository root
**Fungsi:** Detailed troubleshooting guide dengan semua skenario
**Usage:** Read when needed for comprehensive solutions

## ✅ Checklist Cepat

Setelah push ke staging, verify:

```
□ Git push berhasil (check git log)
□ GitHub Actions success (check Actions tab)
□ Health endpoint OK (curl http://localhost:5678/health)
□ PM2 running (pm2 status)
□ File timestamp baru (ls -lt client-build/...)
□ Browser hard reload (Ctrl+Shift+R)
□ Test incognito window
□ Perubahan terlihat ✓
```

## 🆘 Jika Masih Gagal

### 1. Collect Info

```bash
# Di VPS
ssh foom@103.31.39.189

# Run diagnostic
./fix-staging-update.sh > staging-diagnosis.txt

# Download file untuk share
# Atau copy-paste output
```

### 2. Manual Force Redeploy

```bash
# Option A: Re-run GitHub Actions
# 1. Go to GitHub Actions
# 2. Select latest workflow
# 3. Click "Re-run all jobs"

# Option B: Manual deploy
# Di local machine:
cd client
npm run build
cd ..

# Copy ke VPS (via SCP atau manual upload)
scp -r client/build foom@103.31.39.189:/home/foom/deployments/manufacturing-app-staging/client-build

# Di VPS:
ssh foom@103.31.39.189
pm2 restart manufacturing-app-staging
```

### 3. Contact Support

Share informasi:
- GitHub Actions log (screenshot/copy dari "Execute staging deployment script")
- Output dari `./fix-staging-update.sh`
- PM2 logs: `pm2 logs manufacturing-app-staging --lines 100`
- Browser Network tab screenshot

## 📚 Referensi Lengkap

- **STAGING_NOT_UPDATING_TROUBLESHOOT.md** - Detailed troubleshooting
- **STAGING_SETUP.md** - Staging environment setup
- **CI_CD_GUIDE.md** - CI/CD workflow explanation
- **TROUBLESHOOT_STAGING_DEPLOY.md** - Deployment issues

## 💡 Tips

1. **Selalu check GitHub Actions first** - 80% masalah ada di sini
2. **Browser cache is tricky** - Selalu test di incognito window
3. **PM2 restart kadang perlu** - Especially setelah .env changes
4. **Timestamps don't lie** - Check file timestamps untuk verify deployment
5. **Logs are your friend** - `pm2 logs` akan kasih tau masalah sebenarnya

---

**Quick Command Reference:**

```bash
# Check status
ssh foom@103.31.39.189 'pm2 status; curl -s http://localhost:5678/health'

# Fix everything
ssh foom@103.31.39.189 'pm2 restart manufacturing-app-staging --update-env && sudo rm -rf /var/cache/nginx/* && sudo systemctl reload nginx'

# View logs
ssh foom@103.31.39.189 'pm2 logs manufacturing-app-staging --lines 50'
```

---

**Update terakhir:** 2026-01-18
