const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Helper function to parse authenticity data
function parseAuthenticityData(data) {
  try {
    return typeof data === 'string' ? JSON.parse(data) : data;
  } catch (e) {
    return [];
  }
}

// Function to migrate a table
function migrateTable(tableName) {
  return new Promise((resolve, reject) => {
    console.log(`\nMigrating table: ${tableName}`);
    
    // Get all rows from the table
    db.all(`SELECT * FROM ${tableName} ORDER BY id`, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      console.log(`Found ${rows.length} rows to process`);
      
      let processedCount = 0;
      let newRowsCount = 0;
      let skippedCount = 0;
      
      // Process each row
      const processRow = (index) => {
        if (index >= rows.length) {
          console.log(`Migration completed for ${tableName}:`);
          console.log(`  - Processed: ${processedCount} rows`);
          console.log(`  - New rows created: ${newRowsCount}`);
          console.log(`  - Skipped (already single entry): ${skippedCount}`);
          resolve();
          return;
        }
        
        const row = rows[index];
        const authenticityData = parseAuthenticityData(row.authenticity_data);
        
        // If authenticity_data has only one entry, skip (already in correct format)
        if (!Array.isArray(authenticityData) || authenticityData.length <= 1) {
          skippedCount++;
          processedCount++;
          processRow(index + 1);
          return;
        }
        
        // Delete the original row
        db.run(`DELETE FROM ${tableName} WHERE id = ?`, [row.id], (deleteErr) => {
          if (deleteErr) {
            console.error(`Error deleting row ${row.id}:`, deleteErr);
            processedCount++;
            processRow(index + 1);
            return;
          }
          
          // Insert separate rows for each authenticity data entry
          let insertCount = 0;
          const insertNext = (authIndex) => {
            if (authIndex >= authenticityData.length) {
              newRowsCount += authenticityData.length;
              processedCount++;
              processRow(index + 1);
              return;
            }
            
            const authRow = authenticityData[authIndex];
            db.run(
              `INSERT INTO ${tableName} (session_id, leader_name, shift_number, pic, mo_number, sku_name, authenticity_data, status, created_at) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                row.session_id,
                row.leader_name,
                row.shift_number,
                row.pic,
                row.mo_number,
                row.sku_name,
                JSON.stringify([authRow]), // Store as array with single entry
                row.status || 'active',
                row.created_at
              ],
              (insertErr) => {
                if (insertErr) {
                  console.error(`Error inserting row for ${row.id}, auth index ${authIndex}:`, insertErr);
                }
                insertNext(authIndex + 1);
              }
            );
          };
          
          insertNext(0);
        });
      };
      
      processRow(0);
    });
  });
}

// Main migration function
async function migrate() {
  console.log('Starting database migration...');
  console.log('This will split rows with multiple authenticity_data entries into separate rows.');
  console.log('Make sure you have a backup of your database before proceeding!\n');
  
  try {
    // Migrate all three production tables
    await migrateTable('production_liquid');
    await migrateTable('production_device');
    await migrateTable('production_cartridge');
    
    console.log('\n✅ Migration completed successfully!');
    db.close();
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    db.close();
    process.exit(1);
  }
}

// Run migration
migrate();

