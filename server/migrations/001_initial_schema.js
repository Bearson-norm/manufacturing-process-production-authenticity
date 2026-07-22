const { applyBootstrapSchema } = require('../schema-bootstrap');

/**
 * Baseline schema migration (idempotent CREATE IF NOT EXISTS).
 * New schema changes should be 002_*.js, 003_*.js, etc.
 */
module.exports = {
  async up(client) {
    const dbCheckResult = await client.query('SELECT current_database() as db_name');
    console.log(`✅ Connected to database: "${dbCheckResult.rows[0].db_name}"`);
    await applyBootstrapSchema(client);
  },
};
