/**
 * CI migrate smoke: apply schema migrations against an ephemeral Postgres.
 * Expects DATABASE_URL or standard PG* env vars.
 */
const { Pool } = require('pg');
const { runMigrations } = require('../migrations/runner');

async function main() {
  const connectionString =
    process.env.DATABASE_URL ||
    `postgresql://${encodeURIComponent(process.env.PGUSER || 'postgres')}:${encodeURIComponent(process.env.PGPASSWORD || 'postgres')}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || '5432'}/${process.env.PGDATABASE || 'postgres'}`;

  const pool = new Pool({ connectionString });
  try {
    await runMigrations(pool);
    console.log('✅ Migrate smoke completed');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('❌ Migrate smoke failed:', err.message || err);
  process.exit(1);
});
