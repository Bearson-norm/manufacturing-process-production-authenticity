// Migrate Production Data dari SQLite ke PostgreSQL
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

require('dotenv').config();

if (!process.env.DB_PASSWORD) {
  console.error('Error: DB_PASSWORD environment variable is required');
  process.exit(1);
}

// SQLite database path
const sqliteDbPath = path.join(__dirname, 'database.sqlite');

// PostgreSQL connection
const pgConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'manufacturing_db',
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD,
  max: 20,
};

const pool = new Pool(pgConfig);

async function migrateProductionData() {
  console.log('🔄 Migrating Production Data from SQLite to PostgreSQL...\n');

  if (!fs.existsSync(sqliteDbPath)) {
    console.log('❌ SQLite database not found!');
    process.exit(1);
  }

  // Open SQLite database
  const sqliteDb = new sqlite3.Database(sqliteDbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error('❌ Error opening SQLite database:', err);
      process.exit(1);
    }
  });

  try {
    const client = await pool.connect();

    try {
      // 1. Migrate production_liquid
      console.log('1️⃣  Migrating production_liquid...');
      const liquidRows = await new Promise((resolve, reject) => {
        sqliteDb.all('SELECT * FROM production_liquid', [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      if (liquidRows.length > 0) {
        for (const row of liquidRows) {
          try {
            await client.query(`
              INSERT INTO production_liquid 
              (session_id, leader_name, shift_number, pic, mo_number, sku_name, authenticity_data, status, completed_at, created_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
              ON CONFLICT DO NOTHING
            `, [
              row.session_id || `SESSION-${row.id}`,
              row.leader_name,
              row.shift_number,
              row.pic,
              row.mo_number,
              row.sku_name,
              row.authenticity_data,
              row.status || 'active',
              row.completed_at,
              row.created_at
            ]);
          } catch (err) {
            console.error(`   Error inserting row ${row.id}:`, err.message);
          }
        }
        console.log(`   ✅ Migrated ${liquidRows.length} production_liquid records`);
      } else {
        console.log(`   ⚠️  No data to migrate`);
      }

      // 2. Migrate production_device
      console.log('\n2️⃣  Migrating production_device...');
      const deviceRows = await new Promise((resolve, reject) => {
        sqliteDb.all('SELECT * FROM production_device', [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      if (deviceRows.length > 0) {
        for (const row of deviceRows) {
          try {
            await client.query(`
              INSERT INTO production_device 
              (session_id, leader_name, shift_number, pic, mo_number, sku_name, authenticity_data, status, completed_at, created_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
              ON CONFLICT DO NOTHING
            `, [
              row.session_id || `SESSION-${row.id}`,
              row.leader_name,
              row.shift_number,
              row.pic,
              row.mo_number,
              row.sku_name,
              row.authenticity_data,
              row.status || 'active',
              row.completed_at,
              row.created_at
            ]);
          } catch (err) {
            console.error(`   Error inserting row ${row.id}:`, err.message);
          }
        }
        console.log(`   ✅ Migrated ${deviceRows.length} production_device records`);
      } else {
        console.log(`   ⚠️  No data to migrate`);
      }

      // 3. Migrate production_cartridge
      console.log('\n3️⃣  Migrating production_cartridge...');
      const cartridgeRows = await new Promise((resolve, reject) => {
        sqliteDb.all('SELECT * FROM production_cartridge', [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      if (cartridgeRows.length > 0) {
        for (const row of cartridgeRows) {
          try {
            await client.query(`
              INSERT INTO production_cartridge 
              (session_id, leader_name, shift_number, pic, mo_number, sku_name, authenticity_data, status, completed_at, created_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
              ON CONFLICT DO NOTHING
            `, [
              row.session_id || `SESSION-${row.id}`,
              row.leader_name,
              row.shift_number,
              row.pic,
              row.mo_number,
              row.sku_name,
              row.authenticity_data,
              row.status || 'active',
              row.completed_at,
              row.created_at
            ]);
          } catch (err) {
            console.error(`   Error inserting row ${row.id}:`, err.message);
          }
        }
        console.log(`   ✅ Migrated ${cartridgeRows.length} production_cartridge records`);
      } else {
        console.log(`   ⚠️  No data to migrate`);
      }

      console.log('\n✅ Production data migration completed!');

      // Verify
      console.log('\n📊 Verifying data in PostgreSQL...');
      const liquidCount = await client.query('SELECT COUNT(*) as count FROM production_liquid');
      const deviceCount = await client.query('SELECT COUNT(*) as count FROM production_device');
      const cartridgeCount = await client.query('SELECT COUNT(*) as count FROM production_cartridge');

      console.log(`   Production Liquid: ${liquidCount.rows[0].count} records`);
      console.log(`   Production Device: ${deviceCount.rows[0].count} records`);
      console.log(`   Production Cartridge: ${cartridgeCount.rows[0].count} records`);

    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ Migration error:', err);
    process.exit(1);
  } finally {
    sqliteDb.close();
    await pool.end();
  }
}

// Run migration
migrateProductionData().then(() => {
  console.log('\n🎉 Done! You can now restart your application.');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
