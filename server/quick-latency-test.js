// Quick latency test - Test latency untuk data terbaru di database
// Usage: node server/quick-latency-test.js [table_name] [count]
// Example: node server/quick-latency-test.js production_combined 5

const { Pool } = require('pg');
const https = require('https');
const config = require('./config');

const tableName = process.argv[2] || 'production_combined';
const count = parseInt(process.argv[3] || '5', 10);

const domain = 'mpr.moof-set.web.id';

const tableToEndpoint = {
  'production_liquid': '/api/production/liquid',
  'production_device': '/api/production/device',
  'production_cartridge': '/api/production/cartridge',
  'production_combined': '/api/production/combined',
  'production_results': '/api/production-results'
};

const apiEndpoint = tableToEndpoint[tableName] || '/api/production/combined';

console.log('⚡ Quick Latency Test');
console.log('=====================');
console.log(`Domain: ${domain}`);
console.log(`Table: ${tableName}`);
console.log(`API Endpoint: ${apiEndpoint}`);
console.log(`Testing ${count} most recent records\n`);

// Create database connection
const dbConfig = {
  host: process.env.DB_HOST || config.database.host || 'localhost',
  port: parseInt(process.env.DB_PORT || config.database.port || '5432', 10),
  database: process.env.DB_NAME || config.database.database || 'manufacturing_db',
  user: process.env.DB_USER || config.database.user || 'admin',
  password: process.env.DB_PASSWORD || config.database.password || 'Admin123'
};

const pool = new Pool(dbConfig);

// Function to check API for data
async function checkAPIForData(id) {
  return new Promise((resolve) => {
    https.get(`https://${domain}${apiEndpoint}`, { timeout: 5000 }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const apiData = JSON.parse(data);
          
          if (Array.isArray(apiData)) {
            for (const item of apiData) {
              if (item.id === id || (item.inputs && item.inputs.some(i => i.id === id))) {
                resolve({ found: true });
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
    
    setTimeout(() => resolve({ found: false, error: 'Timeout' }), 5000);
  });
}

async function quickTest() {
  try {
    const client = await pool.connect();
    
    // Get most recent records
    const result = await client.query(
      `SELECT id, created_at FROM ${tableName} 
       ORDER BY id DESC LIMIT $1`,
      [count]
    );
    
    client.release();
    
    if (result.rows.length === 0) {
      console.log('❌ Tidak ada data di database!');
      await pool.end();
      return;
    }
    
    console.log(`✅ Found ${result.rows.length} records\n`);
    
    const latencies = [];
    const now = Date.now();
    
    for (const row of result.rows) {
      const id = row.id;
      const insertTime = new Date(row.created_at).getTime();
      const age = now - insertTime;
      
      console.log(`🔍 Testing ID: ${id}`);
      console.log(`   📅 Created: ${new Date(insertTime).toISOString()}`);
      console.log(`   ⏰ Age: ${(age / 1000).toFixed(1)}s ago`);
      
      const checkResult = await checkAPIForData(id);
      
      if (checkResult.found) {
        const latency = now - insertTime;
        latencies.push(latency);
        
        console.log(`   ✅ Found in API`);
        console.log(`   ⏱️  Latency: ${latency}ms (${(latency / 1000).toFixed(2)}s)`);
        
        if (latency < 100) {
          console.log(`   ✅ Status: SANGAT BAIK\n`);
        } else if (latency < 500) {
          console.log(`   ✅ Status: BAIK\n`);
        } else if (latency < 1000) {
          console.log(`   ⚠️  Status: CUKUP\n`);
        } else {
          console.log(`   ❌ Status: PERLU OPTIMASI\n`);
        }
      } else {
        console.log(`   ❌ Not found in API`);
        if (checkResult.error) {
          console.log(`   Error: ${checkResult.error}\n`);
        } else {
          console.log(`   💡 Data mungkin belum di-sync ke API\n`);
        }
      }
    }
    
    // Summary
    if (latencies.length > 0) {
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const min = Math.min(...latencies);
      const max = Math.max(...latencies);
      
      console.log('═══════════════════════════════════════');
      console.log('📊 SUMMARY');
      console.log('═══════════════════════════════════════');
      console.log(`Tested: ${result.rows.length} records`);
      console.log(`Found in API: ${latencies.length} records`);
      console.log(`Success Rate: ${((latencies.length / result.rows.length) * 100).toFixed(1)}%`);
      console.log(`\nLatency:`);
      console.log(`   Min: ${min}ms (${(min / 1000).toFixed(2)}s)`);
      console.log(`   Max: ${max}ms (${(max / 1000).toFixed(2)}s)`);
      console.log(`   Avg: ${avg.toFixed(0)}ms (${(avg / 1000).toFixed(2)}s)`);
      console.log('═══════════════════════════════════════\n');
    }
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

quickTest();
