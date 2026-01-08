# Panduan Mengakses Database dari VPS

Dokumen ini menjelaskan berbagai cara untuk mengakses dan mengeksplorasi database yang tersimpan di VPS.

## 📍 Lokasi Database

Database SQLite disimpan di VPS dengan path:
```
~/deployments/manufacturing-app/server/database.sqlite
```

Atau path lengkap:
```
/home/foom/deployments/manufacturing-app/server/database.sqlite
```

**Catatan:** Path ini mungkin berbeda tergantung konfigurasi deployment Anda. Untuk memastikan path yang benar, jalankan di VPS:
```bash
cd ~/deployments/manufacturing-app/server
pwd
ls -lh database.sqlite*
```

File terkait:
- `database.sqlite` - File database utama
- `database.sqlite-shm` - Shared memory file (WAL mode)
- `database.sqlite-wal` - Write-ahead log file (WAL mode)

---

## 🚀 Metode 1: Mengakses Data Melalui API Endpoints

**Ini adalah cara yang direkomendasikan** karena lebih aman dan tidak memerlukan akses langsung ke server.

### 1.1 API Endpoint: Get Manufacturing Data by MO Number

```bash
curl -X GET "https://yourdomain.com/api/external/manufacturing-data?mo_number=PROD/MO/28204&completed_at=all" \
  -H "X-API-Key: your_api_key_here"
```

**Response:**
```json
{
  "success": true,
  "mo_number": "PROD/MO/28204",
  "data": [
    {
      "production_type": "liquid",
      "sessions": [...],
      "total_sessions": 2,
      "total_authenticity": 100
    }
  ]
}
```

### 1.2 API Endpoint: Get All MO by Date

```bash
curl -X GET "https://yourdomain.com/api/external/manufacturing-data/by-date?completed_at=2024-01-15" \
  -H "X-API-Key: your_api_key_here"
```

### 1.3 API Endpoint: Get Manufacturing Report

```bash
curl -X GET "https://yourdomain.com/api/reports/manufacturing?type=liquid&startDate=2024-01-01&endDate=2024-01-31" \
  -H "X-API-Key: your_api_key_here"
```

### 1.4 Menggunakan Postman

File Postman collection sudah tersedia:
- `odooAPI/API-Report-Authenticity.postman_collection.json`
- `odooAPI/postman-collection.json`

Import ke Postman dan gunakan environment variables:
- `base_url`: URL VPS Anda (contoh: `https://yourdomain.com`)
- `api_key`: API key Anda

---

## 🔧 Metode 2: Akses Langsung ke Database via SSH

Jika Anda memiliki akses SSH ke VPS, Anda dapat mengakses database langsung.

### 2.1 SSH ke VPS

```bash
ssh user@your-vps-ip
```

### 2.2 Install SQLite CLI (jika belum ada)

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install sqlite3

# CentOS/RHEL
sudo yum install sqlite3
```

### 2.3 Akses Database

```bash
# Path yang benar untuk deployment ini:
cd ~/deployments/manufacturing-app/server
sqlite3 database.sqlite

# Atau jika menggunakan path lengkap:
cd /home/foom/deployments/manufacturing-app/server
sqlite3 database.sqlite
```

### 2.4 Query Database

Setelah masuk ke SQLite prompt, Anda bisa menjalankan query:

```sql
-- Lihat semua tabel
.tables

-- Lihat struktur tabel
.schema production_liquid

-- Query data
SELECT * FROM production_liquid LIMIT 10;

-- Query dengan filter
SELECT mo_number, sku_name, created_at 
FROM production_liquid 
WHERE status = 'completed' 
ORDER BY created_at DESC 
LIMIT 20;

-- Hitung total records
SELECT COUNT(*) FROM production_liquid;

-- Export data ke CSV
.headers on
.mode csv
.output production_data.csv
SELECT * FROM production_liquid;
.quit
```

### 2.5 Backup Database

```bash
# Backup database
cd /var/www/manufacturing-api/server
cp database.sqlite database_backup_$(date +%Y%m%d_%H%M%S).sqlite

# Atau gunakan SQLite backup command
sqlite3 database.sqlite ".backup 'database_backup.sqlite'"
```

### 2.6 Download Database ke Local

**Untuk deployment ini (foom@ProductionDashboard):**

```bash
# Dari local machine (Windows PowerShell)
# Ganti ProductionDashboard dengan IP VPS Anda jika berbeda
scp foom@ProductionDashboard:~/deployments/manufacturing-app/server/database.sqlite ./database.sqlite

# Atau menggunakan IP address langsung:
scp foom@103.31.39.189:~/deployments/manufacturing-app/server/database.sqlite ./database.sqlite

# Atau menggunakan path lengkap:
scp foom@103.31.39.189:/home/foom/deployments/manufacturing-app/server/database.sqlite ./database.sqlite
```

**Download semua file database (termasuk WAL files):**

```bash
# Download database utama
scp foom@103.31.39.189:~/deployments/manufacturing-app/server/database.sqlite ./database.sqlite

# Download WAL files (opsional, untuk consistency)
scp foom@103.31.39.189:~/deployments/manufacturing-app/server/database.sqlite-wal ./database.sqlite-wal
scp foom@103.31.39.189:~/deployments/manufacturing-app/server/database.sqlite-shm ./database.sqlite-shm
```

**Menggunakan SFTP client:**
- **WinSCP** (Windows): Connect ke `foom@103.31.39.189`, navigate ke `~/deployments/manufacturing-app/server/`
- **FileZilla**: Gunakan SFTP protocol, connect ke `foom@103.31.39.189`
- **VS Code Remote SSH**: Install extension "Remote - SSH", connect ke VPS, lalu browse ke folder server

---

## 🛠️ Metode 3: Menggunakan Tools untuk Explore Database

### 3.1 SQLite Browser (DB Browser for SQLite)

**Download:** https://sqlitebrowser.org/

**Cara menggunakan:**
1. Download dan install DB Browser for SQLite
2. Download database dari VPS ke local (lihat Metode 2.6)
3. Buka DB Browser for SQLite
4. File → Open Database → Pilih `database.sqlite`
5. Explore data melalui tab "Browse Data" atau jalankan query di tab "Execute SQL"

### 3.2 VS Code Extension: SQLite Viewer

**Install:**
1. Buka VS Code
2. Extensions → Cari "SQLite Viewer" atau "SQLite"
3. Install extension
4. Buka file `database.sqlite` di VS Code
5. Klik kanan → "Open Database"

**Extension yang direkomendasikan:**
- `SQLite Viewer` oleh qwtel
- `SQLite` oleh alexcvzz

### 3.3 Node.js Script untuk Query Database

Script `server/explore-database.js` sudah tersedia di project ini. 

**Cara menggunakan di VPS:**
```bash
# SSH ke VPS
ssh foom@103.31.39.189

# Masuk ke folder server
cd ~/deployments/manufacturing-app/server

# Jalankan script explorer
node explore-database.js --tables
node explore-database.js --stats
node explore-database.js --query "SELECT * FROM production_liquid LIMIT 10"
```

**Atau jika ingin membuat script sendiri:**

```javascript
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    return;
  }
  console.log('Connected to database');
});

// Query example
db.all("SELECT * FROM production_liquid LIMIT 10", (err, rows) => {
  if (err) {
    console.error('Error querying:', err);
    return;
  }
  console.log('Results:', rows);
  db.close();
});
```

**Jalankan:**
```bash
cd server
node explore-database.js
```

### 3.4 Python Script untuk Query Database

Buat file `server/explore_database.py`:

```python
import sqlite3
import json
from datetime import datetime

# Connect to database
conn = sqlite3.connect('database.sqlite')
conn.row_factory = sqlite3.Row  # Return rows as dictionaries
cursor = conn.cursor()

# Query example
cursor.execute("SELECT * FROM production_liquid LIMIT 10")
rows = cursor.fetchall()

# Convert to list of dictionaries
results = [dict(row) for row in rows]
print(json.dumps(results, indent=2, default=str))

conn.close()
```

**Jalankan:**
```bash
cd server
python3 explore_database.py
```

### 3.5 Online SQLite Viewer

Jika Anda sudah download database ke local, Anda bisa menggunakan:
- https://sqliteviewer.app/
- https://inloop.github.io/sqlite-viewer/

**Cara:**
1. Download database dari VPS
2. Upload ke salah satu website di atas
3. Explore database melalui web interface

---

## 📊 Struktur Database

### Tabel yang Tersedia

1. **production_liquid** - Data produksi liquid
2. **production_device** - Data produksi device
3. **production_cartridge** - Data produksi cartridge
4. **api_keys** - API keys untuk autentikasi
5. **config** - Konfigurasi aplikasi
6. **sessions** - Session data

### Schema Tabel Production

```sql
CREATE TABLE production_liquid (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  leader_name TEXT NOT NULL,
  shift_number TEXT NOT NULL,
  pic TEXT NOT NULL,
  mo_number TEXT NOT NULL,
  sku_name TEXT NOT NULL,
  authenticity_data TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);
```

---

## 🔐 Keamanan

### Best Practices

1. **Jangan expose database langsung ke internet**
   - Gunakan API endpoints untuk akses data
   - Jika perlu akses langsung, gunakan SSH tunnel

2. **Backup database secara rutin**
   ```bash
   # Setup cron job untuk backup harian
   # Backup biasanya sudah dikonfigurasi di ~/backups/manufacturing-app/
   0 2 * * * /home/foom/backups/manufacturing-app/backup.sh
   
   # Atau manual backup:
   cd ~/deployments/manufacturing-app/server
   cp database.sqlite ~/backups/manufacturing-app/database_$(date +%Y%m%d_%H%M%S).sqlite
   ```

3. **Gunakan API key untuk akses API**
   - Generate API key melalui halaman Admin
   - Simpan API key dengan aman
   - Jangan commit API key ke repository

4. **Limit akses SSH**
   - Gunakan key-based authentication
   - Disable password authentication
   - Gunakan firewall untuk limit IP yang bisa SSH

---

## 📝 Contoh Query Berguna

### Query 1: Get All Completed MO

```sql
SELECT DISTINCT mo_number, sku_name, production_type, completed_at
FROM (
  SELECT mo_number, sku_name, 'liquid' as production_type, completed_at
  FROM production_liquid
  WHERE status = 'completed'
  UNION ALL
  SELECT mo_number, sku_name, 'device' as production_type, completed_at
  FROM production_device
  WHERE status = 'completed'
  UNION ALL
  SELECT mo_number, sku_name, 'cartridge' as production_type, completed_at
  FROM production_cartridge
  WHERE status = 'completed'
)
ORDER BY completed_at DESC;
```

### Query 2: Get Statistics per Day

```sql
SELECT 
  DATE(completed_at) as date,
  COUNT(DISTINCT mo_number) as total_mo,
  COUNT(*) as total_records
FROM production_liquid
WHERE status = 'completed' AND completed_at IS NOT NULL
GROUP BY DATE(completed_at)
ORDER BY date DESC;
```

### Query 3: Export Data to JSON

```bash
# Di VPS
cd ~/deployments/manufacturing-app/server
sqlite3 database.sqlite <<EOF
.headers on
.mode json
SELECT * FROM production_liquid WHERE status = 'completed' LIMIT 100;
EOF > output.json
```

**Atau menggunakan script explorer:**
```bash
cd ~/deployments/manufacturing-app/server
node explore-database.js --export production_liquid output.json
```

---

## 🆘 Troubleshooting

### Issue: Database locked

```bash
# Stop PM2 processes
pm2 stop manufacturing-app

# Remove lock files
cd ~/deployments/manufacturing-app/server
rm -f database.sqlite-wal
rm -f database.sqlite-shm

# Restart
pm2 restart manufacturing-app
```

### Issue: Permission denied

```bash
# Fix permissions
cd ~/deployments/manufacturing-app/server
chmod 664 database.sqlite
chmod 664 database.sqlite-wal 2>/dev/null || true
chmod 664 database.sqlite-shm 2>/dev/null || true
```

### Issue: Database corrupted

```bash
# Check database integrity
cd ~/deployments/manufacturing-app/server
sqlite3 database.sqlite "PRAGMA integrity_check;"

# If corrupted, restore from backup
# Cek backup di ~/backups/manufacturing-app/
ls -lh ~/backups/manufacturing-app/
cp ~/backups/manufacturing-app/database_YYYYMMDD_HHMMSS.sqlite database.sqlite
```

---

## 📚 Referensi

- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [DB Browser for SQLite](https://sqlitebrowser.org/)
- [API Documentation](./API_DOCUMENTATION.md)
- [VPS Deployment Guide](./VPS_DEPLOYMENT_GUIDE.md)

---

## 💡 Tips

1. **Gunakan API endpoints** untuk akses data dari aplikasi external
2. **Gunakan SQLite tools** untuk analisis data dan debugging
3. **Backup database secara rutin** sebelum melakukan perubahan besar
4. **Monitor ukuran database** - SQLite bisa menjadi besar jika tidak di-maintain
5. **Gunakan VACUUM** secara berkala untuk optimize database:
   ```bash
   cd ~/deployments/manufacturing-app/server
   sqlite3 database.sqlite "VACUUM;"
   ```

