// Check if SQLite database has data
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const sqlitePath = path.join(__dirname, 'database.sqlite');

console.log('🔍 Checking SQLite database for existing data...\n');
console.log('SQLite path:', sqlitePath);

if (!fs.existsSync(sqlitePath)) {
  console.log('❌ SQLite database not found!');
  console.log('   This means there is no old data to migrate.');
  console.log('\n💡 If this is a fresh install, you can start using the app.');
  console.log('   Data will be created as you use the application.\n');
  process.exit(0);
}

console.log('✅ SQLite database found!\n');

const db = new sqlite3.Database(sqlitePath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('❌ Error opening SQLite database:', err.message);
    process.exit(1);
  }
});

const tables = [
  'production_liquid',
  'production_device',
  'production_cartridge',
  'production_results',
  'production_combined',
  'pic_list'
];

let checksComplete = 0;
let hasData = false;

tables.forEach(tableName => {
  db.get(`SELECT COUNT(*) as count FROM ${tableName}`, [], (err, row) => {
    checksComplete++;
    
    if (err) {
      console.log(`⚠️  ${tableName}: Table doesn't exist or error`);
    } else {
      const count = row.count;
      if (count > 0) {
        hasData = true;
        console.log(`✅ ${tableName}: ${count} records`);
        
        // Show sample
        db.all(`SELECT * FROM ${tableName} LIMIT 2`, [], (err2, rows) => {
          if (!err2 && rows.length > 0) {
            console.log(`   Sample:`, JSON.stringify(rows[0], null, 2).substring(0, 200) + '...');
          }
        });
      } else {
        console.log(`⚠️  ${tableName}: Empty (0 records)`);
      }
    }
    
    if (checksComplete === tables.length) {
      setTimeout(() => {
        console.log('\n' + '='.repeat(60));
        if (hasData) {
          console.log('\n✅ SQLite has data! You should run migration:');
          console.log('   npm run migrate\n');
        } else {
          console.log('\n⚠️  SQLite database is empty.');
          console.log('   No data to migrate. Start fresh with PostgreSQL!\n');
        }
        db.close();
        process.exit(0);
      }, 1000);
    }
  });
});
