/**
 * Add source_id to production_results for stable 1:1 sync with source tables.
 * Replaces UNIQUE(production_type, session_id, mo_number, created_at) with
 * UNIQUE(production_type, source_id).
 */
const { backfillSourceIds } = require('../services/production-results-sync.service');

module.exports = {
  async up(client) {
    await client.query(`
      ALTER TABLE production_results
      ADD COLUMN IF NOT EXISTS source_id INTEGER
    `);

    // Drop legacy unique constraint(s) on (production_type, session_id, mo_number, created_at)
    await client.query(`
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN
          SELECT c.conname
          FROM pg_constraint c
          JOIN pg_class t ON c.conrelid = t.oid
          WHERE t.relname = 'production_results'
            AND c.contype = 'u'
            AND pg_get_constraintdef(c.oid) LIKE '%session_id%'
            AND pg_get_constraintdef(c.oid) LIKE '%mo_number%'
            AND pg_get_constraintdef(c.oid) LIKE '%created_at%'
        LOOP
          EXECUTE format('ALTER TABLE production_results DROP CONSTRAINT %I', r.conname);
        END LOOP;
      END $$;
    `);

    await client.query(`
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN
          SELECT indexname
          FROM pg_indexes
          WHERE tablename = 'production_results'
            AND indexdef ILIKE '%UNIQUE%'
            AND indexdef ILIKE '%session_id%'
            AND indexdef ILIKE '%mo_number%'
            AND indexdef ILIKE '%created_at%'
        LOOP
          EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
        END LOOP;
      END $$;
    `);

    await backfillSourceIds(client);

    // Keep newest row when duplicate (production_type, source_id)
    await client.query(`
      DELETE FROM production_results a
      USING production_results b
      WHERE a.source_id IS NOT NULL
        AND b.source_id IS NOT NULL
        AND a.production_type = b.production_type
        AND a.source_id = b.source_id
        AND a.id < b.id
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'production_results_production_type_source_id_key'
        ) THEN
          ALTER TABLE production_results
            ADD CONSTRAINT production_results_production_type_source_id_key
            UNIQUE (production_type, source_id);
        END IF;
      END $$;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS production_results_source_id_idx
      ON production_results (source_id)
      WHERE source_id IS NOT NULL
    `);
  },
};
