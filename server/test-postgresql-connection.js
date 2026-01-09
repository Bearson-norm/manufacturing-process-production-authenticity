// Test PostgreSQL Connection
// Run this to verify PostgreSQL connection before migration

require('dotenv').config();
const { Pool } = require('pg');

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433', 10), // Default to 5433 (PostgreSQL running port)
  database: process.env.DB_NAME || 'manufacturing_db',
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'Admin123',
};

console.log('🔍 Testing PostgreSQL Connection...');
console.log(`   Host: ${config.host}`);
console.log(`   Port: ${config.port}`);
console.log(`   Database: ${config.database}`);
console.log(`   User: ${config.user}`);
console.log('');

const pool = new Pool(config);

pool.connect()
  .then(client => {
    console.log('✅ Connected to PostgreSQL!');
    return client.query('SELECT version()');
  })
  .then(result => {
    console.log('✅ PostgreSQL version:', result.rows[0].version.split(',')[0]);
    console.log('');
    console.log('✅ Connection test successful!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Connection failed:', err.message);
    console.error('');
    console.error('Troubleshooting:');
    console.error('1. Check if PostgreSQL is running: sudo systemctl status postgresql');
    console.error('2. Check if user exists: sudo -u postgres psql -c "\\du"');
    console.error('3. Check if database exists: sudo -u postgres psql -c "\\l"');
    console.error('4. Fix password: bash fix-postgresql-password.sh');
    console.error('5. Check .env file has correct values');
    process.exit(1);
  })
  .finally(() => {
    pool.end();
  });
