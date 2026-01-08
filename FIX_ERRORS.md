# 🔧 Perbaikan Error PostgreSQL

## Error yang Ditemukan:

1. ❌ `column "sku_name" of relation "odoo_mo_cache" does not exist`
2. ❌ `syntax error at or near "OR"` - SQLite syntax belum dikonversi
3. ❌ Frontend putih - backend error

## Solusi:

### Step 1: Update File-file yang Sudah Diperbaiki

File-file berikut sudah diperbaiki dan perlu diupdate:

1. **server/index.js** - Fixed SQL syntax SQLite → PostgreSQL
   - `INSERT OR REPLACE` → `INSERT ... ON CONFLICT ... DO UPDATE`
   - `datetime('now', '-7 days')` → `NOW() - INTERVAL '7 days'`
   - Placeholders `?` → `$1, $2, ...`

2. **server/database.js** - Fixed odoo_mo_cache schema
3. **server/migrate-to-postgresql.js** - Fixed table structure
4. **server/fix-postgresql-schema.js** - NEW: Script untuk fix schema

### Step 2: Jalankan Fix Schema

```bash
cd server

# 1. Fix database schema
npm run fix:schema

# Output yang diharapkan:
# 🔧 Fixing PostgreSQL schema...
# 1. Checking odoo_mo_cache table...
#    ➕ Adding column: sku_name
#    ➕ Adding column: quantity
#    ➕ Adding column: uom
#    ➕ Adding column: note
#    ➕ Adding column: create_date
#    ➕ Adding column: last_updated
# ✅ Schema fixed successfully!
```

### Step 3: Restart Aplikasi

```bash
# Test dulu
npm run test:db

# Jika test OK, restart aplikasi
npm start
```

### Step 4: Verifikasi

```bash
# Test health
curl http://localhost:1234/health

# Expected:
# {"status":"healthy","database":"connected",...}
```

---

## Manual Fix (Jika Script Gagal)

### Fix Schema Manual via psql:

```bash
# Connect to PostgreSQL
psql -U admin -d manufacturing_db

# atau jika menggunakan Docker:
docker exec -it manufacturing-postgres psql -U admin -d manufacturing_db
```

```sql
-- Add missing columns to odoo_mo_cache
ALTER TABLE odoo_mo_cache ADD COLUMN IF NOT EXISTS sku_name TEXT;
ALTER TABLE odoo_mo_cache ADD COLUMN IF NOT EXISTS quantity REAL;
ALTER TABLE odoo_mo_cache ADD COLUMN IF NOT EXISTS uom TEXT;
ALTER TABLE odoo_mo_cache ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE odoo_mo_cache ADD COLUMN IF NOT EXISTS create_date TIMESTAMP;
ALTER TABLE odoo_mo_cache ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Remove old column if exists
ALTER TABLE odoo_mo_cache DROP COLUMN IF EXISTS product_name;

-- Verify structure
\d odoo_mo_cache

-- Exit
\q
```

---

## Troubleshooting

### Error: "relation does not exist"

```bash
# Re-run migration
npm run migrate
```

### Error masih muncul setelah fix

```bash
# 1. Stop aplikasi
# Windows: Ctrl+C
# PM2: pm2 stop all

# 2. Clear cache
rm -rf node_modules/.cache

# 3. Restart
npm start
```

### Frontend masih putih

```bash
# 1. Check backend logs
# Lihat error apa yang muncul

# 2. Check CORS
# Pastikan CORS_ORIGIN di .env benar

# 3. Check network di browser
# Buka Developer Tools → Network
# Lihat request yang gagal

# 4. Test API manual
curl http://localhost:1234/api/health
curl http://localhost:1234/api/pic
```

---

## Verification Checklist

Setelah fix, test semua ini:

- [ ] `npm run test:db` - Database connection OK
- [ ] `curl http://localhost:1234/health` - Health check OK
- [ ] `curl http://localhost:1234/api/pic` - PIC list returns data
- [ ] Frontend loads (no white screen)
- [ ] Dapat login ke admin
- [ ] Dapat input production data
- [ ] Scheduler tidak ada error (check logs)

---

## Quick Command Summary

```bash
# Fix everything
cd server
npm run fix:schema
npm start

# Test
npm run test:db
curl http://localhost:1234/health

# Monitor logs
# Windows PowerShell: Check terminal output
# Linux/PM2: pm2 logs
```

---

## Perubahan SQL Syntax

### Before (SQLite):
```sql
-- Insert or replace
INSERT OR REPLACE INTO admin_config (config_key, config_value) 
VALUES (?, ?)

-- Date arithmetic
WHERE datetime(create_date) >= datetime('now', '-7 days')

-- Placeholders
VALUES (?, ?, ?)
```

### After (PostgreSQL):
```sql
-- Insert with conflict handling
INSERT INTO admin_config (config_key, config_value) 
VALUES ($1, $2)
ON CONFLICT (config_key) DO UPDATE SET config_value = $2

-- Date arithmetic
WHERE create_date >= NOW() - INTERVAL '7 days'

-- Numbered placeholders
VALUES ($1, $2, $3)
```

---

## Contact

Jika masih ada error setelah semua step:
1. Check logs dengan detail
2. Pastikan PostgreSQL running
3. Pastikan environment variables benar
4. Re-run migration jika perlu

**File logs lokasi:**
- Development: Terminal output
- Production/PM2: `pm2 logs manufacturing-server`
- PostgreSQL: `sudo docker logs manufacturing-postgres`


