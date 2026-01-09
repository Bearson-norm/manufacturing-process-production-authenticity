// Fix production_results table - add missing columns and re-migrate

require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');

const sqliteDbPath = path.join(__dirname, 'database.sqlite');
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433', 10),
  database: process.env.DB_NAME || 'manufacturing_db',
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'Admin123',
});

async function fixAndRemigrate() {
  console.log('🔧 Fixing production_results table...');
  
  const client = await pool.connect();
  const sqliteDb = new sqlite3.Database(sqliteDbPath, sqlite3.OPEN_READONLY);
  
  try {
    // 1. Add missing columns
    console.log('   Adding missing columns...');
    
    // Check and add quantity column
    const quantityExists = await client.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'production_results' AND column_name = 'quantity'
    `);
    
    if (quantityExists.rows.length === 0) {
      await client.query('ALTER TABLE production_results ADD COLUMN quantity REAL;');
      console.log('   ✅ Added quantity column');
    } else {
      console.log('   ✅ quantity column already exists');
    }
    
    // Check and add synced_at column
    const syncedAtExists = await client.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'production_results' AND column_name = 'synced_at'
    `);
    
    if (syncedAtExists.rows.length === 0) {
      await client.query('ALTER TABLE production_results ADD COLUMN synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;');
      console.log('   ✅ Added synced_at column');
    } else {
      console.log('   ✅ synced_at column already exists');
    }
    
    // 2. Clear existing data (optional - comment out if you want to keep)
    console.log('   Clearing existing production_results data...');
    await client.query('DELETE FROM production_results');
    
    // 3. Re-migrate data
    console.log('   Re-migrating data from SQLite...');
    const rows = await new Promise((resolve, reject) => {
      sqliteDb.all('SELECT * FROM production_results', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
    
    console.log(`   Found ${rows.length} rows to migrate`);
    
    let successCount = 0;
    for (const row of rows) {
      const columns = Object.keys(row).filter(key => key !== 'id');
      const values = columns.map(col => {
        if (row[col] === null || row[col] === undefined) {
          return null;
        }
        return row[col];
      });
      const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
      
      try {
        await client.query(
          `INSERT INTO production_results (${columns.join(', ')}) VALUES (${placeholders})`,
          values
        );
        successCount++;
      } catch (err) {
        console.error(`   ❌ Error inserting row ${row.id}:`, err.message);
      }
    }
    
    console.log(`   ✅ Successfully migrated ${successCount} rows`);
    
    // 4. Verify
    const count = await client.query('SELECT COUNT(*) as count FROM production_results');
    console.log(`   ✅ Total rows in PostgreSQL: ${count.rows[0].count}`);
    
  } finally {
    sqliteDb.close();
    client.release();
    await pool.end();
  }
}

fixAndRemigrate().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
