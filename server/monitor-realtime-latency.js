// Script untuk mengukur latency secara real-time
// Monitor data terbaru yang di-insert ke database dan ukur latency sampai muncul di API
// Usage: node server/monitor-realtime-latency.js [table_name] [duration_seconds]
// Example: node server/monitor-realtime-latency.js production_combined 300

const { Pool } = require('pg');
const https = require('https');
const config = require('./config');
const fs = require('fs');

const tableName = process.argv[2] || 'production_combined';
const monitorDuration = parseInt(process.argv[3] || '300', 10); // Default 5 menit

const domain = 'mpr.moof-set.web.id';

const tableToEndpoint = {
  'production_liquid': '/api/production/liquid',
  'production_device': '/api/production/device',
  'production_cartridge': '/api/production/cartridge',
  'production_combined': '/api/production/combined',
  'production_results': '/api/production-results'
};

const apiEndpoint = tableToEndpoint[tableName] || '/api/production/combined';

console.log('🔍 Real-Time Latency Monitor');
console.log('============================');
console.log(`Domain: ${domain}`);
console.log(`Table: ${tableName}`);
console.log(`API Endpoint: ${apiEndpoint}`);
console.log(`Monitor Duration: ${monitorDuration} detik (${(monitorDuration / 60).toFixed(1)} menit)`);
console.log('');

// Function to create database connection with fallback
function createDatabasePool() {
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
    
    // Method 2: Try port 5433 (common alternative)
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
    
    // Method 3: Try Unix socket
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
    
    // Method 4: Try Unix socket with port 5433
    {
      name: 'Unix socket (port 5433)',
      create: () => {
        if (dbConfig.host === 'localhost' || dbConfig.host === '127.0.0.1' || !dbConfig.host) {
          const socketPath = '/var/run/postgresql/.s.PGSQL.5433';
          if (fs.existsSync(socketPath)) {
            return new Pool({
              ...dbConfig,
              host: '/var/run/postgresql',
              port: 5433
            });
          }
        }
        return null;
      }
    },
    
    // Method 5: Try without password (peer authentication)
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

// Statistics tracking
const stats = {
  totalInserted: 0,
  totalFound: 0,
  latencies: [],
  errors: [],
  startTime: Date.now()
};

// Track monitored IDs to avoid duplicates
const monitoredIds = new Set();
const pendingChecks = new Map(); // id -> { insertTime, attempts }

// Function to check API for data
async function checkAPIForData(id, insertTime) {
  return new Promise((resolve) => {
    const startCheckTime = Date.now();
    
    https.get(`https://${domain}${apiEndpoint}`, { timeout: 5000 }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const apiData = JSON.parse(data);
          
          // Cari data di API
          if (Array.isArray(apiData)) {
            for (const item of apiData) {
              if (item.id === id || (item.inputs && item.inputs.some(i => i.id === id))) {
                const foundTime = Date.now();
                const latency = foundTime - insertTime;
                
                stats.totalFound++;
                stats.latencies.push(latency);
                
                console.log(`✅ ID ${id} ditemukan di API!`);
                console.log(`   ⏱️  Latency: ${latency}ms (${(latency / 1000).toFixed(2)} detik)`);
                console.log(`   📅 Insert: ${new Date(insertTime).toISOString()}`);
                console.log(`   📅 Found: ${new Date(foundTime).toISOString()}`);
                
                // Status berdasarkan latency
                if (latency < 100) {
                  console.log(`   ✅ Status: SANGAT BAIK (< 100ms)\n`);
                } else if (latency < 500) {
                  console.log(`   ✅ Status: BAIK (100-500ms)\n`);
                } else if (latency < 1000) {
                  console.log(`   ⚠️  Status: CUKUP (500-1000ms)\n`);
                } else {
                  console.log(`   ❌ Status: PERLU OPTIMASI (> 1000ms)\n`);
                }
                
                pendingChecks.delete(id);
                resolve({ found: true, latency });
                return;
              }
            }
          }
          
          resolve({ found: false });
        } catch (e) {
          resolve({ found: false, error: e.message });
        }
      });
    }).on('error', (err) => {
      resolve({ found: false, error: err.message });
    });
    
    // Timeout after 5 seconds
    setTimeout(() => {
      resolve({ found: false, error: 'Timeout' });
    }, 5000);
  });
}

// Function to poll API until data is found
async function pollUntilFound(id, insertTime) {
  const maxAttempts = 60; // 60 attempts = 30 detik (500ms interval)
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    attempts++;
    
    const result = await checkAPIForData(id, insertTime);
    
    if (result.found) {
      return result;
    }
    
    // Wait before next attempt
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Not found after max attempts
  stats.errors.push({ id, error: 'Not found in API after 30 seconds' });
  pendingChecks.delete(id);
  console.log(`⚠️  ID ${id} tidak ditemukan di API setelah ${maxAttempts} attempts\n`);
  return { found: false };
}

// Function to monitor new data
async function monitorNewData() {
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
      client.release();
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
        client.release();
      } catch (portError) {
        // Try Unix socket
        try {
          pool = new Pool({
            host: '/var/run/postgresql',
            port: 5433,
            database: dbConfig.database,
            user: dbConfig.user
          });
          client = await pool.connect();
          await client.query('SELECT 1');
          console.log('✅ Koneksi via Unix socket (port 5433) berhasil!\n');
          connectionSuccess = true;
          client.release();
        } catch (socketError) {
          console.error('❌ Semua metode koneksi gagal!');
          console.log('\n💡 Tips untuk memperbaiki:');
          console.log('   1. Check .env file: cat .env | grep DB_');
          console.log('   2. Set port 5433: export DB_PORT=5433');
          console.log('   3. Try Unix socket: export DB_HOST=/var/run/postgresql');
          console.log('   4. Check PostgreSQL port: sudo netstat -tlnp | grep postgres');
          console.log('   5. Test manual: psql -h localhost -p 5433 -U admin -d manufacturing_db');
          throw connError;
        }
      }
    }
    
    if (!connectionSuccess) {
      throw new Error('Tidak bisa connect ke database');
    }
    
    // Get the latest ID before monitoring starts
    const initialClient = await pool.connect();
    const initialResult = await initialClient.query(
      `SELECT id FROM ${tableName} ORDER BY id DESC LIMIT 1`
    );
    const lastId = initialResult.rows.length > 0 ? initialResult.rows[0].id : 0;
    initialClient.release();
    
    console.log(`📊 Monitoring dimulai dari ID: ${lastId}`);
    console.log(`⏰ Monitor akan berjalan selama ${monitorDuration} detik...\n`);
    console.log('💡 Tips: Insert data baru ke database untuk melihat latency measurement\n');
    
    const endTime = Date.now() + (monitorDuration * 1000);
    const checkInterval = 1000; // Check every 1 second
    
    while (Date.now() < endTime) {
      try {
        const checkClient = await pool.connect();
        
        // Get new data inserted after lastId
        const result = await checkClient.query(
          `SELECT id, created_at FROM ${tableName} 
           WHERE id > $1 AND created_at >= NOW() - INTERVAL '1 minute'
           ORDER BY id ASC`,
          [lastId]
        );
        
        checkClient.release();
        
        for (const row of result.rows) {
          const id = row.id;
          const insertTime = new Date(row.created_at).getTime();
          
          // Skip if already monitored
          if (monitoredIds.has(id)) {
            continue;
          }
          
          monitoredIds.add(id);
          stats.totalInserted++;
          
          console.log(`\n🆕 Data baru ditemukan! ID: ${id}`);
          console.log(`   📅 Insert Time: ${new Date(insertTime).toISOString()}`);
          console.log(`   🔍 Mencari di API...`);
          
          // Start polling in background (don't await)
          pendingChecks.set(id, { insertTime, attempts: 0 });
          pollUntilFound(id, insertTime).catch(err => {
            console.error(`❌ Error polling for ID ${id}:`, err.message);
            stats.errors.push({ id, error: err.message });
            pendingChecks.delete(id);
          });
        }
        
        // Update lastId if we found new data
        if (result.rows.length > 0) {
          lastId = result.rows[result.rows.length - 1].id;
        }
        
      } catch (err) {
        console.error('❌ Error checking for new data:', err.message);
      }
      
      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      
      // Show progress every 30 seconds
      const elapsed = Math.floor((Date.now() - stats.startTime) / 1000);
      if (elapsed % 30 === 0 && elapsed > 0) {
        const remaining = Math.floor((endTime - Date.now()) / 1000);
        console.log(`\n⏳ Progress: ${elapsed}s elapsed, ${remaining}s remaining`);
        console.log(`   📊 Inserted: ${stats.totalInserted}, Found: ${stats.totalFound}`);
      }
    }
    
    // Wait for pending checks to complete
    console.log('\n⏳ Menunggu pending checks selesai...');
    let waitCount = 0;
    while (pendingChecks.size > 0 && waitCount < 30) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      waitCount++;
    }
    
    // Print final statistics
    printStatistics();
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Function to print statistics
function printStatistics() {
  console.log('\n');
  console.log('═══════════════════════════════════════');
  console.log('📊 FINAL STATISTICS');
  console.log('═══════════════════════════════════════');
  console.log(`Total Data Inserted: ${stats.totalInserted}`);
  console.log(`Total Data Found in API: ${stats.totalFound}`);
  console.log(`Success Rate: ${stats.totalInserted > 0 ? ((stats.totalFound / stats.totalInserted) * 100).toFixed(1) : 0}%`);
  console.log(`Errors: ${stats.errors.length}`);
  
  if (stats.latencies.length > 0) {
    const sorted = [...stats.latencies].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const avg = stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    
    console.log('\n📈 Latency Statistics:');
    console.log(`   Minimum: ${min}ms (${(min / 1000).toFixed(2)}s)`);
    console.log(`   Maximum: ${max}ms (${(max / 1000).toFixed(2)}s)`);
    console.log(`   Average: ${avg.toFixed(0)}ms (${(avg / 1000).toFixed(2)}s)`);
    console.log(`   Median: ${median}ms (${(median / 1000).toFixed(2)}s)`);
    console.log(`   95th Percentile: ${p95}ms (${(p95 / 1000).toFixed(2)}s)`);
    console.log(`   99th Percentile: ${p99}ms (${(p99 / 1000).toFixed(2)}s)`);
    
    // Distribution
    const excellent = stats.latencies.filter(l => l < 100).length;
    const good = stats.latencies.filter(l => l >= 100 && l < 500).length;
    const fair = stats.latencies.filter(l => l >= 500 && l < 1000).length;
    const poor = stats.latencies.filter(l => l >= 1000).length;
    
    console.log('\n📊 Latency Distribution:');
    console.log(`   ✅ Excellent (< 100ms): ${excellent} (${((excellent / stats.latencies.length) * 100).toFixed(1)}%)`);
    console.log(`   ✅ Good (100-500ms): ${good} (${((good / stats.latencies.length) * 100).toFixed(1)}%)`);
    console.log(`   ⚠️  Fair (500-1000ms): ${fair} (${((fair / stats.latencies.length) * 100).toFixed(1)}%)`);
    console.log(`   ❌ Poor (> 1000ms): ${poor} (${((poor / stats.latencies.length) * 100).toFixed(1)}%)`);
  }
  
  if (stats.errors.length > 0) {
    console.log('\n❌ Errors:');
    stats.errors.slice(0, 10).forEach(err => {
      console.log(`   ID ${err.id}: ${err.error}`);
    });
    if (stats.errors.length > 10) {
      console.log(`   ... dan ${stats.errors.length - 10} error lainnya`);
    }
  }
  
  console.log('\n═══════════════════════════════════════\n');
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n⚠️  Interrupted by user. Generating final statistics...');
  printStatistics();
  await pool.end();
  process.exit(0);
});

// Start monitoring
monitorNewData();
