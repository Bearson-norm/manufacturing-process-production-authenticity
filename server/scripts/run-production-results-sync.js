/**
 * Apply migrations then run full production_results sync (backfill + orphan cleanup).
 * Usage: node server/scripts/run-production-results-sync.js
 */
const { pool, initializeTables } = require('../database');
const { runFullProductionSync } = require('../services/production-results-sync.service');

async function main() {
  await initializeTables();
  const results = await runFullProductionSync();
  console.log(JSON.stringify({
    duration: results.duration,
    error: results.error || null,
    sync: results.sync,
    delta: results.delta,
    orphans: results.orphans,
  }, null, 2));

  // Post-check: missing by source_id
  for (const table of [
    { name: 'production_liquid', type: 'liquid' },
    { name: 'production_device', type: 'device' },
    { name: 'production_cartridge', type: 'cartridge' },
  ]) {
    const missing = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM ${table.name} s
       LEFT JOIN production_results pr
         ON pr.production_type = $1 AND pr.source_id = s.id
       WHERE pr.id IS NULL`,
      [table.type]
    );
    const distinct = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM ${table.name} s
       INNER JOIN production_results pr
         ON pr.production_type = $1 AND pr.source_id = s.id
       WHERE pr.authenticity_data IS DISTINCT FROM s.authenticity_data::jsonb
          OR pr.mo_number IS DISTINCT FROM s.mo_number`,
      [table.type]
    );
    console.log(`${table.type}: missing=${missing.rows[0].count}, auth_or_mo_mismatch=${distinct.rows[0].count}`);
  }
}

main()
  .catch((err) => {
    console.error('Failed:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
