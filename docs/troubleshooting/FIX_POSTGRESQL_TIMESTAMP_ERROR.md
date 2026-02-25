# 🔧 Fix: PostgreSQL Timestamp Comparison Error

## 🎯 Masalah

Error: `operator does not exist: text >= timestamp with time zone`

Error terjadi karena query membandingkan kolom `create_date` (yang mungkin TEXT setelah migrasi dari SQLite) dengan TIMESTAMP tanpa type casting.

## ⚡ Solusi

Fix sudah dilakukan di `server/index.js` dengan menambahkan type cast `::TIMESTAMP` pada semua query yang membandingkan `create_date` dengan TIMESTAMP.

### Query yang Diperbaiki:

1. **MO List Query** (line ~3871):
   ```sql
   -- Sebelum:
   AND create_date >= NOW() - INTERVAL '7 days'
   
   -- Sesudah:
   AND create_date::TIMESTAMP >= NOW() - INTERVAL '7 days'
   ```

2. **Send MO List Query** (line ~4594):
   ```sql
   -- Sebelum:
   AND create_date >= NOW() - INTERVAL '7 days'
   
   -- Sesudah:
   AND create_date::TIMESTAMP >= NOW() - INTERVAL '7 days'
   ```

3. **Stats Query** (line ~3486, 3506):
   ```sql
   -- Sebelum:
   WHERE create_date >= NOW() - INTERVAL '7 days'
   WHERE create_date < NOW() - INTERVAL '7 days'
   
   -- Sesudah:
   WHERE create_date::TIMESTAMP >= NOW() - INTERVAL '7 days'
   WHERE create_date::TIMESTAMP < NOW() - INTERVAL '7 days'
   ```

4. **Cleanup Query** (line ~3644, 3660, 3670):
   ```sql
   -- Sebelum:
   WHERE create_date < NOW() - INTERVAL '7 days'
   
   -- Sesudah:
   WHERE create_date::TIMESTAMP < NOW() - INTERVAL '7 days'
   ```

5. **Sample Query** (line ~3161, 3174):
   ```sql
   -- Sebelum:
   WHERE create_date < NOW() - INTERVAL '7 days'
   WHERE create_date >= NOW() - INTERVAL '7 days'
   
   -- Sesudah:
   WHERE create_date::TIMESTAMP < NOW() - INTERVAL '7 days'
   WHERE create_date::TIMESTAMP >= NOW() - INTERVAL '7 days'
   ```

## 🔄 Deploy Fix

### Step 1: Update Code di VPS

```bash
# Dari komputer lokal
chmod +x update-from-git.sh
./update-from-git.sh
```

Atau manual:
```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    # Pull dari git
    cd /var/www/manufacturing-process-production-authenticity
    git pull origin main || git pull origin master
    
    # Copy ke running directory
    rsync -av --exclude 'node_modules' --exclude '.git' --exclude 'database.sqlite*' \
        /var/www/manufacturing-process-production-authenticity/ \
        ~/deployments/manufacturing-app/
    
    # Restart aplikasi
    cd ~/deployments/manufacturing-app/server
    pm2 restart manufacturing-app
ENDSSH
```

### Step 2: Verifikasi

```bash
# Test API endpoint
curl http://103.31.39.189:1234/api/odoo/mo-list?productionType=cartridge

# Cek logs
ssh foom@103.31.39.189 "pm2 logs manufacturing-app --lines 20"
```

## 🔍 Alternatif: Fix Database Schema

Jika ingin fix di level database (lebih permanent):

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    PGPASSWORD=Admin123 psql -h localhost -p 5433 -U admin -d manufacturing_db << 'PSQL'
        -- Backup data
        CREATE TABLE odoo_mo_cache_backup AS SELECT * FROM odoo_mo_cache;
        
        -- Convert create_date to TIMESTAMP
        ALTER TABLE odoo_mo_cache 
        ALTER COLUMN create_date TYPE TIMESTAMP USING create_date::TIMESTAMP;
        
        -- Verify
        \d odoo_mo_cache
PSQL
ENDSSH
```

**Note**: Fix di code (dengan `::TIMESTAMP`) lebih aman karena tidak mengubah schema database.

---

**Last Updated**: 2026-01-09
