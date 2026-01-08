#!/usr/bin/env node

/**
 * Test script untuk Production Report API
 * 
 * Usage:
 *   node odooAPI/test_production_report.js
 */

const http = require('http');

const BASE_URL = process.env.API_URL || 'http://localhost:1234';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function makeRequest(path, callback) {
  const url = new URL(path, BASE_URL);
  
  console.log(`${colors.cyan}→ Testing:${colors.reset} GET ${url.pathname}${url.search}`);
  
  http.get(url, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        callback(null, { statusCode: res.statusCode, data: json });
      } catch (e) {
        callback(new Error('Invalid JSON response'), { statusCode: res.statusCode, data: data });
      }
    });
  }).on('error', (err) => {
    callback(err);
  });
}

function testCase(name, path, expectedStatus, validate) {
  return new Promise((resolve, reject) => {
    console.log(`\n${colors.blue}TEST:${colors.reset} ${name}`);
    
    makeRequest(path, (err, result) => {
      if (err) {
        console.log(`${colors.red}✗ FAIL:${colors.reset} ${err.message}`);
        reject(err);
        return;
      }
      
      const { statusCode, data } = result;
      
      // Check status code
      if (statusCode !== expectedStatus) {
        console.log(`${colors.red}✗ FAIL:${colors.reset} Expected status ${expectedStatus}, got ${statusCode}`);
        reject(new Error(`Status code mismatch`));
        return;
      }
      
      // Run custom validation
      try {
        validate(data);
        console.log(`${colors.green}✓ PASS${colors.reset}`);
        resolve();
      } catch (e) {
        console.log(`${colors.red}✗ FAIL:${colors.reset} ${e.message}`);
        reject(e);
      }
    });
  });
}

async function runTests() {
  console.log(`${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}  Production Report API Test Suite${colors.reset}`);
  console.log(`${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`Base URL: ${BASE_URL}\n`);
  
  let passed = 0;
  let failed = 0;
  
  const tests = [
    // Test 1: Basic query
    async () => {
      await testCase(
        'Basic query - Get all production report',
        '/api/production/report',
        200,
        (data) => {
          if (!data.success) throw new Error('Response success should be true');
          if (typeof data.total !== 'number') throw new Error('Total should be a number');
          if (!Array.isArray(data.data)) throw new Error('Data should be an array');
          console.log(`  ${colors.yellow}→${colors.reset} Total records: ${data.total}`);
        }
      );
    },
    
    // Test 2: Filter by type - liquid
    async () => {
      await testCase(
        'Filter by type=liquid',
        '/api/production/report?type=liquid',
        200,
        (data) => {
          if (!data.success) throw new Error('Response success should be true');
          if (!Array.isArray(data.data)) throw new Error('Data should be an array');
          
          // Check if all records are liquid type
          const allLiquid = data.data.every(item => item.production_type === 'liquid');
          if (!allLiquid) throw new Error('All records should be liquid type');
          
          console.log(`  ${colors.yellow}→${colors.reset} Total liquid records: ${data.total}`);
        }
      );
    },
    
    // Test 3: Filter by type - device
    async () => {
      await testCase(
        'Filter by type=device',
        '/api/production/report?type=device',
        200,
        (data) => {
          if (!data.success) throw new Error('Response success should be true');
          if (!Array.isArray(data.data)) throw new Error('Data should be an array');
          
          // Check if all records are device type
          const allDevice = data.data.every(item => item.production_type === 'device');
          if (!allDevice) throw new Error('All records should be device type');
          
          console.log(`  ${colors.yellow}→${colors.reset} Total device records: ${data.total}`);
        }
      );
    },
    
    // Test 4: Filter by type - cartridge
    async () => {
      await testCase(
        'Filter by type=cartridge',
        '/api/production/report?type=cartridge',
        200,
        (data) => {
          if (!data.success) throw new Error('Response success should be true');
          if (!Array.isArray(data.data)) throw new Error('Data should be an array');
          
          // Check if all records are cartridge type
          const allCartridge = data.data.every(item => item.production_type === 'cartridge');
          if (!allCartridge) throw new Error('All records should be cartridge type');
          
          console.log(`  ${colors.yellow}→${colors.reset} Total cartridge records: ${data.total}`);
        }
      );
    },
    
    // Test 5: Filter by status - active
    async () => {
      await testCase(
        'Filter by status=active',
        '/api/production/report?status=active',
        200,
        (data) => {
          if (!data.success) throw new Error('Response success should be true');
          if (!Array.isArray(data.data)) throw new Error('Data should be an array');
          
          // Check if all records have active status
          const allActive = data.data.every(item => item.status === 'active');
          if (!allActive) throw new Error('All records should have active status');
          
          console.log(`  ${colors.yellow}→${colors.reset} Total active records: ${data.total}`);
        }
      );
    },
    
    // Test 6: Pagination - limit
    async () => {
      await testCase(
        'Pagination with limit=5',
        '/api/production/report?limit=5',
        200,
        (data) => {
          if (!data.success) throw new Error('Response success should be true');
          if (!Array.isArray(data.data)) throw new Error('Data should be an array');
          if (data.data.length > 5) throw new Error('Should return max 5 records');
          if (data.limit !== 5) throw new Error('Limit should be 5');
          
          console.log(`  ${colors.yellow}→${colors.reset} Returned ${data.data.length} records (limit: 5)`);
        }
      );
    },
    
    // Test 7: Pagination - offset
    async () => {
      await testCase(
        'Pagination with limit=5&offset=5',
        '/api/production/report?limit=5&offset=5',
        200,
        (data) => {
          if (!data.success) throw new Error('Response success should be true');
          if (!Array.isArray(data.data)) throw new Error('Data should be an array');
          if (data.offset !== 5) throw new Error('Offset should be 5');
          
          console.log(`  ${colors.yellow}→${colors.reset} Returned ${data.data.length} records (offset: 5)`);
        }
      );
    },
    
    // Test 8: Check data structure
    async () => {
      await testCase(
        'Validate data structure',
        '/api/production/report?limit=1',
        200,
        (data) => {
          if (!data.success) throw new Error('Response success should be true');
          if (!Array.isArray(data.data) || data.data.length === 0) {
            console.log(`  ${colors.yellow}→${colors.reset} No data available to validate structure (skipping)`);
            return;
          }
          
          const record = data.data[0];
          const requiredFields = [
            'pic_input',
            'sku_name',
            'mo_number',
            'production_type',
            'created_at'
          ];
          
          for (const field of requiredFields) {
            if (!(field in record)) {
              throw new Error(`Missing required field: ${field}`);
            }
          }
          
          console.log(`  ${colors.yellow}→${colors.reset} Sample record:`, JSON.stringify(record, null, 2));
        }
      );
    },
    
    // Test 9: Combined filters
    async () => {
      await testCase(
        'Combined filters (type=liquid&status=active)',
        '/api/production/report?type=liquid&status=active&limit=3',
        200,
        (data) => {
          if (!data.success) throw new Error('Response success should be true');
          if (!Array.isArray(data.data)) throw new Error('Data should be an array');
          
          // Check if all records match filters
          const allMatch = data.data.every(item => 
            item.production_type === 'liquid' && 
            item.status === 'active'
          );
          
          if (!allMatch) throw new Error('All records should match filter criteria');
          
          console.log(`  ${colors.yellow}→${colors.reset} Total matching records: ${data.total}`);
        }
      );
    },
    
    // Test 10: Invalid type
    async () => {
      await testCase(
        'Invalid production type',
        '/api/production/report?type=invalid',
        400,
        (data) => {
          if (data.success !== false) throw new Error('Response success should be false for invalid type');
          console.log(`  ${colors.yellow}→${colors.reset} Error handled correctly`);
        }
      );
    }
  ];
  
  // Run all tests
  for (const test of tests) {
    try {
      await test();
      passed++;
    } catch (e) {
      failed++;
    }
  }
  
  // Summary
  console.log(`\n${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}  Test Summary${colors.reset}`);
  console.log(`${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.green}Passed:${colors.reset} ${passed}`);
  console.log(`${colors.red}Failed:${colors.reset} ${failed}`);
  console.log(`Total:  ${passed + failed}\n`);
  
  if (failed > 0) {
    console.log(`${colors.red}Some tests failed. Please check the errors above.${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`${colors.green}All tests passed!${colors.reset}\n`);
    process.exit(0);
  }
}

// Run tests
runTests().catch((err) => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, err);
  process.exit(1);
});


