// Fix PostgreSQL Schema - Add missing columns and fix types
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'manufacturing_db',
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'Admin123',
  max: 20,
});

async function fixSchema() {
  console.log('🔧 Fixing PostgreSQL schema...\n');
  
  const client = await pool.connect();
  
  try {
    // 1. Check and fix odoo_mo_cache table structure
    console.log('1. Checking odoo_mo_cache table...');
    
    // Get current columns
    const columnsResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'odoo_mo_cache' AND table_schema = 'public'
    `);
    
    const existingColumns = columnsResult.rows.map(r => r.column_name);
    console.log('   Existing columns:', existingColumns.join(', '));
    
    // Add missing columns
    const requiredColumns = [
      { name: 'sku_name', type: 'TEXT', default: null },
      { name: 'quantity', type: 'REAL', default: null },
      { name: 'uom', type: 'TEXT', default: null },
      { name: 'note', type: 'TEXT', default: null },
      { name: 'create_date', type: 'TIMESTAMP', default: null },
      { name: 'last_updated', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
    ];
    
    for (const col of requiredColumns) {
      if (!existingColumns.includes(col.name)) {
        console.log(`   ➕ Adding column: ${col.name}`);
        const defaultClause = col.default ? `DEFAULT ${col.default}` : '';
        await client.query(`ALTER TABLE odoo_mo_cache ADD COLUMN ${col.name} ${col.type} ${defaultClause}`);
      }
    }
    
    // Remove old columns that are no longer needed
    const oldColumns = ['product_name'];
    for (const col of oldColumns) {
      if (existingColumns.includes(col)) {
        console.log(`   ➖ Removing old column: ${col}`);
        await client.query(`ALTER TABLE odoo_mo_cache DROP COLUMN IF EXISTS ${col}`);
      }
    }
    
    // 2. Fix create_date type if needed (from TEXT to TIMESTAMP)
    const createDateType = columnsResult.rows.find(r => r.column_name === 'create_date');
    if (createDateType && createDateType.data_type === 'text') {
      console.log('   🔄 Converting create_date from TEXT to TIMESTAMP...');
      try {
        await client.query(`
          ALTER TABLE odoo_mo_cache 
          ALTER COLUMN create_date TYPE TIMESTAMP 
          USING CASE 
            WHEN create_date IS NULL THEN NULL
            WHEN create_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN create_date::TIMESTAMP
            ELSE NULL
          END
        `);
        console.log('   ✅ create_date converted to TIMESTAMP');
      } catch (err) {
        console.log('   ⚠️  Could not convert create_date automatically');
        console.log('      Keeping as TEXT for now');
      }
    }
    
    // 3. Verify production_results table has completed_at
    console.log('\n2. Checking production_results table...');
    const prodResultsCols = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'production_results' AND table_schema = 'public'
    `);
    const prodResultsColumns = prodResultsCols.rows.map(r => r.column_name);
    
    if (!prodResultsColumns.includes('completed_at')) {
      console.log('   ➕ Adding completed_at column');
      await client.query(`ALTER TABLE production_results ADD COLUMN completed_at TIMESTAMP`);
    }
    
    if (!prodResultsColumns.includes('synced_at')) {
      console.log('   ➕ Adding synced_at column');
      await client.query(`ALTER TABLE production_results ADD COLUMN synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
    }
    
    // 4. Ensure quantity column exists and is REAL type
    if (!prodResultsColumns.includes('quantity')) {
      console.log('   ➕ Adding quantity column');
      await client.query(`ALTER TABLE production_results ADD COLUMN quantity REAL`);
    }
    
    // 5. Verify indexes
    console.log('\n3. Checking indexes...');
    const indexes = [
      'idx_production_results_mo_number',
      'idx_production_results_created_at',
      'idx_production_results_type',
      'idx_production_results_status',
      'idx_odoo_mo_cache_mo_number',
      'idx_odoo_mo_cache_fetched_at',
    ];
    
    for (const idx of indexes) {
      const idxExists = await client.query(`
        SELECT 1 FROM pg_indexes 
        WHERE indexname = $1
      `, [idx]);
      
      if (idxExists.rows.length === 0) {
        console.log(`   ➕ Creating index: ${idx}`);
        switch(idx) {
          case 'idx_production_results_mo_number':
            await client.query('CREATE INDEX idx_production_results_mo_number ON production_results(mo_number)');
            break;
          case 'idx_production_results_created_at':
            await client.query('CREATE INDEX idx_production_results_created_at ON production_results(created_at)');
            break;
          case 'idx_production_results_type':
            await client.query('CREATE INDEX idx_production_results_type ON production_results(production_type)');
            break;
          case 'idx_production_results_status':
            await client.query('CREATE INDEX idx_production_results_status ON production_results(status)');
            break;
          case 'idx_odoo_mo_cache_mo_number':
            await client.query('CREATE INDEX idx_odoo_mo_cache_mo_number ON odoo_mo_cache(mo_number)');
            break;
          case 'idx_odoo_mo_cache_fetched_at':
            await client.query('CREATE INDEX idx_odoo_mo_cache_fetched_at ON odoo_mo_cache(fetched_at)');
            break;
        }
      }
    }
    
    console.log('\n✅ Schema fixed successfully!\n');
    
    // Show final structure
    console.log('Final odoo_mo_cache structure:');
    const finalCols = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'odoo_mo_cache' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    finalCols.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.column_default ? `(default: ${col.column_default})` : ''}`);
    });
    
  } catch (err) {
    console.error('❌ Error fixing schema:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the fix
fixSchema().then(() => {
  console.log('\n🎉 All done! You can now restart your application.');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});


