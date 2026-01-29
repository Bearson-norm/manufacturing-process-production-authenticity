const { db } = require('./database');

console.log('🔍 Debugging MO Sync Issue...\n');

// Check if MO PROD/MO/29884 exists in cache
console.log('1. Checking if PROD/MO/29884 exists in cache...');
db.get(
  'SELECT * FROM odoo_mo_cache WHERE mo_number = $1',
  ['PROD/MO/29884'],
  (err, row) => {
    if (err) {
      console.error('❌ Error querying database:', err);
    } else if (row) {
      console.log('✅ Found MO in cache:');
      console.log(JSON.stringify(row, null, 2));
    } else {
      console.log('❌ MO PROD/MO/29884 NOT FOUND in cache');
    }
    
    // Check all recent MOs with "cartridge" in note (with typo tolerance)
    console.log('\n2. Checking all cartridge MOs in cache (last 30 days)...');
    console.log('   (Including common typos: cartridge, cartirdge, cartrige)');
    db.all(
      `SELECT mo_number, sku_name, note, create_date, fetched_at, last_updated 
       FROM odoo_mo_cache 
       WHERE (LOWER(note) LIKE LOWER($1) OR LOWER(note) LIKE LOWER($2) OR LOWER(note) LIKE LOWER($3))
         AND create_date::TIMESTAMP >= NOW() - INTERVAL '30 days'
       ORDER BY create_date DESC
       LIMIT 20`,
      ['%cartridge%', '%cartirdge%', '%cartrige%'],
      (err2, rows) => {
        if (err2) {
          console.error('❌ Error querying cartridge MOs:', err2);
        } else {
          console.log(`✅ Found ${rows?.length || 0} cartridge MOs in cache (last 30 days):`);
          rows?.forEach((r, i) => {
            console.log(`${i + 1}. ${r.mo_number} - ${r.sku_name}`);
            console.log(`   Note: ${r.note}`);
            console.log(`   Created: ${r.create_date}`);
            console.log(`   Fetched: ${r.fetched_at}`);
            console.log(`   Updated: ${r.last_updated}\n`);
          });
        }
        
        // Check total MOs in cache
        console.log('3. Checking total MOs in cache...');
        db.get(
          'SELECT COUNT(*) as total FROM odoo_mo_cache',
          [],
          (err3, countRow) => {
            if (err3) {
              console.error('❌ Error counting MOs:', err3);
            } else {
              console.log(`✅ Total MOs in cache: ${countRow?.total || 0}`);
            }
            
            // Check if there are any MOs with number close to 29884
            console.log('\n4. Checking MOs with numbers close to 29884...');
            db.all(
              `SELECT mo_number, sku_name, note, create_date 
               FROM odoo_mo_cache 
               WHERE mo_number LIKE '%29884%'
                  OR mo_number LIKE '%29883%'
                  OR mo_number LIKE '%29885%'
               ORDER BY mo_number`,
              [],
              (err4, closeRows) => {
                if (err4) {
                  console.error('❌ Error querying close MOs:', err4);
                } else if (closeRows && closeRows.length > 0) {
                  console.log(`✅ Found ${closeRows.length} MOs with similar numbers:`);
                  closeRows.forEach(r => {
                    console.log(`- ${r.mo_number}: ${r.sku_name}`);
                    console.log(`  Note: ${r.note}`);
                    console.log(`  Created: ${r.create_date}\n`);
                  });
                } else {
                  console.log('❌ No MOs found with numbers close to 29884');
                }
                
                // Check the last sync time
                console.log('5. Checking last sync time...');
                db.get(
                  'SELECT MAX(fetched_at) as last_sync FROM odoo_mo_cache',
                  [],
                  (err5, syncRow) => {
                    if (err5) {
                      console.error('❌ Error checking last sync:', err5);
                    } else {
                      console.log(`✅ Last sync time: ${syncRow?.last_sync || 'Never'}`);
                      
                      if (syncRow?.last_sync) {
                        const lastSync = new Date(syncRow.last_sync);
                        const now = new Date();
                        const hoursSince = (now - lastSync) / (1000 * 60 * 60);
                        console.log(`   Hours since last sync: ${hoursSince.toFixed(2)}`);
                        
                        if (hoursSince > 6) {
                          console.log('⚠️  WARNING: Last sync was more than 6 hours ago!');
                        }
                      }
                    }
                    
                    console.log('\n📋 SUMMARY:');
                    console.log('============');
                    console.log('If PROD/MO/29884 is not in cache, possible reasons:');
                    console.log('1. MO does not exist in Odoo');
                    console.log('2. MO note does not contain "cartridge" keyword');
                    console.log('3. MO create_date is older than 30 days');
                    console.log('4. Scheduler has not run yet or encountered an error');
                    console.log('5. Odoo session expired or API credentials invalid');
                    console.log('\nTo fix:');
                    console.log('- Check server logs for scheduler errors');
                    console.log('- Manually trigger sync: Call POST /api/admin/sync-mo');
                    console.log('- Verify Odoo credentials in admin config');
                    
                    process.exit(0);
                  }
                );
              }
            );
          }
        );
      }
    );
  }
);
