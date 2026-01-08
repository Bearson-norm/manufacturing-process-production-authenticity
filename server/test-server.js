// Test Server Response
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
  console.log('🧪 Testing server endpoints...\n');

  const endpoints = [
    '/health',
    '/api/pic',
    '/api/production/liquid',
    '/'
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`Testing ${endpoint}...`);
      const response = await testEndpoint(endpoint);
      console.log(`✅ Status: ${response.statusCode}`);
      console.log(`   Body: ${response.body.substring(0, 100)}${response.body.length > 100 ? '...' : ''}`);
      console.log('');
    } catch (error) {
      console.log(`❌ Error: ${error.message}\n`);
    }
  }
}

runTests().catch(console.error);

