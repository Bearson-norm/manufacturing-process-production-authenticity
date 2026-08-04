/**
 * Sync production_liquid / production_device / production_cartridge → production_results.
 * Stable identity: UNIQUE(production_type, source_id).
 */
const { pool } = require('../database');
const { calculateQuantityFromAuthenticity } = require('../utils/authenticity.utils');

const SOURCE_TABLES = [
  { name: 'production_liquid', type: 'liquid' },
  { name: 'production_device', type: 'device' },
  { name: 'production_cartridge', type: 'cartridge' },
];

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

function buildRowPayload(productionType, row) {
  const authData = parseAuthDataForSync(row.authenticity_data);
  const quantity = calculateQuantityFromAuthenticity(row.authenticity_data);
  const completedAt = (row.status === 'completed' && row.completed_at)
    ? row.completed_at
    : (row.status === 'completed' ? new Date().toISOString() : null);

  return {
    productionType,
    sourceId: row.id,
    sessionId: row.session_id || '',
    leaderName: row.leader_name || '',
    shiftNumber: row.shift_number || '',
    pic: row.pic || '',
    moNumber: row.mo_number || '',
    skuName: row.sku_name || '',
    authenticityData: authData,
    status: row.status || 'active',
    quantity,
    completedAt,
    createdAt: row.created_at,
  };
}

/**
 * Upsert one source row into production_results by (production_type, source_id).
 */
async function upsertSourceRowToResults(productionType, sourceRow, client = null) {
  const ownClient = !client;
  const db = client || await pool.connect();
  try {
    const p = buildRowPayload(productionType, sourceRow);
    await db.query(
      `INSERT INTO production_results
         (production_type, source_id, session_id, leader_name, shift_number, pic, mo_number, sku_name,
          authenticity_data, status, quantity, completed_at, created_at, synced_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (production_type, source_id) DO UPDATE SET
         session_id = EXCLUDED.session_id,
         leader_name = EXCLUDED.leader_name,
         shift_number = EXCLUDED.shift_number,
         pic = EXCLUDED.pic,
         mo_number = EXCLUDED.mo_number,
         sku_name = EXCLUDED.sku_name,
         authenticity_data = EXCLUDED.authenticity_data,
         status = EXCLUDED.status,
         quantity = EXCLUDED.quantity,
         completed_at = EXCLUDED.completed_at,
         created_at = EXCLUDED.created_at,
         synced_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP`,
      [
        p.productionType,
        p.sourceId,
        p.sessionId,
        p.leaderName,
        p.shiftNumber,
        p.pic,
        p.moNumber,
        p.skuName,
        JSON.stringify(p.authenticityData),
        p.status,
        p.quantity,
        p.completedAt,
        p.createdAt,
      ]
    );
    return { success: true, sourceId: p.sourceId };
  } finally {
    if (ownClient) db.release();
  }
}

/**
 * Load source row by id and upsert into production_results (for sync-on-write).
 */
async function syncSourceRowById(productionType, sourceId) {
  const table = SOURCE_TABLES.find((t) => t.type === productionType);
  if (!table) {
    throw new Error(`Unknown production type: ${productionType}`);
  }
  const result = await pool.query(
    `SELECT * FROM ${table.name} WHERE id = $1`,
    [sourceId]
  );
  if (!result.rows.length) {
    return { success: false, message: 'Source row not found' };
  }
  return upsertSourceRowToResults(productionType, result.rows[0]);
}

/**
 * Fire-and-forget helper for route handlers (callback or promise contexts).
 */
function enqueueSyncSourceRow(productionType, sourceId) {
  if (sourceId == null) return;
  setImmediate(() => {
    syncSourceRowById(productionType, sourceId).catch((err) => {
      console.error(
        `❌ [SyncOnWrite] ${productionType} id=${sourceId}:`,
        err.message
      );
    });
  });
}

/**
 * Fire-and-forget sync for all rows in a session of a given type.
 */
function enqueueSyncSession(productionType, sessionId) {
  if (!sessionId) return;
  setImmediate(() => {
    syncSessionToResults(productionType, sessionId).catch((err) => {
      console.error(
        `❌ [SyncOnWrite] session ${productionType} ${sessionId}:`,
        err.message
      );
    });
  });
}

async function syncSessionToResults(productionType, sessionId) {
  const table = SOURCE_TABLES.find((t) => t.type === productionType);
  if (!table) return { synced: 0 };
  const result = await pool.query(
    `SELECT * FROM ${table.name} WHERE session_id = $1`,
    [sessionId]
  );
  let synced = 0;
  for (const row of result.rows) {
    await upsertSourceRowToResults(productionType, row);
    synced += 1;
  }
  return { synced };
}

/**
 * Fire-and-forget sync for all rows of an MO for a given type.
 */
function enqueueSyncMo(productionType, moNumber) {
  if (!moNumber) return;
  setImmediate(() => {
    syncMoToResults(productionType, moNumber).catch((err) => {
      console.error(
        `❌ [SyncOnWrite] mo ${productionType} ${moNumber}:`,
        err.message
      );
    });
  });
}

async function syncMoToResults(productionType, moNumber) {
  const table = SOURCE_TABLES.find((t) => t.type === productionType);
  if (!table) return { synced: 0 };
  const result = await pool.query(
    `SELECT * FROM ${table.name} WHERE mo_number = $1`,
    [moNumber]
  );
  let synced = 0;
  for (const row of result.rows) {
    await upsertSourceRowToResults(productionType, row);
    synced += 1;
  }
  return { synced };
}

/**
 * Insert / upsert rows from source that are missing or stale in production_results.
 */
async function syncProductionDataToResults() {
  const client = await pool.connect();
  try {
    console.log('🔄 [Sync] Starting source_id sync of production data to production_results...');

    let totalNew = 0;
    let syncedCount = 0;
    let errorCount = 0;

    for (const table of SOURCE_TABLES) {
      const newRowsResult = await client.query(
        `SELECT s.*
         FROM ${table.name} s
         LEFT JOIN production_results pr
           ON pr.production_type = $1
           AND pr.source_id = s.id
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
          await upsertSourceRowToResults(table.type, row, client);
          syncedCount += 1;
        } catch (rowErr) {
          errorCount += 1;
          console.error(
            `❌ [Sync] Error upserting ${table.name} id=${row.id} (MO: ${row.mo_number}):`,
            rowErr.message
          );
        }
      }
    }

    const message = totalNew === 0
      ? 'No new data to sync — production_results is up to date'
      : `Sync completed: ${syncedCount} new records upserted, ${errorCount} errors`;
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

/**
 * Refresh production_results rows that differ from source (joined by source_id).
 */
async function syncStatusAndDataChanges() {
  const client = await pool.connect();
  try {
    console.log('🔄 [DeltaSync] Checking for status & data changes (by source_id)...');

    let statusUpdated = 0;
    let dataUpdated = 0;
    let activeUpdated = 0;

    for (const table of SOURCE_TABLES) {
      const deltaResult = await client.query(
        `SELECT s.*,
                pr.id AS pr_id, pr.status AS pr_status
         FROM ${table.name} s
         INNER JOIN production_results pr
           ON pr.production_type = $1
           AND pr.source_id = s.id
         WHERE pr.status = 'active'
            OR pr.status IS DISTINCT FROM s.status
            OR pr.quantity IS NULL
            OR pr.mo_number IS DISTINCT FROM s.mo_number
            OR pr.pic IS DISTINCT FROM s.pic
            OR pr.session_id IS DISTINCT FROM s.session_id
            OR pr.sku_name IS DISTINCT FROM s.sku_name
            OR pr.leader_name IS DISTINCT FROM s.leader_name
            OR pr.shift_number IS DISTINCT FROM s.shift_number
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
          await upsertSourceRowToResults(table.type, row, client);
          if (row.pr_status === 'active') {
            activeUpdated += 1;
          } else {
            statusUpdated += 1;
          }
          dataUpdated += 1;
        } catch (rowErr) {
          console.error(`❌ [DeltaSync] Update error (PR id ${row.pr_id}):`, rowErr.message);
        }
      }

      if (deltaResult.rows.length > 0) {
        console.log(
          `📊 [DeltaSync] Updated ${deltaResult.rows.length} records from ${table.name}`
        );
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

/**
 * Delete production_results rows whose source_id no longer exists in the matching source table.
 * Also removes legacy rows with NULL source_id after backfill (orphans).
 */
async function cleanupOrphanResults() {
  const client = await pool.connect();
  try {
    let deleted = 0;

    for (const table of SOURCE_TABLES) {
      const result = await client.query(
        `DELETE FROM production_results pr
         WHERE pr.production_type = $1
           AND pr.source_id IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM ${table.name} s WHERE s.id = pr.source_id
           )
         RETURNING pr.id`,
        [table.type]
      );
      deleted += result.rowCount || 0;
    }

    // Legacy rows never linked to a source id after migration backfill
    const legacy = await client.query(
      `DELETE FROM production_results
       WHERE source_id IS NULL
       RETURNING id`
    );
    deleted += legacy.rowCount || 0;

    const message = deleted > 0
      ? `Orphan cleanup: removed ${deleted} production_results row(s)`
      : 'Orphan cleanup: none';
    console.log(`✅ [OrphanCleanup] ${message}`);
    return { deleted, message };
  } catch (err) {
    console.error('❌ [OrphanCleanup] Fatal error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Backfill source_id on existing production_results using legacy join, then pic-aware join.
 */
async function backfillSourceIds(client) {
  let linked = 0;

  for (const table of SOURCE_TABLES) {
    // Prefer exact legacy key match when unique
    const r1 = await client.query(
      `UPDATE production_results pr
       SET source_id = s.id,
           updated_at = CURRENT_TIMESTAMP
       FROM ${table.name} s
       WHERE pr.production_type = $1
         AND pr.source_id IS NULL
         AND pr.session_id = s.session_id
         AND pr.mo_number = s.mo_number
         AND pr.created_at = s.created_at
         AND (
           SELECT COUNT(*) FROM ${table.name} s2
           WHERE s2.session_id = s.session_id
             AND s2.mo_number = s.mo_number
             AND s2.created_at = s.created_at
         ) = 1`,
      [table.type]
    );
    linked += r1.rowCount || 0;

    // Ambiguous legacy keys: also match pic
    const r2 = await client.query(
      `UPDATE production_results pr
       SET source_id = s.id,
           updated_at = CURRENT_TIMESTAMP
       FROM ${table.name} s
       WHERE pr.production_type = $1
         AND pr.source_id IS NULL
         AND pr.session_id = s.session_id
         AND pr.mo_number = s.mo_number
         AND pr.created_at = s.created_at
         AND pr.pic IS NOT DISTINCT FROM s.pic
         AND (
           SELECT COUNT(*) FROM ${table.name} s2
           WHERE s2.session_id = s.session_id
             AND s2.mo_number = s.mo_number
             AND s2.created_at = s.created_at
             AND s2.pic IS NOT DISTINCT FROM s.pic
         ) = 1`,
      [table.type]
    );
    linked += r2.rowCount || 0;
  }

  console.log(`✅ [Backfill] Linked source_id on ${linked} production_results row(s)`);
  return { linked };
}

async function runFullProductionSync() {
  const startTime = Date.now();
  console.log('\n' + '='.repeat(60));
  console.log('🔄 [FullSync] Starting production_results sync...');
  console.log('='.repeat(60));

  const results = {
    sync: null,
    delta: null,
    orphans: null,
    error: null,
    duration: 0,
  };

  try {
    results.sync = await syncProductionDataToResults();
    results.delta = await syncStatusAndDataChanges();
    results.orphans = await cleanupOrphanResults();
  } catch (err) {
    console.error('❌ [FullSync] Error during sync pipeline:', err.message);
    results.error = err.message;
  }

  results.duration = Date.now() - startTime;
  console.log(`✅ [FullSync] Completed in ${results.duration}ms`);
  console.log('='.repeat(60) + '\n');

  return results;
}

module.exports = {
  SOURCE_TABLES,
  parseAuthDataForSync,
  upsertSourceRowToResults,
  syncSourceRowById,
  enqueueSyncSourceRow,
  enqueueSyncSession,
  enqueueSyncMo,
  syncSessionToResults,
  syncMoToResults,
  syncProductionDataToResults,
  syncStatusAndDataChanges,
  cleanupOrphanResults,
  backfillSourceIds,
  runFullProductionSync,
};
