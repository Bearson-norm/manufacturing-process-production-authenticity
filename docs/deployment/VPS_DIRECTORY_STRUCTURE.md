# 📁 Struktur Direktori di VPS

Dokumen ini menjelaskan struktur direktori di VPS dan workflow deployment.

---

## 📂 Struktur Direktori

### 1. Git Repository
**Path**: `/var/www/manufacturing-process-production-authenticity`

**Fungsi**:
- Menyimpan source code dari git repository
- Direktori untuk version control
- Tidak digunakan langsung untuk menjalankan aplikasi

**Isi**:
```
/var/www/manufacturing-process-production-authenticity/
├── .git/                    # Git repository
├── server/                  # Server code
├── client/                  # Client code
├── package.json
└── ...
```

### 2. Running Application Directory
**Path**: `~/deployments/manufacturing-app` (atau `/home/foom/deployments/manufacturing-app`)

**Fungsi**:
- Direktori untuk aplikasi yang sedang berjalan
- Di-manage oleh PM2
- Berisi database SQLite (sebelum migrasi)

**Isi**:
```
~/deployments/manufacturing-app/
├── server/
│   ├── index.js
│   ├── database.sqlite      # SQLite database (sebelum migrasi)
│   ├── .env                 # Environment variables
│   ├── node_modules/
│   └── ...
├── client/
│   ├── build/               # Built frontend
│   ├── node_modules/
│   └── ...
└── package.json
```

---

## 🔄 Workflow Deployment

### Workflow 1: Deploy dari Git Repository (Recommended)

```
1. Push code ke git repository (dari lokal)
   ↓
2. SSH ke VPS
   ↓
3. Pull dari git repo: cd /var/www/manufacturing-process-production-authenticity && git pull
   ↓
4. Copy ke running directory: rsync dari git repo ke ~/deployments/manufacturing-app
   ↓
5. Install dependencies, migrasi, build, restart
```

**Script**: `deploy-from-git.sh`

### Workflow 2: Deploy Langsung dari Lokal

```
1. Upload code langsung ke running directory (dari lokal)
   ↓
2. (Optional) Update git repo juga
   ↓
3. Install dependencies, migrasi, build, restart
```

**Script**: `deploy-to-vps.sh`

---

## 🚀 Cara Menggunakan

### Deploy dari Git Repository

```bash
# Script akan:
# 1. Pull dari /var/www/manufacturing-process-production-authenticity
# 2. Copy ke ~/deployments/manufacturing-app
# 3. Deploy seperti biasa

./deploy-from-git.sh
```

### Deploy Langsung dari Lokal

```bash
# Script akan:
# 1. Upload langsung ke ~/deployments/manufacturing-app
# 2. (Optional) Update git repo juga

./deploy-to-vps.sh          # Direct upload
./deploy-to-vps.sh git      # Pull from git lalu copy
```

---

## 📋 Manual Deployment

### Step-by-Step Manual

#### 1. Update Git Repository

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    cd /var/www/manufacturing-process-production-authenticity
    git pull origin main || git pull origin master
ENDSSH
```

#### 2. Copy ke Running Directory

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    rsync -av --exclude 'node_modules' --exclude '.git' --exclude 'database.sqlite*' \
        /var/www/manufacturing-process-production-authenticity/ \
        ~/deployments/manufacturing-app/
ENDSSH
```

#### 3. Install Dependencies & Deploy

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    cd ~/deployments/manufacturing-app/server
    npm install
    
    cd ~/deployments/manufacturing-app/client
    npm install && npm run build
    
    cd ~/deployments/manufacturing-app/server
    pm2 restart manufacturing-app
ENDSSH
```

---

## 🔍 Verifikasi Struktur

### Cek Git Repository

```bash
ssh foom@103.31.39.189 "ls -la /var/www/manufacturing-process-production-authenticity"
```

### Cek Running Directory

```bash
ssh foom@103.31.39.189 "ls -la ~/deployments/manufacturing-app/server"
```

### Cek PM2 Process

```bash
ssh foom@103.31.39.189 "pm2 list"
ssh foom@103.31.39.189 "pm2 info manufacturing-app"
```

PM2 seharusnya menjalankan dari: `~/deployments/manufacturing-app/server/index.js`

---

## ⚠️ Important Notes

1. **Database Location**: 
   - SQLite: `~/deployments/manufacturing-app/server/database.sqlite`
   - PostgreSQL: `localhost:5432/manufacturing_db`

2. **Environment Variables**:
   - File `.env` ada di: `~/deployments/manufacturing-app/server/.env`

3. **Logs**:
   - PM2 logs: `~/deployments/manufacturing-app/server/logs/`
   - Check: `pm2 logs manufacturing-app`

4. **Backup**:
   - Backup SQLite: `~/backups/manufacturing-app/`

---

## 🎯 Best Practices

1. **Selalu deploy dari git repository** untuk production
2. **Backup database** sebelum deployment
3. **Test di staging** sebelum production (jika ada)
4. **Monitor logs** setelah deployment
5. **Verifikasi** aplikasi berjalan dengan benar

---

**Last Updated**: 2026-01-08  
**Version**: 1.0.0
