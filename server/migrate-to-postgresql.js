const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// SQLite database path
const sqliteDbPath = path.join(__dirname, 'database.sqlite');

// PostgreSQL connection
const pgConfig = {
  host: 'localhost',
  port: 5432,
  database: 'manufacturing_db',
  user: 'admin',
  password: 'Admin123',
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
        console.log(`Table ${tableName} does not exist in SQLite, skipping...`);
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

// Function to get column info from SQLite
function getTableInfo(db, tableName) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${tableName})`, [], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
}

// Function to create PostgreSQL tables
async function createPostgreSQLTables(client) {
  console.log('Creating PostgreSQL tables...');

  // Production Liquid table
  await client.query(`
    CREATE TABLE IF NOT EXISTS production_liquid (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      leader_name TEXT NOT NULL,
      shift_number TEXT NOT NULL,
      pic TEXT NOT NULL,
      mo_number TEXT NOT NULL,
      sku_name TEXT NOT NULL,
      authenticity_data TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Production Device table
  await client.query(`
    CREATE TABLE IF NOT EXISTS production_device (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      leader_name TEXT NOT NULL,
      shift_number TEXT NOT NULL,
      pic TEXT NOT NULL,
      mo_number TEXT NOT NULL,
      sku_name TEXT NOT NULL,
      authenticity_data TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Production Cartridge table
  await client.query(`
    CREATE TABLE IF NOT EXISTS production_cartridge (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      leader_name TEXT NOT NULL,
      shift_number TEXT NOT NULL,
      pic TEXT NOT NULL,
      mo_number TEXT NOT NULL,
      sku_name TEXT NOT NULL,
      authenticity_data TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Buffer Authenticity tables
  await client.query(`
    CREATE TABLE IF NOT EXISTS buffer_liquid (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      pic TEXT NOT NULL,
      mo_number TEXT NOT NULL,
      sku_name TEXT NOT NULL,
      authenticity_numbers TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS buffer_device (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      pic TEXT NOT NULL,
      mo_number TEXT NOT NULL,
      sku_name TEXT NOT NULL,
      authenticity_numbers TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS buffer_cartridge (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      pic TEXT NOT NULL,
      mo_number TEXT NOT NULL,
      sku_name TEXT NOT NULL,
      authenticity_numbers TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Reject Authenticity tables
  await client.query(`
    CREATE TABLE IF NOT EXISTS reject_liquid (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      pic TEXT NOT NULL,
      mo_number TEXT NOT NULL,
      sku_name TEXT NOT NULL,
      authenticity_numbers TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS reject_device (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      pic TEXT NOT NULL,
      mo_number TEXT NOT NULL,
      sku_name TEXT NOT NULL,
      authenticity_numbers TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS reject_cartridge (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      pic TEXT NOT NULL,
      mo_number TEXT NOT NULL,
      sku_name TEXT NOT NULL,
      authenticity_numbers TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Production Combined table
  await client.query(`
    CREATE TABLE IF NOT EXISTS production_combined (
      id SERIAL PRIMARY KEY,
      production_type TEXT NOT NULL,
      session_id TEXT NOT NULL,
      leader_name TEXT NOT NULL,
      shift_number TEXT NOT NULL,
      pic TEXT NOT NULL,
      mo_number TEXT NOT NULL,
      sku_name TEXT NOT NULL,
      authenticity_data TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Production Results table
  await client.query(`
    CREATE TABLE IF NOT EXISTS production_results (
      id SERIAL PRIMARY KEY,
      production_type TEXT NOT NULL,
      session_id TEXT NOT NULL,
      leader_name TEXT NOT NULL,
      shift_number TEXT NOT NULL,
      pic TEXT NOT NULL,
      mo_number TEXT NOT NULL,
      sku_name TEXT NOT NULL,
      authenticity_data TEXT NOT NULL,
      status TEXT NOT NULL,
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Odoo MO Cache table
  await client.query(`
    CREATE TABLE IF NOT EXISTS odoo_mo_cache (
      id SERIAL PRIMARY KEY,
      mo_number TEXT UNIQUE NOT NULL,
      sku_name TEXT NOT NULL,
      quantity REAL,
      uom TEXT,
      note TEXT,
      create_date TEXT,
      fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Admin Config table
  await client.query(`
    CREATE TABLE IF NOT EXISTS admin_config (
      id SERIAL PRIMARY KEY,
      config_key TEXT UNIQUE NOT NULL,
      config_value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // PIC List table
  await client.query(`
    CREATE TABLE IF NOT EXISTS pic_list (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes
  await client.query('CREATE INDEX IF NOT EXISTS idx_production_combined_mo_number ON production_combined(mo_number)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_production_combined_created_at ON production_combined(created_at)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_production_combined_type ON production_combined(production_type)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_production_results_mo_number ON production_results(mo_number)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_production_results_created_at ON production_results(created_at)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_production_results_type ON production_results(production_type)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_production_results_status ON production_results(status)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_odoo_mo_cache_mo_number ON odoo_mo_cache(mo_number)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_odoo_mo_cache_fetched_at ON odoo_mo_cache(fetched_at)');

  console.log('PostgreSQL tables created successfully!');
}

// Function to insert data into PostgreSQL
async function insertDataToPostgreSQL(client, tableName, rows) {
  if (rows.length === 0) {
    console.log(`No data to migrate for table ${tableName}`);
    return;
  }

  console.log(`Migrating ${rows.length} rows to ${tableName}...`);

  for (const row of rows) {
    const columns = Object.keys(row).filter(key => key !== 'id'); // Skip auto-increment ID
    const values = columns.map(col => row[col]);
    const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
    
    const query = `
      INSERT INTO ${tableName} (${columns.join(', ')})
      VALUES (${placeholders})
    `;

    try {
      await client.query(query, values);
    } catch (err) {
      console.error(`Error inserting row into ${tableName}:`, err.message);
      console.error('Row data:', row);
    }
  }

  console.log(`Successfully migrated ${rows.length} rows to ${tableName}`);
}

// Main migration function
async function migrate() {
  console.log('Starting migration from SQLite to PostgreSQL...');
  console.log('SQLite DB Path:', sqliteDbPath);

  if (!fs.existsSync(sqliteDbPath)) {
    console.log('SQLite database not found. Creating empty PostgreSQL schema...');
    const client = await pool.connect();
    try {
      await createPostgreSQLTables(client);
      console.log('Empty PostgreSQL schema created successfully!');
    } finally {
      client.release();
      await pool.end();
    }
    return;
  }

  // Open SQLite database
  const sqliteDb = new sqlite3.Database(sqliteDbPath, (err) => {
    if (err) {
      console.error('Error opening SQLite database:', err);
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
      for (const tableName of tables) {
        console.log(`\nProcessing table: ${tableName}`);
        
        try {
          const rows = await readSQLiteTable(sqliteDb, tableName);
          await insertDataToPostgreSQL(client, tableName, rows);
        } catch (err) {
          console.error(`Error migrating table ${tableName}:`, err);
        }
      }

      console.log('\n✓ Migration completed successfully!');
      console.log('\nPostgreSQL connection details:');
      console.log(`  Host: ${pgConfig.host}`);
      console.log(`  Port: ${pgConfig.port}`);
      console.log(`  Database: ${pgConfig.database}`);
      console.log(`  User: ${pgConfig.user}`);

    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    // Close SQLite database
    sqliteDb.close((err) => {
      if (err) {
        console.error('Error closing SQLite database:', err);
      }
    });

    // Close PostgreSQL pool
    await pool.end();
  }
}

// Run migration
migrate().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

