// Test script untuk API Production Combined
// Jalankan dengan: node test-combined-api.js

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api/production/combined';

// Fungsi untuk delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Test data dummy
const dummyData = {
  liquid: {
    production_type: 'liquid',
    session_id: `Bagas Prasetya_1_${Date.now()}`,
    leader_name: 'Bagas Prasetya',
    shift_number: '1',
    pic: 'Operator Liquid A',
    mo_number: 'MO-LIQUID-001',
    sku_name: 'Liquid SKU 001',
    authenticity_data: [
      {
        firstAuthenticity: 'LIQ001',
        lastAuthenticity: 'LIQ100',
        rollNumber: 'ROLL-001'
      },
      {
        firstAuthenticity: 'LIQ101',
        lastAuthenticity: 'LIQ200',
        rollNumber: 'ROLL-002'
      }
    ]
  },
  device: {
    production_type: 'device',
    session_id: `Hikmatul Iman_2_${Date.now()}`,
    leader_name: 'Hikmatul Iman',
    shift_number: '2',
    pic: 'Operator Device B',
    mo_number: 'MO-DEVICE-001',
    sku_name: 'Device SKU 001',
    authenticity_data: [
      {
        firstAuthenticity: 'DEV001',
        lastAuthenticity: 'DEV100',
        rollNumber: 'ROLL-001'
      }
    ]
  },
  cartridge: {
    production_type: 'cartridge',
    session_id: `Farhan Rizky Wahyudi_1_${Date.now()}`,
    leader_name: 'Farhan Rizky Wahyudi',
    shift_number: '1',
    pic: 'Operator Cartridge C',
    mo_number: 'MO-CARTRIDGE-001',
    sku_name: 'Cartridge SKU 001',
    authenticity_data: [
      {
        firstAuthenticity: 'CAR001',
        lastAuthenticity: 'CAR100',
        rollNumber: 'ROLL-001'
      }
    ]
  }
};

async function testPOST() {
  console.log('\n=== Testing POST /api/production/combined ===\n');
  
  try {
    // Test insert Liquid
    console.log('1. Inserting Liquid data...');
    const liquidResponse = await axios.post(BASE_URL, dummyData.liquid);
    console.log('✅ Liquid data inserted:', liquidResponse.data.saved_count, 'rows');
    
    await delay(500);
    
    // Test insert Device
    console.log('2. Inserting Device data...');
    const deviceResponse = await axios.post(BASE_URL, dummyData.device);
    console.log('✅ Device data inserted:', deviceResponse.data.saved_count, 'rows');
    
    await delay(500);
    
    // Test insert Cartridge
    console.log('3. Inserting Cartridge data...');
    const cartridgeResponse = await axios.post(BASE_URL, dummyData.cartridge);
    console.log('✅ Cartridge data inserted:', cartridgeResponse.data.saved_count, 'rows');
    
    return {
      liquidMO: dummyData.liquid.mo_number,
      deviceMO: dummyData.device.mo_number,
      cartridgeMO: dummyData.cartridge.mo_number
    };
  } catch (error) {
    console.error('❌ Error in POST test:', error.response?.data || error.message);
    throw error;
  }
}

async function testGET(moNumbers) {
  console.log('\n=== Testing GET /api/production/combined ===\n');
  
  try {
    // Test 1: Get all data
    console.log('1. Getting all data...');
    const allResponse = await axios.get(BASE_URL);
    console.log(`✅ Found ${allResponse.data.count} records`);
    
    await delay(300);
    
    // Test 2: Get by MO Number
    console.log(`2. Getting data by MO Number: ${moNumbers.liquidMO}...`);
    const moResponse = await axios.get(BASE_URL, {
      params: { moNumber: moNumbers.liquidMO }
    });
    console.log(`✅ Found ${moResponse.data.count} records with MO Number ${moNumbers.liquidMO}`);
    
    await delay(300);
    
    // Test 3: Get by production type
    console.log('3. Getting data by production_type: liquid...');
    const typeResponse = await axios.get(BASE_URL, {
      params: { production_type: 'liquid' }
    });
    console.log(`✅ Found ${typeResponse.data.count} liquid records`);
    
    await delay(300);
    
    // Test 4: Get by date (today)
    const today = new Date().toISOString().split('T')[0];
    console.log(`4. Getting data by created_at: ${today}...`);
    const dateResponse = await axios.get(BASE_URL, {
      params: { created_at: today }
    });
    console.log(`✅ Found ${dateResponse.data.count} records created today`);
    
    await delay(300);
    
    // Test 5: Combined filters
    console.log(`5. Getting data with combined filters (MO Number + production_type)...`);
    const combinedResponse = await axios.get(BASE_URL, {
      params: {
        moNumber: moNumbers.liquidMO,
        production_type: 'liquid'
      }
    });
    console.log(`✅ Found ${combinedResponse.data.count} records matching filters`);
    
  } catch (error) {
    console.error('❌ Error in GET test:', error.response?.data || error.message);
    throw error;
  }
}

async function runTests() {
  console.log('🚀 Starting API Tests for Production Combined\n');
  console.log('Make sure the server is running on http://localhost:5000\n');
  
  try {
    // Test POST
    const moNumbers = await testPOST();
    
    // Wait a bit for data to be saved
    await delay(1000);
    
    // Test GET
    await testGET(moNumbers);
    
    console.log('\n✅ All tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Tests failed:', error.message);
    process.exit(1);
  }
}

// Run tests
runTests();

