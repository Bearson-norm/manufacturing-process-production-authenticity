// Script to check and verify database connection
// Usage: node check-database.js

const { Pool } = require('pg');
const config = require('./config');

async function checkDatabase() {
  console.log('🔍 Checking Database Connection...\n');
  console.log('📊 Configuration:');
  console.log(`   Host: ${config.database.host}`);
  console.log(`   Port: ${config.database.port}`);
  console.log(`   Database: ${config.database.database}`);
  console.log(`   User: ${config.database.user}`);
  console.log(`   Password: ${config.database.password ? '***' : 'not set'}\n`);

  const pool = new Pool(config.database);

  try {
    const client = await pool.connect();
    
    // Check current database
    const dbResult = await client.query('SELECT current_database() as db_name, current_user as db_user');
    console.log('✅ Connection successful!');
    console.log(`   Current Database: ${dbResult.rows[0].db_name}`);
    console.log(`   Current User: ${dbResult.rows[0].db_user}\n`);

    // List all tables
    const tablesResult = await client.query(`
      SELECT table_name, 
             (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log(`📋 Tables in database (${tablesResult.rows.length} total):`);
    if (tablesResult.rows.length === 0) {
      console.log('   ⚠️  No tables found - database is empty');
    } else {
      for (const row of tablesResult.rows) {
        // Count rows in each table
        try {
          const countResult = await client.query(`SELECT COUNT(*) as count FROM ${row.table_name}`);
          const rowCount = parseInt(countResult.rows[0].count) || 0;
          console.log(`   - ${row.table_name} (${row.column_count} columns, ${rowCount} rows)`);
        } catch (err) {
          console.log(`   - ${row.table_name} (${row.column_count} columns, error counting rows)`);
        }
      }
    }

    // Check for expected tables
    const expectedTables = [
      'production_liquid',
      'production_device',
      'production_cartridge',
      'production_combined',
      'production_results',
      'buffer_liquid',
      'buffer_device',
      'buffer_cartridge',
      'reject_liquid',
      'reject_device',
      'reject_cartridge',
      'odoo_mo_cache',
      'admin_config',
      'pic_list',
      'receiver_logs'
    ];

    console.log(`\n🔍 Expected Tables Check:`);
    const existingTables = tablesResult.rows.map(r => r.table_name);
    for (const expectedTable of expectedTables) {
      if (existingTables.includes(expectedTable)) {
        console.log(`   ✅ ${expectedTable}`);
      } else {
        console.log(`   ❌ ${expectedTable} - MISSING`);
      }
    }

    client.release();
    await pool.end();
    
    console.log('\n✅ Database check completed!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Database connection failed!');
    console.error(`   Error: ${err.message}`);
    console.error(`\n💡 Tips:`);
    console.error(`   1. Check if PostgreSQL is running`);
    console.error(`   2. Verify database "${config.database.database}" exists`);
    console.error(`   3. Check credentials in config.js or .env file`);
    console.error(`   4. Try creating database: CREATE DATABASE ${config.database.database};`);
    process.exit(1);
  }
}

checkDatabase();
