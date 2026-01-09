# 🔄 Panduan Update Sistem di VPS

Panduan untuk mengupdate sistem di VPS dengan struktur:
- **Git Repository**: `/var/www/manufacturing-process-production-authenticity/`
- **Running App**: `~/deployments/manufacturing-app/server`

---

## ⚡ Quick Update (Recommended)

### Metode 1: Update dari Git Repository

```bash
# Dari komputer lokal, push code ke git dulu
git add .
git commit -m "Update system"
git push origin main  # atau master

# Deploy dari git ke VPS
chmod +x deploy-from-git.sh
./deploy-from-git.sh
```

### Metode 2: Update Manual di VPS

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    # 1. Pull dari git
    cd /var/www/manufacturing-process-production-authenticity
    git pull origin main || git pull origin master
    
    # 2. Copy ke running directory
    rsync -av --exclude 'node_modules' --exclude '.git' --exclude 'database.sqlite*' \
        /var/www/manufacturing-process-production-authenticity/ \
        ~/deployments/manufacturing-app/
    
    # 3. Install dependencies
    cd ~/deployments/manufacturing-app/server
    npm install
    
    cd ~/deployments/manufacturing-app/client
    npm install
    
    # 4. Build client
    cd ~/deployments/manufacturing-app/client
    npm run build
    
    # 5. Restart aplikasi
    cd ~/deployments/manufacturing-app/server
    pm2 restart manufacturing-app
ENDSSH
```

---

## 📋 Step-by-Step Update Manual

### Step 1: Pull dari Git Repository

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    cd /var/www/manufacturing-process-production-authenticity
    
    # Pull latest changes
    git pull origin main || git pull origin master
    
    # Verify
    git log -1 --oneline
ENDSSH
```

### Step 2: Backup Database (Jika Perlu)

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    mkdir -p ~/backups/manufacturing-app
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    
    # Backup PostgreSQL
    PGPASSWORD=Admin123 pg_dump -h localhost -p 5433 -U admin manufacturing_db > \
        ~/backups/manufacturing-app/postgresql-backup-$TIMESTAMP.sql
    
    echo "✅ Backup created: postgresql-backup-$TIMESTAMP.sql"
ENDSSH
```

### Step 3: Stop Aplikasi

```bash
ssh foom@103.31.39.189 "cd ~/deployments/manufacturing-app/server && pm2 stop manufacturing-app"
```

### Step 4: Copy Code dari Git ke Running Directory

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    # Copy dari git repo ke running directory
    rsync -av --exclude 'node_modules' --exclude '.git' --exclude 'database.sqlite*' \
        /var/www/manufacturing-process-production-authenticity/ \
        ~/deployments/manufacturing-app/
    
    echo "✅ Code updated"
ENDSSH
```

### Step 5: Install Dependencies

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    # Server dependencies
    cd ~/deployments/manufacturing-app/server
    npm install
    
    # Client dependencies
    cd ~/deployments/manufacturing-app/client
    npm install
ENDSSH
```

### Step 6: Setup .env (Jika Ada Perubahan)

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    cd ~/deployments/manufacturing-app/server
    
    # Pastikan .env ada
    if [ ! -f .env ]; then
        cp env.example .env
    fi
    
    # Pastikan DB_PORT=5433
    sed -i 's/^DB_PORT=.*/DB_PORT=5433/' .env || echo "DB_PORT=5433" >> .env
    
    # Verify
    echo "=== Current .env DB Settings ==="
    grep "^DB_" .env
ENDSSH
```

### Step 7: Run Migration (Jika Ada Perubahan Database Schema)

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    cd ~/deployments/manufacturing-app/server
    
    # Hanya jika ada perubahan schema
    # node migrate-to-postgresql.js
    
    # Atau fix specific table jika perlu
    # node fix-production-results-simple.js
ENDSSH
```

### Step 8: Build Client

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    cd ~/deployments/manufacturing-app/client
    npm run build
ENDSSH
```

### Step 9: Start Aplikasi

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    cd ~/deployments/manufacturing-app/server
    pm2 restart manufacturing-app || pm2 start ecosystem.config.js
    pm2 save
    
    # Show status
    pm2 status
ENDSSH
```

### Step 10: Verifikasi

```bash
# Test health endpoint
ssh foom@103.31.39.189 "curl http://localhost:1234/health"

# Cek logs
ssh foom@103.31.39.189 "pm2 logs manufacturing-app --lines 30"
```

---

## 🔄 Script Update Otomatis

### Buat Script: `update-from-git.sh`

```bash
#!/bin/bash
# Script untuk update dari git repository ke running directory

set -e

VPS_USER="foom"
VPS_HOST="103.31.39.189"
GIT_REPO="/var/www/manufacturing-process-production-authenticity"
DEPLOY_PATH="~/deployments/manufacturing-app"

echo "🔄 Updating system from git repository..."

ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
    # 1. Pull dari git
    cd /var/www/manufacturing-process-production-authenticity
    echo "📥 Pulling from git..."
    git pull origin main || git pull origin master
    
    # 2. Stop aplikasi
    echo "🛑 Stopping application..."
    cd ~/deployments/manufacturing-app/server
    pm2 stop manufacturing-app || true
    
    # 3. Copy ke running directory
    echo "📋 Copying files..."
    rsync -av --exclude 'node_modules' --exclude '.git' --exclude 'database.sqlite*' \
        /var/www/manufacturing-process-production-authenticity/ \
        ~/deployments/manufacturing-app/
    
    # 4. Install dependencies
    echo "📦 Installing dependencies..."
    cd ~/deployments/manufacturing-app/server
    npm install
    
    cd ~/deployments/manufacturing-app/client
    npm install
    
    # 5. Build client
    echo "🏗️  Building client..."
    npm run build
    
    # 6. Restart aplikasi
    echo "🚀 Restarting application..."
    cd ~/deployments/manufacturing-app/server
    pm2 restart manufacturing-app || pm2 start ecosystem.config.js
    pm2 save
    
    echo "✅ Update completed!"
ENDSSH

echo ""
echo "✅ System updated successfully!"
```

### Cara Pakai:

```bash
# Dari komputer lokal
chmod +x update-from-git.sh
./update-from-git.sh
```

---

## 📋 Update Checklist

Sebelum update:
- [ ] Code sudah di-commit dan push ke git
- [ ] Backup database (jika perlu)
- [ ] Test di local/development dulu (jika memungkinkan)

Saat update:
- [ ] Pull dari git repository
- [ ] Copy ke running directory
- [ ] Install dependencies
- [ ] Setup .env (jika ada perubahan)
- [ ] Run migration (jika ada perubahan schema)
- [ ] Build client
- [ ] Restart aplikasi

Setelah update:
- [ ] Verifikasi aplikasi running
- [ ] Test health endpoint
- [ ] Cek logs untuk error
- [ ] Test fitur utama

---

## 🔄 Update Tanpa Downtime (Zero-Downtime)

Untuk update tanpa downtime:

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    # 1. Pull dan copy (aplikasi masih running)
    cd /var/www/manufacturing-process-production-authenticity
    git pull origin main
    
    rsync -av --exclude 'node_modules' --exclude '.git' --exclude 'database.sqlite*' \
        /var/www/manufacturing-process-production-authenticity/ \
        ~/deployments/manufacturing-app/
    
    # 2. Install dependencies
    cd ~/deployments/manufacturing-app/server
    npm install
    
    cd ~/deployments/manufacturing-app/client
    npm install && npm run build
    
    # 3. Graceful restart (PM2 akan restart dengan zero downtime jika cluster mode)
    cd ~/deployments/manufacturing-app/server
    pm2 reload manufacturing-app
ENDSSH
```

**Note**: PM2 cluster mode akan melakukan rolling restart (restart satu instance per waktu).

---

## 🆘 Rollback (Jika Update Gagal)

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    # 1. Revert ke commit sebelumnya
    cd /var/www/manufacturing-process-production-authenticity
    git log --oneline -5  # Lihat commit history
    git checkout <previous-commit-hash>
    
    # 2. Copy ke running directory
    rsync -av --exclude 'node_modules' --exclude '.git' --exclude 'database.sqlite*' \
        /var/www/manufacturing-process-production-authenticity/ \
        ~/deployments/manufacturing-app/
    
    # 3. Restart
    cd ~/deployments/manufacturing-app/server
    pm2 restart manufacturing-app
ENDSSH
```

---

## 🎯 Quick Update Command

```bash
# All-in-one update
ssh foom@103.31.39.189 << 'ENDSSH'
    cd /var/www/manufacturing-process-production-authenticity && \
    git pull origin main && \
    rsync -av --exclude 'node_modules' --exclude '.git' --exclude 'database.sqlite*' \
        /var/www/manufacturing-process-production-authenticity/ \
        ~/deployments/manufacturing-app/ && \
    cd ~/deployments/manufacturing-app/server && npm install && \
    cd ~/deployments/manufacturing-app/client && npm install && npm run build && \
    cd ~/deployments/manufacturing-app/server && pm2 restart manufacturing-app
ENDSSH
```

---

**Last Updated**: 2026-01-08
