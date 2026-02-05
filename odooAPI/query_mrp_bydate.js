#!/usr/bin/env node

/**
 * Script untuk query Odoo mrp.production API berdasarkan waktu/tanggal
 * Output dalam format JSON yang rapi
 * 
 * Usage: 
 *   node query_mrp_bydate.js [session_id] --date-start "2025-01-15"
 *   node query_mrp_bydate.js [session_id] --date-finished "2025-01-15"
 *   node query_mrp_bydate.js [session_id] --date-from "2025-01-01" --date-to "2025-01-31"
 *   node query_mrp_bydate.js [session_id] --create-date "2025-01-15"
 * 
 * Opsi filter waktu (mendukung format --key=value atau --key value):
 *   --date-start=DATE      : Filter berdasarkan tanggal mulai produksi (date_start)
 *   --date-finished=DATE   : Filter berdasarkan tanggal selesai produksi (date_finished)
 *   --create-date=DATE     : Filter berdasarkan tanggal dibuat MO (create_date)
 *   --date-from=DATE       : Filter dari tanggal (untuk create_date)
 *   --date-to=DATE         : Filter sampai tanggal (untuk create_date)
 *   --date-range=FROM,TO   : Filter range tanggal (untuk create_date)
 * 
 * Format tanggal: YYYY-MM-DD atau YYYY-MM-DD HH:MM:SS
 * 
 * Contoh:
 *   # MO yang dibuat pada tanggal tertentu
 *   node query_mrp_bydate.js bc6b1450c0cd3b05e3ac199521e02f7b639e39ae --create-date "2025-01-15"
 *   node query_mrp_bydate.js bc6b1450c0cd3b05e3ac199521e02f7b639e39ae --create-date="2025-01-15"
 * 
 *   # MO yang selesai pada tanggal tertentu
 *   node query_mrp_bydate.js bc6b1450c0cd3b05e3ac199521e02f7b639e39ae --date-finished "2025-01-15"
 * 
 *   # MO yang dibuat dalam range tanggal
 *   node query_mrp_bydate.js bc6b1450c0cd3b05e3ac199521e02f7b639e39ae --date-from "2025-01-01" --date-to "2025-01-31"
 * 
 *   # JSON only output
 *   node query_mrp_bydate.js bc6b1450c0cd3b05e3ac199521e02f7b639e39ae --date-finished "2025-01-15" --json-only
 * 
 *   # Help
 *   node query_mrp_bydate.js --help
 */

const https = require('https');
const url = require('url');

// Parse command line arguments
const args = process.argv.slice(2);

// Show help if requested (check first, before parsing)
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node query_mrp_bydate.js [session_id] [options]

Options (supports both --key=value and --key value formats):
  --date-start=DATE        Filter by production start date (date_start)
  --date-finished=DATE     Filter by production finish date (date_finished)
  --create-date=DATE       Filter by MO creation date (create_date)
  --date-from=DATE         Filter from date (for create_date)
  --date-to=DATE           Filter to date (for create_date)
  --date-range=FROM,TO     Filter date range (for create_date)
  --limit=N                Limit number of records (default: 20)
  --offset=N               Offset for pagination (default: 0)
  --json-only              Output JSON only (no summary)
  --help, -h               Show this help message

Date Format: YYYY-MM-DD or YYYY-MM-DD HH:MM:SS

Examples:
  # MO created on specific date (both formats work)
  node query_mrp_bydate.js [session_id] --create-date "2025-01-15"
  node query_mrp_bydate.js [session_id] --create-date="2025-01-15"
  
  # MO finished on specific date
  node query_mrp_bydate.js [session_id] --date-finished "2025-01-15"
  
  # MO created in date range
  node query_mrp_bydate.js [session_id] --date-from "2025-01-01" --date-to "2025-01-31"
  
  # JSON only output
  node query_mrp_bydate.js [session_id] --date-finished "2025-01-15" --json-only

Session ID:
  Can be provided as first argument, or via environment variable ODOO_SESSION_ID
`);
    process.exit(0);
}

let sessionId = null;
let limit = 20;
let offset = 0;
let dateStart = null;
let dateFinished = null;
let createDate = null;
let dateFrom = null;
let dateTo = null;
let jsonOnly = false;

// First, find session ID (first argument that doesn't start with --)
// Session ID should be a long hex string (typically 40 chars)
for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('--') && arg.length > 20) {
        // Likely a session ID (long hex string)
        sessionId = arg;
        break;
    }
}

// Track consumed argument indices to avoid processing values twice
const consumedIndices = new Set();

// Helper function to get argument value (supports both --key=value and --key value formats)
function getArgValue(arg, index) {
    if (arg.includes('=')) {
        // Format: --key=value
        return arg.split('=')[1];
    } else {
        // Format: --key value (check next argument)
        if (index + 1 < args.length && !args[index + 1].startsWith('--')) {
            consumedIndices.add(index + 1); // Mark next argument as consumed
            return args[index + 1];
        }
        return null;
    }
}

// Then parse other arguments
args.forEach((arg, index) => {
    // Skip if this argument was already consumed as a value
    if (consumedIndices.has(index)) {
        return;
    }
    
    if (arg.startsWith('--date-start')) {
        const value = getArgValue(arg, index);
        if (value) {
            dateStart = value;
        } else {
            console.error('❌ Error: --date-start requires a value');
            process.exit(1);
        }
    } else if (arg.startsWith('--date-finished')) {
        const value = getArgValue(arg, index);
        if (value) {
            dateFinished = value;
        } else {
            console.error('❌ Error: --date-finished requires a value');
            process.exit(1);
        }
    } else if (arg.startsWith('--create-date')) {
        const value = getArgValue(arg, index);
        if (value) {
            createDate = value;
        } else {
            console.error('❌ Error: --create-date requires a value');
            process.exit(1);
        }
    } else if (arg.startsWith('--date-from')) {
        const value = getArgValue(arg, index);
        if (value) {
            dateFrom = value;
        } else {
            console.error('❌ Error: --date-from requires a value');
            process.exit(1);
        }
    } else if (arg.startsWith('--date-to')) {
        const value = getArgValue(arg, index);
        if (value) {
            dateTo = value;
        } else {
            console.error('❌ Error: --date-to requires a value');
            process.exit(1);
        }
    } else if (arg.startsWith('--date-range')) {
        const value = getArgValue(arg, index);
        if (value) {
            const range = value.split(',');
            if (range.length === 2) {
                dateFrom = range[0].trim();
                dateTo = range[1].trim();
            } else {
                console.error('❌ Error: --date-range requires format: FROM,TO');
                process.exit(1);
            }
        } else {
            console.error('❌ Error: --date-range requires a value');
            process.exit(1);
        }
    } else if (arg.startsWith('--limit')) {
        const value = getArgValue(arg, index);
        if (value) {
            const limitValue = parseInt(value);
            if (isNaN(limitValue) || limitValue < 1) {
                console.error('❌ Error: --limit must be a positive number');
                process.exit(1);
            }
            limit = limitValue;
        } else {
            console.error('❌ Error: --limit requires a value');
            process.exit(1);
        }
    } else if (arg.startsWith('--offset')) {
        const value = getArgValue(arg, index);
        if (value) {
            const offsetValue = parseInt(value);
            if (isNaN(offsetValue) || offsetValue < 0) {
                console.error('❌ Error: --offset must be a non-negative number');
                process.exit(1);
            }
            offset = offsetValue;
        } else {
            console.error('❌ Error: --offset requires a value');
            process.exit(1);
        }
    } else if (arg === '--json-only') {
        jsonOnly = true;
    } else if (arg.startsWith('--') && arg !== '--json-only') {
        // Unknown flag
        console.error(`❌ Error: Unknown flag: ${arg}`);
        console.error('   Use --help to see available options');
        process.exit(1);
    }
});

// Try to load config
let config = null;
try {
    config = require('./config.js');
} catch (e) {
    // Config not available, will use defaults
}

// Get session ID from command line, environment, config, or default
const SESSION_ID = sessionId 
    || process.env.ODOO_SESSION_ID 
    || (config && config.odoo && config.odoo.sessionId)
    || 'bc6b1450c0cd3b05e3ac199521e02f7b639e39ae';

// Validate session ID format
if (!SESSION_ID || SESSION_ID.length < 20) {
    console.error('❌ Error: Invalid or missing session ID');
    console.error('   Provide session ID as first argument or set ODOO_SESSION_ID environment variable');
    console.error('   Example: node script.js bc6b1450c0cd3b05e3ac199521e02f7b639e39ae');
    process.exit(1);
}

// Get base URL from environment or use default
const ODOO_BASE_URL = process.env.ODOO_API_URL || 'https://foomx.odoo.com';
const ODOO_URL = `${ODOO_BASE_URL}/web/dataset/call_kw/mrp.production/search_read`;

// Cookie header format: session_id=xxx; session_id=xxx
const COOKIE_HEADER = `session_id=${SESSION_ID}; session_id=${SESSION_ID}`;

// Helper function to format date for Odoo
function formatDateForOdoo(dateStr) {
    // If date is just YYYY-MM-DD, add time to make it start/end of day
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateStr;
    }
    // If already has time, return as is
    return dateStr;
}

// Build domain filter
const domain = [];

// Filter berdasarkan date_start (tanggal mulai produksi)
if (dateStart) {
    const dateStr = formatDateForOdoo(dateStart);
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Date only, filter for entire day
        domain.push(["date_start", ">=", dateStr + " 00:00:00"]);
        domain.push(["date_start", "<=", dateStr + " 23:59:59"]);
    } else {
        // Has time, use exact match or range
        domain.push(["date_start", ">=", dateStr]);
    }
}

// Filter berdasarkan date_finished (tanggal selesai produksi)
if (dateFinished) {
    const dateStr = formatDateForOdoo(dateFinished);
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Date only, filter for entire day
        domain.push(["date_finished", ">=", dateStr + " 00:00:00"]);
        domain.push(["date_finished", "<=", dateStr + " 23:59:59"]);
    } else {
        // Has time, use exact match or range
        domain.push(["date_finished", ">=", dateStr]);
    }
}

// Filter berdasarkan create_date (tanggal dibuat MO)
if (createDate) {
    const dateStr = formatDateForOdoo(createDate);
    domain.push(["create_date", ">=", dateStr + " 00:00:00"]);
    domain.push(["create_date", "<=", dateStr + " 23:59:59"]);
}

// Filter range untuk create_date
if (dateFrom) {
    const dateStr = formatDateForOdoo(dateFrom);
    domain.push(["create_date", ">=", dateStr.includes(' ') ? dateStr : dateStr + " 00:00:00"]);
}

if (dateTo) {
    const dateStr = formatDateForOdoo(dateTo);
    domain.push(["create_date", "<=", dateStr.includes(' ') ? dateStr : dateStr + " 23:59:59"]);
}

// Request payload
const requestData = {
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
        "model": "mrp.production",
        "method": "search_read",
        "args": domain.length > 0 ? [domain] : [],
        "kwargs": {
            "fields": [
                "id",
                "name",
                "product_id",
                "product_qty",
                "product_uom_id",
                "initial_qty_target",
                "note",
                "group_worker",
                "date_start",
                "date_finished",
                "date_deadline",
                "state",
                "origin",
                "create_date"
            ],
            "limit": limit,
            "offset": offset,
            "order": "create_date desc"  // Order by create_date descending (newest first)
        }
    }
};

// Parse URL
const parsedUrl = url.parse(ODOO_URL);

// Prepare request options
const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || 443,
    path: parsedUrl.path,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Cookie': COOKIE_HEADER
    }
};

// Convert request data to JSON string
const postData = JSON.stringify(requestData);

// Display info (only if not json-only mode)
if (!jsonOnly) {
    console.log('=== Odoo MRP Production Query by Date/Time ===\n');
    console.log('Base URL:', ODOO_BASE_URL);
    console.log('Session ID:', SESSION_ID.substring(0, 20) + '...');
    console.log('Endpoint:', '/web/dataset/call_kw/mrp.production/search_read');
    
    if (dateStart) console.log('Filter: Date Start =', dateStart);
    if (dateFinished) console.log('Filter: Date Finished =', dateFinished);
    if (createDate) console.log('Filter: Create Date =', createDate);
    if (dateFrom) console.log('Filter: Date From =', dateFrom);
    if (dateTo) console.log('Filter: Date To =', dateTo);
    
    console.log('Limit:', limit, '| Offset:', offset);
    console.log('\nRequest payload:');
    console.log(JSON.stringify(requestData, null, 2));
    console.log('\n--- Response ---\n');
}

// Make the request
const req = https.request(options, (res) => {
    let responseData = '';

    // Collect response data
    res.on('data', (chunk) => {
        responseData += chunk;
    });

    // Handle response end
    res.on('end', () => {
        try {
            // Try to parse as JSON
            const jsonResponse = JSON.parse(responseData);
            
            // Check for errors
            if (jsonResponse.error) {
                if (!jsonOnly) {
                    console.error('\n❌ API Error:\n');
                    console.error('Error Code:', jsonResponse.error.code || 'N/A');
                    console.error('Error Message:', jsonResponse.error.message || 'Unknown error');
                    if (jsonResponse.error.data) {
                        console.error('\nError Details:');
                        console.error(JSON.stringify(jsonResponse.error.data, null, 2));
                    }
                    console.error('\nFull Error Response:');
                    console.error(JSON.stringify(jsonResponse.error, null, 2));
                } else {
                    console.error(JSON.stringify(jsonResponse, null, 2));
                }
                process.exit(1);
            }
            
            // If json-only mode, just output the JSON
            if (jsonOnly) {
                console.log(JSON.stringify(jsonResponse, null, 2));
                return;
            }
            
            // Display result with summary
            if (jsonResponse.result && Array.isArray(jsonResponse.result)) {
                console.log(`Status Code: ${res.statusCode}`);
                console.log(`✅ Found ${jsonResponse.result.length} record(s):\n`);
                
                // Display summary
                jsonResponse.result.forEach((mo, index) => {
                    const productName = mo.product_id ? mo.product_id[1] : 'N/A';
                    const uom = mo.product_uom_id ? mo.product_uom_id[1] : '';
                    
                    console.log(`${index + 1}. Manufacturing Order: ${mo.name || 'N/A'}`);
                    console.log(`   ID: ${mo.id}`);
                    console.log(`   Product: ${productName}`);
                    console.log(`   Quantity: ${mo.product_qty || 0} ${uom}`);
                    if (mo.initial_qty_target) {
                        console.log(`   Target: ${mo.initial_qty_target} ${uom}`);
                    }
                    console.log(`   State: ${mo.state || 'N/A'}`);
                    console.log(`   Origin: ${mo.origin && mo.origin !== false ? mo.origin : 'N/A'}`);
                    console.log(`   Created: ${mo.create_date || 'N/A'}`);
                    if (mo.date_start && mo.date_start !== false) {
                        console.log(`   Start: ${mo.date_start}`);
                    }
                    if (mo.date_finished && mo.date_finished !== false) {
                        console.log(`   Finished: ${mo.date_finished}`);
                    }
                    if (mo.date_deadline && mo.date_deadline !== false) {
                        console.log(`   Deadline: ${mo.date_deadline}`);
                    }
                    if (mo.group_worker && mo.group_worker !== false) {
                        const groupWorkerName = Array.isArray(mo.group_worker) ? mo.group_worker[1] : mo.group_worker;
                        console.log(`   Group Worker: ${groupWorkerName}`);
                    }
                    if (mo.note && mo.note !== false) {
                        const notePreview = String(mo.note).length > 50 
                            ? String(mo.note).substring(0, 47) + '...' 
                            : mo.note;
                        console.log(`   Note: ${notePreview}`);
                    }
                    console.log('');
                });
                
                // Display full JSON
                console.log('\n--- Full JSON Response ---\n');
                console.log(JSON.stringify(jsonResponse, null, 2));
            } else {
                console.log('Response:');
                console.log(JSON.stringify(jsonResponse, null, 2));
            }
        } catch (e) {
            // If not JSON, just print raw response
            if (!jsonOnly) {
                console.error('\n❌ Error parsing JSON response:\n');
                console.error('Error:', e.message);
                console.error('\nRaw Response (first 500 chars):');
                console.error(responseData.substring(0, 500));
                if (responseData.length > 500) {
                    console.error('... (truncated)');
                }
            } else {
                console.error(JSON.stringify({ 
                    error: 'Parse error', 
                    message: e.message,
                    raw: responseData.substring(0, 500)
                }, null, 2));
            }
            process.exit(1);
        }
    });
});

// Handle errors
req.on('error', (error) => {
    if (!jsonOnly) {
        console.error('\n❌ Error making request:\n');
        console.error('Error Type:', error.constructor.name);
        console.error('Error Message:', error.message);
        if (error.code) {
            console.error('Error Code:', error.code);
        }
    } else {
        console.error(JSON.stringify({ 
            error: 'Request error', 
            message: error.message,
            code: error.code || null
        }, null, 2));
    }
    process.exit(1);
});

req.on('timeout', () => {
    if (!jsonOnly) {
        console.error('\n❌ Request timeout:\n');
        console.error('The request took longer than 30 seconds to complete.');
        console.error('This might indicate:');
        console.error('  - Network connectivity issues');
        console.error('  - Odoo server is overloaded');
        console.error('  - Firewall blocking the request');
    } else {
        console.error(JSON.stringify({ 
            error: 'Request timeout',
            message: 'The request took longer than 30 seconds to complete'
        }, null, 2));
    }
    req.destroy();
    process.exit(1);
});

// Set timeout (30 seconds)
req.setTimeout(30000);

// Send the request 
req.write(postData);
req.end();