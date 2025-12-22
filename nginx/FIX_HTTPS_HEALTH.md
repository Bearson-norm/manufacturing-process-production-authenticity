# Fix HTTPS Health Endpoints

## Masalah
Certbot menambahkan HTTPS server block, tapi mungkin tidak include location blocks untuk health endpoints.

## Solusi Cepat

### 1. Check konfigurasi saat ini:
```bash
cd /var/www/manufacturing-process-production-authenticity/nginx
chmod +x check-https-config.sh
sudo ./check-https-config.sh
```

### 2. Jika health endpoints tidak ada di HTTPS block:

**Option A: Manual edit (Recommended)**
```bash
# Edit config
sudo nano /etc/nginx/sites-enabled/manufacturing-app

# Cari HTTPS server block (listen 443)
# Setelah baris "index index.html;", tambahkan:

    # Health check endpoint (direct to backend)
    location = /health {
        proxy_pass http://127.0.0.1:1234/health;
        proxy_set_header Host $host;
        access_log off;
    }
    
    location = /api/health {
        proxy_pass http://127.0.0.1:1234/health;
        proxy_set_header Host $host;
        access_log off;
    }

# Save dan test
sudo nginx -t && sudo systemctl reload nginx
```

**Option B: Gunakan script (jika tersedia)**
```bash
chmod +x add-health-to-https.sh
sudo ./add-health-to-https.sh
```

### 3. Test endpoints:
```bash
# Skip SSL verification untuk testing
curl -k https://mpr.moof-set.web.id/api/health
curl -k https://mpr.moof-set.web.id/health

# Atau via HTTP (akan redirect ke HTTPS)
curl -L http://mpr.moof-set.web.id/api/health
```

## Verifikasi

Setelah fix, semua endpoint harus bekerja:
- ✅ `http://localhost:1234/health` - Backend direct
- ✅ `https://mpr.moof-set.web.id/health` - Via Nginx HTTPS
- ✅ `https://mpr.moof-set.web.id/api/health` - Via Nginx HTTPS

## Catatan SSL Certificate

Error SSL certificate verification di curl adalah normal jika:
- Certificate tidak match hostname
- Certificate self-signed
- Certificate expired

Gunakan flag `-k` untuk skip SSL verification saat testing:
```bash
curl -k https://mpr.moof-set.web.id/api/health
```

Untuk production, pastikan SSL certificate valid dan match domain.

