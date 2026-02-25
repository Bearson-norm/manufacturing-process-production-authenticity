# 📘 Panduan Deployment dan Migrasi ke VPS

Panduan lengkap untuk mengupdate sistem dari SQLite ke PostgreSQL di VPS.

---

## 📋 Daftar Isi

1. [Persiapan](#persiapan)
2. [Backup Database](#backup-database)
3. [Deployment ke VPS](#deployment-ke-vps)
4. [Setup PostgreSQL](#setup-postgresql)
5. [Migrasi Database](#migrasi-database)
6. [Verifikasi](#verifikasi)
7. [Rollback (Jika Gagal)](#rollback-jika-gagal)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 Persiapan

### 1. Pastikan Akses ke VPS

```bash
# Test SSH connection
ssh foom@103.31.39.189
```

### 2. Cek Struktur Direktori di VPS

```bash
ssh foom@103.31.39.189 "ls -la ~/deployments/manufacturing-app/server"
```

Pastikan direktori ada dan aplikasi sedang berjalan.

### 3. Backup Lokal (Opsional)

Sebelum deployment, backup kode lokal Anda:

```bash
git add .
git commit -m "Pre-deployment backup"
git push
```

---

## 💾 Backup Database

**PENTING**: Selalu backup database sebelum migrasi!

### Metode 1: Backup Otomatis (Recommended)

Script deployment akan otomatis backup database, tapi Anda bisa backup manual:

```bash
# Di VPS
cd ~/deployments/manufacturing-app/server
bash backup-database-vps.sh
```

### Metode 2: Backup Manual

```bash
# SSH ke VPS
ssh foom@103.31.39.189

# Buat direktori backup
mkdir -p ~/backups/manufacturing-app

# Backup database
cd ~/deployments/manufacturing-app/server
cp database.sqlite ~/backups/manufacturing-app/database.sqlite.$(date +%Y%m%d-%H%M%S)
cp database.sqlite-wal ~/backups/manufacturing-app/database.sqlite-wal.$(date +%Y%m%d-%H%M%S) 2>/dev/null || true
cp database.sqlite-shm ~/backups/manufacturing-app/database.sqlite-shm.$(date +%Y%m%d-%H%M%S) 2>/dev/null || true
```

### Verifikasi Backup

```bash
ls -lh ~/backups/manufacturing-app/
```

---

## 🚀 Deployment ke VPS

### Metode 1: Deployment Otomatis (Recommended)

Gunakan script deployment otomatis:

```bash
# Dari komputer lokal
chmod +x deploy-to-vps.sh
./deploy-to-vps.sh
```

Script ini akan:
1. ✅ Backup database
2. ✅ Stop aplikasi
3. ✅ Upload kode baru
4. ✅ Install PostgreSQL (jika belum ada)
5. ✅ Install dependencies
6. ✅ Run migrasi database
7. ✅ Build client
8. ✅ Start aplikasi

### Metode 2: Deployment Manual

Jika ingin melakukan step-by-step manual:

#### Step 1: Stop Aplikasi

```bash
ssh foom@103.31.39.189 "cd ~/deployments/manufacturing-app/server && pm2 stop manufacturing-app"
```

#### Step 2: Upload Kode

```bash
# Dari komputer lokal
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'database.sqlite*' \
    ./ foom@103.31.39.189:~/deployments/manufacturing-app/
```

#### Step 3: Install Dependencies

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    cd ~/deployments/manufacturing-app
    npm install
    
    cd ~/deployments/manufacturing-app/server
    npm install
    
    cd ~/deployments/manufacturing-app/client
    npm install
ENDSSH
```

#### Step 4: Setup PostgreSQL (lihat section berikutnya)

#### Step 5: Run Migrasi (lihat section migrasi)

#### Step 6: Build Client

```bash
ssh foom@103.31.39.189 "cd ~/deployments/manufacturing-app/client && npm run build"
```

#### Step 7: Start Aplikasi

```bash
ssh foom@103.31.39.189 "cd ~/deployments/manufacturing-app/server && pm2 start ecosystem.config.js"
```

---

## 🗄️ Setup PostgreSQL

### Install PostgreSQL

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    # Update package list
    sudo apt-get update
    
    # Install PostgreSQL
    sudo apt-get install -y postgresql postgresql-contrib
    
    # Start PostgreSQL service
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
    
    # Create database and user
    sudo -u postgres psql << 'PSQL'
        CREATE USER admin WITH PASSWORD 'Admin123';
        CREATE DATABASE manufacturing_db OWNER admin;
        GRANT ALL PRIVILEGES ON DATABASE manufacturing_db TO admin;
        \c manufacturing_db
        GRANT ALL ON SCHEMA public TO admin;
PSQL
    
    echo "✅ PostgreSQL installed and configured"
ENDSSH
```

### Verifikasi PostgreSQL

```bash
ssh foom@103.31.39.189 "sudo -u postgres psql -c '\l' | grep manufacturing_db"
```

### Setup .env File

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    cd ~/deployments/manufacturing-app/server
    
    # Copy env.example jika .env belum ada
    if [ ! -f .env ]; then
        cp env.example .env
    fi
    
    # Edit .env file (gunakan nano atau vi)
    # Pastikan konfigurasi PostgreSQL:
    # DB_HOST=localhost
    # DB_PORT=5432
    # DB_NAME=manufacturing_db
    # DB_USER=admin
    # DB_PASSWORD=Admin123
ENDSSH
```

---

## 🔄 Migrasi Database

### Metode 1: Migrasi Otomatis

Script deployment sudah include migrasi, tapi bisa dijalankan manual:

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    cd ~/deployments/manufacturing-app/server
    
    # Pastikan .env sudah dikonfigurasi
    # Run migrasi
    node migrate-sqlite-to-postgresql-vps.js
ENDSSH
```

### Metode 2: Migrasi Manual

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    cd ~/deployments/manufacturing-app/server
    
    # Run migrasi
    node migrate-to-postgresql.js
ENDSSH
```

### Apa yang Dilakukan Migrasi?

1. ✅ Membaca semua data dari SQLite
2. ✅ Membuat tabel di PostgreSQL (jika belum ada)
3. ✅ Migrasi data dari SQLite ke PostgreSQL
4. ✅ Verifikasi data yang dimigrasi

### Tabel yang Dimigrasi

- `production_liquid`
- `production_device`
- `production_cartridge`
- `buffer_liquid`, `buffer_device`, `buffer_cartridge`
- `reject_liquid`, `reject_device`, `reject_cartridge`
- `production_combined`
- `production_results`
- `odoo_mo_cache`
- `admin_config`
- `pic_list`

---

## ✅ Verifikasi

### 1. Cek Status Aplikasi

```bash
ssh foom@103.31.39.189 "pm2 status"
```

Pastikan `manufacturing-app` statusnya `online`.

### 2. Cek Logs

```bash
ssh foom@103.31.39.189 "pm2 logs manufacturing-app --lines 50"
```

Cari error terkait database.

### 3. Cek Data di PostgreSQL

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    cd ~/deployments/manufacturing-app/server
    node check-data.js
ENDSSH
```

### 4. Test Health Endpoint

```bash
curl http://103.31.39.189:1234/health
```

Harus return:
```json
{
  "status": "healthy",
  "database": "connected"
}
```

### 5. Test API Endpoints

```bash
# Test login
curl -X POST http://103.31.39.189:1234/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'

# Test production data
curl http://103.31.39.189:1234/api/production/combined
```

---

## 🔙 Rollback (Jika Gagal)

Jika migrasi gagal atau ada masalah, rollback ke SQLite:

### Step 1: Stop Aplikasi

```bash
ssh foom@103.31.39.189 "cd ~/deployments/manufacturing-app/server && pm2 stop manufacturing-app"
```

### Step 2: Restore Database dari Backup

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    cd ~/deployments/manufacturing-app/server
    bash rollback-to-sqlite.sh
ENDSSH
```

Atau manual:

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    # Cari backup terbaru
    LATEST_BACKUP=$(ls -t ~/backups/manufacturing-app/database.sqlite.* | head -1)
    
    # Restore
    cp "$LATEST_BACKUP" ~/deployments/manufacturing-app/server/database.sqlite
    
    # Restore WAL files jika ada
    WAL_BACKUP="${LATEST_BACKUP%-*}-wal.${LATEST_BACKUP##*.}"
    if [ -f "$WAL_BACKUP" ]; then
        cp "$WAL_BACKUP" ~/deployments/manufacturing-app/server/database.sqlite-wal
    fi
ENDSSH
```

### Step 3: Revert Code (Jika Perlu)

Jika perlu revert ke versi SQLite:

```bash
# Git checkout versi sebelumnya
ssh foom@103.31.39.189 "cd ~/deployments/manufacturing-app && git checkout <commit-hash>"
```

### Step 4: Restart Aplikasi

```bash
ssh foom@103.31.39.189 "cd ~/deployments/manufacturing-app/server && pm2 start ecosystem.config.js"
```

---

## 🔧 Troubleshooting

### Error: "Cannot connect to PostgreSQL"

**Penyebab**: PostgreSQL tidak berjalan atau kredensial salah.

**Solusi**:
```bash
# Cek status PostgreSQL
ssh foom@103.31.39.189 "sudo systemctl status postgresql"

# Start PostgreSQL jika tidak berjalan
ssh foom@103.31.39.189 "sudo systemctl start postgresql"

# Cek kredensial di .env
ssh foom@103.31.39.189 "cat ~/deployments/manufacturing-app/server/.env | grep DB_"
```

### Error: "Database does not exist"

**Penyebab**: Database belum dibuat.

**Solusi**:
```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    sudo -u postgres psql << 'PSQL'
        CREATE DATABASE manufacturing_db OWNER admin;
        GRANT ALL PRIVILEGES ON DATABASE manufacturing_db TO admin;
PSQL
ENDSSH
```

### Error: "Permission denied"

**Penyebab**: User tidak punya permission.

**Solusi**:
```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    sudo -u postgres psql -d manufacturing_db << 'PSQL'
        GRANT ALL ON SCHEMA public TO admin;
        GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin;
        GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO admin;
PSQL
ENDSSH
```

### Error: "Table already exists"

**Penyebab**: Tabel sudah ada dari migrasi sebelumnya.

**Solusi**: Ini normal, migrasi akan skip data yang sudah ada (ON CONFLICT DO NOTHING).

### Error: "Application won't start"

**Penyebab**: Database connection error atau code error.

**Solusi**:
```bash
# Cek logs
ssh foom@103.31.39.189 "pm2 logs manufacturing-app --lines 100"

# Test database connection
ssh foom@103.31.39.189 "cd ~/deployments/manufacturing-app/server && node -e \"require('./database').db.testConnection((err, result) => console.log(err || 'OK'))\""
```

### Error: "No data after migration"

**Penyebab**: Data tidak ter-migrasi dengan benar.

**Solusi**:
```bash
# Cek data di PostgreSQL
ssh foom@103.31.39.189 << 'ENDSSH'
    sudo -u postgres psql -d manufacturing_db -c "SELECT COUNT(*) FROM production_liquid;"
    sudo -u postgres psql -d manufacturing_db -c "SELECT COUNT(*) FROM production_device;"
    sudo -u postgres psql -d manufacturing_db -c "SELECT COUNT(*) FROM production_cartridge;"
ENDSSH

# Re-run migrasi jika perlu
ssh foom@103.31.39.189 "cd ~/deployments/manufacturing-app/server && node migrate-sqlite-to-postgresql-vps.js"
```

---

## 📝 Checklist Deployment

Sebelum deployment, pastikan:

- [ ] Backup database sudah dibuat
- [ ] Kode sudah di-commit dan push ke git
- [ ] PostgreSQL sudah terinstall di VPS
- [ ] .env file sudah dikonfigurasi dengan benar
- [ ] Dependencies sudah terinstall
- [ ] Migrasi berhasil tanpa error
- [ ] Aplikasi berjalan dengan status `online`
- [ ] Health endpoint return `healthy`
- [ ] Data terlihat di frontend
- [ ] API endpoints berfungsi

---

## 🎉 Setelah Deployment Berhasil

1. **Monitor aplikasi** selama beberapa jam pertama
2. **Cek logs** secara berkala: `pm2 logs manufacturing-app`
3. **Verifikasi data** masih lengkap
4. **Test semua fitur** di frontend
5. **Backup PostgreSQL** secara berkala

### Backup PostgreSQL Berkala

```bash
# Tambahkan ke crontab
ssh foom@103.31.39.189 << 'ENDSSH'
    # Backup PostgreSQL setiap hari jam 2 pagi
    (crontab -l 2>/dev/null; echo "0 2 * * * pg_dump -h localhost -U admin manufacturing_db > ~/backups/manufacturing-app/postgresql-backup-\$(date +\\%Y\\%m\\%d).sql") | crontab -
ENDSSH
```

---

## 📞 Support

Jika ada masalah:

1. Cek logs: `pm2 logs manufacturing-app`
2. Cek database connection
3. Verifikasi .env configuration
4. Cek PostgreSQL status: `sudo systemctl status postgresql`

---

**Last Updated**: 2026-01-08  
**Version**: 1.0.0
