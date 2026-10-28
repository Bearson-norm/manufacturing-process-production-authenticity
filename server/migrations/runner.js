const fs = require('fs');
const path = require('path');

/**
 * Lightweight migration runner.
 * Tracks applied migrations in schema_migrations.
 */
async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getApplied(client) {
  const result = await client.query('SELECT id FROM schema_migrations ORDER BY id');
  return new Set(result.rows.map((r) => r.id));
}

function loadMigrationFiles() {
  const dir = path.join(__dirname);
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d+_.*\.js$/.test(f))
    .sort()
    .map((f) => ({
      id: f.replace(/\.js$/, ''),
      // eslint-disable-next-line import/no-dynamic-require, global-require
      mod: require(path.join(dir, f)),
    }));
}

const MIGRATION_ADVISORY_LOCK_KEY = 904273891;

async function acquireMigrationLock(client) {
  const maxWaitMs = 120000;
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    const res = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [
      MIGRATION_ADVISORY_LOCK_KEY,
    ]);
    if (res.rows[0]?.locked) {
      return;
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });
  }
  throw new Error('Timed out waiting for migration lock');
}

async function releaseMigrationLock(client) {
  await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_ADVISORY_LOCK_KEY]);
}

async function runMigrations(pool) {
  const client = await pool.connect();
  try {
    await acquireMigrationLock(client);
    try {
      await ensureMigrationsTable(client);
      let applied = await getApplied(client);
      const migrations = loadMigrationFiles();

      for (const migration of migrations) {
        if (applied.has(migration.id)) {
          continue;
        }
        console.log(`🔄 Applying migration ${migration.id}...`);
        await client.query('BEGIN');
        try {
          if (typeof migration.mod.up !== 'function') {
            throw new Error(`Migration ${migration.id} missing up()`);
          }
          await migration.mod.up(client);
          await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [migration.id]);
          await client.query('COMMIT');
          applied.add(migration.id);
          console.log(`✅ Migration ${migration.id} applied`);
        } catch (err) {
          await client.query('ROLLBACK');
          if (err.code === '23505') {
            applied = await getApplied(client);
            if (applied.has(migration.id)) {
              console.log(`ℹ️  Migration ${migration.id} already recorded (parallel apply)`);
              continue;
            }
          }
          throw err;
        }
      }

      if (migrations.length === 0) {
        console.log('ℹ️  No migration files found');
      } else {
        console.log(`✅ Migrations up to date (${migrations.length} file(s))`);
      }
    } finally {
      await releaseMigrationLock(client);
    }
  } finally {
    client.release();
  }
}

module.exports = { runMigrations };
