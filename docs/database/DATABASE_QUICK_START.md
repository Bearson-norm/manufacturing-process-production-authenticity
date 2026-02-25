# Quick Start: Akses Database dari VPS

## 🚀 Cara Cepat

### 1. Via API (Paling Mudah)

```bash
# Dapatkan data manufacturing
curl -X GET "https://yourdomain.com/api/external/manufacturing-data?mo_number=PROD/MO/28204" \
  -H "X-API-Key: your_api_key"

# Dapatkan semua MO per tanggal
curl -X GET "https://yourdomain.com/api/external/manufacturing-data/by-date?completed_at=2024-01-15" \
  -H "X-API-Key: your_api_key"
```

### 2. Via SSH + SQLite CLI

```bash
# SSH ke VPS
ssh foom@103.31.39.189
# Atau jika menggunakan hostname:
ssh foom@ProductionDashboard

# Akses database
cd ~/deployments/manufacturing-app/server
sqlite3 database.sqlite

# Query
SELECT * FROM production_liquid LIMIT 10;
.quit
```

### 3. Download Database ke Local

```bash
# Windows PowerShell
# Ganti dengan IP atau hostname VPS Anda
scp foom@103.31.39.189:~/deployments/manufacturing-app/server/database.sqlite ./database.sqlite

# Atau menggunakan hostname (jika sudah dikonfigurasi):
scp foom@ProductionDashboard:~/deployments/manufacturing-app/server/database.sqlite ./database.sqlite

# Lalu buka dengan DB Browser for SQLite atau VS Code SQLite extension
```

### 4. Menggunakan Script Explorer (di VPS)

```bash
# SSH ke VPS
ssh foom@103.31.39.189
cd ~/deployments/manufacturing-app/server

# List semua tabel
npm run db:tables

# Lihat statistik
npm run db:stats

# Query custom
node explore-database.js --query "SELECT * FROM production_liquid LIMIT 10"

# Export ke JSON
node explore-database.js --export production_liquid output.json
```

## 📦 Tools yang Bisa Digunakan

1. **DB Browser for SQLite** (Desktop App)
   - Download: https://sqlitebrowser.org/
   - Cocok untuk: Visual browsing dan editing

2. **VS Code Extension: SQLite Viewer**
   - Install extension "SQLite Viewer" di VS Code
   - Cocok untuk: Developer yang sudah pakai VS Code

3. **Online SQLite Viewer**
   - https://sqliteviewer.app/
   - Cocok untuk: Quick view tanpa install

4. **Postman** (untuk API)
   - Import collection dari `odooAPI/`
   - Cocok untuk: Testing API endpoints

## 📚 Dokumentasi Lengkap

Lihat [DATABASE_ACCESS_GUIDE.md](./DATABASE_ACCESS_GUIDE.md) untuk panduan lengkap.

