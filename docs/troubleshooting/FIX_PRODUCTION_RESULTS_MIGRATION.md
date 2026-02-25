# 🔧 Fix: Production Results Migration Error

## 🎯 Masalah

Error: `column "quantity" of relation "production_results" does not exist`

Schema di script migrasi tidak sesuai dengan data SQLite.

## ⚡ Solusi: Fix Table dan Re-migrate

### Step 1: Fix Table Schema (Add Missing Columns)

```bash
cd ~/deployments/manufacturing-app/server

PGPASSWORD=Admin123 psql -h localhost -p 5433 -U admin -d manufacturing_db << 'PSQL'
    -- Add quantity column if not exists
    ALTER TABLE production_results ADD COLUMN IF NOT EXISTS quantity REAL;
    
    -- Add synced_at column if not exists
    ALTER TABLE production_results ADD COLUMN IF NOT EXISTS synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
PSQL
```

### Step 2: Re-migrate production_results Data

```bash
cd ~/deployments/manufacturing-app/server

# Run fix script
node fix-production-results-simple.js
```

Script ini akan:
- ✅ Add missing columns (`quantity` dan `synced_at`)
- ✅ Clear existing data
- ✅ Re-migrate dari SQLite dengan schema yang benar

## 🔄 Complete Fix (All-in-One)

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    cd ~/deployments/manufacturing-app/server
    
    # 1. Fix table schema
    echo "Fixing table schema..."
    PGPASSWORD=Admin123 psql -h localhost -p 5433 -U admin -d manufacturing_db << 'PSQL'
        ALTER TABLE production_results ADD COLUMN IF NOT EXISTS quantity REAL;
        ALTER TABLE production_results ADD COLUMN IF NOT EXISTS synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
PSQL
    
    # 2. Re-migrate data
    echo "Re-migrating production_results..."
    node fix-production-results-simple.js
ENDSSH
```

## 📋 Manual Fix (Jika Script Tidak Ada)

### 1. Add Columns

```bash
PGPASSWORD=Admin123 psql -h localhost -p 5433 -U admin -d manufacturing_db << 'PSQL'
    ALTER TABLE production_results ADD COLUMN IF NOT EXISTS quantity REAL;
    ALTER TABLE production_results ADD COLUMN IF NOT EXISTS synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
PSQL
```

### 2. Clear and Re-insert Data

```bash
cd ~/deployments/manufacturing-app/server

# Clear existing
PGPASSWORD=Admin123 psql -h localhost -p 5433 -U admin -d manufacturing_db -c "DELETE FROM production_results;"

# Re-run migration for production_results only
node -e "
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();

const sqliteDb = new sqlite3.Database('database.sqlite', sqlite3.OPEN_READONLY);
const pool = new Pool({
  host: 'localhost',
  port: 5433,
  database: 'manufacturing_db',
  user: 'admin',
  password: 'Admin123',
});

sqliteDb.all('SELECT * FROM production_results', [], async (err, rows) => {
  if (err) { console.error(err); process.exit(1); }
  
  const client = await pool.connect();
  try {
    for (const row of rows) {
      const columns = Object.keys(row).filter(k => k !== 'id');
      const values = columns.map(c => row[c]);
      const placeholders = columns.map((_, i) => \`$\${i+1}\`).join(', ');
      
      try {
        await client.query(
          \`INSERT INTO production_results (\${columns.join(', ')}) VALUES (\${placeholders})\`,
          values
        );
      } catch (e) {
        console.error('Error:', e.message);
      }
    }
    console.log(\`✅ Migrated \${rows.length} rows\`);
  } finally {
    client.release();
    await pool.end();
    sqliteDb.close();
  }
});
"
```

## ✅ Verifikasi

```bash
# Cek jumlah data
PGPASSWORD=Admin123 psql -h localhost -p 5433 -U admin -d manufacturing_db -c "SELECT COUNT(*) FROM production_results;"

# Cek schema
PGPASSWORD=Admin123 psql -h localhost -p 5433 -U admin -d manufacturing_db -c "\d production_results"

# Cek data sample
PGPASSWORD=Admin123 psql -h localhost -p 5433 -U admin -d manufacturing_db -c "SELECT id, mo_number, sku_name, quantity FROM production_results LIMIT 5;"
```

---

**Last Updated**: 2026-01-08
