# 🚀 Quick Start: Deployment ke VPS

Panduan cepat untuk mengupdate sistem dari SQLite ke PostgreSQL di VPS.

---

## ⚡ Deployment Cepat (5 Menit)

### Struktur Direktori di VPS

- **Git Repository**: `/var/www/manufacturing-process-production-authenticity`
- **Running App**: `~/deployments/manufacturing-app/server`

### Opsi 1: Deploy dari Git Repository (Recommended)

```bash
# Dari komputer lokal
chmod +x deploy-from-git.sh
./deploy-from-git.sh
```

**Selesai!** Script akan otomatis:
- ✅ Backup database
- ✅ Stop aplikasi
- ✅ Pull dari git repo (`/var/www/manufacturing-process-production-authenticity`)
- ✅ Copy ke running directory (`~/deployments/manufacturing-app`)
- ✅ Install PostgreSQL (jika belum ada)
- ✅ Install dependencies
- ✅ Migrasi database
- ✅ Build client
- ✅ Start aplikasi

### Opsi 2: Deploy Langsung dari Lokal

```bash
# Step 1: Backup Database
ssh foom@103.31.39.189 "cd ~/deployments/manufacturing-app/server && bash backup-database-vps.sh"

# Step 2: Deploy
chmod +x deploy-to-vps.sh
./deploy-to-vps.sh          # Direct upload
# atau
./deploy-to-vps.sh git      # Pull from git repo lalu copy
```

---

## 📋 Manual Step-by-Step (Jika Perlu)

### 1. Setup .env File

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    cd ~/deployments/manufacturing-app/server
    
    # Pastikan .env ada dan benar
    if [ ! -f .env ]; then
        cp env.example .env
    fi
    
    # Update DB_PORT ke 5433 (PostgreSQL running di port 5433)
    sed -i 's/^DB_PORT=.*/DB_PORT=5433/' .env || echo "DB_PORT=5433" >> .env
    
    # Verify
    cat .env | grep DB_
ENDSSH
```

### 2. Test PostgreSQL Connection

```bash
ssh foom@103.31.39.189 "PGPASSWORD=Admin123 psql -h localhost -p 5433 -U admin -d manufacturing_db -c 'SELECT 1;'"
```

### 3. Stop Aplikasi

```bash
ssh foom@103.31.39.189 "cd ~/deployments/manufacturing-app/server && pm2 stop manufacturing-app || true"
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

### 3. Update Kode

**Opsi A: Dari Git Repository**
```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    cd /var/www/manufacturing-process-production-authenticity
    git pull origin main || git pull origin master
    
    # Copy ke running directory
    rsync -av --exclude 'node_modules' --exclude '.git' --exclude 'database.sqlite*' \
        /var/www/manufacturing-process-production-authenticity/ ~/deployments/manufacturing-app/
ENDSSH
```

**Opsi B: Upload Langsung dari Lokal**
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
