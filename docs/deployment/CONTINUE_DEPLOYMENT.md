# 🚀 Lanjutkan Deployment ke VPS

Setelah PostgreSQL sudah fix, lanjutkan deployment dengan langkah-langkah berikut.

---

## ✅ Checklist Sebelum Deployment

Pastikan sudah selesai:
- [x] PostgreSQL running di port 5433
- [x] Database `manufacturing_db` exists
- [x] User `admin` exists dengan password `Admin123`
- [x] Connection test berhasil: `PGPASSWORD=Admin123 psql -h localhost -p 5433 -U admin -d manufacturing_db -c "SELECT 1;"`
- [x] .env file sudah dikonfigurasi dengan `DB_PORT=5433`

---

## 📋 Langkah-Langkah Deployment

### Step 1: Verifikasi Konfigurasi

```bash
cd ~/deployments/manufacturing-app/server

# Cek .env file
cat .env | grep DB_

# Pastikan ada:
# DB_HOST=localhost
# DB_PORT=5433
# DB_NAME=manufacturing_db
# DB_USER=admin
# DB_PASSWORD=Admin123
```

Jika belum ada atau salah, update:
```bash
nano .env
```

Atau langsung set:
```bash
cat > .env << 'EOF'
NODE_ENV=production
PORT=1234

DB_HOST=localhost
DB_PORT=5433
DB_NAME=manufacturing_db
DB_USER=admin
DB_PASSWORD=Admin123
DB_POOL_MAX=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000

CORS_ORIGIN=*
LOG_LEVEL=info
EOF
```

### Step 2: Test PostgreSQL Connection

```bash
cd ~/deployments/manufacturing-app/server

# Test dengan Node.js script
node test-postgresql-connection.js
```

Jika belum ada script, test manual:
```bash
PGPASSWORD=Admin123 psql -h localhost -p 5433 -U admin -d manufacturing_db -c "SELECT current_user, current_database();"
```

### Step 3: Migrasi Database SQLite ke PostgreSQL

```bash
cd ~/deployments/manufacturing-app/server

# Run migration
node migrate-to-postgresql.js
```

Script ini akan:
- ✅ Membaca data dari SQLite (`database.sqlite`)
- ✅ Membuat tabel di PostgreSQL
- ✅ Migrasi semua data
- ✅ Verifikasi hasil migrasi

**Note**: Pastikan aplikasi sudah di-stop sebelum migrasi:
```bash
pm2 stop manufacturing-app || true
```

### Step 4: Verifikasi Data Migration

```bash
cd ~/deployments/manufacturing-app/server

# Cek data di PostgreSQL
node check-data.js

# Atau manual
PGPASSWORD=Admin123 psql -h localhost -p 5433 -U admin -d manufacturing_db -c "SELECT COUNT(*) FROM production_liquid;"
PGPASSWORD=Admin123 psql -h localhost -p 5433 -U admin -d manufacturing_db -c "SELECT COUNT(*) FROM production_device;"
PGPASSWORD=Admin123 psql -h localhost -p 5433 -U admin -d manufacturing_db -c "SELECT COUNT(*) FROM production_cartridge;"
```

### Step 5: Build Client (Frontend)

```bash
cd ~/deployments/manufacturing-app/client

# Install dependencies (jika belum)
npm install

# Build untuk production
npm run build
```

### Step 6: Start Aplikasi

```bash
cd ~/deployments/manufacturing-app/server

# Start dengan PM2
pm2 start ecosystem.config.js

# Atau jika sudah running, restart
pm2 restart manufacturing-app

# Save PM2 configuration
pm2 save
```

### Step 7: Verifikasi Aplikasi Berjalan

```bash
# Cek status PM2
pm2 status

# Cek logs
pm2 logs manufacturing-app --lines 50

# Test health endpoint
curl http://localhost:1234/health

# Atau dari luar
curl http://103.31.39.189:1234/health
```

Seharusnya return:
```json
{
  "status": "healthy",
  "database": "connected",
  "uptime": ...,
  "timestamp": "..."
}
```

---

## 🔄 Update Sistem (Setelah Deployment Pertama)

### Update dari Git Repository

```bash
# Dari komputer lokal
chmod +x update-from-git.sh
./update-from-git.sh
```

Atau manual di VPS:
```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    # Pull dari git
    cd /var/www/manufacturing-process-production-authenticity
    git pull origin main || git pull origin master
    
    # Copy ke running directory
    rsync -av --exclude 'node_modules' --exclude '.git' --exclude 'database.sqlite*' \
        /var/www/manufacturing-process-production-authenticity/ \
        ~/deployments/manufacturing-app/
    
    # Install dependencies
    cd ~/deployments/manufacturing-app/server && npm install
    cd ~/deployments/manufacturing-app/client && npm install && npm run build
    
    # Restart
    cd ~/deployments/manufacturing-app/server
    pm2 restart manufacturing-app
ENDSSH
```

**Lihat**: `UPDATE_SYSTEM_VPS.md` untuk panduan lengkap update sistem.

---

## 📊 Verifikasi Final

### 1. Cek Aplikasi Running

```bash
pm2 status
pm2 info manufacturing-app
```

### 2. Cek Database Connection

```bash
cd ~/deployments/manufacturing-app/server
node test-postgresql-connection.js
```

### 3. Test API Endpoints

```bash
# Health check
curl http://localhost:1234/health

# Test login
curl -X POST http://localhost:1234/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'

# Test production data (jika sudah ada data)
curl http://localhost:1234/api/production/combined
```

### 4. Cek Frontend

```bash
# Cek apakah build folder ada
ls -la ~/deployments/manufacturing-app/client/build

# Test di browser
# http://103.31.39.189:1234
# atau sesuai konfigurasi domain Anda
```

---

## 🆘 Troubleshooting

### Error: "Cannot connect to database"

```bash
# Cek PostgreSQL running
sudo systemctl status postgresql

# Test connection
PGPASSWORD=Admin123 psql -h localhost -p 5433 -U admin -d manufacturing_db -c "SELECT 1;"

# Cek .env
cat ~/deployments/manufacturing-app/server/.env | grep DB_
```

### Error: "Table does not exist"

```bash
# Run migration lagi
cd ~/deployments/manufacturing-app/server
node migrate-to-postgresql.js
```

### Error: "Application won't start"

```bash
# Cek logs
pm2 logs manufacturing-app --lines 100

# Cek error specific
pm2 logs manufacturing-app --err --lines 50
```

### Error: "Port 1234 already in use"

```bash
# Cek apa yang menggunakan port 1234
sudo lsof -i :1234

# Atau
sudo netstat -tulpn | grep 1234

# Stop process yang menggunakan port tersebut
pm2 stop manufacturing-app
# atau
sudo kill <PID>
```

---

## ✅ Checklist Final

- [ ] .env dikonfigurasi dengan benar (DB_PORT=5433)
- [ ] PostgreSQL connection test berhasil
- [ ] Migration database berhasil
- [ ] Data ter-verifikasi di PostgreSQL
- [ ] Client (frontend) sudah di-build
- [ ] Aplikasi running dengan PM2
- [ ] Health endpoint return "healthy"
- [ ] API endpoints berfungsi
- [ ] Frontend accessible

---

## 🎯 Quick Command Summary

```bash
# 1. Setup .env
cd ~/deployments/manufacturing-app/server
cat > .env << 'EOF'
NODE_ENV=production
PORT=1234
DB_HOST=localhost
DB_PORT=5433
DB_NAME=manufacturing_db
DB_USER=admin
DB_PASSWORD=Admin123
EOF

# 2. Test connection
PGPASSWORD=Admin123 psql -h localhost -p 5433 -U admin -d manufacturing_db -c "SELECT 1;"

# 3. Stop app
pm2 stop manufacturing-app || true

# 4. Run migration
node migrate-to-postgresql.js

# 5. Build client
cd ~/deployments/manufacturing-app/client
npm install
npm run build

# 6. Start app
cd ~/deployments/manufacturing-app/server
pm2 start ecosystem.config.js
pm2 save

# 7. Verify
pm2 status
curl http://localhost:1234/health
```

---

**Selamat! Deployment selesai!** 🎉

**Last Updated**: 2026-01-08
