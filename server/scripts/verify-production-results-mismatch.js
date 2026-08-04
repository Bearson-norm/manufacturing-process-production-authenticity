/**
 * Report production_results vs source mismatches (by source_id).
 * Usage: node server/scripts/verify-production-results-mismatch.js
 */
const { pool } = require('../database');

const SOURCE_TABLES = [
  { name: 'production_liquid', type: 'liquid' },
  { name: 'production_device', type: 'device' },
  { name: 'production_cartridge', type: 'cartridge' },
];

async function main() {
  const summary = {};

  for (const table of SOURCE_TABLES) {
    const missing = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM ${table.name} s
       LEFT JOIN production_results pr
         ON pr.production_type = $1
         AND pr.source_id = s.id
       WHERE pr.id IS NULL`,
      [table.type]
    );

    const distinctAuth = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM ${table.name} s
       INNER JOIN production_results pr
         ON pr.production_type = $1
         AND pr.source_id = s.id
       WHERE pr.authenticity_data IS DISTINCT FROM s.authenticity_data::jsonb
          OR pr.mo_number IS DISTINCT FROM s.mo_number
          OR pr.pic IS DISTINCT FROM s.pic`,
      [table.type]
    );

    summary[table.type] = {
      sourceMissingInResults: missing.rows[0].count,
      authOrMetaMismatch: distinctAuth.rows[0].count,
    };
  }

  const synced = await pool.query(
    `SELECT MAX(synced_at) AS max_synced, COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE source_id IS NULL)::int AS null_source_id
     FROM production_results`
  );

  console.log(JSON.stringify({
    productionResults: synced.rows[0],
    byType: summary,
  }, null, 2));
}

main()
  .catch((err) => {
    console.error('Verification failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
