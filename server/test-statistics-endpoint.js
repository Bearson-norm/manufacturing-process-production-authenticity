// Test Statistics Endpoint
const http = require('http');

function testEndpoint(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 1234,
      path: path,
      method: 'GET',
      timeout: 10000
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

async function test() {
  console.log('🧪 Testing Statistics Endpoint...\n');
  
  try {
    const response = await testEndpoint('/api/statistics/production-by-leader?period=day');
    
    console.log(`Status: ${response.statusCode}`);
    
    if (response.statusCode === 200) {
      const data = JSON.parse(response.body);
      console.log('✅ Success!');
      console.log(`Data items: ${data.data ? data.data.length : 0}`);
      console.log(`Period: ${data.period}`);
      
      if (data.data && data.data.length > 0) {
        console.log('\nSample data:');
        console.log(JSON.stringify(data.data[0], null, 2));
      }
    } else {
      console.log('❌ Error Response:');
      console.log(response.body);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

test();
