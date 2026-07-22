// PostgreSQL Database Wrapper
// Provides an interface similar to sqlite3 for easier migration
const { Pool, Client } = require('pg');
const config = require('./config');

// Log database configuration (without password)
// This runs when database.js is first loaded
console.log('\n' + '='.repeat(60));
console.log('📊 DATABASE CONFIGURATION');
console.log('='.repeat(60));
console.log(`   Host: ${config.database.host}`);
console.log(`   Port: ${config.database.port}`);
console.log(`   Database: ${config.database.database}`);
console.log(`   User: ${config.database.user}`);
console.log(`   Password: ${config.database.password ? '***' : 'not set'}`);
console.log('='.repeat(60) + '\n');

// Create PostgreSQL connection pool
const pool = new Pool(config.database);

// Test connection on startup
pool.on('connect', (client) => {
  console.log(`✅ PostgreSQL: Connected to database "${config.database.database}"`);
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL: Unexpected error on idle client', err);
});

// Helper function to convert PostgreSQL placeholders
function convertPlaceholders(sql, params) {
  // If query already uses PostgreSQL placeholders ($1, $2, etc), return as-is
  if (/\$\d+/.test(sql)) {
    return sql;
  }
  // Convert ? placeholders to $1, $2, etc. for PostgreSQL
  let index = 0;
  const convertedSql = sql.replace(/\?/g, () => `$${++index}`);
  return convertedSql;
}

// Helper function to execute queries
class Database {
  constructor() {
    this.pool = pool;
  }

  // Execute a query with callback (SQLite-style compatibility)
  run(sql, params = [], callback) {
    // Handle optional params parameter
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    
    const convertedSql = convertPlaceholders(sql, params);
    
    this.pool.connect()
      .then(client => {
        return client.query(convertedSql, params)
          .then(result => {
            client.release();
            if (callback) {
              // Call callback with error=null and this context
              callback.call({ lastID: result.rows[0]?.id, changes: result.rowCount }, null);
            }
          })
          .catch(err => {
            client.release();
            if (callback) {
              callback(err);
            } else {
              console.error('Database run error:', err);
            }
          });
      })
      .catch(err => {
        if (callback) {
          callback(err);
        } else {
          console.error('Database connection error:', err);
        }
      });
  }

  // Get all rows with callback (SQLite-style compatibility)
  all(sql, params = [], callback) {
    // Handle optional params parameter
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    
    const convertedSql = convertPlaceholders(sql, params);
    
    this.pool.connect()
      .then(client => {
        return client.query(convertedSql, params)
          .then(result => {
            client.release();
            if (callback) {
              callback(null, result.rows);
            }
          })
          .catch(err => {
            client.release();
            if (callback) {
              callback(err, null);
            } else {
              console.error('Database all error:', err);
            }
          });
      })
      .catch(err => {
        if (callback) {
          callback(err, null);
        } else {
          console.error('Database connection error:', err);
        }
      });
  }

  // Get single row with callback (SQLite-style compatibility)
  get(sql, params = [], callback) {
    // Handle optional params parameter
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    
    const convertedSql = convertPlaceholders(sql, params);
    
    this.pool.connect()
      .then(client => {
        return client.query(convertedSql, params)
          .then(result => {
            client.release();
            if (callback) {
              callback(null, result.rows[0]);
            }
          })
          .catch(err => {
            client.release();
            if (callback) {
              callback(err, null);
            } else {
              console.error('Database get error:', err);
            }
          });
      })
      .catch(err => {
        if (callback) {
          callback(err, null);
        } else {
          console.error('Database connection error:', err);
        }
      });
  }

  // Execute multiple queries in a transaction
  async transaction(callback) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await callback(client);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  // Serialize (for SQLite compatibility - PostgreSQL doesn't need this)
  serialize(callback) {
    if (callback) callback();
  }

  // Close all connections
  async close() {
    await this.pool.end();
  }

  // Test connection
  testConnection(callback) {
    this.get('SELECT 1 as test', [], (err, result) => {
      if (callback) {
        callback(err, result && result.test === 1);
      }
    });
  }
}

// Create singleton instance
const db = new Database();

// Initialize database tables via versioned migrations
async function initializeTables() {
  console.log('🔄 Initializing PostgreSQL tables...');
  console.log(`📦 Target database: ${config.database.database}`);
  const { runMigrations } = require('./migrations/runner');
  await runMigrations(pool);
}

module.exports = { db, initializeTables, pool };
