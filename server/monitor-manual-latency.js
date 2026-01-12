// Script untuk mengukur latency dengan manual trigger
// Usage: node server/monitor-manual-latency.js [table_name] [id_to_check]
// Example: node server/monitor-manual-latency.js production_combined 123

const { Pool } = require('pg');
const https = require('https');
const config = require('./config');

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

const pool = new Pool(config.database);

async function measureLatency() {
  try {
    // 1. Get timestamp dari database
    const client = await pool.connect();
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