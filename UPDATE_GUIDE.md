# 📦 Panduan Update Program di VPS

Panduan lengkap untuk update Manufacturing Process Production Authenticity di VPS.

## 🚀 Cara Update (Recommended)

### Method 1: Update via CI/CD (Otomatis) ⭐

**Ini adalah cara TERMUDAH dan TERAMAN!**

#### Langkah-langkah:

1. **Di local machine, commit perubahan:**
   ```bash
   git add .
   git commit -m "Update: deskripsi perubahan"
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

4. **Verify di VPS:**
   ```bash
   # SSH ke VPS
   ssh foom@103.31.39.189
   
   # Check PM2 status
   pm2 status
   
   # Check logs
   pm2 logs manufacturing-app --lines 50
   
   # Test endpoint
   curl http://localhost:1234/health
   curl https://mpr.moof-set.web.id/api/health
   ```

#### Keuntungan:
- ✅ Otomatis, tidak perlu SSH manual
- ✅ Backup otomatis (5 backup terakhir disimpan)
- ✅ Rollback mudah jika ada masalah
- ✅ Consistent deployment process

---

### Method 2: Update Manual (Jika CI/CD tidak tersedia)

#### Langkah-langkah:

1. **SSH ke VPS:**
   ```bash
   ssh foom@103.31.39.189
   ```

2. **Pull latest code:**
   ```bash
   cd /var/www/manufacturing-process-production-authenticity
   git pull origin main
   ```

3. **Build client:**
   ```bash
   cd client
   npm install
   npm run build
   ```

4. **Backup deployment saat ini:**
   ```bash
   cd ~/deployments
   if [ -d "manufacturing-app" ]; then
     mv manufacturing-app manufacturing-app-backup-$(date +%Y%m%d-%H%M%S)
   fi
   ```

5. **Copy files ke deployment directory:**
   ```bash
   mkdir -p ~/deployments/manufacturing-app
   mkdir -p ~/deployments/manufacturing-app/server
   mkdir -p ~/deployments/manufacturing-app/client-build
   
   # Copy server files
   cp -r /var/www/manufacturing-process-production-authenticity/server/* ~/deployments/manufacturing-app/server/
   
   # Copy client build
   cp -r /var/www/manufacturing-process-production-authenticity/client/build/* ~/deployments/manufacturing-app/client-build/
   ```

6. **Install server dependencies:**
   ```bash
   cd ~/deployments/manufacturing-app/server
   npm install --production
   ```

7. **Restart aplikasi:**
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

8. **Verify:**
   ```bash
   pm2 status
   pm2 logs manufacturing-app --lines 20
   curl http://localhost:1234/health
   ```

---

### Method 3: Update Manual dengan Script

Gunakan script yang sudah ada:

```bash
cd /var/www/manufacturing-process-production-authenticity
git pull origin main

# Run manual deploy script
chmod +x .github/scripts/deploy-manual.sh
sudo ./.github/scripts/deploy-manual.sh
```

---

## 🔄 Rollback (Jika Update Bermasalah)

### Rollback dari Backup

```bash
# List semua backup
ls -la ~/deployments/ | grep manufacturing-app-backup

# Rollback ke backup tertentu
cd ~/deployments
BACKUP_NAME="manufacturing-app-backup-20241222-120000"  # Ganti dengan nama backup
rm -rf manufacturing-app
mv $BACKUP_NAME manufacturing-app

# Restart aplikasi
cd manufacturing-app/server
pm2 delete manufacturing-app || true
if [ -f ecosystem.config.js ]; then
  pm2 start ecosystem.config.js
else
  pm2 start index.js --name manufacturing-app --instances max --exec-mode cluster
fi
pm2 save
```

### Rollback via Git (Jika update manual)

```bash
cd /var/www/manufacturing-process-production-authenticity
git log --oneline  # Lihat commit history
git checkout <commit-hash>  # Rollback ke commit tertentu
# Lalu deploy ulang dengan method manual
```

---

## ✅ Checklist Sebelum Update

- [ ] **Backup database** (jika ada perubahan schema)
  ```bash
  # Backup SQLite database
  cp ~/deployments/manufacturing-app/server/database.db ~/deployments/manufacturing-app/server/database.db.backup
  ```

- [ ] **Test di local** terlebih dahulu
- [ ] **Commit message jelas** (deskripsi perubahan)
- [ ] **Check dependencies** (apakah ada dependency baru?)
- [ ] **Check environment variables** (apakah ada env var baru?)
- [ ] **Check Nginx config** (apakah perlu update config?)

---

## 🔍 Verifikasi Setelah Update

### 1. Check PM2 Status
```bash
pm2 status
# Harus menunjukkan: manufacturing-app | online
```

### 2. Check Logs
```bash
pm2 logs manufacturing-app --lines 50
# Check untuk error atau warning
```

### 3. Test Backend
```bash
curl http://localhost:1234/health
# Harus return: {"status":"healthy","database":"connected",...}
```

### 4. Test via Nginx
```bash
curl -k https://mpr.moof-set.web.id/api/health
curl -k https://mpr.moof-set.web.id/health
```

### 5. Test Website
```bash
curl -I https://mpr.moof-set.web.id
# Harus return: HTTP/1.1 200 OK
```

### 6. Check Database (jika ada perubahan)
```bash
# Jika ada migration, jalankan:
cd ~/deployments/manufacturing-app/server
node migrate-database.js  # atau script migration lainnya
```

---

## 🐛 Troubleshooting Update

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

---

## 📝 Best Practices

1. **Selalu test di local** sebelum push ke production
2. **Gunakan commit message yang jelas** untuk tracking
3. **Monitor GitHub Actions** setelah push
4. **Backup database** sebelum update besar
5. **Update di waktu low traffic** jika memungkinkan
6. **Keep backup** minimal 3-5 deployment terakhir
7. **Document breaking changes** di commit message
8. **Test semua endpoint** setelah update

---

## 🚨 Emergency Rollback

Jika aplikasi down dan perlu rollback cepat:

```bash
# 1. Stop aplikasi
pm2 delete manufacturing-app

# 2. Rollback ke backup terakhir
cd ~/deployments
LATEST_BACKUP=$(ls -dt manufacturing-app-backup-* | head -1)
rm -rf manufacturing-app
mv $LATEST_BACKUP manufacturing-app

# 3. Start aplikasi
cd manufacturing-app/server
pm2 start ecosystem.config.js || pm2 start index.js --name manufacturing-app --instances max --exec-mode cluster
pm2 save

# 4. Verify
pm2 status
curl http://localhost:1234/health
```

---

## 📞 Support

Jika ada masalah:
1. Check logs: `pm2 logs manufacturing-app`
2. Check Nginx logs: `sudo tail -50 /var/log/nginx/manufacturing-app-error.log`
3. Check GitHub Actions logs (jika update via CI/CD)
4. Rollback ke backup sebelumnya

---

**Happy Updating! 🎉**

