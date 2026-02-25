# Cara Mencari Lokasi Database di VPS

Berdasarkan script deployment (`deploy-to-vps.sh`), project di-deploy ke lokasi yang berbeda dari manual.

## 🔍 Cara Mencari Lokasi Database

### Step 1: Cari Lokasi Project

Jalankan perintah berikut di VPS untuk mencari di mana project disimpan:

```bash
# Cari di home directory
find ~ -name "database.sqlite" -type f 2>/dev/null

# Atau cari folder manufacturing
find ~ -type d -name "*manufacturing*" 2>/dev/null

# Cek apakah ada di deployments
ls -la ~/deployments/

# Atau cek PM2 untuk melihat working directory
pm2 list
pm2 info manufacturing-backend
```

### Step 2: Berdasarkan Script Deployment

Berdasarkan `deploy-to-vps.sh`, project seharusnya ada di:

```bash
# Path yang digunakan di script deployment
~/deployments/manufacturing-app

# Path lengkap (jika user adalah foom)
/home/foom/deployments/manufacturing-app

# Database seharusnya ada di
/home/foom/deployments/manufacturing-app/server/database.sqlite
```

### Step 3: Cek PM2 Process

PM2 process bisa memberitahu kita di mana aplikasi berjalan:

```bash
# Lihat semua PM2 processes
pm2 list

# Lihat detail process (ganti dengan nama process yang ada)
pm2 info manufacturing-backend

# Atau lihat semua info
pm2 describe all
```

Dari output PM2, cari field `cwd` (current working directory) yang menunjukkan lokasi project.

### Step 4: Cek dari Process yang Running

```bash
# Cari process Node.js yang running
ps aux | grep node

# Atau cari process yang menggunakan database.sqlite
lsof | grep database.sqlite
```

### Step 5: Cek Nginx Configuration (jika menggunakan Nginx)

```bash
# Lihat konfigurasi Nginx
sudo cat /etc/nginx/sites-enabled/* | grep root

# Atau
sudo nginx -T | grep root
```

## 📍 Lokasi yang Mungkin

Berdasarkan berbagai kemungkinan deployment:

1. **Berdasarkan deploy script:**
   ```
   ~/deployments/manufacturing-app/server/database.sqlite
   /home/foom/deployments/manufacturing-app/server/database.sqlite
   ```

2. **Berdasarkan manual VPS:**
   ```
   /var/www/manufacturing-api/server/database.sqlite
   ```

3. **Lokasi umum lainnya:**
   ```
   ~/manufacturing-api/server/database.sqlite
   /opt/manufacturing-api/server/database.sqlite
   /home/foom/manufacturing-api/server/database.sqlite
   ```

## ✅ Quick Check Commands

Jalankan semua perintah ini untuk menemukan lokasi:

```bash
# 1. Cari file database
find ~ -name "database.sqlite" 2>/dev/null
find /var/www -name "database.sqlite" 2>/dev/null
find /opt -name "database.sqlite" 2>/dev/null

# 2. Cek PM2
pm2 list
pm2 describe all | grep -A 10 "cwd\|script"

# 3. Cek process
ps aux | grep "node.*index.js" | grep -v grep

# 4. Cek di deployments folder
ls -la ~/deployments/ 2>/dev/null
ls -la ~/deployments/manufacturing-app/ 2>/dev/null

# 5. Cek di var/www
ls -la /var/www/ 2>/dev/null
```

## 🎯 Setelah Menemukan Lokasi

Setelah menemukan lokasi database, update dokumentasi dengan path yang benar.

Contoh jika ditemukan di `~/deployments/manufacturing-app/server/database.sqlite`:

```bash
# Navigate ke folder
cd ~/deployments/manufacturing-app/server

# Akses database
sqlite3 database.sqlite

# Atau lihat ukuran
ls -lh database.sqlite
```

## 📝 Update Dokumentasi

Setelah menemukan lokasi yang benar, update file:
- `DATABASE_ACCESS_GUIDE.md` - Update path database
- `VPS_DEPLOYMENT_GUIDE.md` - Update path deployment (jika berbeda)

