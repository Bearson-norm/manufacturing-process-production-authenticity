# Migration dari SQLite ke PostgreSQL

## Prasyarat

1. **Install PostgreSQL**
   - Download dan install PostgreSQL dari https://www.postgresql.org/download/
   - Atau gunakan Docker: `docker run --name postgres -e POSTGRES_PASSWORD=Admin123 -p 5432:5432 -d postgres`

2. **Buat Database dan User**
   ```bash
   # Login ke PostgreSQL
   psql -U postgres
   
   # Buat user admin
   CREATE USER admin WITH PASSWORD 'Admin123';
   
   # Buat database
   CREATE DATABASE manufacturing_db;
   
   # Berikan akses ke user
   GRANT ALL PRIVILEGES ON DATABASE manufacturing_db TO admin;
   
   # Login ke database yang baru dibuat
   \c manufacturing_db
   
   # Berikan akses schema
   GRANT ALL ON SCHEMA public TO admin;
   GRANT ALL ON ALL TABLES IN SCHEMA public TO admin;
   GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO admin;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO admin;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO admin;
   
   # Keluar
   \q
   ```

## Langkah-langkah Migrasi

### 1. Install Dependencies

```bash
cd server
npm install
```

Package `pg` (PostgreSQL driver) sudah ditambahkan ke `package.json` menggantikan `sqlite3`.

### 2. Konfigurasi Environment

Buat file `.env` di folder `server/`:

```bash
# Server Configuration
NODE_ENV=development
PORT=1234

# Database Configuration - PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=manufacturing_db
DB_USER=admin
DB_PASSWORD=Admin123
DB_POOL_MAX=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000

# CORS Configuration
CORS_ORIGIN=*

# Logging
LOG_LEVEL=info

# Application Settings
APP_NAME=Manufacturing Process Production Authenticity
APP_VERSION=1.0.0
```

### 3. Migrasi Data dari SQLite (Opsional)

Jika Anda memiliki data di SQLite yang ingin dipindahkan:

```bash
cd server
node migrate-to-postgresql.js
```

Script ini akan:
- Membaca semua data dari `database.sqlite`
- Membuat tabel di PostgreSQL
- Mengimpor semua data ke PostgreSQL

**Note:** Jika Anda memulai dari awal (tanpa data SQLite), langkah ini bisa dilewati. Server akan otomatis membuat tabel saat pertama kali dijalankan.

### 4. Jalankan Server

```bash
cd server
npm start
```

Atau untuk development dengan auto-reload:

```bash
npm run dev
```

### 5. Verifikasi

Cek health endpoint:

```bash
curl http://localhost:1234/health
```

Response yang baik:
```json
{
  "status": "healthy",
  "database": "connected",
  "uptime": 10.5,
  "timestamp": "2026-01-08T..."
}
```

## Perubahan Teknis

### Yang Berubah:

1. **Database Driver**
   - SQLite3 → PostgreSQL (pg)
   
2. **Tipe Data**
   - `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`
   - `DATETIME` → `TIMESTAMP`
   
3. **Query Metadata**
   - `sqlite_master` → `information_schema.tables`

4. **Connection Pool**
   - PostgreSQL menggunakan connection pooling built-in untuk performa lebih baik

5. **Konfigurasi**
   - File config.js diupdate untuk PostgreSQL
   - Environment variables berubah

### Yang Tidak Berubah:

1. **API Endpoints** - Semua endpoint tetap sama
2. **Request/Response Format** - Format data tidak berubah
3. **Business Logic** - Logika aplikasi tetap sama
4. **Client Application** - Tidak perlu perubahan di client

## Troubleshooting

### Error: "Connection refused"

- Pastikan PostgreSQL sudah berjalan
- Cek koneksi: `psql -U admin -d manufacturing_db -h localhost`

### Error: "Authentication failed"

- Pastikan password di `.env` sesuai dengan password PostgreSQL
- Cek file `pg_hba.conf` untuk authentication method

### Error: "Database does not exist"

- Buat database terlebih dahulu (lihat langkah Prasyarat)

### Error: "Permission denied"

- Pastikan user `admin` memiliki semua privilege (lihat langkah Prasyarat)

### Melihat Log PostgreSQL

```bash
# Windows
C:\Program Files\PostgreSQL\<version>\data\log\

# Linux/Mac
/var/log/postgresql/
```

## Rollback ke SQLite (Jika Diperlukan)

Jika ingin kembali ke SQLite:

1. Install ulang sqlite3:
   ```bash
   npm install sqlite3@^5.1.6
   npm uninstall pg
   ```

2. Restore file `index.js` dan `config.js` dari git:
   ```bash
   git checkout HEAD -- index.js config.js package.json
   ```

3. Hapus file-file migrasi:
   ```bash
   rm database.js migrate-to-postgresql.js
   ```

## Keuntungan PostgreSQL

1. **Concurrent Access** - Lebih baik untuk multiple users
2. **Data Integrity** - ACID compliance lebih kuat
3. **Scalability** - Dapat handle dataset lebih besar
4. **Performance** - Indexing dan query optimization lebih baik
5. **Production Ready** - Lebih cocok untuk production environment
6. **Advanced Features** - JSON support, full-text search, dll

## Monitoring & Maintenance

### Check Connection Pool

```sql
SELECT * FROM pg_stat_activity WHERE datname = 'manufacturing_db';
```

### Check Table Sizes

```sql
SELECT 
  table_name,
  pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as size
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY pg_total_relation_size(quote_ident(table_name)) DESC;
```

### Backup Database

```bash
pg_dump -U admin -d manufacturing_db -F c -f backup_$(date +%Y%m%d).dump
```

### Restore Database

```bash
pg_restore -U admin -d manufacturing_db -c backup_20260108.dump
```

## Support

Jika ada masalah dengan migrasi, silakan buka issue di GitHub repository atau hubungi tim development.


