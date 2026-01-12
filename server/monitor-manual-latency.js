// Script untuk mengukur latency dengan manual trigger
// Usage: node server/monitor-manual-latency.js [table_name] [id_to_check]
// Example: node server/monitor-manual-latency.js production_combined 123

const { Pool } = require('pg');
const https = require('https');
const config = require('./config');
const fs = require('fs');

const tableName = process.argv[2] || 'production_combined';
const targetId = parseInt(process.argv[3]);

const domain = 'mpr.moof-set.web.id';

const tableToEndpoint = {
  'production_liquid': '/api/production/liquid',
  'production_device': '/api/production/device',
  'production_cartridge': '/api/production/cartridge',
  'production_combined': '/api/production/combined',
  'production_results': '/api/production-results'
};

const apiEndpoint = tableToEndpoint[tableName] || '/api/production/combined';

if (!targetId) {
  console.log('❌ Error: ID harus diisi!');
  console.log(`Usage: node ${process.argv[1]} [table_name] [id_to_check]`);
  console.log(`Example: node ${process.argv[1]} production_combined 123`);
  process.exit(1);
}

console.log('🔍 Manual Latency Monitor');
console.log('=========================');
console.log(`Domain: ${domain}`);
console.log(`Table: ${tableName}`);
console.log(`Target ID: ${targetId}`);
console.log(`API Endpoint: ${apiEndpoint}`);
console.log('');

// Function to create database connection with fallback
function createDatabasePool() {
  // Get config from environment or use defaults
  const dbConfig = {
    host: process.env.DB_HOST || config.database.host || 'localhost',
    port: parseInt(process.env.DB_PORT || config.database.port || '5432', 10),
    database: process.env.DB_NAME || config.database.database || 'manufacturing_db',
    user: process.env.DB_USER || config.database.user || 'admin',
    password: process.env.DB_PASSWORD || config.database.password || 'Admin123'
  };
  
  console.log('📋 Database Configuration:');
  console.log(`   Host: ${dbConfig.host}`);
  console.log(`   Port: ${dbConfig.port}`);
  console.log(`   Database: ${dbConfig.database}`);
  console.log(`   User: ${dbConfig.user}`);
  console.log('');
  
  // Try multiple connection methods
  const connectionMethods = [
    // Method 1: Use config as-is
    {
      name: 'Konfigurasi default',
      create: () => new Pool(dbConfig)
    },
    
    // Method 2: Try Unix socket
    {
      name: 'Unix socket',
      create: () => {
        if (dbConfig.host === 'localhost' || dbConfig.host === '127.0.0.1' || !dbConfig.host) {
          const socketPath = '/var/run/postgresql/.s.PGSQL.' + dbConfig.port;
          if (fs.existsSync(socketPath)) {
            return new Pool({
              ...dbConfig,
              host: '/var/run/postgresql'
            });
          }
        }
        return null;
      }
    },
    
    // Method 3: Try port 5433
    {
      name: 'Port 5433',
      create: () => {
        if (dbConfig.port === 5432) {
          return new Pool({
            ...dbConfig,
            port: 5433
          });
        }
        return null;
      }
    },
    
    // Method 4: Try without password (peer authentication)
    {
      name: 'Peer authentication (no password)',
      create: () => {
        const peerConfig = { ...dbConfig };
        delete peerConfig.password;
        return new Pool({
          ...peerConfig,
          host: '/var/run/postgresql'
        });
      }
    }
  ];
  
  // Try each method
  for (const method of connectionMethods) {
    try {
      const pool = method.create();
      if (pool) {
        console.log(`🔌 Mencoba: ${method.name}...`);
        return pool;
      }
    } catch (err) {
      // Continue to next method
    }
  }
  
  // Fallback to default
  console.log('🔌 Menggunakan konfigurasi default...');
  return new Pool(dbConfig);
}

let pool = createDatabasePool();

async function measureLatency() {
  try {
    // Test connection first
    console.log('🔍 Testing database connection...');
    let client;
    let connectionSuccess = false;
    
    try {
      client = await pool.connect();
      await client.query('SELECT 1');
      console.log('✅ Database connection successful!\n');
      connectionSuccess = true;
    } catch (connError) {
      console.error('❌ Database connection failed:', connError.message);
      
      // Try alternative methods
      console.log('\n🔄 Mencoba metode koneksi alternatif...');
      await pool.end();
      
      const dbConfig = {
        host: process.env.DB_HOST || config.database.host || 'localhost',
        port: parseInt(process.env.DB_PORT || config.database.port || '5432', 10),
        database: process.env.DB_NAME || config.database.database || 'manufacturing_db',
        user: process.env.DB_USER || config.database.user || 'admin',
        password: process.env.DB_PASSWORD || config.database.password || 'Admin123'
      };
      
      // Try Unix socket
      try {
        pool = new Pool({
          host: '/var/run/postgresql',
          port: dbConfig.port,
          database: dbConfig.database,
          user: dbConfig.user
        });
        client = await pool.connect();
        await client.query('SELECT 1');
        console.log('✅ Koneksi via Unix socket berhasil!\n');
        connectionSuccess = true;
      } catch (socketError) {
        // Try port 5433
        try {
          pool = new Pool({
            ...dbConfig,
            port: 5433
          });
          client = await pool.connect();
          await client.query('SELECT 1');
          console.log('✅ Koneksi via port 5433 berhasil!\n');
          connectionSuccess = true;
        } catch (portError) {
          console.error('❌ Semua metode koneksi gagal!');
          console.log('\n💡 Tips untuk memperbaiki:');
          console.log('   1. Check .env file: cat .env | grep DB_');
          console.log('   2. Try Unix socket: export DB_HOST=/var/run/postgresql');
          console.log('   3. Check PostgreSQL port: sudo netstat -tlnp | grep postgres');
          console.log('   4. Test manual: psql -h localhost -U admin -d manufacturing_db');
          console.log('   5. Check password: sudo -u postgres psql -c "\\du admin"');
          throw connError;
        }
      }
    }
    
    if (!connectionSuccess) {
      throw new Error('Tidak bisa connect ke database');
    }
    
    // 1. Get timestamp dari database
    const dbResult = await client.query(
      `SELECT id, created_at FROM ${tableName} WHERE id = $1`,
      [targetId]
    );
    client.release();
    
    if (dbResult.rows.length === 0) {
      console.log(`❌ ID ${targetId} tidak ditemukan di database!`);
      process.exit(1);
    }
    
    const dbTimestamp = new Date(dbResult.rows[0].created_at);
    const startTime = Date.now();
    
    console.log(`✅ Data ditemukan di database`);
    console.log(`   ID: ${targetId}`);
    console.log(`   Created At: ${dbTimestamp.toISOString()}`);
    console.log(`   Mencari di API...\n`);
    
    // 2. Polling API
    let found = false;
    let attempts = 0;
    const maxAttempts = 60;
    
    while (!found && attempts < maxAttempts) {
      attempts++;
      
      await new Promise((resolve) => {
        https.get(`https://${domain}${apiEndpoint}`, { timeout: 5000 }, (res) => {
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            try {
              const apiData = JSON.parse(data);
              
              // Cari data
              if (Array.isArray(apiData)) {
                for (const item of apiData) {
                  if (item.id === targetId || (item.inputs && item.inputs.some(i => i.id === targetId))) {
                    found = true;
                    const foundTime = Date.now();
                    const latency = foundTime - startTime;
                    
                    console.log(`✅ Data ditemukan di API!`);
                    console.log(`   Attempt: ${attempts}`);
                    console.log(`   Latency: ${latency}ms (${(latency / 1000).toFixed(2)} detik)`);
                    console.log(`   Breakdown:`);
                    console.log(`     - Waktu Insert (DB): ${dbTimestamp.toISOString()}`);
                    console.log(`     - Waktu Ditemukan (API): ${new Date(foundTime).toISOString()}`);
                    console.log(`     - Selisih: ${latency}ms`);
                    
                    resolve();
                    return;
                  }
                }
              }
              
              if (attempts % 10 === 0) {
                console.log(`   Attempt ${attempts}: Mencari...`);
              }
              
              resolve();
            } catch (e) {
              console.log(`   Attempt ${attempts}: ❌ Error parsing response`);
              resolve();
            }
          });
        }).on('error', (err) => {
          console.log(`   Attempt ${attempts}: ❌ Error - ${err.message}`);
          resolve();
        });
        
        setTimeout(() => resolve(), 500);
      });
      
      if (!found) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    if (!found) {
      console.log(`\n⚠️  Data tidak ditemukan di API setelah ${maxAttempts} attempts`);
      console.log(`   💡 Pastikan data sudah di-insert dengan benar`);
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

measureLatency();