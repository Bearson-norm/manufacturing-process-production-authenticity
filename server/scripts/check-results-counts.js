const { pool } = require('../database');

async function main() {
  const counts = await pool.query(`
    SELECT 'liquid' AS t, COUNT(*)::int AS c FROM production_liquid
    UNION ALL SELECT 'device', COUNT(*)::int FROM production_device
    UNION ALL SELECT 'cartridge', COUNT(*)::int FROM production_cartridge
    UNION ALL SELECT 'results', COUNT(*)::int FROM production_results
  `);
  const byType = await pool.query(`
    SELECT production_type, COUNT(*)::int AS c, COUNT(source_id)::int AS with_src
    FROM production_results GROUP BY 1 ORDER BY 1
  `);
  const nullSrc = await pool.query(
    `SELECT COUNT(*)::int AS c FROM production_results WHERE source_id IS NULL`
  );
  console.log(JSON.stringify({ counts: counts.rows, byType: byType.rows, nullSrc: nullSrc.rows[0] }, null, 2));
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => pool.end());
