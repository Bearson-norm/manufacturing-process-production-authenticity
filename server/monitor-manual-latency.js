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
    const currentTime = Date.now();
    const timeDiff = currentTime - dbTimestamp.getTime();
    const timeDiffSeconds = Math.abs(timeDiff / 1000);
    
    // Validasi: jika timestamp terlalu lama (> 5 menit), kemungkinan ada masalah
    let useInsertTime = true;
    if (timeDiffSeconds > 300) { // > 5 menit
      console.log(`⚠️  WARNING: Timestamp di database terlalu lama!`);
      console.log(`   Created At (DB): ${dbTimestamp.toISOString()}`);
      console.log(`   Waktu Sekarang: ${new Date(currentTime).toISOString()}`);
      console.log(`   Selisih: ${timeDiffSeconds.toFixed(0)} detik (${(timeDiffSeconds / 60).toFixed(1)} menit)`);
      console.log(``);
      console.log(`   🔍 Kemungkinan Masalah:`);
      console.log(`   1. Kolom created_at tidak di-set saat insert dari DBeaver`);
      console.log(`   2. Tabel tidak punya DEFAULT CURRENT_TIMESTAMP`);
      console.log(`   3. Data yang di-insert adalah data lama (bukan data baru)`);
      console.log(``);
      console.log(`   💡 Solusi:`);
      console.log(`   - Pastikan saat insert di DBeaver, kolom created_at di-set dengan CURRENT_TIMESTAMP`);
      console.log(`   - Atau gunakan: INSERT ... VALUES (..., CURRENT_TIMESTAMP)`);
      console.log(`   - Script akan menggunakan waktu query sebagai referensi\n`);
      useInsertTime = false;
    } else if (timeDiffSeconds < 0) {
      // Timestamp di masa depan (tidak mungkin, kecuali timezone issue)
      console.log(`⚠️  WARNING: Timestamp di database di masa depan!`);
      console.log(`   Created At (DB): ${dbTimestamp.toISOString()}`);
      console.log(`   Waktu Sekarang: ${new Date(currentTime).toISOString()}`);
      console.log(`   💡 Kemungkinan: Timezone issue atau clock tidak sync\n`);
      useInsertTime = false;
    }
    
    // Gunakan waktu saat query jika timestamp terlalu lama
    const referenceTime = useInsertTime ? dbTimestamp.getTime() : currentTime;
    const referenceTimestamp = useInsertTime ? dbTimestamp : new Date(currentTime);
    
    console.log(`✅ Data ditemukan di database`);
    console.log(`   ID: ${targetId}`);
    console.log(`   Created At (DB): ${dbTimestamp.toISOString()}`);
    if (!useInsertTime) {
      console.log(`   ⚠️  Menggunakan waktu query sebagai referensi: ${referenceTimestamp.toISOString()}`);
    }
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
                    
                    // Option 1: Latency dari start polling (waktu script mulai mencari)
                    const latencyFromStart = foundTime - startTime;
                    
                    // Option 2: Latency dari waktu insert di database (lebih akurat)
                    // Gunakan referenceTime yang sudah divalidasi
                    const realLatency = foundTime - referenceTime;
                    
                    console.log(`✅ Data ditemukan di API!`);
                    console.log(`   Attempt: ${attempts}`);
                    console.log(``);
                    console.log(`📊 Latency Measurement:`);
                    console.log(`   ⏱️  Latency dari waktu insert (AKURAT): ${realLatency}ms (${(realLatency / 1000).toFixed(2)} detik)`);
                    console.log(`   ⏱️  Latency dari start polling: ${latencyFromStart}ms (${(latencyFromStart / 1000).toFixed(2)} detik)`);
                    console.log(``);
                    console.log(`📅 Timeline Breakdown:`);
                    console.log(`     - Waktu Insert (DB): ${dbTimestamp.toISOString()}`);
                    if (!useInsertTime) {
                      console.log(`     - Waktu Referensi (Query): ${referenceTimestamp.toISOString()} ⚠️`);
                    }
                    console.log(`     - Waktu Ditemukan (API): ${new Date(foundTime).toISOString()}`);
                    console.log(`     - Total Latency: ${realLatency}ms (${(realLatency / 1000).toFixed(2)} detik)`);
                    if (!useInsertTime) {
                      console.log(`     ⚠️  Catatan: Latency dihitung dari waktu query, bukan waktu insert`);
                      console.log(`     💡 Pastikan kolom created_at di-set dengan DEFAULT CURRENT_TIMESTAMP`);
                    }
                    
                    // Tampilkan interpretasi
                    if (realLatency < 100) {
                      console.log(`   ✅ Status: SANGAT BAIK (< 100ms)`);
                    } else if (realLatency < 500) {
                      console.log(`   ✅ Status: BAIK (100-500ms)`);
                    } else if (realLatency < 1000) {
                      console.log(`   ⚠️  Status: CUKUP (500-1000ms)`);
                    } else {
                      console.log(`   ❌ Status: PERLU OPTIMASI (> 1000ms)`);
                    }
                    
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