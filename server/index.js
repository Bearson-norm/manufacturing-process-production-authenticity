const app = require('./app');
const { initializeTables } = require('./database');
const cron = require('node-cron');
const { assertAuthConfigOrThrow } = require('./middleware/auth.middleware');

try {
  assertAuthConfigOrThrow();
} catch (authErr) {
  console.error('\n❌ Auth configuration error:', authErr.message);
  console.error('   Set JWT_SECRET, ADMIN_PASSWORD, and PRODUCTION_PASSWORD in server/.env\n');
  process.exit(1);
}

const PORT = process.env.PORT || 1234;

// Initialize database tables using PostgreSQL
initializeTables().then(async () => {
  console.log('\n✅ Database initialized and ready');
  try {
    await backfillMoCacheTeamNames(pool);
  } catch (backfillErr) {
    console.warn('⚠️  team_name backfill skipped:', backfillErr.message);
  }
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
const { db, pool } = require('./database');
const { pushIdleManufacturingForLiquidMosFromCache } = require('./services/liquid-external-manufacturing.service');
const {
  ODOO_MO_SYNC_FIELDS,
  ODOO_MO_CACHE_UPSERT_SQL,
  mapOdooMoToCacheParams,
  backfillMoCacheTeamNames,
  buildDeviceSyncDomain,
} = require('./utils/odoo-mo.helpers');

const {
  calculateQuantityFromAuthenticity
} = require('./utils/authenticity.utils');

// ============================================================================
// PRODUCTION RESULTS SYNC FUNCTIONS (async/await with PostgreSQL pool)
// ============================================================================

// Helper: Parse authenticity_data to ensure valid JSONB
function parseAuthDataForSync(authenticityData) {
  let authData = authenticityData;
  if (typeof authData === 'string') {
    try {
      authData = JSON.parse(authData);
    } catch (e) {
      authData = [];
    }
  }
  if (!authData || typeof authData !== 'object') {
    authData = [];
  }
  return authData;
}

// Function to sync ONLY NEW production data (not yet in production_results) from source tables
async function syncProductionDataToResults() {
  const client = await pool.connect();
  try {
    console.log('🔄 [Sync] Starting incremental sync of production data to production_results...');

    const sourceTables = [
      { name: 'production_liquid', type: 'liquid' },
      { name: 'production_device', type: 'device' },
      { name: 'production_cartridge', type: 'cartridge' }
    ];

    let totalNew = 0;
    let syncedCount = 0;
    let errorCount = 0;

    for (const table of sourceTables) {
      // Only fetch rows from source that do NOT yet exist in production_results
      // Uses LEFT JOIN + IS NULL to find missing rows — no full-table scan on production_results
      const newRowsResult = await client.query(
        `SELECT s.* 
         FROM ${table.name} s
         LEFT JOIN production_results pr
           ON pr.production_type = $1
           AND pr.session_id = s.session_id
           AND pr.mo_number = s.mo_number
           AND pr.created_at = s.created_at
         WHERE pr.id IS NULL
           AND s.session_id IS NOT NULL
           AND s.mo_number IS NOT NULL
           AND s.pic IS NOT NULL
           AND s.created_at IS NOT NULL`,
        [table.type]
      );

      const newRows = newRowsResult.rows || [];
      totalNew += newRows.length;

      if (newRows.length > 0) {
        console.log(`📊 [Sync] Found ${newRows.length} new records from ${table.name}`);
      }

      for (const row of newRows) {
        try {
          const authData = parseAuthDataForSync(row.authenticity_data);
          const quantity = calculateQuantityFromAuthenticity(row.authenticity_data);
          const completedAt = (row.status === 'completed' && row.completed_at)
            ? row.completed_at
            : (row.status === 'completed' ? new Date().toISOString() : null);

          await client.query(
            `INSERT INTO production_results 
             (production_type, session_id, leader_name, shift_number, pic, mo_number, sku_name,
              authenticity_data, status, quantity, completed_at, created_at, synced_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, CURRENT_TIMESTAMP)
             ON CONFLICT (production_type, session_id, mo_number, created_at) DO NOTHING`,
            [
              table.type,
              row.session_id || '',
              row.leader_name || '',
              row.shift_number || '',
              row.pic || '',
              row.mo_number || '',
              row.sku_name || '',
              JSON.stringify(authData),
              row.status || 'active',
              quantity,
              completedAt,
              row.created_at
            ]
          );
          syncedCount++;
        } catch (rowErr) {
          errorCount++;
          console.error(`❌ [Sync] Error inserting row from ${table.name} (MO: ${row.mo_number}, PIC: ${row.pic}):`, rowErr.message);
        }
      }
    }

    const message = totalNew === 0
      ? 'No new data to sync — production_results is up to date'
      : `Sync completed: ${syncedCount} new records inserted, ${errorCount} errors`;
    console.log(`✅ [Sync] ${message}`);
    return { syncedCount, totalNew, errorCount, message };

  } catch (err) {
    console.error('❌ [Sync] Fatal error:', err.message);
    console.error('❌ [Sync] Stack:', err.stack);
    throw err;
  } finally {
    client.release();
  }
}

// Function to sync status & data changes from source tables to production_results
// Only touches rows where source and production_results actually differ
async function syncStatusAndDataChanges() {
  const client = await pool.connect();
  try {
    console.log('🔄 [DeltaSync] Checking for status & data changes...');

    const sourceTables = [
      { name: 'production_liquid', type: 'liquid' },
      { name: 'production_device', type: 'device' },
      { name: 'production_cartridge', type: 'cartridge' }
    ];

    let statusUpdated = 0;
    let dataUpdated = 0;

    let activeUpdated = 0;

    for (const table of sourceTables) {
      // 1) Always refresh rows where production_results status is 'active'
      //    + rows where status mismatch or quantity/completed_at is missing
      const deltaResult = await client.query(
        `SELECT s.authenticity_data AS source_auth_data,
                s.status AS source_status,
                s.completed_at AS source_completed_at,
                s.leader_name AS source_leader, s.shift_number AS source_shift,
                s.pic AS source_pic, s.sku_name AS source_sku,
                pr.id AS pr_id, pr.status AS pr_status
         FROM ${table.name} s
         INNER JOIN production_results pr
           ON pr.production_type = $1
           AND pr.session_id = s.session_id
           AND pr.mo_number = s.mo_number
           AND pr.created_at = s.created_at
         WHERE pr.status = 'active'
            OR pr.status IS DISTINCT FROM s.status
            OR pr.quantity IS NULL
            OR pr.authenticity_data IS DISTINCT FROM s.authenticity_data::jsonb
            OR (
              COALESCE(pr.quantity, 0) = 0
              AND s.authenticity_data IS NOT NULL
              AND s.authenticity_data::text NOT IN ('[]', 'null', '', '{}')
            )
            OR (pr.completed_at IS NULL AND s.status = 'completed')`,
        [table.type]
      );

      for (const row of deltaResult.rows) {
        try {
          const authData = parseAuthDataForSync(row.source_auth_data);
          const quantity = calculateQuantityFromAuthenticity(row.source_auth_data);
          const completedAt = row.source_completed_at ||
            (row.source_status === 'completed' ? new Date().toISOString() : null);

          await client.query(
            `UPDATE production_results
             SET status = $1,
                 quantity = $2,
                 completed_at = $3,
                 authenticity_data = $4::jsonb,
                 leader_name = $5,
                 shift_number = $6,
                 pic = $7,
                 sku_name = $8,
                 updated_at = CURRENT_TIMESTAMP,
                 synced_at = CURRENT_TIMESTAMP
             WHERE id = $9`,
            [
              row.source_status || 'active',
              quantity,
              completedAt,
              JSON.stringify(authData),
              row.source_leader || '',
              row.source_shift || '',
              row.source_pic || '',
              row.source_sku || '',
              row.pr_id
            ]
          );

          if (row.pr_status === 'active') {
            activeUpdated++;
          } else {
            statusUpdated++;
          }
          dataUpdated++;
        } catch (rowErr) {
          console.error(`❌ [DeltaSync] Update error (PR id ${row.pr_id}):`, rowErr.message);
        }
      }

      if (deltaResult.rows.length > 0) {
        console.log(`📊 [DeltaSync] Updated ${deltaResult.rows.length} records from ${table.name} (${activeUpdated} active refreshed)`);
      }
    }

    const message = dataUpdated > 0
      ? `Delta sync: ${dataUpdated} total updates (${activeUpdated} active refreshed, ${statusUpdated} status fixes)`
      : 'Delta sync: everything up to date';
    console.log(`✅ [DeltaSync] ${message}`);
    return { statusUpdated, dataUpdated, activeUpdated, message };

  } catch (err) {
    console.error('❌ [DeltaSync] Fatal error:', err.message);
    console.error('❌ [DeltaSync] Stack:', err.stack);
    throw err;
  } finally {
    client.release();
  }
}

// Master function that runs all sync steps in sequence
async function runFullProductionSync() {
  const startTime = Date.now();
  console.log('\n' + '='.repeat(60));
  console.log('🔄 [FullSync] Starting production_results sync...');
  console.log('='.repeat(60));

  const results = {
    sync: null,
    delta: null,
    error: null,
    duration: 0
  };

  try {
    // Step 1: Insert rows that don't exist yet in production_results
    results.sync = await syncProductionDataToResults();

    // Step 2: Fix status mismatches + null quantity/completed_at
    results.delta = await syncStatusAndDataChanges();

  } catch (err) {
    console.error('❌ [FullSync] Error during sync pipeline:', err.message);
    results.error = err.message;
  }

  results.duration = Date.now() - startTime;
  console.log(`✅ [FullSync] Completed in ${results.duration}ms`);
  console.log('='.repeat(60) + '\n');

  return results;
}

// NOTE: sync-production-data endpoint is handled by admin.routes.js (mounted at /api/admin)
// runFullProductionSync() is used by the scheduler only

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
          domainFilter = [
            '|', '|', '|', '|', '|', '|', '|', '|', '|', '|', '|', '|', '|', '|', '|', '|', '|', '|', '|', '|',
            ['note', 'ilike', 'cartridge'],
            ['note', 'ilike', 'cartirdge'],
            ['note', 'ilike', 'cartrige'],
            ['note', 'ilike', 'cartrdige'],
            ['note', 'ilike', 'TIM CARTRIDGE - SHIFT 1'],
            ['note', 'ilike', 'TIM CARTRIDGE - SHIFT 2'],
            ['note', 'ilike', 'TIM CARTRIDGE - SHIFT 3'],
            ['note', 'ilike', 'TIM DEVICE CT - SHIFT 1'],
            ['note', 'ilike', 'TIM DEVICE CT - SHIFT 2'],
            ['note', 'ilike', 'TIM DEVICE CT - SHIFT 3'],
            ['note', 'ilike', 'TIM DEVICE - SHIFT 1'],
            ['note', 'ilike', 'TIM DEVICE - SHIFT 2'],
            ['note', 'ilike', 'TIM DEVICE - SHIFT 3'],
            ['note', 'ilike', 'TEAM DEVICE CT - SHIFT 1'],
            ['note', 'ilike', 'TEAM DEVICE CT - SHIFT 2'],
            ['note', 'ilike', 'TEAM DEVICE CT - SHIFT 3'],
            ['note', 'ilike', 'TEAM DEVICE - SHIFT 1'],
            ['note', 'ilike', 'TEAM DEVICE - SHIFT 2'],
            ['note', 'ilike', 'TEAM DEVICE - SHIFT 3'],
            ['note', '=', false],
            ['note', '=', '']
          ];
        } else if (noteFilter === 'liquid') {
          // Use OR condition to catch "TEAM LIQUID" and "liquid" variations
          domainFilter = ['|', '|', '|',
            ['note', 'ilike', 'TEAM LIQUID'],  // Primary filter: TEAM LIQUID
            ['note', 'ilike', 'liquid'],         // Fallback: any note with "liquid"
            ['note', '=', false],
            ['note', '=', '']
          ];
        } else if (noteFilter !== 'device') {
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
            '|', '|', '|', '|', '|', '|', '|', '|', '|', '|', '|', '|', '|', '|', '|', '|', '|', '|', '|', '|',
            ['note', 'ilike', 'cartridge'],
            ['note', 'ilike', 'cartirdge'],
            ['note', 'ilike', 'cartrige'],
            ['note', 'ilike', 'cartrdige'],
            ['note', 'ilike', 'TIM CARTRIDGE - SHIFT 1'],
            ['note', 'ilike', 'TIM CARTRIDGE - SHIFT 2'],
            ['note', 'ilike', 'TIM CARTRIDGE - SHIFT 3'],
            ['note', 'ilike', 'TIM DEVICE CT - SHIFT 1'],
            ['note', 'ilike', 'TIM DEVICE CT - SHIFT 2'],
            ['note', 'ilike', 'TIM DEVICE CT - SHIFT 3'],
            ['note', 'ilike', 'TIM DEVICE - SHIFT 1'],
            ['note', 'ilike', 'TIM DEVICE - SHIFT 2'],
            ['note', 'ilike', 'TIM DEVICE - SHIFT 3'],
            ['note', 'ilike', 'TEAM DEVICE CT - SHIFT 1'],
            ['note', 'ilike', 'TEAM DEVICE CT - SHIFT 2'],
            ['note', 'ilike', 'TEAM DEVICE CT - SHIFT 3'],
            ['note', 'ilike', 'TEAM DEVICE - SHIFT 1'],
            ['note', 'ilike', 'TEAM DEVICE - SHIFT 2'],
            ['note', 'ilike', 'TEAM DEVICE - SHIFT 3'],
            ['note', '=', false],
            ['note', '=', ''],
            ["create_date", ">=", startDateStr]
          ];
        } else if (noteFilter === 'liquid') {
          // Need '&' operator to combine OR condition with date filter
          combinedDomain = [
            '&',  // AND operator
            '|', '|', '|',  // OR: TEAM LIQUID / liquid / empty note
            ['note', 'ilike', 'TEAM LIQUID'],
            ['note', 'ilike', 'liquid'],
            ['note', '=', false],
            ['note', '=', ''],
            ["create_date", ">=", startDateStr]
          ];
        } else if (noteFilter === 'device') {
          combinedDomain = buildDeviceSyncDomain(startDateStr);
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
              "fields": ODOO_MO_SYNC_FIELDS,
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

          const MO_INSERT_CONCURRENCY = 12;
          const rows = response.result;
          for (let i = 0; i < rows.length; i += MO_INSERT_CONCURRENCY) {
            const chunk = rows.slice(i, i + MO_INSERT_CONCURRENCY);
            await Promise.all(
              chunk.map(
                (mo) =>
                  new Promise((resolve, reject) => {
                    db.run(
                      ODOO_MO_CACHE_UPSERT_SQL,
                      mapOdooMoToCacheParams(mo),
                      function (insertErr) {
                        if (insertErr) {
                          reject(insertErr);
                        } else {
                          resolve();
                        }
                      }
                    );
                  })
              )
            );
          }

          totalUpdated += response.result.length;
          console.log(`✅ [Scheduler] Updated ${response.result.length} MO records for ${productionType}`);
        }
      } catch (error) {
        console.error(`❌ [Scheduler] Error updating MO data for ${productionType}:`, error.message);
      }
    }

    console.log(`✅ [Scheduler] MO data update completed. Total updated: ${totalUpdated}`);
    try {
      await backfillMoCacheTeamNames(pool);
    } catch (backfillErr) {
      console.warn('⚠️  [Scheduler] team_name backfill failed:', backfillErr.message);
    }
  });
}

// Setup cron jobs — only when ENABLE_SCHEDULER=true (PM2 worker process)
// Explicit ENABLE_SCHEDULER wins; otherwise enable in local/dev only (not production/staging).
const schedulerEnabled =
  process.env.ENABLE_SCHEDULER != null && String(process.env.ENABLE_SCHEDULER).trim() !== ''
    ? String(process.env.ENABLE_SCHEDULER).toLowerCase() === 'true'
    : process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'staging';
const httpEnabled = String(process.env.ENABLE_HTTP || 'true').toLowerCase() !== 'false';
const scheduledTasks = [];

function stopScheduledTasks() {
  for (const task of scheduledTasks) {
    try {
      if (task && typeof task.stop === 'function') task.stop();
    } catch (e) {
      console.warn('⚠️  Failed to stop cron task:', e.message);
    }
  }
  scheduledTasks.length = 0;
}

if (schedulerEnabled) {
  scheduledTasks.push(
    cron.schedule('* * * * *', () => {
      console.log('⏰ [Scheduler] Triggered: Update MO data from Odoo');
      updateMoDataFromOdoo();
    })
  );

  scheduledTasks.push(
    cron.schedule('0 6 * * *', () => {
      console.log('⏰ [Scheduler] Triggered: Push external manufacturing idle (liquid MOs)');
      pushIdleManufacturingForLiquidMosFromCache({ limit: 2000 }).catch((err) => {
        console.error('❌ [Scheduler] pushIdleManufacturingForLiquidMosFromCache:', err.message);
      });
    })
  );

  scheduledTasks.push(
    cron.schedule('0 * * * *', () => {
      console.log('⏰ [Scheduler] Triggered: Full production_results sync');
      runFullProductionSync()
        .then((results) => {
          console.log('✅ [Scheduler] Full sync completed in ' + results.duration + 'ms');
        })
        .catch((error) => {
          console.error('❌ [Scheduler] Error in full production sync:', error.message);
        });
    })
  );

  console.log('📅 [Scheduler] Cron jobs configured (ENABLE_SCHEDULER=true):');
  console.log('   - Update MO data from Odoo: Every 1 minute (cron: * * * * *)');
  console.log('   - External manufacturing idle POST (liquid): Daily at 06:00 (cron: 0 6 * * *)');
  console.log('   - Full production_results sync: Every 1 hour (cron: 0 * * * *)');
} else {
  console.log('📅 [Scheduler] Disabled on this process (set ENABLE_SCHEDULER=true on the worker)');
}

const runInitialSync = () => {
  if (!schedulerEnabled) return;

  console.log('\n🔄 [Initial Sync] Starting initial sync on server startup...');
  console.log('   This will sync MO data from Odoo AND production_results');

  setTimeout(async () => {
    try {
      await updateMoDataFromOdoo();
      console.log('✅ [Initial Sync] MO data sync completed');
    } catch (err) {
      console.error('❌ [Initial Sync] MO data sync failed:', err.message);
      console.error('   You can manually trigger sync using: POST /api/admin/sync-mo');
    }

    try {
      const result = await runFullProductionSync();
      console.log('✅ [Initial Sync] Production results sync completed in ' + result.duration + 'ms');
    } catch (err) {
      console.error('❌ [Initial Sync] Production results sync failed:', err.message);
      console.error('   You can manually trigger sync using: POST /api/admin/sync-production-data');
    }
  }, 5000);
};

let server = null;

function signalReady() {
  if (process.send) {
    process.send('ready');
  }
}

if (httpEnabled) {
  server = app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 Server is running on port ' + PORT);
    console.log('📡 Environment: ' + (process.env.NODE_ENV || 'development'));
    console.log('🔗 Access at: http://localhost:' + PORT);
    console.log('🗓️  Scheduler: ' + (schedulerEnabled ? 'enabled' : 'disabled'));
    runInitialSync();
    signalReady();
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error('❌ Port ' + PORT + ' is already in use');
    } else {
      console.error('❌ Server error:', err);
    }
    process.exit(1);
  });

  server.timeout = 60000;
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
} else {
  console.log('📡 HTTP disabled (ENABLE_HTTP=false) — worker/scheduler mode');
  console.log('🗓️  Scheduler: ' + (schedulerEnabled ? 'enabled' : 'disabled'));
  runInitialSync();
  signalReady();
}

let isShuttingDown = false;
const SHUTDOWN_DEADLINE_MS = 10000;

async function gracefulShutdown(signal) {
  if (isShuttingDown) {
    console.log('⚠️  ' + signal + ' received again, forcing exit...');
    process.exit(1);
    return;
  }

  isShuttingDown = true;
  console.log(signal + ' signal received: starting graceful shutdown...');

  const forceTimer = setTimeout(() => {
    console.error('❌ Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, SHUTDOWN_DEADLINE_MS);
  if (typeof forceTimer.unref === 'function') forceTimer.unref();

  try {
    stopScheduledTasks();
    console.log('✅ Cron tasks stopped');

    if (server) {
      await new Promise((resolve) => {
        server.close(() => {
          console.log('✅ HTTP server closed');
          resolve();
        });
      });
    }

    await db.close();
    console.log('✅ Database connection closed');

    clearTimeout(forceTimer);
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
