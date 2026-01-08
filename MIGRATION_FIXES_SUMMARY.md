# 🔧 Summary - Perbaikan Error Migrasi PostgreSQL

## 🐛 Error yang Ditemukan

Saat menjalankan `npm run migrate`, muncul error:

1. **Column missing**: `column "sku_name" of relation "odoo_mo_cache" does not exist`
2. **SQL syntax error**: `syntax error at or near "OR"` 
3. **Frontend putih** - backend error

## ✅ Solusi yang Sudah Diterapkan

### 1. Fixed SQL Syntax SQLite → PostgreSQL (8 locations)

**Before (SQLite):**
```sql
INSERT OR REPLACE INTO admin_config (config_key, config_value) 
VALUES (?, ?)
```

**After (PostgreSQL):**
```sql
INSERT INTO admin_config (config_key, config_value) 
VALUES ($1, $2)
ON CONFLICT (config_key) DO UPDATE SET 
  config_value = $2, updated_at = CURRENT_TIMESTAMP
```

**Files updated:**
- `server/index.js` - Lines ~2753, 2773, 2794, 2815, 2836, 2857, 2906, 4131

### 2. Fixed Date/Time Functions (16 locations)

**Before (SQLite):**
```sql
WHERE datetime(create_date) >= datetime('now', '-7 days')
```

**After (PostgreSQL):**
```sql
WHERE create_date >= NOW() - INTERVAL '7 days'
```

**Files updated:**
- `server/index.js` - All datetime functions converted

### 3. Fixed odoo_mo_cache Table Schema

**Before (incomplete schema):**
```sql
CREATE TABLE odoo_mo_cache (
  id SERIAL PRIMARY KEY,
  mo_number TEXT UNIQUE NOT NULL,
  quantity INTEGER NOT NULL,
  product_name TEXT NOT NULL,  -- ❌ Wrong column name
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

**After (complete schema):**
```sql
CREATE TABLE odoo_mo_cache (
  id SERIAL PRIMARY KEY,
  mo_number TEXT UNIQUE NOT NULL,
  sku_name TEXT NOT NULL,           -- ✅ Correct name
  quantity REAL,                     -- ✅ REAL for decimal
  uom TEXT,                          -- ✅ Added
  note TEXT,                         -- ✅ Added
  create_date TIMESTAMP,             -- ✅ Added
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- ✅ Added
)
```

**Files updated:**
- `server/database.js` - initializeTables()
- `server/migrate-to-postgresql.js` - createPostgreSQLTables()

### 4. Created Fix Schema Script

**New file:** `server/fix-postgresql-schema.js`

Script ini akan:
- ✅ Check struktur table existing
- ✅ Add missing columns
- ✅ Remove old columns
- ✅ Fix data types
- ✅ Verify indexes

## 📦 New Files Created

1. **server/fix-postgresql-schema.js** - Schema repair tool
2. **FIX_ERRORS.md** - Detailed troubleshooting guide
3. **QUICK_FIX.md** - 3-command quick fix
4. **MIGRATION_FIXES_SUMMARY.md** - This file

## 🚀 How to Apply Fixes

### Option 1: Quick Fix (3 Commands)

```bash
cd server
npm run fix:schema    # Fix database schema
npm run test:db       # Test connection
npm start            # Restart app
```

### Option 2: Manual Update

If you're running in production/VPS:

```bash
# 1. Stop aplikasi
pm2 stop manufacturing-server

# 2. Update files
# Upload file-file yang sudah diperbaiki:
# - server/index.js
# - server/database.js
# - server/fix-postgresql-schema.js
# - server/package.json

# 3. Run fix
cd /home/foom/deployments/manufacturing-app/server
npm run fix:schema

# 4. Restart
pm2 restart manufacturing-server
pm2 logs manufacturing-server
```

## ✅ Verification Steps

After applying fixes:

```bash
# 1. Test database
npm run test:db

# Expected output:
# ✅ Connection successful!
# ✅ Found 14/14 tables
# ✅ All tests passed!

# 2. Test health endpoint
curl http://localhost:1234/health

# Expected:
# {"status":"healthy","database":"connected",...}

# 3. Test API endpoints
curl http://localhost:1234/api/pic
curl http://localhost:1234/api/production/liquid

# 4. Check frontend
# Open browser: http://localhost:3000
# Should load properly (not white screen)

# 5. Check scheduler (if enabled)
# Watch logs for "✅ [Scheduler]" messages
# Should NOT see "❌ syntax error at or near OR"
```

## 🔍 What Changed in SQL Queries

### admin_config inserts (7 occurrences)
- ❌ `INSERT OR REPLACE ... VALUES (?)`
- ✅ `INSERT ... ON CONFLICT DO UPDATE ... VALUES ($1)`

### odoo_mo_cache inserts (1 occurrence)
- ❌ `INSERT OR REPLACE ... VALUES (?, ?, ?, ...)`
- ✅ `INSERT ... ON CONFLICT DO UPDATE ... VALUES ($1, $2, $3, ...)`

### Date filtering (16 occurrences)
- ❌ `datetime('now', '-7 days')`
- ✅ `NOW() - INTERVAL '7 days'`

- ❌ `datetime(create_date)`
- ✅ `create_date` (direct comparison)

### Placeholder format (throughout)
- ❌ `VALUES (?, ?, ?)`
- ✅ `VALUES ($1, $2, $3)`

## 📊 Files Modified

| File | Lines Changed | Type |
|------|--------------|------|
| server/index.js | ~30 locations | SQL syntax fixes |
| server/database.js | 1 table schema | Schema update |
| server/migrate-to-postgresql.js | 1 table schema | Schema update |
| server/package.json | 1 script added | New command |
| server/fix-postgresql-schema.js | NEW | Fix tool |

## 🎯 Root Cause Analysis

### Why These Errors Happened:

1. **Incomplete schema migration** - odoo_mo_cache table was defined differently in migration script vs actual usage
2. **SQLite syntax not fully converted** - `INSERT OR REPLACE` is SQLite-specific
3. **Date functions** - `datetime()` is SQLite, PostgreSQL uses different syntax
4. **Placeholder style** - SQLite uses `?`, PostgreSQL uses `$1, $2, etc.`

### Prevention for Future:

- ✅ Created comprehensive test script (`test-postgresql.js`)
- ✅ Added schema validation in migration
- ✅ Created fix tool for schema issues
- ✅ Better documentation of SQL differences

## 📚 References

**PostgreSQL Documentation:**
- INSERT ... ON CONFLICT: https://www.postgresql.org/docs/current/sql-insert.html
- Date/Time Functions: https://www.postgresql.org/docs/current/functions-datetime.html
- Data Types: https://www.postgresql.org/docs/current/datatype.html

**Project Documentation:**
- Full migration guide: `POSTGRESQL_MIGRATION_SUMMARY.md`
- VPS deployment: `VPS_POSTGRESQL_MIGRATION.md`
- Quick reference: `QUICK_START_POSTGRESQL.md`
- Fix guide: `FIX_ERRORS.md`

## 🆘 Still Having Issues?

1. **Check logs:**
   ```bash
   # Development
   # Look at terminal output
   
   # Production
   pm2 logs manufacturing-server
   
   # PostgreSQL
   docker logs manufacturing-postgres
   ```

2. **Verify database:**
   ```bash
   # Connect to database
   psql -U admin -d manufacturing_db
   
   # or
   docker exec -it manufacturing-postgres psql -U admin -d manufacturing_db
   
   # Check table structure
   \d odoo_mo_cache
   
   # Check data
   SELECT COUNT(*) FROM odoo_mo_cache;
   ```

3. **Re-run migration:**
   ```bash
   npm run migrate
   ```

4. **Manual fix:**
   See `FIX_ERRORS.md` for SQL commands

---

**Status**: ✅ All errors identified and fixed  
**Action Required**: Run `npm run fix:schema` then restart  
**Estimated Time**: 2-3 minutes  
**Downtime**: None (if using blue-green deployment)

---

**Last Updated**: 2026-01-08  
**Version**: 1.0.1 (Post-migration fixes)


