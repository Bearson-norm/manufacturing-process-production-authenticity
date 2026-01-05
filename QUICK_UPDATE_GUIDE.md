# 🚀 Quick Update Guide - Fix Generate API Key 404 Error

Panduan cepat untuk update file `server/index.js` yang sudah diperbaiki.

## 📋 Pre-requisites

1. File `server/index.js` sudah diubah di local machine
2. SSH access ke VPS: `ssh foom@103.31.39.189`

## 🔄 Method 1: Update via SCP (Recommended untuk Quick Fix)

### Di Local Machine (Windows PowerShell):

```powershell
# Navigate ke project directory
cd "C:\Users\info\Documents\Project\not-released\IoT-Project\Released-Github\Manufacturing-Process-Production-Authenticity"

# Copy file server/index.js ke VPS
scp server/index.js foom@103.31.39.189:~/deployments/manufacturing-app/server/index.js
```

### Di VPS:

```bash
# Backup file lama dulu
cd ~/deployments/manufacturing-app/server
cp index.js index.js.backup-$(date +%Y%m%d-%H%M%S)

# File sudah di-copy via SCP, sekarang restart aplikasi
pm2 restart manufacturing-app

# Check logs untuk memastikan tidak ada error
pm2 logs manufacturing-app --lines 50
```

---

## 🔄 Method 2: Update Manual via SSH (Copy-Paste)

### Langkah 1: Backup File Lama

```bash
ssh foom@103.31.39.189
cd ~/deployments/manufacturing-app/server
cp index.js index.js.backup-$(date +%Y%m%d-%H%M%S)
```

### Langkah 2: Edit File di VPS

```bash
# Edit file menggunakan nano atau vi
nano index.js
```

**Atau gunakan method copy-paste:**

1. Buka file `server/index.js` di local machine
2. Copy seluruh isi file
3. Di VPS, buat file baru atau edit:
   ```bash
   nano ~/deployments/manufacturing-app/server/index.js
   ```
4. Paste seluruh isi file
5. Save (Ctrl+O, Enter, Ctrl+X untuk nano)

### Langkah 3: Restart Aplikasi

```bash
pm2 restart manufacturing-app
pm2 logs manufacturing-app --lines 50
```

---

## 🔄 Method 3: Update via Git (Jika Git Repository Ada)

### Cek Apakah Ada Git Repository:

```bash
ssh foom@103.31.39.189

# Cek beberapa lokasi yang mungkin
ls -la /var/www/manufacturing-process-production-authenticity 2>/dev/null
ls -la ~/manufacturing-process-production-authenticity 2>/dev/null
ls -la ~/repos/manufacturing-process-production-authenticity 2>/dev/null
```

### Jika Ada Git Repository:

```bash
# Pull latest code
cd /path/to/git/repository  # Ganti dengan path yang ditemukan
git pull origin main

# Build client (jika ada perubahan di client)
cd client
npm install
npm run build

# Copy server file ke deployment
cp server/index.js ~/deployments/manufacturing-app/server/index.js

# Restart aplikasi
pm2 restart manufacturing-app
```

---

## 🔄 Method 4: Update via GitHub Actions (Jika CI/CD Tersedia)

### Di Local Machine:

```bash
# Commit perubahan
git add server/index.js
git commit -m "Fix: Move static middleware after API routes to fix 404 on generate-api-key"
git push origin main
```

### Monitor Deployment:

1. Buka: `https://github.com/Bearson-norm/manufacturing-process-production-authenticity/actions`
2. Tunggu deployment selesai (hijau = sukses)
3. Verify di VPS:
   ```bash
   ssh foom@103.31.39.189
   pm2 logs manufacturing-app --lines 50
   ```

---

## ✅ Verification

Setelah update, test endpoint:

```bash
# Test dari VPS
curl -X POST http://localhost:1234/api/admin/generate-api-key

# Atau test dari browser/Postman
# POST https://mpr.moof-set.web.id/api/admin/generate-api-key
```

**Expected Response:**
```json
{
  "success": true,
  "message": "API key generated successfully",
  "apiKey": "64-character-hex-string",
  "warning": "Please save this API key securely. It will not be shown again."
}
```

---

## 🐛 Troubleshooting

### Error: "Cannot find module"
```bash
cd ~/deployments/manufacturing-app/server
npm install --production
pm2 restart manufacturing-app
```

### Error: "Port already in use"
```bash
pm2 delete manufacturing-app
pm2 start ~/deployments/manufacturing-app/server/index.js --name manufacturing-app
```

### Check PM2 Status
```bash
pm2 status
pm2 logs manufacturing-app --lines 100
pm2 monit
```

---

## 📝 Catatan Penting

1. **Selalu backup** sebelum update
2. **Database tidak akan terpengaruh** - hanya file server yang diubah
3. **Tidak perlu rebuild client** - hanya server file yang diubah
4. **Restart diperlukan** untuk menerapkan perubahan

