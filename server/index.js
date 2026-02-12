const app = require('./app');
const { initializeTables } = require('./database');
const cron = require('node-cron');

const PORT = process.env.PORT || 1234;

// Initialize database tables using PostgreSQL
initializeTables().then(() => {
  console.log('\n✅ Database initialized and ready');
  console.log('🚀 Server starting...\n');
}).catch(err => {
  console.error('\n❌ Failed to initialize database:', err);
  console.error('\n💡 Tips:');
  console.error('   1. Check database configuration in server/config.js or .env file');
  console.error('   2. Verify PostgreSQL is running');
  console.error('   3. Ensure database exists: CREATE DATABASE <db_name>;');
  console.error('   4. Run: node server/check-database.js to verify connection\n');
  process.exit(1);
});

// Import scheduler functions (keep schedulers in index.js for now)
// TODO: Move to services/scheduler.service.js in future refactoring
const { getAdminConfig } = require('./routes/admin.routes');
const { db } = require('./database');
const { sendToExternalAPIWithUrl } = require('./services/external-api.service');

// Scheduler Functions
// Function to update MO data from Odoo for all production types
async function updateMoDataFromOdoo() {
  console.log('🔄 [Scheduler] Starting MO data update from Odoo...');
  
  getAdminConfig(async (err, config) => {
    if (err) {
      console.error('❌ [Scheduler] Error getting admin config:', err);
      return;
    }

    const productionTypes = ['liquid', 'device', 'cartridge'];
    let totalUpdated = 0;

    for (const productionType of productionTypes) {
      try {
        const https = require('https');
        const url = require('url');
        const noteFilter = productionType.toLowerCase();
        let domainFilter;
        
        if (noteFilter === 'cartridge') {
          domainFilter = ['|', '|', 
            ['note', 'ilike', 'cartridge'],
            ['note', 'ilike', 'cartirdge'],
            ['note', 'ilike', 'cartrige']
          ];
        } else if (noteFilter === 'liquid') {
          domainFilter = ['note', 'ilike', 'liquid'];
        } else if (noteFilter === 'device') {
          domainFilter = ['note', 'ilike', 'device'];
        } else {
          continue;
        }

        const daysBack = 30;
        const now = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysBack);
        const startDateStr = startDate.toISOString().split('T')[0] + ' 00:00:00';

        let combinedDomain;
        if (noteFilter === 'cartridge') {
          combinedDomain = [
            '&',
            '|', '|',
            ['note', 'ilike', 'cartridge'],
            ['note', 'ilike', 'cartirdge'],
            ['note', 'ilike', 'cartrige'],
            ["create_date", ">=", startDateStr]
          ];
        } else {
          combinedDomain = [
            domainFilter,
            ["create_date", ">=", startDateStr]
          ];
        }

        const ODOO_URL = `${config.odooBaseUrl}/web/dataset/call_kw/mrp.production/search_read`;
        const COOKIE_HEADER = `session_id=${config.sessionId}; session_id=${config.sessionId}`;

        const requestData = {
          "jsonrpc": "2.0",
          "method": "call",
          "params": {
            "model": "mrp.production",
            "method": "search_read",
            "args": [combinedDomain],
            "kwargs": {
              "fields": ["id", "name", "product_id", "product_qty", "product_uom_id", "note", "create_date"],
              "limit": 1000,
              "order": "create_date desc"
            }
          }
        };

        const parsedUrl = url.parse(ODOO_URL);
        const options = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 443,
          path: parsedUrl.path,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': COOKIE_HEADER
          }
        };

        const postData = JSON.stringify(requestData);

        const response = await new Promise((resolve, reject) => {
          const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => {
              responseData += chunk;
            });
            res.on('end', () => {
              try {
                const jsonResponse = JSON.parse(responseData);
                if (jsonResponse.error) {
                  reject(new Error(jsonResponse.error.message || 'Odoo API error'));
                } else {
                  resolve(jsonResponse);
                }
              } catch (e) {
                reject(new Error('Failed to parse Odoo response'));
              }
            });
          });

          req.on('error', (error) => {
            reject(error);
          });

          req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
          });

          req.write(postData);
          req.end();
        });

        if (response.result && Array.isArray(response.result)) {
          console.log(`📊 [Scheduler] Received ${response.result.length} MO records from Odoo for ${productionType}`);
          
          const insertPromises = response.result.map((mo) => {
            return new Promise((resolve, reject) => {
              const moCreateDate = mo.create_date || new Date().toISOString();
              const productName = mo.product_id ? mo.product_id[1] : 'N/A';
              const productQty = mo.product_qty || 0;
              const productUom = mo.product_uom_id ? mo.product_uom_id[1] : '';
              const moNote = mo.note || '';
              
              db.run(
                `INSERT INTO odoo_mo_cache 
                 (mo_number, sku_name, quantity, uom, note, create_date, fetched_at, last_updated) 
                 VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                 ON CONFLICT (mo_number) DO UPDATE SET 
                   sku_name = $2, quantity = $3, uom = $4, note = $5, 
                   create_date = $6, last_updated = CURRENT_TIMESTAMP`,
                [
                  mo.name,
                  productName,
                  productQty,
                  productUom,
                  moNote,
                  moCreateDate
                ],
                function(insertErr) {
                  if (insertErr) {
                    reject(insertErr);
                  } else {
                    resolve();
                  }
                }
              );
            });
          });

            await Promise.all(insertPromises);
            totalUpdated += response.result.length;
          console.log(`✅ [Scheduler] Updated ${response.result.length} MO records for ${productionType}`);
        }
      } catch (error) {
        console.error(`❌ [Scheduler] Error updating MO data for ${productionType}:`, error.message);
      }
    }

    console.log(`✅ [Scheduler] MO data update completed. Total updated: ${totalUpdated}`);
  });
}

// Function to send MO list to external API
async function sendMoListToExternalAPI() {
  console.log('📤 [Scheduler] Starting to send MO list for liquid production to external API...');
  
  db.all('SELECT mo_number, sku_name, quantity, uom, note FROM odoo_mo_cache ORDER BY mo_number ASC', [], async (err, rows) => {
      if (err) {
      console.error('❌ [Scheduler] Error fetching MO list:', err);
        return;
      }
      
    if (rows.length === 0) {
      console.log('ℹ️  [Scheduler] No MO data to send');
        return;
      }
      
      const moList = rows.map(row => ({
      mo_number: row.mo_number,
      sku_name: row.sku_name,
      quantity: row.quantity,
      uom: row.uom,
      note: row.note
    }));

    try {
      db.get('SELECT config_value FROM admin_config WHERE config_key = $1', ['external_api_url'], (err2, row2) => {
        if (err2) {
          console.error('❌ [Scheduler] Error fetching external_api_url config:', err2);
          return;
        }
        
        const externalApiUrl = row2 ? row2.config_value : (process.env.EXTERNAL_API_URL || 'https://foom-dash.vercel.app/API');
        
        if (!externalApiUrl || externalApiUrl.trim() === '') {
          console.log('⚠️  [Scheduler] External API URL not configured, skipping send');
          return;
        }
        
        sendToExternalAPIWithUrl({ mo_list: moList }, externalApiUrl)
          .then((result) => {
                if (result.success) {
              console.log(`✅ [Scheduler] Successfully sent MO list (${moList.length} items) to external API`);
                } else {
              console.log(`⚠️  [Scheduler] MO list send skipped: ${result.message}`);
            }
          })
          .catch((error) => {
            console.error(`❌ [Scheduler] Error sending MO list to external API:`, error.message);
          });
    });
  } catch (error) {
      console.error('❌ [Scheduler] Error preparing MO list for external API:', error);
  }
  });
}

// Setup cron jobs
// Update MO data from Odoo every 6 hours
cron.schedule('0 */6 * * *', () => {
  console.log('⏰ [Scheduler] Triggered: Update MO data from Odoo');
  updateMoDataFromOdoo();
});

// Send MO list to external API every 6 hours (after MO data update)
cron.schedule('10 */6 * * *', () => {
  console.log('⏰ [Scheduler] Triggered: Send MO list to external API');
  sendMoListToExternalAPI();
});

console.log('📅 [Scheduler] Cron jobs configured:');
console.log('   - Update MO data from Odoo: Every 6 hours (cron: 0 */6 * * *)');
console.log('   - Send MO list to external API: Every 6 hours (cron: 10 */6 * * *)');

// Initial MO sync on server startup (after 5 seconds delay to ensure DB is ready)
const runInitialSync = () => {
  console.log('\n🔄 [Initial Sync] Starting initial MO sync from Odoo...');
  console.log('   This will run once on server startup to populate MO cache');
  
  setTimeout(() => {
    updateMoDataFromOdoo()
      .then(() => {
        console.log('✅ [Initial Sync] Initial MO sync completed');
      })
      .catch((err) => {
        console.error('❌ [Initial Sync] Initial MO sync failed:', err.message);
        console.error('   You can manually trigger sync using: POST /api/admin/sync-mo');
      });
  }, 5000); // Wait 5 seconds for database to be fully ready
};

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Access at: http://localhost:${PORT}`);
  
  // Run initial sync after server starts
  runInitialSync();
  
  // Signal PM2 that the app is ready
  if (process.send) {
    process.send('ready');
  }
});

// Handle server errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
  } else {
    console.error('❌ Server error:', err);
  }
  process.exit(1);
});

// Increase server timeout for long-running requests
server.timeout = 60000; // 60 seconds
server.keepAliveTimeout = 65000; // 65 seconds
server.headersTimeout = 66000; // 66 seconds

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  const { db } = require('./database');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  const { db } = require('./database');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});