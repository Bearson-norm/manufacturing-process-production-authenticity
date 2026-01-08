// Check Data in PostgreSQL
const { db } = require('./database');

async function checkData() {
  console.log('🔍 Checking data in PostgreSQL database...\n');
  
  const tables = [
    { name: 'production_liquid', label: 'Production Liquid' },
    { name: 'production_device', label: 'Production Device' },
    { name: 'production_cartridge', label: 'Production Cartridge' },
    { name: 'pic_list', label: 'PIC List' },
    { name: 'odoo_mo_cache', label: 'MO Cache' },
    { name: 'admin_config', label: 'Admin Config' },
    { name: 'production_results', label: 'Production Results' },
    { name: 'production_combined', label: 'Production Combined' },
  ];

  for (const table of tables) {
    db.get(`SELECT COUNT(*) as count FROM ${table.name}`, [], (err, row) => {
      if (err) {
        console.log(`❌ ${table.label}: Error - ${err.message}`);
      } else {
        const count = parseInt(row.count);
        if (count > 0) {
          console.log(`✅ ${table.label}: ${count} records`);
          
          // Show sample data for main tables
          if (['production_liquid', 'production_device', 'production_cartridge'].includes(table.name)) {
            db.all(`SELECT id, mo_number, sku_name, created_at FROM ${table.name} LIMIT 3`, [], (err2, rows) => {
              if (!err2 && rows.length > 0) {
                console.log(`   Sample data:`);
                rows.forEach(r => {
                  console.log(`   - ID: ${r.id}, MO: ${r.mo_number}, SKU: ${r.sku_name}`);
                });
              }
            });
          }
        } else {
          console.log(`⚠️  ${table.label}: Empty (0 records)`);
        }
      }
    });
  }

  // Check PIC list specifically
  setTimeout(() => {
    console.log('\n📋 Checking PIC List in detail...');
    db.all('SELECT * FROM pic_list LIMIT 10', [], (err, rows) => {
      if (err) {
        console.log('❌ Error:', err.message);
      } else if (rows.length === 0) {
        console.log('⚠️  PIC list is empty!');
      } else {
        console.log(`✅ Found ${rows.length} PICs (showing first 10):`);
        rows.forEach((row, idx) => {
          console.log(`   ${idx + 1}. ${row.name} (Active: ${row.is_active})`);
        });
      }
      
      // Exit after checking
      setTimeout(() => {
        process.exit(0);
      }, 1000);
    });
  }, 2000);
}

console.log('Connecting to PostgreSQL...\n');
checkData();
