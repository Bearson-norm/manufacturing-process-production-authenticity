// Test All Important Endpoints
const http = require('http');

function testEndpoint(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 1234,
      path: path,
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing Manufacturing Server Endpoints\n');
  console.log('Server: http://localhost:1234\n');
  console.log('='.repeat(60));

  const endpoints = [
    { name: 'Health Check', path: '/health' },
    { name: 'Main Page', path: '/' },
    { name: 'PIC List (Active)', path: '/api/pic/list' },
    { name: 'PIC All', path: '/api/pic/all' },
    { name: 'Production Liquid', path: '/api/production/liquid' },
    { name: 'Production Device', path: '/api/production/device' },
    { name: 'Production Cartridge', path: '/api/production/cartridge' },
    { name: 'Combined Production', path: '/api/combined-production' },
    { name: 'Admin Config', path: '/api/admin/config' },
    { name: 'MO Stats', path: '/api/admin/mo-stats' },
  ];

  let successCount = 0;
  let errorCount = 0;

  for (const endpoint of endpoints) {
    try {
      const response = await testEndpoint(endpoint.path);
      const status = response.statusCode;
      const isSuccess = status >= 200 && status < 300;
      
      if (isSuccess) {
        successCount++;
        console.log(`✅ ${endpoint.name}`);
        console.log(`   Path: ${endpoint.path}`);
        console.log(`   Status: ${status}`);
        
        // Parse and show first bit of response
        try {
          const json = JSON.parse(response.body);
          if (json.data && Array.isArray(json.data)) {
            console.log(`   Data: ${json.data.length} items`);
          } else if (json.status) {
            console.log(`   Status: ${json.status}`);
          }
        } catch (e) {
          // HTML or other response
          const preview = response.body.substring(0, 50).replace(/\n/g, ' ');
          console.log(`   Body: ${preview}...`);
        }
      } else {
        errorCount++;
        console.log(`❌ ${endpoint.name}`);
        console.log(`   Path: ${endpoint.path}`);
        console.log(`   Status: ${status}`);
        console.log(`   Body: ${response.body.substring(0, 100)}`);
      }
      console.log('');
    } catch (error) {
      errorCount++;
      console.log(`❌ ${endpoint.name}`);
      console.log(`   Path: ${endpoint.path}`);
      console.log(`   Error: ${error.message}\n`);
    }
  }

  console.log('='.repeat(60));
  console.log(`\n📊 Test Results:`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📦 Total: ${endpoints.length}\n`);

  if (successCount > 0) {
    console.log('🎉 Server is responding!');
    console.log('\n📝 Access in browser:');
    console.log('   Main App: http://localhost:1234/');
    console.log('   Health: http://localhost:1234/health');
    console.log('   PIC List: http://localhost:1234/api/pic/list');
  }
}

runTests().catch(console.error);

