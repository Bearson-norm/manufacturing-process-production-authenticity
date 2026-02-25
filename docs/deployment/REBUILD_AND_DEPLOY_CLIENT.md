# 🔄 Rebuild & Deploy Client - Fix Tombol Edit Buffer/Reject

## Masalah
Tombol edit untuk buffer-card dan reject-card tidak muncul di VPS karena frontend belum di-build ulang dengan perubahan terbaru.

## Solusi: Rebuild & Deploy Client

### Option 1: Quick Rebuild & Deploy (Recommended)

```bash
# 1. Build client di local
cd client
npm install  # Pastikan dependencies ter-update
npm run build

# 2. Deploy ke VPS
# Ganti dengan IP/hostname VPS Anda
scp -r build/* foom@103.31.39.189:~/deployments/manufacturing-app/client-build/

# 3. Restart server di VPS (jika perlu)
ssh foom@103.31.39.189 "cd ~/deployments/manufacturing-app/server && pm2 restart manufacturing-app || true"
```

### Option 2: Full Rebuild & Deploy (Termasuk Server)

```bash
# 1. Build client
cd client
npm install
npm run build

# 2. Deploy client build
scp -r build/* foom@103.31.39.189:~/deployments/manufacturing-app/client-build/

# 3. Deploy server (jika ada perubahan di server/index.js)
scp server/index.js foom@103.31.39.189:~/deployments/manufacturing-app/server/

# 4. Restart aplikasi di VPS
ssh foom@103.31.39.189 << 'EOF'
cd ~/deployments/manufacturing-app/server
npm install --production
pm2 restart manufacturing-app
EOF
```

### Option 3: Deploy via Git (Jika menggunakan CI/CD)

```bash
# 1. Commit perubahan
git add .
git commit -m "Add edit button for buffer and reject cards"
git push origin main

# 2. Monitor GitHub Actions untuk deployment otomatis
# Atau trigger manual deployment di GitHub Actions
```

## Verifikasi Deployment

Setelah deploy, verifikasi bahwa file sudah ter-update:

```bash
# SSH ke VPS
ssh foom@103.31.39.189

# Cek apakah file build ter-update
ls -lah ~/deployments/manufacturing-app/client-build/static/js/
ls -lah ~/deployments/manufacturing-app/client-build/static/css/

# Cek timestamp file (harus baru)
stat ~/deployments/manufacturing-app/client-build/index.html
```

## Clear Browser Cache

Setelah deploy, **clear browser cache** atau gunakan **hard refresh**:
- **Chrome/Edge**: `Ctrl + Shift + R` (Windows) atau `Cmd + Shift + R` (Mac)
- **Firefox**: `Ctrl + F5` (Windows) atau `Cmd + Shift + R` (Mac)
- **Safari**: `Cmd + Option + R`

Atau buka dalam **Incognito/Private mode** untuk test.

## Troubleshooting

### 1. Tombol Edit Masih Tidak Muncul

**Cek apakah file sudah ter-deploy:**
```bash
ssh foom@103.31.39.189
grep -r "edit-button" ~/deployments/manufacturing-app/client-build/static/js/
```

Jika tidak ada hasil, berarti build belum ter-deploy dengan benar.

**Solusi:**
```bash
# Rebuild ulang
cd client
rm -rf build
npm run build

# Deploy ulang
scp -r build/* foom@103.31.39.189:~/deployments/manufacturing-app/client-build/
```

### 2. Error saat Build

Jika ada error saat build:
```bash
cd client
rm -rf node_modules build
npm install
npm run build
```

### 3. Nginx Cache

Jika menggunakan Nginx, mungkin perlu clear cache:
```bash
ssh foom@103.31.39.189
sudo systemctl reload nginx
```

Atau tambahkan di nginx config untuk disable cache untuk development:
```nginx
location /static/ {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}
```

### 4. PM2 Tidak Restart

```bash
ssh foom@103.31.39.189
cd ~/deployments/manufacturing-app/server
pm2 restart manufacturing-app
pm2 logs manufacturing-app --lines 50
```

## Checklist

- [ ] Client sudah di-build (`npm run build` berhasil)
- [ ] File build sudah di-copy ke VPS (`client-build/` directory)
- [ ] Server sudah di-restart (jika ada perubahan server)
- [ ] Browser cache sudah di-clear
- [ ] Tombol edit muncul di buffer-card dan reject-card

## Catatan Penting

1. **Build harus dilakukan setiap kali ada perubahan di frontend**
2. **File di `client/build/` adalah hasil build yang harus di-deploy**
3. **Jangan deploy folder `client/src/` - itu adalah source code, bukan build**
4. **Pastikan build berhasil tanpa error sebelum deploy**

## Quick Command (Copy-Paste)

```bash
# Full rebuild & deploy
cd client && npm install && npm run build && cd .. && \
scp -r client/build/* foom@103.31.39.189:~/deployments/manufacturing-app/client-build/ && \
ssh foom@103.31.39.189 "cd ~/deployments/manufacturing-app/server && pm2 restart manufacturing-app || true" && \
echo "✅ Deployment selesai! Clear browser cache dan refresh halaman."
```
