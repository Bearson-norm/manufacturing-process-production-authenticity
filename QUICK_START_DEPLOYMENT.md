# 🚀 Quick Start: Deployment ke VPS

Panduan cepat untuk mengupdate sistem dari SQLite ke PostgreSQL di VPS.

---

## ⚡ Deployment Cepat (5 Menit)

### Step 1: Backup Database

```bash
ssh foom@103.31.39.189 "cd ~/deployments/manufacturing-app/server && bash backup-database-vps.sh"
```

### Step 2: Deploy

```bash
# Dari komputer lokal
chmod +x deploy-to-vps.sh
./deploy-to-vps.sh
```

**Selesai!** Script akan otomatis:
- ✅ Backup database
- ✅ Stop aplikasi
- ✅ Upload kode baru
- ✅ Install PostgreSQL (jika belum ada)
- ✅ Install dependencies
- ✅ Migrasi database
- ✅ Build client
- ✅ Start aplikasi

---

## 📋 Manual Step-by-Step (Jika Perlu)

### 1. Stop Aplikasi

```bash
ssh foom@103.31.39.189 "cd ~/deployments/manufacturing-app/server && pm2 stop manufacturing-app"
```

### 2. Backup Database

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    mkdir -p ~/backups/manufacturing-app
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    cp ~/deployments/manufacturing-app/server/database.sqlite ~/backups/manufacturing-app/database.sqlite.$TIMESTAMP
    echo "✅ Backup created"
ENDSSH
```

### 3. Upload Kode

```bash
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'database.sqlite*' \
    ./ foom@103.31.39.189:~/deployments/manufacturing-app/
```

### 4. Install PostgreSQL

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    sudo apt-get update
    sudo apt-get install -y postgresql postgresql-contrib
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
    
    sudo -u postgres psql << 'PSQL'
        CREATE USER admin WITH PASSWORD 'Admin123';
        CREATE DATABASE manufacturing_db OWNER admin;
        GRANT ALL PRIVILEGES ON DATABASE manufacturing_db TO admin;
        \c manufacturing_db
        GRANT ALL ON SCHEMA public TO admin;
PSQL
ENDSSH
```

### 5. Setup .env

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    cd ~/deployments/manufacturing-app/server
    if [ ! -f .env ]; then
        cp env.example .env
    fi
    # Edit .env jika perlu (default sudah benar)
ENDSSH
```

### 6. Install Dependencies

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

### 7. Migrasi Database

```bash
ssh foom@103.31.39.189 "cd ~/deployments/manufacturing-app/server && node migrate-sqlite-to-postgresql-vps.js"
```

### 8. Build Client

```bash
ssh foom@103.31.39.189 "cd ~/deployments/manufacturing-app/client && npm run build"
```

### 9. Start Aplikasi

```bash
ssh foom@103.31.39.189 "cd ~/deployments/manufacturing-app/server && pm2 start ecosystem.config.js"
```

### 10. Verifikasi

```bash
# Cek status
ssh foom@103.31.39.189 "pm2 status"

# Cek health
curl http://103.31.39.189:1234/health

# Cek data
ssh foom@103.31.39.189 "cd ~/deployments/manufacturing-app/server && node check-data.js"
```

---

## 🔙 Rollback (Jika Gagal)

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    cd ~/deployments/manufacturing-app/server
    pm2 stop manufacturing-app
    
    # Restore dari backup terbaru
    LATEST_BACKUP=$(ls -t ~/backups/manufacturing-app/database.sqlite.* | head -1)
    cp "$LATEST_BACKUP" ~/deployments/manufacturing-app/server/database.sqlite
    
    # Restart (perlu revert code ke versi SQLite dulu)
    pm2 start ecosystem.config.js
ENDSSH
```

---

## ✅ Checklist

- [ ] Backup database dibuat
- [ ] PostgreSQL terinstall
- [ ] .env dikonfigurasi
- [ ] Dependencies terinstall
- [ ] Migrasi berhasil
- [ ] Aplikasi running
- [ ] Health check OK
- [ ] Data terlihat

---

**Untuk detail lengkap, lihat**: `VPS_DEPLOYMENT_GUIDE.md`
