#!/bin/bash
# Fix production_results table - add missing columns

set -e

echo "=========================================="
echo "Fix production_results Table"
echo "=========================================="
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  This script needs sudo privileges for PostgreSQL"
fi

cd ~/deployments/manufacturing-app/server

echo "🔄 Adding missing columns to production_results table..."

PGPASSWORD=Admin123 psql -h localhost -p 5433 -U admin -d manufacturing_db << 'PSQL'
    -- Add quantity column if not exists
    DO \$\$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'production_results' 
            AND column_name = 'quantity'
        ) THEN
            ALTER TABLE production_results ADD COLUMN quantity REAL;
            RAISE NOTICE 'Added quantity column';
        ELSE
            RAISE NOTICE 'quantity column already exists';
        END IF;
    END \$\$;
    
    -- Add synced_at column if not exists
    DO \$\$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'production_results' 
            AND column_name = 'synced_at'
        ) THEN
            ALTER TABLE production_results ADD COLUMN synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
            RAISE NOTICE 'Added synced_at column';
        ELSE
            RAISE NOTICE 'synced_at column already exists';
        END IF;
    END \$\$;
PSQL

echo ""
echo "✅ Table fixed!"
echo ""
echo "🔄 Re-running migration for production_results..."

# Re-run migration untuk production_results saja
node -e "
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();

const sqliteDbPath = path.join(__dirname, 'database.sqlite');
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433', 10),
  database: process.env.DB_NAME || 'manufacturing_db',
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'Admin123',
});

async function remigrateProductionResults() {
  console.log('Re-migrating production_results...');
  
  const sqliteDb = new sqlite3.Database(sqliteDbPath, sqlite3.OPEN_READONLY);
  const client = await pool.connect();
  
  try {
    // Clear existing data (optional - only if you want fresh migration)
    // await client.query('DELETE FROM production_results');
    
    // Read from SQLite
    const rows = await new Promise((resolve, reject) => {
      sqliteDb.all('SELECT * FROM production_results', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
    
    console.log(\`Found \${rows.length} rows in SQLite\`);
    
    let successCount = 0;
    for (const row of rows) {
      const columns = Object.keys(row).filter(key => key !== 'id');
      const values = columns.map(col => row[col]);
      const placeholders = columns.map((_, idx) => \`$\${idx + 1}\`).join(', ');
      
      try {
        await client.query(
          \`INSERT INTO production_results (\${columns.join(', ')}) VALUES (\${placeholders}) ON CONFLICT DO NOTHING\`,
          values
        );
        successCount++;
      } catch (err) {
        console.error(\`Error inserting row \${row.id}:\`, err.message);
      }
    }
    
    console.log(\`✅ Successfully migrated \${successCount} rows\`);
  } finally {
    sqliteDb.close();
    client.release();
    await pool.end();
  }
}

remigrateProductionResults().catch(console.error);
"

echo ""
echo "=========================================="
echo "✅ Fix completed!"
echo "=========================================="
