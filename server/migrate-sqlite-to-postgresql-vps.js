// Migration Script untuk VPS: SQLite ke PostgreSQL
// Script ini dirancang untuk dijalankan di VPS setelah deployment

const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// SQLite database path (di VPS)
const sqliteDbPath = path.join(__dirname, 'database.sqlite');

// PostgreSQL connection dari .env
const pgConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'manufacturing_db',
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'Admin123',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

const pool = new Pool(pgConfig);

// List of tables to migrate
const tables = [
  'production_liquid',
  'production_device',
  'production_cartridge',
  'buffer_liquid',
  'buffer_device',
  'buffer_cartridge',
  'reject_liquid',
  'reject_device',
  'reject_cartridge',
  'production_combined',
  'production_results',
  'odoo_mo_cache',
  'admin_config',
  'pic_list'
];

// Function to read all data from SQLite table
function readSQLiteTable(db, tableName) {
  return new Promise((resolve, reject) => {
    // First check if table exists
    db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [tableName], (err, row) => {
      if (err) {
        reject(err);
      } else if (!row) {
        console.log(`   ⚠️  Table ${tableName} does not exist in SQLite, skipping...`);
        resolve([]);
      } else {
        db.all(`SELECT * FROM ${tableName}`, [], (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows || []);
          }
        });
      }
    });
  });
}

// Function to create PostgreSQL tables (using database.js initializeTables)
async function createPostgreSQLTables(client) {
  console.log('📋 Creating PostgreSQL tables...');
  
  // Import initializeTables from database.js
  const { initializeTables } = require('./database');
  
  // Initialize tables (this will create all tables with proper schema)
  await initializeTables();
  
  console.log('✅ PostgreSQL tables created successfully!');
}

// Function to insert data into PostgreSQL
async function insertDataToPostgreSQL(client, tableName, rows) {
  if (rows.length === 0) {
    console.log(`   ⚠️  No data to migrate for table ${tableName}`);
    return 0;
  }

  console.log(`   📦 Migrating ${rows.length} rows to ${tableName}...`);

  let successCount = 0;
  let errorCount = 0;

  for (const row of rows) {
    const columns = Object.keys(row).filter(key => key !== 'id'); // Skip auto-increment ID
    const values = columns.map(col => {
      // Handle null/undefined values
      if (row[col] === null || row[col] === undefined) {
        return null;
      }
      // Convert DATETIME to TIMESTAMP format if needed
      if (col.includes('_at') && typeof row[col] === 'string') {
        return row[col];
      }
      return row[col];
    });
    const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
    
    const query = `
      INSERT INTO ${tableName} (${columns.join(', ')})
      VALUES (${placeholders})
      ON CONFLICT DO NOTHING
    `;

    try {
      await client.query(query, values);
      successCount++;
    } catch (err) {
      errorCount++;
      if (errorCount <= 5) { // Only show first 5 errors
        console.error(`   ❌ Error inserting row into ${tableName}:`, err.message);
        if (errorCount === 5) {
          console.error(`   ... (suppressing further errors for ${tableName})`);
        }
      }
    }
  }

  console.log(`   ✅ Successfully migrated ${successCount} rows to ${tableName}${errorCount > 0 ? ` (${errorCount} errors)` : ''}`);
  return successCount;
}

// Function to verify migration
async function verifyMigration(client) {
  console.log('\n🔍 Verifying migration...');
  
  const results = {};
  
  for (const tableName of tables) {
    try {
      const result = await client.query(`SELECT COUNT(*) as count FROM ${tableName}`);
      results[tableName] = parseInt(result.rows[0].count);
      console.log(`   ${tableName}: ${results[tableName]} records`);
    } catch (err) {
      console.error(`   ❌ Error checking ${tableName}:`, err.message);
      results[tableName] = 0;
    }
  }
  
  return results;
}

// Main migration function
async function migrate() {
  console.log('🚀 Starting migration from SQLite to PostgreSQL...');
  console.log(`📁 SQLite DB Path: ${sqliteDbPath}`);
  console.log(`🔌 PostgreSQL: ${pgConfig.host}:${pgConfig.port}/${pgConfig.database}`);
  console.log('');

  // Check if SQLite database exists
  if (!fs.existsSync(sqliteDbPath)) {
    console.log('⚠️  SQLite database not found. Creating empty PostgreSQL schema...');
    const client = await pool.connect();
    try {
      await createPostgreSQLTables(client);
      console.log('✅ Empty PostgreSQL schema created successfully!');
    } finally {
      client.release();
      await pool.end();
    }
    return;
  }

  // Test PostgreSQL connection
  try {
    const testClient = await pool.connect();
    await testClient.query('SELECT 1');
    testClient.release();
    console.log('✅ PostgreSQL connection successful');
  } catch (err) {
    console.error('❌ Cannot connect to PostgreSQL:', err.message);
    console.error('   Please check your .env file and ensure PostgreSQL is running');
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
    // Connect to PostgreSQL
    const client = await pool.connect();

    try {
      // Create tables in PostgreSQL
      await createPostgreSQLTables(client);

      // Migrate each table
      let totalMigrated = 0;
      for (const tableName of tables) {
        console.log(`\n📊 Processing table: ${tableName}`);
        
        try {
          const rows = await readSQLiteTable(sqliteDb, tableName);
          const migrated = await insertDataToPostgreSQL(client, tableName, rows);
          totalMigrated += migrated;
        } catch (err) {
          console.error(`❌ Error migrating table ${tableName}:`, err.message);
        }
      }

      // Verify migration
      const verification = await verifyMigration(client);

      console.log('\n' + '='.repeat(50));
      console.log('✅ Migration completed successfully!');
      console.log('='.repeat(50));
      console.log(`📊 Total records migrated: ${totalMigrated}`);
      console.log('\n📋 PostgreSQL connection details:');
      console.log(`   Host: ${pgConfig.host}`);
      console.log(`   Port: ${pgConfig.port}`);
      console.log(`   Database: ${pgConfig.database}`);
      console.log(`   User: ${pgConfig.user}`);
      console.log('\n💡 Next steps:');
      console.log('   1. Update .env file with correct PostgreSQL credentials');
      console.log('   2. Restart application: pm2 restart manufacturing-app');
      console.log('   3. Verify data: node check-data.js');

    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ Migration error:', err);
    process.exit(1);
  } finally {
    // Close SQLite database
    sqliteDb.close((err) => {
      if (err) {
        console.error('⚠️  Error closing SQLite database:', err);
      }
    });

    // Close PostgreSQL pool
    await pool.end();
  }
}

// Run migration
migrate().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
