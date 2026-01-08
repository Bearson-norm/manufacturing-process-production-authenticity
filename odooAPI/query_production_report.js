#!/usr/bin/env node

/**
 * Script untuk query data produksi dengan informasi:
 * - PIC Input
 * - SKU
 * - MO ID
 * - Roll
 * - First Authenticity ID
 * - Last Authenticity ID
 * 
 * Usage:
 *   node odooAPI/query_production_report.js [options]
 * 
 * Options:
 *   --type=TYPE              Production type: liquid, device, cartridge, atau all (default: all)
 *   --mo=MO_NUMBER          Filter berdasarkan MO Number
 *   --pic=PIC_NAME          Filter berdasarkan PIC name
 *   --date-from=DATE        Filter dari tanggal (format: YYYY-MM-DD)
 *   --date-to=DATE          Filter sampai tanggal (format: YYYY-MM-DD)
 *   --status=STATUS         Filter by status: active, completed, atau all (default: all)
 *   --output=FORMAT         Output format: table, json, atau csv (default: table)
 *   --help, -h              Show this help message
 * 
 * Examples:
 *   # Semua data produksi
 *   node odooAPI/query_production_report.js
 * 
 *   # Data produksi liquid saja
 *   node odooAPI/query_production_report.js --type=liquid
 * 
 *   # Filter berdasarkan MO Number
 *   node odooAPI/query_production_report.js --mo=MO001
 * 
 *   # Filter berdasarkan tanggal
 *   node odooAPI/query_production_report.js --date-from=2025-01-01 --date-to=2025-01-31
 * 
 *   # Output dalam format CSV
 *   node odooAPI/query_production_report.js --output=csv
 * 
 *   # Output dalam format JSON
 *   node odooAPI/query_production_report.js --output=json --type=device
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);

// Show help if requested
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node odooAPI/query_production_report.js [options]

Options:
  --type=TYPE              Production type: liquid, device, cartridge, atau all (default: all)
  --mo=MO_NUMBER          Filter berdasarkan MO Number
  --pic=PIC_NAME          Filter berdasarkan PIC name
  --date-from=DATE        Filter dari tanggal (format: YYYY-MM-DD)
  --date-to=DATE          Filter sampai tanggal (format: YYYY-MM-DD)
  --status=STATUS         Filter by status: active, completed, atau all (default: all)
  --output=FORMAT         Output format: table, json, atau csv (default: table)
  --help, -h              Show this help message

Examples:
  # Semua data produksi
  node odooAPI/query_production_report.js
  
  # Data produksi liquid saja
  node odooAPI/query_production_report.js --type=liquid
  
  # Filter berdasarkan MO Number
  node odooAPI/query_production_report.js --mo=MO001
  
  # Filter berdasarkan tanggal
  node odooAPI/query_production_report.js --date-from=2025-01-01 --date-to=2025-01-31
  
  # Output dalam format CSV
  node odooAPI/query_production_report.js --output=csv
  
  # Output dalam format JSON
  node odooAPI/query_production_report.js --output=json --type=device
`);
    process.exit(0);
}

// Parse arguments
let productionType = 'all';
let moNumber = null;
let picName = null;
let dateFrom = null;
let dateTo = null;
let status = 'all';
let outputFormat = 'table';

args.forEach((arg) => {
    if (arg.startsWith('--type=')) {
        productionType = arg.split('=')[1].toLowerCase();
        if (!['liquid', 'device', 'cartridge', 'all'].includes(productionType)) {
            console.error('❌ Error: --type must be liquid, device, cartridge, or all');
            process.exit(1);
        }
    } else if (arg.startsWith('--mo=')) {
        moNumber = arg.split('=')[1];
    } else if (arg.startsWith('--pic=')) {
        picName = arg.split('=')[1];
    } else if (arg.startsWith('--date-from=')) {
        dateFrom = arg.split('=')[1];
    } else if (arg.startsWith('--date-to=')) {
        dateTo = arg.split('=')[1];
    } else if (arg.startsWith('--status=')) {
        status = arg.split('=')[1].toLowerCase();
        if (!['active', 'completed', 'all'].includes(status)) {
            console.error('❌ Error: --status must be active, completed, or all');
            process.exit(1);
        }
    } else if (arg.startsWith('--output=')) {
        outputFormat = arg.split('=')[1].toLowerCase();
        if (!['table', 'json', 'csv'].includes(outputFormat)) {
            console.error('❌ Error: --output must be table, json, or csv');
            process.exit(1);
        }
    }
});

// Database path
const dbPath = path.join(__dirname, '..', 'server', 'database.sqlite');

// Open database connection
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('❌ Error opening database:', err.message);
        process.exit(1);
    }
});

// Build query based on production type
function buildQuery(tableName) {
    let query = `
        SELECT 
            pic as pic_input,
            sku_name,
            mo_number,
            json_extract(authenticity_data, '$[0].rollNumber') as roll,
            json_extract(authenticity_data, '$[0].firstAuthenticity') as first_authenticity_id,
            json_extract(authenticity_data, '$[0].lastAuthenticity') as last_authenticity_id,
            created_at,
            '${tableName.replace('production_', '')}' as production_type
        FROM ${tableName}
        WHERE 1=1
    `;
    
    const params = [];
    
    if (moNumber) {
        query += ' AND mo_number = ?';
        params.push(moNumber);
    }
    
    if (picName) {
        query += ' AND pic LIKE ?';
        params.push(`%${picName}%`);
    }
    
    if (dateFrom) {
        query += ' AND date(created_at) >= ?';
        params.push(dateFrom);
    }
    
    if (dateTo) {
        query += ' AND date(created_at) <= ?';
        params.push(dateTo);
    }
    
    if (status !== 'all') {
        query += ' AND status = ?';
        params.push(status);
    }
    
    query += ' ORDER BY created_at DESC';
    
    return { query, params };
}

// Get data from all tables or specific table
function getAllData(callback) {
    const tables = [];
    
    if (productionType === 'all' || productionType === 'liquid') {
        tables.push('production_liquid');
    }
    if (productionType === 'all' || productionType === 'device') {
        tables.push('production_device');
    }
    if (productionType === 'all' || productionType === 'cartridge') {
        tables.push('production_cartridge');
    }
    
    let allData = [];
    let completed = 0;
    
    tables.forEach((tableName) => {
        const { query, params } = buildQuery(tableName);
        
        db.all(query, params, (err, rows) => {
            if (err) {
                console.error(`❌ Error querying ${tableName}:`, err.message);
                process.exit(1);
            }
            
            allData = allData.concat(rows);
            completed++;
            
            if (completed === tables.length) {
                // Sort by created_at descending
                allData.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                callback(allData);
            }
        });
    });
}

// Format output based on format type
function formatOutput(data) {
    if (data.length === 0) {
        console.log('\n❌ No data found.\n');
        return;
    }
    
    if (outputFormat === 'json') {
        console.log(JSON.stringify(data, null, 2));
    } else if (outputFormat === 'csv') {
        // CSV Header
        console.log('PIC Input,SKU,MO ID,Roll,First Authenticity ID,Last Authenticity ID,Production Type,Created At');
        
        // CSV Rows
        data.forEach((row) => {
            console.log([
                row.pic_input,
                row.sku_name,
                row.mo_number,
                row.roll || '',
                row.first_authenticity_id || '',
                row.last_authenticity_id || '',
                row.production_type,
                row.created_at
            ].map(v => `"${v}"`).join(','));
        });
    } else {
        // Table format
        console.log('\n=== Production Report ===\n');
        console.log('Filters:');
        console.log(`  Production Type: ${productionType}`);
        if (moNumber) console.log(`  MO Number: ${moNumber}`);
        if (picName) console.log(`  PIC Name: ${picName}`);
        if (dateFrom) console.log(`  Date From: ${dateFrom}`);
        if (dateTo) console.log(`  Date To: ${dateTo}`);
        if (status !== 'all') console.log(`  Status: ${status}`);
        console.log(`\nTotal Records: ${data.length}\n`);
        
        // Table header
        console.log('─'.repeat(150));
        console.log(
            padRight('PIC Input', 25) + ' | ' +
            padRight('SKU', 20) + ' | ' +
            padRight('MO ID', 15) + ' | ' +
            padRight('Roll', 12) + ' | ' +
            padRight('First ID', 15) + ' | ' +
            padRight('Last ID', 15) + ' | ' +
            padRight('Type', 10)
        );
        console.log('─'.repeat(150));
        
        // Table rows
        data.forEach((row) => {
            console.log(
                padRight(row.pic_input || '', 25) + ' | ' +
                padRight(row.sku_name || '', 20) + ' | ' +
                padRight(row.mo_number || '', 15) + ' | ' +
                padRight(row.roll || '', 12) + ' | ' +
                padRight(row.first_authenticity_id || '', 15) + ' | ' +
                padRight(row.last_authenticity_id || '', 15) + ' | ' +
                padRight(row.production_type || '', 10)
            );
        });
        
        console.log('─'.repeat(150));
        console.log('');
    }
}

// Helper function to pad string
function padRight(str, length) {
    str = String(str);
    if (str.length > length) {
        return str.substring(0, length - 3) + '...';
    }
    return str + ' '.repeat(length - str.length);
}

// Main execution
if (outputFormat !== 'json' && outputFormat !== 'csv') {
    console.log('🔄 Querying database...\n');
}

getAllData((data) => {
    formatOutput(data);
    
    // Close database
    db.close((err) => {
        if (err) {
            console.error('❌ Error closing database:', err.message);
        }
        process.exit(0);
    });
});


