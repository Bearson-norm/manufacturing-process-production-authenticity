# 🔧 Fix 403 Forbidden Error - Static Files

## Masalah
Error 403 Forbidden saat mengakses static files (CSS, JS) di VPS:
```
GET https://mpr.moof-set.web.id/static/css/main.23a4024a.css net::ERR_ABORTED 403 (Forbidden)
GET https://mpr.moof-set.web.id/static/js/main.a81033a4.js net::ERR_ABORTED 403 (Forbidden)
```

## Penyebab
1. **Permission file/directory tidak benar** - Nginx tidak bisa membaca file
2. **Ownership salah** - File dimiliki user yang salah
3. **Directory permission tidak cukup** - Nginx tidak bisa traverse directory

## Solusi Cepat

### Option 1: Fix Permission via SSH (Recommended)

```bash
# SSH ke VPS
ssh foom@103.31.39.189

# Jalankan script fix permission
cd ~/deployments/manufacturing-app
# Upload script fix-static-files-permission.sh dulu, atau jalankan manual:

# Fix ownership
sudo chown -R foom:www-data ~/deployments/manufacturing-app/client-build

# Fix directory permissions (755 = rwxr-xr-x)
find ~/deployments/manufacturing-app/client-build -type d -exec sudo chmod 755 {} \;

# Fix file permissions (644 = rw-r--r--)
find ~/deployments/manufacturing-app/client-build -type f -exec sudo chmod 644 {} \;

# Ensure nginx can read
sudo chmod -R o+r ~/deployments/manufacturing-app/client-build

# Reload nginx
sudo systemctl reload nginx
```

### Option 2: Manual Fix

```bash
ssh foom@103.31.39.189

# 1. Check current permissions
ls -la ~/deployments/manufacturing-app/client-build/
ls -la ~/deployments/manufacturing-app/client-build/static/

# 2. Fix ownership (user: foom, group: www-data)
sudo chown -R foom:www-data ~/deployments/manufacturing-app/client-build

# 3. Fix directory permissions
sudo chmod 755 ~/deployments/manufacturing-app/client-build
sudo chmod 755 ~/deployments/manufacturing-app/client-build/static
sudo chmod 755 ~/deployments/manufacturing-app/client-build/static/css
sudo chmod 755 ~/deployments/manufacturing-app/client-build/static/js

# 4. Fix file permissions
sudo find ~/deployments/manufacturing-app/client-build -type f -exec chmod 644 {} \;

# 5. Test nginx can read
sudo -u www-data test -r ~/deployments/manufacturing-app/client-build/index.html && echo "✅ OK" || echo "❌ FAIL"

# 6. Reload nginx
sudo systemctl reload nginx
```

### Option 3: Upload & Run Script

```bash
# Di local machine
scp fix-static-files-permission.sh foom@103.31.39.189:~/deployments/manufacturing-app/

# SSH ke VPS
ssh foom@103.31.39.189
cd ~/deployments/manufacturing-app
chmod +x fix-static-files-permission.sh
./fix-static-files-permission.sh
```

## Verifikasi

Setelah fix, verifikasi:

```bash
ssh foom@103.31.39.189

# 1. Check permissions
ls -la ~/deployments/manufacturing-app/client-build/static/css/ | head -5
ls -la ~/deployments/manufacturing-app/client-build/static/js/ | head -5

# 2. Test nginx can read
sudo -u www-data cat ~/deployments/manufacturing-app/client-build/index.html > /dev/null && echo "✅ Nginx can read" || echo "❌ Nginx cannot read"

# 3. Check nginx error log
sudo tail -20 /var/log/nginx/manufacturing-app-error.log

# 4. Test access
curl -I http://localhost/static/css/main.23a4024a.css
```

## Troubleshooting

### 1. Masih 403 Setelah Fix Permission

**Cek SELinux (jika enabled):**
```bash
# Check SELinux status
getenforce

# Jika enabled, set context untuk nginx
sudo chcon -R -t httpd_sys_content_t ~/deployments/manufacturing-app/client-build
```

### 2. File Tidak Ditemukan (404)

**Pastikan file sudah ter-deploy:**
```bash
ls -la ~/deployments/manufacturing-app/client-build/static/css/
ls -la ~/deployments/manufacturing-app/client-build/static/js/
```

Jika tidak ada, rebuild dan deploy ulang:
```bash
# Di local
cd client
npm run build
scp -r build/* foom@103.31.39.189:~/deployments/manufacturing-app/client-build/
```

### 3. Nginx Config Issue

**Cek nginx config:**
```bash
sudo nginx -t
sudo cat /etc/nginx/sites-available/manufacturing-app.conf | grep -A 5 "static"
```

**Pastikan root path benar:**
```nginx
root /home/foom/deployments/manufacturing-app/client-build;
```

### 4. Check Nginx User

**Verifikasi nginx user:**
```bash
# Check nginx user
ps aux | grep nginx | head -1

# Check nginx config
sudo grep "^user" /etc/nginx/nginx.conf

# Pastikan user bisa read file
sudo -u www-data test -r ~/deployments/manufacturing-app/client-build/index.html
```

## Quick Fix Command (Copy-Paste)

```bash
ssh foom@103.31.39.189 << 'EOF'
sudo chown -R foom:www-data ~/deployments/manufacturing-app/client-build && \
find ~/deployments/manufacturing-app/client-build -type d -exec sudo chmod 755 {} \; && \
find ~/deployments/manufacturing-app/client-build -type f -exec sudo chmod 644 {} \; && \
sudo chmod -R o+r ~/deployments/manufacturing-app/client-build && \
sudo systemctl reload nginx && \
echo "✅ Permission fixed! Clear browser cache and refresh."
EOF
```

## Checklist

- [ ] Ownership sudah benar (foom:www-data)
- [ ] Directory permissions 755
- [ ] File permissions 644
- [ ] Nginx bisa read file (test dengan `sudo -u www-data test -r`)
- [ ] Nginx sudah di-reload
- [ ] Browser cache sudah di-clear
- [ ] File static sudah ter-deploy

## Catatan

1. **Permission 755** untuk directory = owner bisa read/write/execute, group dan others bisa read/execute
2. **Permission 644** untuk file = owner bisa read/write, group dan others bisa read
3. **Nginx user** biasanya `www-data` atau `nginx` tergantung distro
4. **Setelah fix**, selalu clear browser cache atau hard refresh
