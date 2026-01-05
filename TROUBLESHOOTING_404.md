# 🔧 Troubleshooting 404 Error pada Generate API Key

Jika Anda masih mendapatkan error 404 setelah update, ikuti langkah-langkah berikut:

## ✅ Step 1: Verifikasi File Sudah Ter-Update di VPS

```bash
ssh foom@103.31.39.189
cd ~/deployments/manufacturing-app/server

# Cek apakah route ada
grep -n "app.post('/api/admin/generate-api-key'" index.js

# Cek apakah static middleware fix ada
grep -n "Serve static files AFTER all API routes" index.js
```

**Expected Output:**
- Route harus ada (sekitar line 2293)
- Static middleware fix harus ada (sekitar line 3996)

---

## ✅ Step 2: Pastikan Aplikasi Sudah Di-Restart

```bash
# Check PM2 status
pm2 status

# Restart aplikasi
pm2 restart manufacturing-app

# Check logs
pm2 logs manufacturing-app --lines 50
```

---

## ✅ Step 3: Test Endpoint Langsung dari VPS

```bash
# Test dari localhost (bypass Nginx)
curl -X POST http://localhost:1234/api/admin/generate-api-key

# Expected response:
# {"success":true,"message":"API key generated successfully","apiKey":"...","warning":"..."}
```

**Jika ini berhasil**, masalahnya ada di Nginx configuration.
**Jika ini juga 404**, masalahnya ada di Express server.

---

## ✅ Step 4: Check Nginx Configuration

```bash
# Test Nginx config
sudo nginx -t

# Check Nginx error logs
sudo tail -50 /var/log/nginx/manufacturing-app-error.log

# Check Nginx access logs
sudo tail -50 /var/log/nginx/manufacturing-app-access.log
```

Pastikan Nginx config memiliki:

```nginx
location /api {
    proxy_pass http://127.0.0.1:1234;
    # ... other settings
}
```

---

## ✅ Step 5: Verifikasi Route Terdaftar di Express

```bash
# Check PM2 logs untuk melihat route yang terdaftar
pm2 logs manufacturing-app --lines 100 | grep -i "route\|api\|admin"

# Atau check saat startup
pm2 restart manufacturing-app
pm2 logs manufacturing-app --lines 30
```

---

## ✅ Step 6: Manual Test dengan Node

```bash
cd ~/deployments/manufacturing-app/server

# Test syntax
node -c index.js

# Jika tidak ada error, coba run langsung (di terminal lain)
# Ctrl+C untuk stop setelah test
node index.js
```

Lalu di terminal lain:
```bash
curl -X POST http://localhost:1234/api/admin/generate-api-key
```

---

## 🐛 Common Issues

### Issue 1: File Belum Ter-Update

**Solution:**
```bash
# Di local machine (PowerShell)
scp server/index.js foom@103.31.39.189:~/deployments/manufacturing-app/server/index.js

# Di VPS
pm2 restart manufacturing-app
```

### Issue 2: PM2 Tidak Restart dengan Benar

**Solution:**
```bash
# Stop dan start ulang
pm2 delete manufacturing-app
cd ~/deployments/manufacturing-app/server
pm2 start index.js --name manufacturing-app
pm2 save
```

### Issue 3: Nginx Cache atau Config Issue

**Solution:**
```bash
# Reload Nginx
sudo nginx -t
sudo systemctl reload nginx

# Atau restart Nginx
sudo systemctl restart nginx
```

### Issue 4: Port Conflict

**Solution:**
```bash
# Check port 1234
sudo lsof -i :1234
netstat -tulpn | grep 1234

# Kill process jika perlu
pm2 delete manufacturing-app
pm2 start index.js --name manufacturing-app
```

---

## 🔍 Debug Commands

```bash
# Check semua route yang terdaftar (jika ada debug mode)
pm2 logs manufacturing-app | grep -i "route\|listening\|server"

# Check apakah Express server running
curl http://localhost:1234/health

# Check PM2 process info
pm2 describe manufacturing-app

# Check system resources
pm2 monit
```

---

## 📝 Quick Fix Script

Jalankan script verifikasi:

```bash
# Upload script ke VPS (dari local)
scp verify-and-fix.sh foom@103.31.39.189:~/

# Di VPS
chmod +x ~/verify-and-fix.sh
~/verify-and-fix.sh
```

---

## 🆘 Jika Masih Error

1. **Check file timestamp:**
   ```bash
   ls -la ~/deployments/manufacturing-app/server/index.js
   ```

2. **Compare dengan file local:**
   ```bash
   # Di local, check line 2293 dan 3996
   # Di VPS, check line yang sama
   ```

3. **Full restart:**
   ```bash
   pm2 delete manufacturing-app
   cd ~/deployments/manufacturing-app/server
   npm install --production
   pm2 start index.js --name manufacturing-app
   pm2 save
   ```

4. **Check database connection:**
   ```bash
   # Pastikan database file ada
   ls -la ~/deployments/manufacturing-app/server/database.sqlite
   ```

---

## 📞 Support

Jika masih error setelah semua langkah di atas:
1. Copy output dari: `pm2 logs manufacturing-app --lines 100`
2. Copy output dari: `curl -v -X POST http://localhost:1234/api/admin/generate-api-key`
3. Copy output dari: `sudo tail -50 /var/log/nginx/manufacturing-app-error.log`

