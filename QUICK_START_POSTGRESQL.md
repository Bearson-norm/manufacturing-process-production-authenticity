# 🚀 Quick Start - PostgreSQL Migration

## Setup PostgreSQL (Pilih salah satu):

### Option 1: Docker (Recommended - Tercepat)
```bash
docker run --name manufacturing-postgres \
  -e POSTGRES_USER=admin \
  -e POSTGRES_PASSWORD=Admin123 \
  -e POSTGRES_DB=manufacturing_db \
  -p 5432:5432 \
  -d postgres:15

# Verify running
docker ps
```

### Option 2: Install Manual
```bash
# Download dari: https://www.postgresql.org/download/

# Setelah install, buat database:
psql -U postgres
CREATE USER admin WITH PASSWORD 'Admin123';
CREATE DATABASE manufacturing_db OWNER admin;
\c manufacturing_db
GRANT ALL ON SCHEMA public TO admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO admin;
\q
```

## Setup Project

```bash
# 1. Install dependencies
cd server
npm install

# 2. Buat file .env (copy dari env.example)
# Edit jika perlu sesuaikan credentials

# 3. (Opsional) Migrasi data dari SQLite
npm run migrate

# 4. Test koneksi
npm run test:db

# 5. Jalankan server
npm start
```

## Verify

```bash
# Test health endpoint
curl http://localhost:1234/health

# Expected: {"status":"healthy","database":"connected",...}
```

## Commands

```bash
npm start           # Start server
npm run dev         # Development dengan auto-reload
npm run migrate     # Migrasi data dari SQLite ke PostgreSQL
npm run test:db     # Test database connection
```

## Credentials

- **Host**: localhost
- **Port**: 5432
- **Database**: manufacturing_db
- **User**: admin
- **Password**: Admin123

## Files

- `server/database.js` - Database wrapper module
- `server/migrate-to-postgresql.js` - Migration script
- `server/test-postgresql.js` - Test script
- `POSTGRESQL_MIGRATION_SUMMARY.md` - Full documentation
- `server/MIGRATION_TO_POSTGRESQL.md` - Detailed guide

## Troubleshooting

**Can't connect?**
```bash
# Check PostgreSQL is running
docker ps  # if using Docker
# or
Get-Service postgresql*  # Windows
```

**Permission error?**
```sql
psql -U postgres -d manufacturing_db
GRANT ALL ON SCHEMA public TO admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO admin;
```

**Need to rollback?**
See `POSTGRESQL_MIGRATION_SUMMARY.md` section "Rollback ke SQLite"

---
✅ Ready to go! Start with: `cd server && npm install && npm start`


