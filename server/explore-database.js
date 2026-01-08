#!/usr/bin/env node

/**
 * Database Explorer Script
 * 
 * Script untuk mengeksplorasi dan query database SQLite
 * 
 * Usage:
 *   node explore-database.js
 *   node explore-database.js --query "SELECT * FROM production_liquid LIMIT 10"
 *   node explore-database.js --tables
 *   node explore-database.js --schema production_liquid
 *   node explore-database.js --stats
 *   node explore-database.js --export production_liquid output.json
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'database.sqlite');

// Check if database exists
if (!fs.existsSync(dbPath)) {
  console.error('❌ Database not found at:', dbPath);
  process.exit(1);
}

// Open database
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to database:', dbPath);
});

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

// Helper function to execute query and return results
function executeQuery(query, callback) {
  db.all(query, (err, rows) => {
    if (err) {
      console.error('❌ Query error:', err.message);
      callback(err, null);
      return;
    }
    callback(null, rows);
  });
}

// List all tables
function listTables() {
  console.log('\n📋 Available Tables:\n');
  db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", (err, rows) => {
    if (err) {
      console.error('❌ Error:', err.message);
      db.close();
      return;
    }
    rows.forEach((row, index) => {
      console.log(`  ${index + 1}. ${row.name}`);
    });
    console.log('');
    db.close();
  });
}

// Show schema of a table
function showSchema(tableName) {
  console.log(`\n📐 Schema for table: ${tableName}\n`);
  db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
    if (err) {
      console.error('❌ Error:', err.message);
      db.close();
      return;
    }
    if (rows.length === 0) {
      console.log('  Table not found or empty');
    } else {
      console.log('  Column Name          | Type    | Not Null | Default | Primary Key');
      console.log('  ' + '-'.repeat(70));
      rows.forEach(col => {
        const name = col.name.padEnd(20);
        const type = col.type.padEnd(8);
        const notNull = col.notnull ? 'YES' : 'NO';
        const defaultValue = col.dflt_value || '';
        const pk = col.pk ? 'YES' : 'NO';
        console.log(`  ${name} | ${type} | ${notNull.padEnd(8)} | ${String(defaultValue).padEnd(8)} | ${pk}`);
      });
    }
    console.log('');
    db.close();
  });
}

// Show statistics
function showStats() {
  console.log('\n📊 Database Statistics:\n');
  
  // Get all tables
  db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", (err, tables) => {
    if (err) {
      console.error('❌ Error:', err.message);
      db.close();
      return;
    }
    
    let completed = 0;
    const totalTables = tables.length;
    
    tables.forEach(table => {
      const tableName = table.name;
      
      // Get row count
      db.get(`SELECT COUNT(*) as count FROM ${tableName}`, (err, row) => {
        if (err) {
          console.log(`  ${tableName}: Error - ${err.message}`);
        } else {
          console.log(`  ${tableName}: ${row.count} rows`);
        }
        
        completed++;
        if (completed === totalTables) {
          // Get database size
          fs.stat(dbPath, (err, stats) => {
            if (!err) {
              const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
              console.log(`\n  Database size: ${sizeMB} MB`);
            }
            console.log('');
            db.close();
          });
        }
      });
    });
  });
}

// Execute custom query
function executeCustomQuery(query) {
  console.log(`\n🔍 Executing query:\n  ${query}\n`);
  console.log('Results:\n');
  
  executeQuery(query, (err, rows) => {
    if (err) {
      db.close();
      return;
    }
    
    if (rows.length === 0) {
      console.log('  No results found');
    } else {
      // Print header
      const firstRow = rows[0];
      const columns = Object.keys(firstRow);
      console.log('  ' + columns.join(' | '));
      console.log('  ' + '-'.repeat(columns.join(' | ').length));
      
      // Print rows (limit to 50 for display)
      const displayRows = rows.slice(0, 50);
      displayRows.forEach(row => {
        const values = columns.map(col => {
          const value = row[col];
          if (value === null) return 'NULL';
          if (typeof value === 'string' && value.length > 30) {
            return value.substring(0, 27) + '...';
          }
          return String(value);
        });
        console.log('  ' + values.join(' | '));
      });
      
      if (rows.length > 50) {
        console.log(`\n  ... and ${rows.length - 50} more rows`);
      }
      
      console.log(`\n  Total: ${rows.length} rows`);
    }
    console.log('');
    db.close();
  });
}

// Export table to JSON
function exportTable(tableName, outputFile) {
  console.log(`\n📤 Exporting table '${tableName}' to '${outputFile}'...\n`);
  
  executeQuery(`SELECT * FROM ${tableName}`, (err, rows) => {
    if (err) {
      db.close();
      return;
    }
    
    const jsonData = JSON.stringify(rows, null, 2);
    fs.writeFileSync(outputFile, jsonData, 'utf8');
    
    console.log(`✅ Exported ${rows.length} rows to ${outputFile}`);
    console.log(`   File size: ${(jsonData.length / 1024).toFixed(2)} KB\n`);
    db.close();
  });
}

// Main command handler
if (!command || command === '--help' || command === '-h') {
  console.log(`
📚 Database Explorer - Usage Guide

Commands:
  node explore-database.js                    - Show this help
  node explore-database.js --tables            - List all tables
  node explore-database.js --schema <table>   - Show schema of a table
  node explore-database.js --stats            - Show database statistics
  node explore-database.js --query "<SQL>"    - Execute custom SQL query
  node explore-database.js --export <table> <file> - Export table to JSON

Examples:
  node explore-database.js --tables
  node explore-database.js --schema production_liquid
  node explore-database.js --stats
  node explore-database.js --query "SELECT * FROM production_liquid LIMIT 10"
  node explore-database.js --export production_liquid output.json
`);
  db.close();
} else if (command === '--tables') {
  listTables();
} else if (command === '--schema') {
  const tableName = args[1];
  if (!tableName) {
    console.error('❌ Please specify table name: --schema <table_name>');
    db.close();
  } else {
    showSchema(tableName);
  }
} else if (command === '--stats') {
  showStats();
} else if (command === '--query') {
  const query = args.slice(1).join(' ');
  if (!query) {
    console.error('❌ Please provide SQL query: --query "<SQL>"');
    db.close();
  } else {
    executeCustomQuery(query);
  }
} else if (command === '--export') {
  const tableName = args[1];
  const outputFile = args[2] || `${tableName}_export.json`;
  if (!tableName) {
    console.error('❌ Please specify table name: --export <table_name> [output_file]');
    db.close();
  } else {
    exportTable(tableName, outputFile);
  }
} else {
  console.error(`❌ Unknown command: ${command}`);
  console.log('Use --help to see available commands');
  db.close();
}

