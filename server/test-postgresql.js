// Test PostgreSQL Connection
const { db } = require('./database');

console.log('Testing PostgreSQL connection...\n');

// Test 1: Basic connection
console.log('1. Testing basic connection...');
db.get('SELECT 1 as test', [], (err, result) => {
  if (err) {
    console.error('❌ Connection failed:', err.message);
    process.exit(1);
  }
  console.log('✅ Connection successful!\n');

  // Test 2: Check tables
  console.log('2. Checking if tables exist...');
  const tables = [
    'production_liquid',
    'production_device',
    'production_cartridge',
    'buffer_liquid',
    'buffer_device',
    'buffer_cartridge',
    'reject_liquid',
    'reject_device',
    'reject_cartridge',
    'production_combined',
    'production_results',
    'odoo_mo_cache',
    'admin_config',
    'pic_list'
  ];

  let checkCount = 0;
  let existsCount = 0;

  tables.forEach(tableName => {
    db.get(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
      [tableName],
      (err, row) => {
        checkCount++;
        if (!err && row) {
          existsCount++;
          console.log(`   ✅ ${tableName}`);
        } else {
          console.log(`   ❌ ${tableName} - not found`);
        }

        if (checkCount === tables.length) {
          console.log(`\n   Found ${existsCount}/${tables.length} tables\n`);

          if (existsCount > 0) {
            // Test 3: Check PIC list
            console.log('3. Checking PIC list...');
            db.all('SELECT COUNT(*) as count FROM pic_list', [], (err, rows) => {
              if (err) {
                console.error('❌ Error checking PIC list:', err.message);
              } else {
                const count = rows[0].count;
                console.log(`✅ PIC list has ${count} entries\n`);
              }

              // Test 4: Insert and query test
              console.log('4. Testing insert and query...');
              const testData = {
                session_id: 'TEST-' + Date.now(),
                leader_name: 'Test Leader',
                shift_number: '1',
                pic: 'Test PIC',
                mo_number: 'MO-TEST-001',
                sku_name: 'Test SKU',
                authenticity_data: JSON.stringify({ test: true })
              };

              db.run(
                `INSERT INTO production_liquid (session_id, leader_name, shift_number, pic, mo_number, sku_name, authenticity_data)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                  testData.session_id,
                  testData.leader_name,
                  testData.shift_number,
                  testData.pic,
                  testData.mo_number,
                  testData.sku_name,
                  testData.authenticity_data
                ],
                function (err) {
                  if (err) {
                    console.error('❌ Insert failed:', err.message);
                    process.exit(1);
                  }
                  console.log('✅ Test data inserted');

                  // Query the test data
                  db.get(
                    'SELECT * FROM production_liquid WHERE session_id = $1',
                    [testData.session_id],
                    (err, row) => {
                      if (err) {
                        console.error('❌ Query failed:', err.message);
                        process.exit(1);
                      }
                      if (!row) {
                        console.error('❌ Test data not found');
                        process.exit(1);
                      }
                      console.log('✅ Test data queried successfully');

                      // Clean up test data
                      db.run(
                        'DELETE FROM production_liquid WHERE session_id = $1',
                        [testData.session_id],
                        (err) => {
                          if (err) {
                            console.error('❌ Cleanup failed:', err.message);
                          } else {
                            console.log('✅ Test data cleaned up');
                          }

                          console.log('\n=================================');
                          console.log('✅ All tests passed!');
                          console.log('PostgreSQL is ready to use.');
                          console.log('=================================\n');
                          process.exit(0);
                        }
                      );
                    }
                  );
                }
              );
            });
          } else {
            console.log('⚠️  No tables found. Run the server first to create tables.');
            process.exit(1);
          }
        }
      }
    );
  });
});


