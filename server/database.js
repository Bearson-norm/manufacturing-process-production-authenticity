// PostgreSQL Database Wrapper
// Provides an interface similar to sqlite3 for easier migration
const { Pool, Client } = require('pg');
const config = require('./config');

// Log database configuration (without password)
// This runs when database.js is first loaded
console.log('\n' + '='.repeat(60));
console.log('📊 DATABASE CONFIGURATION');
console.log('='.repeat(60));
console.log(`   Host: ${config.database.host}`);
console.log(`   Port: ${config.database.port}`);
console.log(`   Database: ${config.database.database}`);
console.log(`   User: ${config.database.user}`);
console.log(`   Password: ${config.database.password ? '***' : 'not set'}`);
console.log('='.repeat(60) + '\n');

// Create PostgreSQL connection pool
const pool = new Pool(config.database);

// Test connection on startup
pool.on('connect', (client) => {
  console.log(`✅ PostgreSQL: Connected to database "${config.database.database}"`);
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL: Unexpected error on idle client', err);
});

// Helper function to convert PostgreSQL placeholders
function convertPlaceholders(sql, params) {
  // Convert ? placeholders to $1, $2, etc. for PostgreSQL
  let index = 0;
  const convertedSql = sql.replace(/\?/g, () => `$${++index}`);
  return convertedSql;
}

// Helper function to execute queries
class Database {
  constructor() {
    this.pool = pool;
  }

  // Execute a query with callback (SQLite-style compatibility)
  run(sql, params = [], callback) {
    // Handle optional params parameter
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    
    const convertedSql = convertPlaceholders(sql, params);
    
    this.pool.connect()
      .then(client => {
        return client.query(convertedSql, params)
          .then(result => {
            client.release();
            if (callback) {
              // Call callback with error=null and this context
              callback.call({ lastID: result.rows[0]?.id, changes: result.rowCount }, null);
            }
          })
          .catch(err => {
            client.release();
            if (callback) {
              callback(err);
            } else {
              console.error('Database run error:', err);
            }
          });
      })
      .catch(err => {
        if (callback) {
          callback(err);
        } else {
          console.error('Database connection error:', err);
        }
      });
  }

  // Get all rows with callback (SQLite-style compatibility)
  all(sql, params = [], callback) {
    // Handle optional params parameter
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    
    const convertedSql = convertPlaceholders(sql, params);
    
    this.pool.connect()
      .then(client => {
        return client.query(convertedSql, params)
          .then(result => {
            client.release();
            if (callback) {
              callback(null, result.rows);
            }
          })
          .catch(err => {
            client.release();
            if (callback) {
              callback(err, null);
            } else {
              console.error('Database all error:', err);
            }
          });
      })
      .catch(err => {
        if (callback) {
          callback(err, null);
        } else {
          console.error('Database connection error:', err);
        }
      });
  }

  // Get single row with callback (SQLite-style compatibility)
  get(sql, params = [], callback) {
    // Handle optional params parameter
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    
    const convertedSql = convertPlaceholders(sql, params);
    
    this.pool.connect()
      .then(client => {
        return client.query(convertedSql, params)
          .then(result => {
            client.release();
            if (callback) {
              callback(null, result.rows[0]);
            }
          })
          .catch(err => {
            client.release();
            if (callback) {
              callback(err, null);
            } else {
              console.error('Database get error:', err);
            }
          });
      })
      .catch(err => {
        if (callback) {
          callback(err, null);
        } else {
          console.error('Database connection error:', err);
        }
      });
  }

  // Execute multiple queries in a transaction
  async transaction(callback) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await callback(client);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  // Serialize (for SQLite compatibility - PostgreSQL doesn't need this)
  serialize(callback) {
    if (callback) callback();
  }

  // Close all connections
  async close() {
    await this.pool.end();
  }

  // Test connection
  testConnection(callback) {
    this.get('SELECT 1 as test', [], (err, result) => {
      if (callback) {
        callback(err, result && result.test === 1);
      }
    });
  }
}

// Create singleton instance
const db = new Database();

// Initialize database tables
async function initializeTables() {
  console.log('🔄 Initializing PostgreSQL tables...');
  console.log(`📦 Target database: ${config.database.database}`);

  const client = await pool.connect();
  try {
    // Verify we're connected to the correct database
    const dbCheckResult = await client.query('SELECT current_database() as db_name');
    const currentDbName = dbCheckResult.rows[0].db_name;
    
    if (currentDbName !== config.database.database) {
      console.warn(`⚠️  WARNING: Connected to database "${currentDbName}" but expected "${config.database.database}"`);
    } else {
      console.log(`✅ Connected to correct database: "${currentDbName}"`);
    }
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

    // Combined Production table
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
        session_id TEXT,
        leader_name TEXT,
        shift_number TEXT,
        pic TEXT,
        mo_number TEXT,
        sku_name TEXT,
        authenticity_data JSONB,
        status TEXT DEFAULT 'active',
        quantity REAL,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        synced_at TIMESTAMP,
        UNIQUE(production_type, session_id, mo_number, created_at)
      )
    `);

    // Add missing columns to production_results if table already exists
    await client.query(`
      DO $$ 
      BEGIN
        -- Add status column if not exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name='production_results' AND column_name='status') THEN
          ALTER TABLE production_results ADD COLUMN status TEXT DEFAULT 'active';
        END IF;
        
        -- Add quantity column if not exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name='production_results' AND column_name='quantity') THEN
          ALTER TABLE production_results ADD COLUMN quantity REAL;
        END IF;
        
        -- Add completed_at column if not exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name='production_results' AND column_name='completed_at') THEN
          ALTER TABLE production_results ADD COLUMN completed_at TIMESTAMP;
        END IF;
        
        -- Add synced_at column if not exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name='production_results' AND column_name='synced_at') THEN
          ALTER TABLE production_results ADD COLUMN synced_at TIMESTAMP;
        END IF;
      END $$;
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
        create_date TIMESTAMP,
        fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Receiver Logs table (for external API receiver endpoint)
    await client.query(`
      CREATE TABLE IF NOT EXISTS receiver_logs (
        id SERIAL PRIMARY KEY,
        source TEXT NOT NULL,
        payload TEXT NOT NULL,
        received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        response_status INTEGER,
        response_message TEXT,
        ip_address TEXT,
        user_agent TEXT
      )
    `);

    // Manufacturing Identity table (for storing data received from external API)
    await client.query(`
      CREATE TABLE IF NOT EXISTS manufacturing_identity (
        id SERIAL PRIMARY KEY,
        manufacturing_id TEXT NOT NULL,
        sku TEXT NOT NULL,
        sku_name TEXT NOT NULL,
        target_qty INTEGER NOT NULL DEFAULT 0,
        done_qty INTEGER,
        leader_name TEXT NOT NULL,
        finished_at TIMESTAMP,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Admin Configuration table
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_config (
        id SERIAL PRIMARY KEY,
        config_key TEXT UNIQUE NOT NULL,
        config_value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // PIC List table
    await client.query(`
      CREATE TABLE IF NOT EXISTS pic_list (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_production_combined_mo_number ON production_combined(mo_number)',
      'CREATE INDEX IF NOT EXISTS idx_production_combined_created_at ON production_combined(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_production_combined_type ON production_combined(production_type)',
      'CREATE INDEX IF NOT EXISTS idx_production_results_mo_number ON production_results(mo_number)',
      'CREATE INDEX IF NOT EXISTS idx_production_results_created_at ON production_results(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_production_results_type ON production_results(production_type)',
      'CREATE INDEX IF NOT EXISTS idx_odoo_mo_cache_mo_number ON odoo_mo_cache(mo_number)',
      'CREATE INDEX IF NOT EXISTS idx_odoo_mo_cache_fetched_at ON odoo_mo_cache(fetched_at)',
      'CREATE INDEX IF NOT EXISTS idx_receiver_logs_source ON receiver_logs(source)',
      'CREATE INDEX IF NOT EXISTS idx_receiver_logs_received_at ON receiver_logs(received_at)',
      'CREATE INDEX IF NOT EXISTS idx_manufacturing_identity_manufacturing_id ON manufacturing_identity(manufacturing_id)',
      'CREATE INDEX IF NOT EXISTS idx_manufacturing_identity_status ON manufacturing_identity(status)',
      'CREATE INDEX IF NOT EXISTS idx_manufacturing_identity_created_at ON manufacturing_identity(created_at)',
    ];

    for (const indexQuery of indexes) {
      try {
        await client.query(indexQuery);
      } catch (err) {
        // Ignore if index already exists
        if (!err.message.includes('already exists')) {
          console.error('Error creating index:', err.message);
        }
      }
    }

    // Initialize default PIC list
    const picCountResult = await client.query('SELECT COUNT(*) as count FROM pic_list');
    const picCount = parseInt(picCountResult.rows[0].count);
    
    if (picCount === 0) {
      const defaultPICs = [
        'Puput Wijanarko', 'Adhari Wijaya', 'Qurotul Aini', 'Fita Estikasari',
        'Dela Wahyu Handayani', 'Thania Novelia Suseno', 'Astikaria Nababan', 'Yati Sumiati',
        'Faliq Humam Zulian', 'Pria Nanda Pratama', 'Rendy Join Prayoga Hutapea', 'Rizqi Mahendra',
        'Muhammad Irfan Perdinan', 'Ahmad Buseri', 'Ilyas Safiq', 'Ganjar Ferdianto',
        'Martunis Hidayatulloh', 'Selly Juniar Andriyani', 'Irma Anggraeni', 'Evi Dwi Setiani',
        'Siti Sopiah', 'Dede Mustika Alawiah', 'Diah Ayu Novianti', 'Anisa Putri Ramadani',
        'Ahmad Ari Ripa\'i', 'Andre Romadoni', 'Dwi Nova Safitri', 'Sahroni',
        'Niken Susanti', 'Ubedilah', 'Aulia Rachma Putri', 'Zimam Mulhakam',
        'Yuliyanti Putri Pratiwi', 'Meitya Rifai Yusnah', 'Nurhadi', 'Bagas Prasetya',
        'Hendra Azwar Eka Saputra', 'Rini Rokhimah', 'Iin Silpiana Dewi', 'Muhammad Abdul Halim',
        'Ahmad Muhaimin', 'Sharani Noor padilah', 'Iin Rofizah', 'Frisca Nurjannah',
        'Windi Nur Azizah', 'Muhammad Ilham', 'Jonathan Claudio P', 'Teguh Santoso',
        'Adi Ardiansyah', 'Widi Dwi Gita', 'Nurul Amelia', 'Dini Milati',
        'Sofhie Angellita', 'Annisa Rahmawati', 'Dessy Indriyani', 'Suhendra Jaya Kusuma',
        'Ardani', 'Rohiah', 'Novita Astriani', 'Nurul Khofiduriah',
        'Galing Resdianto', 'Nurbaiti', 'Andri Mulyadi', 'Tiaruli Nababan',
        'Indadari Windrayanti', 'Muhammad Apandi', 'Vini Claras Anatasyia', 'Siti Mahidah',
        'Rusnia Ningsih', 'Randy Virmansyah', 'Silvia Fransiska', 'Armah Wati',
        'Euis Santi', 'Hermawan', 'Linda Haryati', 'Aditya Rachman',
        'Calvin Lama Tokan', 'Norris Samuel Silaban', 'Dora Nopinda', 'Vita Lativa',
        'Nur Azizah', 'Devi Yanti', 'Ita Purnamasari', 'Rizky Septian',
        'Laila Arifatul Hilmi', 'Erfild Ardi Mahardika', 'Hanun Dhiya Imtiaz', 'Mayang Puspitaningrum',
        'Hikmatul Iman', 'Muhammad Tedi Al Bukhori', 'Mahardika', 'Sevira Yunita Andini',
        'Gista Nadia', 'Parjiyanti', 'Rifki Maulana Rafif', 'Sri hoviya',
        'Amanda Tifara', 'Laras Wati', 'Dwi Setia Putri', 'Putri Bela Savira',
        'Siti Hasanah', 'Farhan Rizky Wahyudi', 'Adam Rizki', 'Tomi Wijaya',
        'Syahrizal', 'Sherly Triananda Lisa', 'Henry Daniarto', 'Sindy Yusnia',
        'Inka Purnama Sari', 'Larasati', 'Muhamad Hojaji Muslim', 'Sopiyana', 'Yuyun'
      ];

      for (const name of defaultPICs) {
        try {
          await client.query('INSERT INTO pic_list (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
        } catch (err) {
          console.error(`Error inserting PIC ${name}:`, err.message);
        }
      }
      console.log('✅ Default PIC list initialized');
    }

    // Count existing tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log(`✅ PostgreSQL tables initialized successfully`);
    console.log(`📋 Total tables in database: ${tablesResult.rows.length}`);
    
    if (tablesResult.rows.length > 0) {
      console.log(`📊 Tables found:`);
      tablesResult.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.table_name}`);
      });
    }
    
    // Check if database has data
    const dataCheckQueries = [
      { name: 'production_liquid', query: 'SELECT COUNT(*) as count FROM production_liquid' },
      { name: 'production_device', query: 'SELECT COUNT(*) as count FROM production_device' },
      { name: 'production_cartridge', query: 'SELECT COUNT(*) as count FROM production_cartridge' },
      { name: 'odoo_mo_cache', query: 'SELECT COUNT(*) as count FROM odoo_mo_cache' },
      { name: 'admin_config', query: 'SELECT COUNT(*) as count FROM admin_config' },
    ];
    
    console.log(`\n📈 Database Data Summary:`);
    for (const check of dataCheckQueries) {
      try {
        const result = await client.query(check.query);
        const count = parseInt(result.rows[0].count) || 0;
        if (count > 0) {
          console.log(`   ${check.name}: ${count} records`);
        }
      } catch (err) {
        // Table might not exist yet, ignore
      }
    }
    
  } catch (err) {
    console.error('❌ Error initializing tables:', err);
    console.error(`   Database: ${config.database.database}`);
    console.error(`   Host: ${config.database.host}:${config.database.port}`);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { db, initializeTables, pool };

