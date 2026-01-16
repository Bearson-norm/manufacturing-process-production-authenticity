# Fix Staging Frontend Update Issue

## Masalah
Frontend tidak terupdate setelah push ke branch staging, meskipun GitHub Actions berhasil.

## Penyebab
1. **Nginx cache**: Nginx meng-cache static files dengan `expires 1y` (1 tahun)
2. **Browser cache**: Browser juga cache static files karena cache headers
3. **Path static files**: Server mungkin tidak serve dari path yang benar

## Perbaikan yang Sudah Dilakukan

### 1. Nginx Config (nginx/manufacturing-app-staging.conf)
- ✅ Mengubah cache policy dari `expires 1y` menjadi `no-cache` untuk staging
- ✅ Semua static files (JS, CSS, images) sekarang tidak di-cache
- ✅ HTML files juga tidak di-cache

### 2. Server Code (server/index.js)
- ✅ Deteksi otomatis path: `client-build` (production) atau `client/public` (development)
- ✅ Tambahkan no-cache headers untuk staging environment
- ✅ SPA routing support untuk React Router

### 3. Deployment Workflow (.github/workflows/deploy-staging.yml)
- ✅ Pastikan nginx config ter-copy dalam deployment package
- ✅ Nginx reload otomatis setelah deployment
- ✅ Verifikasi nginx config sebelum reload

## Langkah Troubleshooting

### 1. Verifikasi Deployment
SSH ke VPS dan jalankan:
```bash
cd /home/foom/deployments/manufacturing-app-staging
ls -lt client-build/static/js/*.js | head -3
ls -lt client-build/static/css/*.css | head -3
```

Jika file timestamp masih lama, berarti build tidak terdeploy dengan benar.

### 2. Clear Nginx Cache
```bash
sudo rm -rf /var/cache/nginx/*
sudo systemctl reload nginx
```

### 3. Verifikasi Nginx Config
```bash
sudo cat /etc/nginx/sites-enabled/manufacturing-app-staging.conf | grep -A 5 "Static files"
```

Pastikan ada `no-cache` headers.

### 4. Restart PM2
```bash
pm2 restart manufacturing-app-staging
pm2 logs manufacturing-app-staging --lines 50
```

Cek log untuk melihat path static files yang digunakan:
- Harus ada: `📦 Serving static files from client-build (production)`

### 5. Test dari Server
```bash
curl -I http://localhost:5678/ | head -10
curl -I http://localhost:5678/static/js/main.*.js | head -10
```

Cek response headers - harus ada `Cache-Control: no-cache`.

### 6. Clear Browser Cache
1. Buka Developer Tools (F12)
2. Klik kanan pada tombol refresh
3. Pilih "Empty Cache and Hard Reload"
4. Atau gunakan Ctrl+Shift+R (Windows/Linux) atau Cmd+Shift+R (Mac)

### 7. Test dengan Incognito/Private Window
Buka `staging.mpr.moof-set.web.id` di incognito window untuk bypass cache.

## Verifikasi Setelah Push

Setelah push ke branch `staging`:

1. **Cek GitHub Actions**: Pastikan workflow `Deploy to Staging` berhasil
2. **Cek Logs**: Lihat log deployment untuk memastikan:
   - ✅ Client build berhasil
   - ✅ Files ter-copy ke `client-build`
   - ✅ Nginx config ter-copy
   - ✅ Nginx reload berhasil
   - ✅ PM2 restart berhasil

3. **Cek di VPS**:
   ```bash
   # SSH ke VPS
   ssh foom@your-vps-ip
   
   # Cek file terbaru
   ls -lt /home/foom/deployments/manufacturing-app-staging/client-build/static/js/*.js | head -1
   
   # Cek PM2
   pm2 logs manufacturing-app-staging --lines 20
   
   # Cek nginx
   sudo nginx -t
   sudo systemctl status nginx
   ```

4. **Test di Browser**:
   - Buka `staging.mpr.moof-set.web.id` di incognito window
   - Buka Developer Tools > Network tab
   - Reload page
   - Cek request untuk `main.*.js` dan `main.*.css`
   - Response headers harus ada `Cache-Control: no-cache`
   - File size dan timestamp harus sesuai dengan build terbaru

## Jika Masih Tidak Update

1. **Force rebuild di GitHub Actions**:
   - Buka Actions tab di GitHub
   - Re-run workflow terakhir

2. **Manual deployment**:
   ```bash
   # Di VPS
   cd /home/foom/deployments/manufacturing-app-staging
   pm2 stop manufacturing-app-staging
   rm -rf client-build/*
   # Copy build baru manual atau pull dari repo
   pm2 start manufacturing-app-staging
   ```

3. **Check file permissions**:
   ```bash
   sudo chown -R foom:foom /home/foom/deployments/manufacturing-app-staging
   sudo chmod -R 755 /home/foom/deployments/manufacturing-app-staging
   ```

## Catatan Penting

- **Staging environment**: Tidak menggunakan cache untuk memastikan selalu dapat versi terbaru
- **Production environment**: Masih menggunakan cache untuk performa (akan diupdate terpisah)
- **Build files**: Setiap build menghasilkan hash unik (misal: `main.abc123.js`), jadi browser akan fetch file baru jika hash berbeda
