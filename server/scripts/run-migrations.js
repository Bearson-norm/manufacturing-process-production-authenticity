/**
 * Apply DB migrations once (deploy / ops). Loads server/.env via config.js.
 */
require('../config');
const { pool, initializeTables } = require('../database');

initializeTables()
  .then(async () => {
    console.log('✅ All migrations applied');
    await pool.end();
  })
  .catch(async (err) => {
    console.error('❌ Migration failed:', err.message || err);
    try {
      await pool.end();
    } catch {
      // ignore
    }
    process.exit(1);
  });
