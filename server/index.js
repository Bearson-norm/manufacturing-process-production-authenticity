const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 1234;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Database setup with connection pooling for concurrent requests
const dbPath = path.join(__dirname, 'database.sqlite');

// Create database connection with WAL mode for better concurrency
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    // Enable WAL mode for better concurrent read/write performance
    db.run('PRAGMA journal_mode = WAL;');
    db.run('PRAGMA synchronous = NORMAL;');
    db.run('PRAGMA cache_size = 10000;');
    db.run('PRAGMA foreign_keys = ON;');
    console.log('Database connected with WAL mode enabled');
  }
});

// Initialize database tables
db.serialize(() => {
  // Production Liquid table
  db.run(`CREATE TABLE IF NOT EXISTS production_liquid (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    leader_name TEXT NOT NULL,
    shift_number TEXT NOT NULL,
    pic TEXT NOT NULL,
    mo_number TEXT NOT NULL,
    sku_name TEXT NOT NULL,
    authenticity_data TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Production Device table
  db.run(`CREATE TABLE IF NOT EXISTS production_device (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    leader_name TEXT NOT NULL,
    shift_number TEXT NOT NULL,
    pic TEXT NOT NULL,
    mo_number TEXT NOT NULL,
    sku_name TEXT NOT NULL,
    authenticity_data TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Production Cartridge table
  db.run(`CREATE TABLE IF NOT EXISTS production_cartridge (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    leader_name TEXT NOT NULL,
    shift_number TEXT NOT NULL,
    pic TEXT NOT NULL,
    mo_number TEXT NOT NULL,
    sku_name TEXT NOT NULL,
    authenticity_data TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Add new columns to existing tables if they don't exist (migration)
  db.run(`ALTER TABLE production_liquid ADD COLUMN session_id TEXT`, () => {});
  db.run(`ALTER TABLE production_liquid ADD COLUMN status TEXT DEFAULT 'active'`, () => {});
  db.run(`ALTER TABLE production_liquid ADD COLUMN completed_at DATETIME`, () => {});
  db.run(`ALTER TABLE production_device ADD COLUMN session_id TEXT`, () => {});
  db.run(`ALTER TABLE production_device ADD COLUMN status TEXT DEFAULT 'active'`, () => {});
  db.run(`ALTER TABLE production_device ADD COLUMN completed_at DATETIME`, () => {});
  db.run(`ALTER TABLE production_cartridge ADD COLUMN session_id TEXT`, () => {});
  db.run(`ALTER TABLE production_cartridge ADD COLUMN status TEXT DEFAULT 'active'`, () => {});
  db.run(`ALTER TABLE production_cartridge ADD COLUMN completed_at DATETIME`, () => {});

  // Buffer Authenticity tables
  db.run(`CREATE TABLE IF NOT EXISTS buffer_liquid (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    pic TEXT NOT NULL,
    mo_number TEXT NOT NULL,
    sku_name TEXT NOT NULL,
    authenticity_numbers TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS buffer_device (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    pic TEXT NOT NULL,
    mo_number TEXT NOT NULL,
    sku_name TEXT NOT NULL,
    authenticity_numbers TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS buffer_cartridge (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    pic TEXT NOT NULL,
    mo_number TEXT NOT NULL,
    sku_name TEXT NOT NULL,
    authenticity_numbers TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Reject Authenticity tables
  db.run(`CREATE TABLE IF NOT EXISTS reject_liquid (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    pic TEXT NOT NULL,
    mo_number TEXT NOT NULL,
    sku_name TEXT NOT NULL,
    authenticity_numbers TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reject_device (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    pic TEXT NOT NULL,
    mo_number TEXT NOT NULL,
    sku_name TEXT NOT NULL,
    authenticity_numbers TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reject_cartridge (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    pic TEXT NOT NULL,
    mo_number TEXT NOT NULL,
    sku_name TEXT NOT NULL,
    authenticity_numbers TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Combined Production table - gabungan dari production_liquid, production_device, dan production_cartridge
  db.run(`CREATE TABLE IF NOT EXISTS production_combined (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    production_type TEXT NOT NULL,
    session_id TEXT NOT NULL,
    leader_name TEXT NOT NULL,
    shift_number TEXT NOT NULL,
    pic TEXT NOT NULL,
    mo_number TEXT NOT NULL,
    sku_name TEXT NOT NULL,
    authenticity_data TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Create index for faster queries
  db.run(`CREATE INDEX IF NOT EXISTS idx_production_combined_mo_number ON production_combined(mo_number)`, () => {});
  db.run(`CREATE INDEX IF NOT EXISTS idx_production_combined_created_at ON production_combined(created_at)`, () => {});
  db.run(`CREATE INDEX IF NOT EXISTS idx_production_combined_type ON production_combined(production_type)`, () => {});

  // Production Results table - unified table for all production inputs
  db.run(`CREATE TABLE IF NOT EXISTS production_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    production_type TEXT NOT NULL,
    session_id TEXT NOT NULL,
    leader_name TEXT NOT NULL,
    shift_number TEXT NOT NULL,
    pic TEXT NOT NULL,
    mo_number TEXT NOT NULL,
    sku_name TEXT NOT NULL,
    quantity REAL,
    authenticity_data TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Create indexes for production_results
  db.run(`CREATE INDEX IF NOT EXISTS idx_production_results_mo_number ON production_results(mo_number)`, () => {});
  db.run(`CREATE INDEX IF NOT EXISTS idx_production_results_created_at ON production_results(created_at)`, () => {});
  db.run(`CREATE INDEX IF NOT EXISTS idx_production_results_type ON production_results(production_type)`, () => {});
  db.run(`CREATE INDEX IF NOT EXISTS idx_production_results_status ON production_results(status)`, () => {});

  // Odoo MO Cache table - untuk menyimpan MO data dari Odoo (7 hari terakhir)
  db.run(`CREATE TABLE IF NOT EXISTS odoo_mo_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mo_number TEXT NOT NULL UNIQUE,
    sku_name TEXT NOT NULL,
    quantity REAL,
    uom TEXT,
    note TEXT,
    create_date TEXT,
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Create indexes for odoo_mo_cache
  db.run(`CREATE INDEX IF NOT EXISTS idx_odoo_mo_cache_mo_number ON odoo_mo_cache(mo_number)`, () => {});
  db.run(`CREATE INDEX IF NOT EXISTS idx_odoo_mo_cache_fetched_at ON odoo_mo_cache(fetched_at)`, () => {});

  // Admin Configuration table
  db.run(`CREATE TABLE IF NOT EXISTS admin_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key TEXT NOT NULL UNIQUE,
    config_value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Health check endpoint for Traefik and monitoring
app.get('/health', (req, res) => {
  // Check database connection
  db.get('SELECT 1', (err) => {
    if (err) {
      res.status(503).json({ 
        status: 'unhealthy', 
        database: 'disconnected',
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({ 
        status: 'healthy', 
        database: 'connected',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    }
  });
});

// Favicon route (before static middleware)
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// Helper function to get API key from database
function getApiKey(callback) {
  db.get('SELECT config_value FROM admin_config WHERE config_key = ?', ['api_key'], (err, row) => {
    if (err) {
      console.error('Error fetching API key:', err);
      return callback(null, null);
    }
    const apiKey = row ? row.config_value : null;
    callback(null, apiKey);
  });
}

// Middleware for API key authentication
function apiKeyAuth(req, res, next) {
  getApiKey((err, storedApiKey) => {
    if (err || !storedApiKey) {
      // If no API key is configured, allow access (backward compatibility)
      // In production, you might want to require API key
      return next();
    }
    
    // Get API key from header
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key is required. Please provide X-API-Key header or Authorization Bearer token.'
      });
    }
    
    if (apiKey !== storedApiKey) {
      return res.status(403).json({
        success: false,
        error: 'Invalid API key'
      });
    }
    
    next();
  });
}

// Authentication endpoint
app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }
    
    if (username === 'production' && password === 'production123') {
      res.json({ success: true, message: 'Login successful' });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Helper function to parse authenticity data
function parseAuthenticityData(row) {
  try {
    return {
      ...row,
      authenticity_data: typeof row.authenticity_data === 'string' 
        ? JSON.parse(row.authenticity_data) 
        : row.authenticity_data
    };
  } catch (e) {
    return {
      ...row,
      authenticity_data: []
    };
  }
}

// Normalize authenticity rows so leading zeros are preserved as strings
function normalizeAuthenticityRow(row = {}) {
  const safeRow = typeof row === 'object' && row !== null ? row : {};
  const toText = (v) => (v === undefined || v === null) ? '' : String(v).trim();
  return {
    firstAuthenticity: toText(safeRow.firstAuthenticity),
    lastAuthenticity: toText(safeRow.lastAuthenticity),
    rollNumber: toText(safeRow.rollNumber)
  };
}

function normalizeAuthenticityArray(data) {
  const rows = Array.isArray(data) ? data : [data];
  return rows.map(normalizeAuthenticityRow);
}

function normalizeAuthenticityNumbers(numbers) {
  const arr = Array.isArray(numbers) ? numbers : [numbers];
  return arr
    .map((n) => (n === undefined || n === null) ? '' : String(n).trim())
    .filter((n) => n !== '');
}

// Helper function to get external API URL from config based on status
function getExternalAPIUrl(status, callback) {
  // Determine which config key to use based on status
  const configKey = status === 'active' ? 'external_api_url_active' : 'external_api_url_completed';
  const defaultUrl = process.env.EXTERNAL_API_URL || 'https://foom-dash.vercel.app/API';
  
  db.get('SELECT config_value FROM admin_config WHERE config_key = ?', [configKey], (err, row) => {
    if (err) {
      console.error(`Error fetching ${configKey} config:`, err);
      // Fallback to general external_api_url if specific one doesn't exist
      return getFallbackUrl(callback, defaultUrl);
    }
    
    const apiUrl = row ? row.config_value : null;
    // If specific URL is not set or empty, fallback to general external_api_url
    if (!apiUrl || apiUrl.trim() === '') {
      return getFallbackUrl(callback, defaultUrl);
    } else {
      callback(null, apiUrl);
    }
  });
}

// Helper function to get fallback external API URL
function getFallbackUrl(callback, defaultUrl) {
  db.get('SELECT config_value FROM admin_config WHERE config_key = ?', ['external_api_url'], (fallbackErr, fallbackRow) => {
    if (fallbackErr) {
      console.error('Error fetching fallback external_api_url config:', fallbackErr);
      return callback(null, defaultUrl);
    }
    const fallbackUrl = fallbackRow && fallbackRow.config_value ? fallbackRow.config_value : defaultUrl;
    callback(null, fallbackUrl);
  });
}

// Circuit breaker state for External API
const externalApiCircuitBreaker = {
  state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
  failureCount: 0,
  lastFailureTime: null,
  successCount: 0,
  errorStats: {
    '405': 0,
    'other': 0
  }
};

// Circuit breaker configuration
const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 10, // Open circuit after 10 consecutive failures
  resetTimeout: 300000, // 5 minutes in milliseconds
  halfOpenMaxAttempts: 3 // Try 3 times in half-open state
};

// Helper function to check circuit breaker state
function checkCircuitBreaker() {
  const now = Date.now();
  
  // If circuit is OPEN, check if we should move to HALF_OPEN
  if (externalApiCircuitBreaker.state === 'OPEN') {
    if (externalApiCircuitBreaker.lastFailureTime && 
        (now - externalApiCircuitBreaker.lastFailureTime) >= CIRCUIT_BREAKER_CONFIG.resetTimeout) {
      externalApiCircuitBreaker.state = 'HALF_OPEN';
      externalApiCircuitBreaker.successCount = 0;
      return true; // Allow request
    }
    return false; // Block request
  }
  
  // If circuit is HALF_OPEN, allow limited requests
  if (externalApiCircuitBreaker.state === 'HALF_OPEN') {
    return externalApiCircuitBreaker.successCount < CIRCUIT_BREAKER_CONFIG.halfOpenMaxAttempts;
  }
  
  // Circuit is CLOSED, allow all requests
  return true;
}

// Helper function to record success
function recordCircuitBreakerSuccess() {
  if (externalApiCircuitBreaker.state === 'HALF_OPEN') {
    externalApiCircuitBreaker.successCount++;
    if (externalApiCircuitBreaker.successCount >= CIRCUIT_BREAKER_CONFIG.halfOpenMaxAttempts) {
      externalApiCircuitBreaker.state = 'CLOSED';
      externalApiCircuitBreaker.failureCount = 0;
      externalApiCircuitBreaker.errorStats = { '405': 0, 'other': 0 };
    }
  } else if (externalApiCircuitBreaker.state === 'CLOSED') {
    externalApiCircuitBreaker.failureCount = 0;
  }
}

// Helper function to record failure
function recordCircuitBreakerFailure(statusCode) {
  externalApiCircuitBreaker.failureCount++;
  externalApiCircuitBreaker.lastFailureTime = Date.now();
  
  // Track error by status code
  if (statusCode === 405) {
    externalApiCircuitBreaker.errorStats['405']++;
  } else {
    externalApiCircuitBreaker.errorStats['other']++;
  }
  
  // Open circuit if threshold exceeded
  if (externalApiCircuitBreaker.failureCount >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
    externalApiCircuitBreaker.state = 'OPEN';
  } else if (externalApiCircuitBreaker.state === 'HALF_OPEN') {
    // If failure in half-open, go back to open
    externalApiCircuitBreaker.state = 'OPEN';
    externalApiCircuitBreaker.successCount = 0;
  }
}

// Helper function to send data to external API with specific URL
async function sendToExternalAPIWithUrl(data, apiUrl) {
  return new Promise((resolve, reject) => {
    // Skip if URL is empty or not configured
    if (!apiUrl || apiUrl.trim() === '') {
      console.log(`⚠️  [External API] External API URL not configured, skipping send`);
      return resolve({ success: true, skipped: true, message: 'External API URL not configured' });
    }
    
    // Check circuit breaker
    if (!checkCircuitBreaker()) {
      const stats = externalApiCircuitBreaker.errorStats;
      const totalErrors = stats['405'] + stats['other'];
      // Only log once per minute to reduce spam
      if (!externalApiCircuitBreaker.lastLogTime || 
          (Date.now() - externalApiCircuitBreaker.lastLogTime) > 60000) {
        console.log(`⚠️  [External API] Circuit breaker OPEN - skipping requests. ` +
                   `Recent errors: 405 (${stats['405']}), Other (${stats['other']}). ` +
                   `Will retry in ${Math.ceil((CIRCUIT_BREAKER_CONFIG.resetTimeout - (Date.now() - externalApiCircuitBreaker.lastFailureTime)) / 1000)}s`);
        externalApiCircuitBreaker.lastLogTime = Date.now();
      }
      return resolve({ 
        success: false, 
        skipped: true, 
        message: 'Circuit breaker is OPEN - too many failures',
        circuitBreakerState: externalApiCircuitBreaker.state
      });
    }
    
    try {
      const https = require('https');
      const http = require('http');
      const url = require('url');
      
      const parsedUrl = url.parse(apiUrl);
      const postData = JSON.stringify(data);
      const isHttps = parsedUrl.protocol === 'https:';
      const httpModule = isHttps ? https : http;
      
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };
      
      const req = httpModule.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            recordCircuitBreakerSuccess();
            // Only log success if circuit was in half-open state (recovery)
            if (externalApiCircuitBreaker.state === 'HALF_OPEN') {
              console.log(`✅ [External API] Successfully sent data to ${apiUrl} (Circuit recovering)`);
            }
            resolve({ success: true, statusCode: res.statusCode, data: responseData });
          } else {
            recordCircuitBreakerFailure(res.statusCode);
            // Only log non-405 errors or log 405 errors less frequently
            if (res.statusCode !== 405) {
              console.error(`❌ [External API] Error response: ${res.statusCode} - ${responseData.substring(0, 100)}`);
            }
            reject(new Error(`API returned status ${res.statusCode}: ${responseData.substring(0, 100)}`));
          }
        });
      });
      
      req.on('error', (error) => {
        recordCircuitBreakerFailure(0); // 0 for network errors
        // Only log network errors occasionally
        if (externalApiCircuitBreaker.failureCount % 10 === 0) {
          console.error(`❌ [External API] Request error:`, error.message);
        }
        reject(error);
      });
      
      req.setTimeout(30000, () => {
        req.destroy();
        recordCircuitBreakerFailure(0);
        reject(new Error('Request timeout'));
      });
      
      req.write(postData);
      req.end();
    } catch (error) {
      recordCircuitBreakerFailure(0);
      // Only log errors occasionally
      if (externalApiCircuitBreaker.failureCount % 10 === 0) {
        console.error(`❌ [External API] Error sending data:`, error.message);
      }
      reject(error);
    }
  });
}

// Helper function to send data to external API (determines URL based on status)
async function sendToExternalAPI(data) {
  return new Promise((resolve, reject) => {
    // Determine status from data, default to 'active' if not specified
    const status = data.status || 'active';
    
    getExternalAPIUrl(status, (err, EXTERNAL_API_URL) => {
      if (err) {
        return reject(err);
      }
      
      // Skip if URL is empty or not configured
      if (!EXTERNAL_API_URL || EXTERNAL_API_URL.trim() === '') {
        console.log(`⚠️  [External API] External API URL for status "${status}" not configured, skipping send`);
        return resolve({ success: true, skipped: true, message: `External API URL for status "${status}" not configured` });
      }
      
      // Use the helper function with specific URL
      sendToExternalAPIWithUrl(data, EXTERNAL_API_URL)
        .then(resolve)
        .catch(reject);
    });
  });
}

// Helper to fetch production data for external API consumers
function fetchProductionData(filter = {}) {
  const { type, status, start_date, end_date } = filter;
  const typeFilter = type ? String(type).toLowerCase() : null;
  const statusFilter = status ? String(status).toLowerCase() : null;
  const startDate = start_date ? new Date(start_date) : null;
  const endDate = end_date ? new Date(end_date) : null;
  const tables = [
    { name: 'production_liquid', production_type: 'liquid' },
    { name: 'production_device', production_type: 'device' },
    { name: 'production_cartridge', production_type: 'cartridge' }
  ];

  const loaders = tables
    .filter(t => !typeFilter || typeFilter === 'all' || t.production_type === typeFilter)
    .map((table) => {
      return new Promise((resolve, reject) => {
        db.all(
          `SELECT *, ? as production_type FROM ${table.name} ORDER BY created_at DESC`,
          [table.production_type],
          (err, rows) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(rows.map(r => parseAuthenticityData(r)));
          }
        );
      });
    });

  return Promise.all(loaders).then(results => {
    const combined = results.flat();
    return combined.filter((row) => {
      const rowStatus = (row.status || 'active').toLowerCase();
      if (statusFilter && rowStatus !== statusFilter) return false;
      const createdAt = new Date(row.created_at);
      if (startDate && createdAt < startDate) return false;
      if (endDate && createdAt > endDate) return false;
      return true;
    });
  });
}

// GET endpoints - Group by session_id
app.get('/api/production/liquid', (req, res) => {
  db.all('SELECT * FROM production_liquid ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    // Parse JSON strings back to objects
    const parsedRows = rows.map(parseAuthenticityData);
    
    // Group by session_id
    const grouped = {};
    parsedRows.forEach(row => {
      const sessionKey = row.session_id || `${row.leader_name}_${row.shift_number}_${row.created_at}`;
      if (!grouped[sessionKey]) {
        grouped[sessionKey] = {
          session_id: sessionKey,
          leader_name: row.leader_name,
          shift_number: row.shift_number,
          status: row.status || 'active',
          created_at: row.created_at,
          inputs: []
        };
      }
      grouped[sessionKey].inputs.push({
        id: row.id,
        pic: row.pic,
        mo_number: row.mo_number,
        sku_name: row.sku_name,
        authenticity_data: row.authenticity_data,
        status: row.status || 'active',
        created_at: row.created_at
      });
    });
    
    // Convert to array and sort by created_at
    const result = Object.values(grouped).sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    );
    
    res.json(result);
  });
});

app.get('/api/production/device', (req, res) => {
  db.all('SELECT * FROM production_device ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    // Parse JSON strings back to objects
    const parsedRows = rows.map(parseAuthenticityData);
    
    // Group by session_id
    const grouped = {};
    parsedRows.forEach(row => {
      const sessionKey = row.session_id || `${row.leader_name}_${row.shift_number}_${row.created_at}`;
      if (!grouped[sessionKey]) {
        grouped[sessionKey] = {
          session_id: sessionKey,
          leader_name: row.leader_name,
          shift_number: row.shift_number,
          status: row.status || 'active',
          created_at: row.created_at,
          inputs: []
        };
      }
      grouped[sessionKey].inputs.push({
        id: row.id,
        pic: row.pic,
        mo_number: row.mo_number,
        sku_name: row.sku_name,
        authenticity_data: row.authenticity_data,
        status: row.status || 'active',
        created_at: row.created_at
      });
    });
    
    // Convert to array and sort by created_at
    const result = Object.values(grouped).sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    );
    
    res.json(result);
  });
});

app.get('/api/production/cartridge', (req, res) => {
  db.all('SELECT * FROM production_cartridge ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    // Parse JSON strings back to objects
    const parsedRows = rows.map(parseAuthenticityData);
    
    // Group by session_id
    const grouped = {};
    parsedRows.forEach(row => {
      const sessionKey = row.session_id || `${row.leader_name}_${row.shift_number}_${row.created_at}`;
      if (!grouped[sessionKey]) {
        grouped[sessionKey] = {
          session_id: sessionKey,
          leader_name: row.leader_name,
          shift_number: row.shift_number,
          status: row.status || 'active',
          created_at: row.created_at,
          inputs: []
        };
      }
      grouped[sessionKey].inputs.push({
        id: row.id,
        pic: row.pic,
        mo_number: row.mo_number,
        sku_name: row.sku_name,
        authenticity_data: row.authenticity_data,
        status: row.status || 'active',
        created_at: row.created_at
      });
    });
    
    // Convert to array and sort by created_at
    const result = Object.values(grouped).sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    );
    
    res.json(result);
  });
});

// External API endpoints for authenticity data
app.get('/api/external/authenticity', apiKeyAuth, async (req, res) => {
  try {
    const data = await fetchProductionData({
      type: req.query.type,
      status: req.query.status,
      start_date: req.query.start_date,
      end_date: req.query.end_date
    });
    res.json({ count: data.length, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/external/authenticity', apiKeyAuth, async (req, res) => {
  try {
    const { type, status, start_date, end_date } = req.body || {};
    const data = await fetchProductionData({ type, status, start_date, end_date });
    res.json({ count: data.length, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// External API endpoint for manufacturing process data by MO Number
app.get('/api/external/manufacturing-data', apiKeyAuth, async (req, res) => {
  try {
    const { mo_number, completed_at } = req.query;
    
    if (!mo_number) {
      return res.status(400).json({ 
        success: false, 
        error: 'MO Number is required' 
      });
    }

    // Query all production tables
    const tables = [
      { name: 'production_liquid', type: 'liquid' },
      { name: 'production_device', type: 'device' },
      { name: 'production_cartridge', type: 'cartridge' }
    ];

    const productionPromises = tables.map(table => {
      return new Promise((resolve, reject) => {
        let query = `SELECT *, '${table.type}' as production_type FROM ${table.name} WHERE mo_number = ? AND status = 'completed'`;
        const params = [mo_number];
        
        if (completed_at && completed_at !== 'all') {
          query += ` AND completed_at IS NOT NULL AND DATE(completed_at) = DATE(?)`;
          params.push(completed_at);
        }
        
        query += ` ORDER BY created_at ASC`;
        
        db.all(query, params, (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(rows.map(row => parseAuthenticityData(row)));
        });
      });
    });

    // Query buffer tables
    const bufferPromises = [
      { name: 'buffer_liquid', type: 'liquid' },
      { name: 'buffer_device', type: 'device' },
      { name: 'buffer_cartridge', type: 'cartridge' }
    ].map(table => {
      return new Promise((resolve, reject) => {
        db.all(
          `SELECT * FROM ${table.name} WHERE mo_number = ? ORDER BY created_at ASC`,
          [mo_number],
          (err, rows) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(rows.map(row => ({
              ...row,
              authenticity_numbers: typeof row.authenticity_numbers === 'string' 
                ? JSON.parse(row.authenticity_numbers) 
                : row.authenticity_numbers
            })));
          }
        );
      });
    });

    // Query reject tables
    const rejectPromises = [
      { name: 'reject_liquid', type: 'liquid' },
      { name: 'reject_device', type: 'device' },
      { name: 'reject_cartridge', type: 'cartridge' }
    ].map(table => {
      return new Promise((resolve, reject) => {
        db.all(
          `SELECT * FROM ${table.name} WHERE mo_number = ? ORDER BY created_at ASC`,
          [mo_number],
          (err, rows) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(rows.map(row => ({
              ...row,
              authenticity_numbers: typeof row.authenticity_numbers === 'string' 
                ? JSON.parse(row.authenticity_numbers) 
                : row.authenticity_numbers
            })));
          }
        );
      });
    });

    const [productionResults, bufferResults, rejectResults] = await Promise.all([
      Promise.all(productionPromises),
      Promise.all(bufferPromises),
      Promise.all(rejectPromises)
    ]);

    // Flatten results
    const allProduction = productionResults.flat();
    const allBuffers = bufferResults.flat();
    const allRejects = rejectResults.flat();

    if (allProduction.length === 0) {
      return res.json({
        success: true,
        mo_number: mo_number,
        completed_at: completed_at || 'all',
        total_sessions: 0,
        data: []
      });
    }

    // Group by session_id
    const sessionGroups = {};
    allProduction.forEach(row => {
      const sessionKey = row.session_id;
      if (!sessionGroups[sessionKey]) {
        sessionGroups[sessionKey] = {
          session: sessionKey,
          leader: row.leader_name,
          shift: row.shift_number,
          mo_data: []
        };
      }

      // Add production data
      sessionGroups[sessionKey].mo_data.push({
        mo_number: row.mo_number,
        sku_name: row.sku_name,
        pic: row.pic,
        production_type: row.production_type,
        completed_at: row.completed_at || null,
        authenticity_data: row.authenticity_data.map(auth => ({
          first_authenticity: auth.firstAuthenticity || '',
          last_authenticity: auth.lastAuthenticity || '',
          roll_number: auth.rollNumber || ''
        })),
        buffered_auth: allBuffers
          .filter(b => b.mo_number === row.mo_number)
          .flatMap(b => b.authenticity_numbers),
        rejected_auth: allRejects
          .filter(r => r.mo_number === row.mo_number)
          .flatMap(r => r.authenticity_numbers)
      });
    });

    res.json({
      success: true,
      mo_number: mo_number,
      completed_at: completed_at || 'all',
      total_sessions: Object.keys(sessionGroups).length,
      data: Object.values(sessionGroups)
    });

  } catch (error) {
    console.error('Error fetching manufacturing data:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// GET endpoint to check MO status (active or completed)
app.get('/api/external/manufacturing-data/status', apiKeyAuth, async (req, res) => {
  try {
    const { mo_number, completed_at } = req.query;
    
    if (!mo_number) {
      return res.status(400).json({ 
        success: false, 
        error: 'MO Number is required' 
      });
    }

    // Query all production tables to check for active status
    const tables = [
      { name: 'production_liquid', type: 'liquid' },
      { name: 'production_device', type: 'device' },
      { name: 'production_cartridge', type: 'cartridge' }
    ];

    // Check for active inputs
    const activePromises = tables.map(table => {
      return new Promise((resolve, reject) => {
        let query = `SELECT COUNT(*) as count FROM ${table.name} WHERE mo_number = ? AND status = 'active'`;
        db.get(query, [mo_number], (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(row ? row.count : 0);
        });
      });
    });

    // Check for completed inputs
    const completedPromises = tables.map(table => {
      return new Promise((resolve, reject) => {
        let query = `SELECT COUNT(*) as count FROM ${table.name} WHERE mo_number = ? AND status = 'completed'`;
        const params = [mo_number];
        
        if (completed_at && completed_at !== 'all') {
          query += ` AND completed_at IS NOT NULL AND DATE(completed_at) = DATE(?)`;
          params.push(completed_at);
        }
        
        db.get(query, params, (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(row ? row.count : 0);
        });
      });
    });

    const [activeCounts, completedCounts] = await Promise.all([
      Promise.all(activePromises),
      Promise.all(completedPromises)
    ]);

    const totalActive = activeCounts.reduce((sum, count) => sum + count, 0);
    const totalCompleted = completedCounts.reduce((sum, count) => sum + count, 0);

    // Determine status
    // If there are any active inputs, status is "active"
    // If there are only completed inputs (and no active), status is "completed"
    // If there are no inputs at all, return error or "not_found"
    if (totalActive > 0) {
      return res.json({
        status: 'active'
      });
    } else if (totalCompleted > 0) {
      return res.json({
        status: 'completed'
      });
    } else {
      return res.status(404).json({
        success: false,
        error: 'MO number not found',
        status: null
      });
    }

  } catch (error) {
    console.error('Error checking MO status:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// GET endpoint to get all MOs completed on a specific date
app.get('/api/external/manufacturing-data/by-date', apiKeyAuth, async (req, res) => {
  try {
    const { completed_at } = req.query;
    
    if (!completed_at) {
      return res.status(400).json({ 
        success: false, 
        error: 'completed_at parameter is required. Format: YYYY-MM-DD' 
      });
    }

    // Query all production tables
    const tables = [
      { name: 'production_liquid', type: 'liquid' },
      { name: 'production_device', type: 'device' },
      { name: 'production_cartridge', type: 'cartridge' }
    ];

    const productionPromises = tables.map(table => {
      return new Promise((resolve, reject) => {
        let query = `SELECT *, '${table.type}' as production_type FROM ${table.name} WHERE status = 'completed' AND completed_at IS NOT NULL AND DATE(completed_at) = DATE(?)`;
        const params = [completed_at];
        
        query += ` ORDER BY completed_at ASC, mo_number ASC`;
        
        db.all(query, params, (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(rows.map(row => parseAuthenticityData(row)));
        });
      });
    });

    // Query buffer tables for all MOs
    const bufferPromises = [
      { name: 'buffer_liquid', type: 'liquid' },
      { name: 'buffer_device', type: 'device' },
      { name: 'buffer_cartridge', type: 'cartridge' }
    ].map(table => {
      return new Promise((resolve, reject) => {
        // Get buffer data for MOs that were completed on the target date
        db.all(
          `SELECT b.* FROM ${table.name} b 
           INNER JOIN (
             SELECT DISTINCT mo_number FROM (
               SELECT mo_number FROM production_liquid WHERE status = 'completed' AND completed_at IS NOT NULL AND DATE(completed_at) = DATE(?)
               UNION
               SELECT mo_number FROM production_device WHERE status = 'completed' AND completed_at IS NOT NULL AND DATE(completed_at) = DATE(?)
               UNION
               SELECT mo_number FROM production_cartridge WHERE status = 'completed' AND completed_at IS NOT NULL AND DATE(completed_at) = DATE(?)
             )
           ) p ON b.mo_number = p.mo_number
           ORDER BY b.created_at ASC`,
          [completed_at, completed_at, completed_at],
          (err, rows) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(rows.map(row => ({
              ...row,
              authenticity_numbers: typeof row.authenticity_numbers === 'string' 
                ? JSON.parse(row.authenticity_numbers) 
                : row.authenticity_numbers
            })));
          }
        );
      });
    });

    // Query reject tables for all MOs
    const rejectPromises = [
      { name: 'reject_liquid', type: 'liquid' },
      { name: 'reject_device', type: 'device' },
      { name: 'reject_cartridge', type: 'cartridge' }
    ].map(table => {
      return new Promise((resolve, reject) => {
        // Get reject data for MOs that were completed on the target date
        db.all(
          `SELECT r.* FROM ${table.name} r 
           INNER JOIN (
             SELECT DISTINCT mo_number FROM (
               SELECT mo_number FROM production_liquid WHERE status = 'completed' AND completed_at IS NOT NULL AND DATE(completed_at) = DATE(?)
               UNION
               SELECT mo_number FROM production_device WHERE status = 'completed' AND completed_at IS NOT NULL AND DATE(completed_at) = DATE(?)
               UNION
               SELECT mo_number FROM production_cartridge WHERE status = 'completed' AND completed_at IS NOT NULL AND DATE(completed_at) = DATE(?)
             )
           ) p ON r.mo_number = p.mo_number
           ORDER BY r.created_at ASC`,
          [completed_at, completed_at, completed_at],
          (err, rows) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(rows.map(row => ({
              ...row,
              authenticity_numbers: typeof row.authenticity_numbers === 'string' 
                ? JSON.parse(row.authenticity_numbers) 
                : row.authenticity_numbers
            })));
          }
        );
      });
    });

    const [productionResults, bufferResults, rejectResults] = await Promise.all([
      Promise.all(productionPromises),
      Promise.all(bufferPromises),
      Promise.all(rejectPromises)
    ]);

    // Flatten results
    const allProduction = productionResults.flat();
    const allBuffers = bufferResults.flat();
    const allRejects = rejectResults.flat();

    if (allProduction.length === 0) {
      return res.json({
        success: true,
        completed_at: completed_at,
        total_mo: 0,
        total_sessions: 0,
        data: []
      });
    }

    // Get unique MO numbers
    const uniqueMoNumbers = [...new Set(allProduction.map(row => row.mo_number))];

    // Group by MO number first, then by session_id
    const moGroups = {};
    uniqueMoNumbers.forEach(moNumber => {
      moGroups[moNumber] = {
        mo_number: moNumber,
        sessions: {}
      };
    });

    // Group production data by MO and session
    allProduction.forEach(row => {
      const moNumber = row.mo_number;
      const sessionKey = row.session_id;
      
      if (!moGroups[moNumber].sessions[sessionKey]) {
        moGroups[moNumber].sessions[sessionKey] = {
          session: sessionKey,
          leader: row.leader_name,
          shift: row.shift_number,
          mo_data: []
        };
      }

      // Add production data
      moGroups[moNumber].sessions[sessionKey].mo_data.push({
        mo_number: row.mo_number,
        sku_name: row.sku_name,
        pic: row.pic,
        production_type: row.production_type,
        completed_at: row.completed_at || null,
        authenticity_data: row.authenticity_data.map(auth => ({
          first_authenticity: auth.firstAuthenticity || '',
          last_authenticity: auth.lastAuthenticity || '',
          roll_number: auth.rollNumber || ''
        })),
        buffered_auth: allBuffers
          .filter(b => b.mo_number === row.mo_number)
          .flatMap(b => b.authenticity_numbers),
        rejected_auth: allRejects
          .filter(r => r.mo_number === row.mo_number)
          .flatMap(r => r.authenticity_numbers)
      });
    });

    // Convert to array format
    const result = Object.values(moGroups).map(moGroup => ({
      mo_number: moGroup.mo_number,
      total_sessions: Object.keys(moGroup.sessions).length,
      sessions: Object.values(moGroup.sessions)
    }));

    res.json({
      success: true,
      completed_at: completed_at,
      total_mo: uniqueMoNumbers.length,
      total_sessions: Object.values(moGroups).reduce((sum, mo) => sum + Object.keys(mo.sessions).length, 0),
      data: result
    });

  } catch (error) {
    console.error('Error fetching manufacturing data by date:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// POST endpoints
app.post('/api/production/liquid', (req, res) => {
  const { session_id, leader_name, shift_number, pic, mo_number, sku_name, authenticity_data } = req.body;
  
  // Ensure authenticity_data is an array
  const authenticityRows = normalizeAuthenticityArray(authenticity_data);
  
  // Get target_qty from odoo_mo_cache
  db.get('SELECT quantity FROM odoo_mo_cache WHERE mo_number = ?', [mo_number], (err, row) => {
    const targetQty = (!err && row) ? (row.quantity || 0) : 0;
    
    // Create separate row for each authenticity data entry (each roll number)
    const insertPromises = authenticityRows.map((authRow) => {
      return new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO production_liquid (session_id, leader_name, shift_number, pic, mo_number, sku_name, authenticity_data, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
          [session_id, leader_name, shift_number, pic, mo_number, sku_name, JSON.stringify([authRow])],
          function(insertErr) {
            if (insertErr) {
              reject(insertErr);
            } else {
              resolve({ id: this.lastID, row: authRow });
            }
          }
        );
      });
    });
    
    Promise.all(insertPromises)
      .then((results) => {
        // Send data to external API when Input Authenticity Label Process is performed
        const externalAPIData = {
          status: 'active'
        };
        
        // Send to external API asynchronously (don't wait for response)
        sendToExternalAPI(externalAPIData).catch(apiErr => {
          console.error(`❌ [External API] Failed to send active status for MO ${mo_number}:`, apiErr.message);
        });
        
        res.json({ 
          message: 'Data saved successfully',
          saved_count: results.length,
          data: results.map(r => ({
            id: r.id,
            session_id,
            leader_name,
            shift_number,
            pic,
            mo_number,
            sku_name,
            authenticity_data: [r.row]
          }))
        });
      })
      .catch((err) => {
        res.status(500).json({ error: err.message });
      });
  });
});

app.post('/api/production/device', (req, res) => {
  const { session_id, leader_name, shift_number, pic, mo_number, sku_name, authenticity_data } = req.body;
  
  // Ensure authenticity_data is an array
  const authenticityRows = normalizeAuthenticityArray(authenticity_data);
  
  // Create separate row for each authenticity data entry (each roll number)
  const insertPromises = authenticityRows.map((row) => {
    return new Promise((resolve, reject) => {
  db.run(
    `INSERT INTO production_device (session_id, leader_name, shift_number, pic, mo_number, sku_name, authenticity_data, status) 
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
        [session_id, leader_name, shift_number, pic, mo_number, sku_name, JSON.stringify([row])],
    function(err) {
      if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, row });
          }
        }
      );
    });
  });
  
  Promise.all(insertPromises)
    .then((results) => {
      res.json({ 
        message: 'Data saved successfully',
        saved_count: results.length,
        data: results.map(r => ({
          id: r.id,
          session_id,
          leader_name,
          shift_number,
          pic,
          mo_number,
          sku_name,
          authenticity_data: [r.row]
        }))
      });
    })
    .catch((err) => {
      res.status(500).json({ error: err.message });
    });
});

app.post('/api/production/cartridge', (req, res) => {
  const { session_id, leader_name, shift_number, pic, mo_number, sku_name, authenticity_data } = req.body;
  
  // Ensure authenticity_data is an array
  const authenticityRows = normalizeAuthenticityArray(authenticity_data);
  
  // Create separate row for each authenticity data entry (each roll number)
  const insertPromises = authenticityRows.map((row) => {
    return new Promise((resolve, reject) => {
  db.run(
    `INSERT INTO production_cartridge (session_id, leader_name, shift_number, pic, mo_number, sku_name, authenticity_data, status) 
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
        [session_id, leader_name, shift_number, pic, mo_number, sku_name, JSON.stringify([row])],
    function(err) {
      if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, row });
          }
        }
      );
    });
  });
  
  Promise.all(insertPromises)
    .then((results) => {
      res.json({ 
        message: 'Data saved successfully',
        saved_count: results.length,
        data: results.map(r => ({
          id: r.id,
          session_id,
          leader_name,
          shift_number,
          pic,
          mo_number,
          sku_name,
          authenticity_data: [r.row]
        }))
      });
    })
    .catch((err) => {
      res.status(500).json({ error: err.message });
    });
});

// PUT endpoints to update session status
app.put('/api/production/liquid/end-session', (req, res) => {
  const { session_id } = req.body;
  
  db.run(
    `UPDATE production_liquid SET status = 'completed' WHERE session_id = ?`,
    [session_id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Session ended successfully' });
    }
  );
});

app.put('/api/production/device/end-session', (req, res) => {
  const { session_id } = req.body;
  
  db.run(
    `UPDATE production_device SET status = 'completed' WHERE session_id = ?`,
    [session_id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Session ended successfully' });
    }
  );
});

app.put('/api/production/cartridge/end-session', (req, res) => {
  const { session_id } = req.body;
  
  db.run(
    `UPDATE production_cartridge SET status = 'completed' WHERE session_id = ?`,
    [session_id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Session ended successfully' });
    }
  );
});

// PUT endpoints to update individual input status
app.put('/api/production/liquid/update-status/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  if (!status || !['active', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Status must be "active" or "completed"' });
  }
  
  const completedAt = status === 'completed' ? new Date().toISOString() : null;
  
  // Get MO data before updating
  db.get('SELECT mo_number, sku_name, leader_name FROM production_liquid WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!row) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    // Update status
    db.run(
      `UPDATE production_liquid SET status = ?, completed_at = ? WHERE id = ?`,
      [status, completedAt, id],
      async function(updateErr) {
        if (updateErr) {
          return res.status(500).json({ error: updateErr.message });
        }
        
        // If status is completed, check if all inputs for this MO are now completed
        // Only send to external API when all inputs for the MO are completed
        if (status === 'completed') {
          try {
            // Check if there are any remaining active inputs for this MO
            db.get(
              `SELECT COUNT(*) as active_count FROM production_liquid 
               WHERE mo_number = ? AND status = 'active'`,
              [row.mo_number],
              (checkErr, checkRow) => {
                if (checkErr) {
                  console.error(`❌ [External API] Error checking active inputs for MO ${row.mo_number}:`, checkErr.message);
                  return;
                }
                
                // If no active inputs remain, all inputs for this MO are completed
                // Send completed status to external API
                if (checkRow && checkRow.active_count === 0) {
                  const externalAPIData = {
                    status: 'completed'
                  };
                  
                  // Send to external API asynchronously (don't wait for response)
                  sendToExternalAPI(externalAPIData).catch(apiErr => {
                    console.error(`❌ [External API] Failed to send completed status for MO ${row.mo_number}:`, apiErr.message);
                  });
                }
              }
            );
          } catch (apiError) {
            console.error(`❌ [External API] Error preparing completed data for MO ${row.mo_number}:`, apiError.message);
          }
        }
        
        res.json({ message: 'Status updated successfully', id: id, status: status });
      }
    );
  });
});

app.put('/api/production/device/update-status/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  if (!status || !['active', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Status must be "active" or "completed"' });
  }
  
  const completedAt = status === 'completed' ? new Date().toISOString() : null;
  
  db.run(
    `UPDATE production_device SET status = ?, completed_at = ? WHERE id = ?`,
    [status, completedAt, id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Status updated successfully', id: id, status: status });
    }
  );
});

app.put('/api/production/cartridge/update-status/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  if (!status || !['active', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Status must be "active" or "completed"' });
  }
  
  const completedAt = status === 'completed' ? new Date().toISOString() : null;
  
  db.run(
    `UPDATE production_cartridge SET status = ?, completed_at = ? WHERE id = ?`,
    [status, completedAt, id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Status updated successfully', id: id, status: status });
    }
  );
});

// PUT endpoints to update/edit individual input data
app.put('/api/production/liquid/:id', (req, res) => {
  const { id } = req.params;
  const { pic, mo_number, sku_name, authenticity_data } = req.body;
  
  // Build update query dynamically
  const updates = [];
  const values = [];
  
  if (pic !== undefined) {
    updates.push('pic = ?');
    values.push(pic);
  }
  if (mo_number !== undefined) {
    updates.push('mo_number = ?');
    values.push(mo_number);
  }
  if (sku_name !== undefined) {
    updates.push('sku_name = ?');
    values.push(sku_name);
  }
  if (authenticity_data !== undefined) {
    updates.push('authenticity_data = ?');
    values.push(JSON.stringify(normalizeAuthenticityArray(authenticity_data)));
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  
  values.push(id);
  
  db.run(
    `UPDATE production_liquid SET ${updates.join(', ')} WHERE id = ?`,
    values,
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Data updated successfully', id: id });
    }
  );
});

app.put('/api/production/device/:id', (req, res) => {
  const { id } = req.params;
  const { pic, mo_number, sku_name, authenticity_data } = req.body;
  
  const updates = [];
  const values = [];
  
  if (pic !== undefined) {
    updates.push('pic = ?');
    values.push(pic);
  }
  if (mo_number !== undefined) {
    updates.push('mo_number = ?');
    values.push(mo_number);
  }
  if (sku_name !== undefined) {
    updates.push('sku_name = ?');
    values.push(sku_name);
  }
  if (authenticity_data !== undefined) {
    updates.push('authenticity_data = ?');
    values.push(JSON.stringify(normalizeAuthenticityArray(authenticity_data)));
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  
  values.push(id);
  
  db.run(
    `UPDATE production_device SET ${updates.join(', ')} WHERE id = ?`,
    values,
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Data updated successfully', id: id });
    }
  );
});

app.put('/api/production/cartridge/:id', (req, res) => {
  const { id } = req.params;
  const { pic, mo_number, sku_name, authenticity_data } = req.body;
  
  const updates = [];
  const values = [];
  
  if (pic !== undefined) {
    updates.push('pic = ?');
    values.push(pic);
  }
  if (mo_number !== undefined) {
    updates.push('mo_number = ?');
    values.push(mo_number);
  }
  if (sku_name !== undefined) {
    updates.push('sku_name = ?');
    values.push(sku_name);
  }
  if (authenticity_data !== undefined) {
    updates.push('authenticity_data = ?');
    values.push(JSON.stringify(normalizeAuthenticityArray(authenticity_data)));
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  
  values.push(id);
  
  db.run(
    `UPDATE production_cartridge SET ${updates.join(', ')} WHERE id = ?`,
    values,
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Data updated successfully', id: id });
    }
  );
});

// Buffer Authenticity endpoints
// GET buffer by MO Number (using query parameter to handle MO numbers with slashes)
app.get('/api/buffer/liquid', (req, res) => {
  const { moNumber } = req.query;
  if (!moNumber) {
    res.status(400).json({ error: 'MO Number is required' });
    return;
  }
  db.all('SELECT * FROM buffer_liquid WHERE mo_number = ? ORDER BY created_at DESC', [moNumber], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    const parsedRows = rows.map(row => ({
      ...row,
      authenticity_numbers: typeof row.authenticity_numbers === 'string' 
        ? JSON.parse(row.authenticity_numbers) 
        : row.authenticity_numbers
    }));
    res.json(parsedRows);
  });
});

app.get('/api/buffer/device', (req, res) => {
  const { moNumber } = req.query;
  if (!moNumber) {
    res.status(400).json({ error: 'MO Number is required' });
    return;
  }
  db.all('SELECT * FROM buffer_device WHERE mo_number = ? ORDER BY created_at DESC', [moNumber], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    const parsedRows = rows.map(row => ({
      ...row,
      authenticity_numbers: typeof row.authenticity_numbers === 'string' 
        ? JSON.parse(row.authenticity_numbers) 
        : row.authenticity_numbers
    }));
    res.json(parsedRows);
  });
});

app.get('/api/buffer/cartridge', (req, res) => {
  const { moNumber } = req.query;
  if (!moNumber) {
    res.status(400).json({ error: 'MO Number is required' });
    return;
  }
  db.all('SELECT * FROM buffer_cartridge WHERE mo_number = ? ORDER BY created_at DESC', [moNumber], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    const parsedRows = rows.map(row => ({
      ...row,
      authenticity_numbers: typeof row.authenticity_numbers === 'string' 
        ? JSON.parse(row.authenticity_numbers) 
        : row.authenticity_numbers
    }));
    res.json(parsedRows);
  });
});

// POST buffer
app.post('/api/buffer/liquid', (req, res) => {
  const { session_id, pic, mo_number, sku_name, authenticity_numbers } = req.body;
  const normalizedNumbers = normalizeAuthenticityNumbers(authenticity_numbers);
  
  db.run(
    `INSERT INTO buffer_liquid (session_id, pic, mo_number, sku_name, authenticity_numbers) 
     VALUES (?, ?, ?, ?, ?)`,
    [session_id, pic, mo_number, sku_name, JSON.stringify(normalizedNumbers)],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ 
        id: this.lastID, 
        message: 'Buffer data saved successfully'
      });
    }
  );
});

app.post('/api/buffer/device', (req, res) => {
  const { session_id, pic, mo_number, sku_name, authenticity_numbers } = req.body;
  const normalizedNumbers = normalizeAuthenticityNumbers(authenticity_numbers);
  
  db.run(
    `INSERT INTO buffer_device (session_id, pic, mo_number, sku_name, authenticity_numbers) 
     VALUES (?, ?, ?, ?, ?)`,
    [session_id, pic, mo_number, sku_name, JSON.stringify(normalizedNumbers)],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ 
        id: this.lastID, 
        message: 'Buffer data saved successfully'
      });
    }
  );
});

app.post('/api/buffer/cartridge', (req, res) => {
  const { session_id, pic, mo_number, sku_name, authenticity_numbers } = req.body;
  const normalizedNumbers = normalizeAuthenticityNumbers(authenticity_numbers);
  
  db.run(
    `INSERT INTO buffer_cartridge (session_id, pic, mo_number, sku_name, authenticity_numbers) 
     VALUES (?, ?, ?, ?, ?)`,
    [session_id, pic, mo_number, sku_name, JSON.stringify(normalizedNumbers)],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ 
        id: this.lastID, 
        message: 'Buffer data saved successfully'
      });
    }
  );
});

// Reject Authenticity endpoints
// GET reject by MO Number (using query parameter to handle MO numbers with slashes)
app.get('/api/reject/liquid', (req, res) => {
  const { moNumber } = req.query;
  if (!moNumber) {
    res.status(400).json({ error: 'MO Number is required' });
    return;
  }
  db.all('SELECT * FROM reject_liquid WHERE mo_number = ? ORDER BY created_at DESC', [moNumber], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    const parsedRows = rows.map(row => ({
      ...row,
      authenticity_numbers: typeof row.authenticity_numbers === 'string' 
        ? JSON.parse(row.authenticity_numbers) 
        : row.authenticity_numbers
    }));
    res.json(parsedRows);
  });
});

app.get('/api/reject/device', (req, res) => {
  const { moNumber } = req.query;
  if (!moNumber) {
    res.status(400).json({ error: 'MO Number is required' });
    return;
  }
  db.all('SELECT * FROM reject_device WHERE mo_number = ? ORDER BY created_at DESC', [moNumber], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    const parsedRows = rows.map(row => ({
      ...row,
      authenticity_numbers: typeof row.authenticity_numbers === 'string' 
        ? JSON.parse(row.authenticity_numbers) 
        : row.authenticity_numbers
    }));
    res.json(parsedRows);
  });
});

app.get('/api/reject/cartridge', (req, res) => {
  const { moNumber } = req.query;
  if (!moNumber) {
    res.status(400).json({ error: 'MO Number is required' });
    return;
  }
  db.all('SELECT * FROM reject_cartridge WHERE mo_number = ? ORDER BY created_at DESC', [moNumber], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    const parsedRows = rows.map(row => ({
      ...row,
      authenticity_numbers: typeof row.authenticity_numbers === 'string' 
        ? JSON.parse(row.authenticity_numbers) 
        : row.authenticity_numbers
    }));
    res.json(parsedRows);
  });
});

// POST reject
app.post('/api/reject/liquid', (req, res) => {
  const { session_id, pic, mo_number, sku_name, authenticity_numbers } = req.body;
  const normalizedNumbers = normalizeAuthenticityNumbers(authenticity_numbers);
  
  db.run(
    `INSERT INTO reject_liquid (session_id, pic, mo_number, sku_name, authenticity_numbers) 
     VALUES (?, ?, ?, ?, ?)`,
    [session_id, pic, mo_number, sku_name, JSON.stringify(normalizedNumbers)],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ 
        id: this.lastID, 
        message: 'Reject data saved successfully'
      });
    }
  );
});

app.post('/api/reject/device', (req, res) => {
  const { session_id, pic, mo_number, sku_name, authenticity_numbers } = req.body;
  const normalizedNumbers = normalizeAuthenticityNumbers(authenticity_numbers);
  
  db.run(
    `INSERT INTO reject_device (session_id, pic, mo_number, sku_name, authenticity_numbers) 
     VALUES (?, ?, ?, ?, ?)`,
    [session_id, pic, mo_number, sku_name, JSON.stringify(normalizedNumbers)],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ 
        id: this.lastID, 
        message: 'Reject data saved successfully'
      });
    }
  );
});

app.post('/api/reject/cartridge', (req, res) => {
  const { session_id, pic, mo_number, sku_name, authenticity_numbers } = req.body;
  const normalizedNumbers = normalizeAuthenticityNumbers(authenticity_numbers);
  
  db.run(
    `INSERT INTO reject_cartridge (session_id, pic, mo_number, sku_name, authenticity_numbers) 
     VALUES (?, ?, ?, ?, ?)`,
    [session_id, pic, mo_number, sku_name, JSON.stringify(normalizedNumbers)],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ 
        id: this.lastID, 
        message: 'Reject data saved successfully'
      });
    }
  );
});

// Admin API Endpoints
// GET admin configuration
app.get('/api/admin/config', (req, res) => {
  try {
    if (!db) {
      console.error('Database connection not available');
      return res.json({
        success: true,
        config: {
          sessionId: process.env.ODOO_SESSION_ID || 'bc6b1450c0cd3b05e3ac199521e02f7b639e39ae',
          odooBaseUrl: process.env.ODOO_API_URL || 'https://foomx.odoo.com'
        }
      });
    }

    // Check if table exists first
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='admin_config'", (tableErr, tableRow) => {
      if (tableErr) {
        console.error('Error checking admin_config table:', tableErr);
        // Return default values on error
        return res.json({
          success: true,
          config: {
            sessionId: process.env.ODOO_SESSION_ID || 'bc6b1450c0cd3b05e3ac199521e02f7b639e39ae',
            odooBaseUrl: process.env.ODOO_API_URL || 'https://foomx.odoo.com'
          }
        });
      }

      if (!tableRow) {
        // Table doesn't exist, return default values
        return res.json({
          success: true,
          config: {
            sessionId: process.env.ODOO_SESSION_ID || 'bc6b1450c0cd3b05e3ac199521e02f7b639e39ae',
            odooBaseUrl: process.env.ODOO_API_URL || 'https://foomx.odoo.com'
          }
        });
      }

      db.get('SELECT config_value FROM admin_config WHERE config_key = ?', ['odoo_session_id'], (err, row) => {
        if (err) {
          console.error('Error fetching session_id config:', err);
          // Return default if error
          const sessionId = process.env.ODOO_SESSION_ID || 'bc6b1450c0cd3b05e3ac199521e02f7b639e39ae';
          const odooBaseUrl = process.env.ODOO_API_URL || 'https://foomx.odoo.com';
          return res.json({
            success: true,
            config: {
              sessionId: sessionId,
              odooBaseUrl: odooBaseUrl
            }
          });
        }
        
        const sessionId = row ? row.config_value : process.env.ODOO_SESSION_ID || 'bc6b1450c0cd3b05e3ac199521e02f7b639e39ae';
        
        db.get('SELECT config_value FROM admin_config WHERE config_key = ?', ['odoo_base_url'], (err2, row2) => {
          if (err2) {
            console.error('Error fetching base_url config:', err2);
            // Return default if error
            return res.json({
              success: true,
              config: {
                sessionId: sessionId,
                odooBaseUrl: process.env.ODOO_API_URL || 'https://foomx.odoo.com'
              }
            });
          }
          
          const odooBaseUrl = row2 ? row2.config_value : process.env.ODOO_API_URL || 'https://foomx.odoo.com';
          
          // Get external API URLs (active and completed)
          db.get('SELECT config_value FROM admin_config WHERE config_key = ?', ['external_api_url_active'], (err3, row3) => {
            try {
              if (err3) {
                console.error('Error fetching external_api_url_active config:', err3);
              }
              
              const externalApiUrlActive = row3 ? row3.config_value : (process.env.EXTERNAL_API_URL_ACTIVE || process.env.EXTERNAL_API_URL || 'https://foom-dash.vercel.app/API');
              
              db.get('SELECT config_value FROM admin_config WHERE config_key = ?', ['external_api_url_completed'], (err4, row4) => {
                try {
                  if (err4) {
                    console.error('Error fetching external_api_url_completed config:', err4);
                  }
                  
                  const externalApiUrlCompleted = row4 ? row4.config_value : (process.env.EXTERNAL_API_URL_COMPLETED || process.env.EXTERNAL_API_URL || 'https://foom-dash.vercel.app/API');
                  
                  // Also get fallback general external_api_url for backward compatibility
                  db.get('SELECT config_value FROM admin_config WHERE config_key = ?', ['external_api_url'], (err5, row5) => {
                    try {
                      if (err5) {
                        console.error('Error fetching external_api_url config:', err5);
                      }
                      
                      const externalApiUrl = row5 ? row5.config_value : (process.env.EXTERNAL_API_URL || 'https://foom-dash.vercel.app/API');
                      
                      // Get API key (masked for security)
                      db.get('SELECT config_value FROM admin_config WHERE config_key = ?', ['api_key'], (err6, row6) => {
                        try {
                          if (err6) {
                            console.error('Error fetching api_key config:', err6);
                          }
                          
                          const apiKey = row6 ? row6.config_value : null;
                          // Mask API key for display (show only last 8 characters)
                          let maskedApiKey = null;
                          if (apiKey && typeof apiKey === 'string' && apiKey.length > 8) {
                            maskedApiKey = apiKey.substring(0, apiKey.length - 8) + '********';
                          } else if (apiKey && typeof apiKey === 'string') {
                            // If API key is too short, just show all as masked
                            maskedApiKey = '********';
                          }
                          
                          res.json({
                            success: true,
                            config: {
                              sessionId: sessionId,
                              odooBaseUrl: odooBaseUrl,
                              externalApiUrl: externalApiUrl,
                              externalApiUrlActive: externalApiUrlActive,
                              externalApiUrlCompleted: externalApiUrlCompleted,
                              apiKey: maskedApiKey,
                              apiKeyConfigured: !!apiKey
                            }
                          });
                        } catch (error) {
                          console.error('Error processing API key config:', error);
                          // Return response even if API key processing fails
                          res.json({
                            success: true,
                            config: {
                              sessionId: sessionId,
                              odooBaseUrl: odooBaseUrl,
                              externalApiUrl: externalApiUrl,
                              externalApiUrlActive: externalApiUrlActive,
                              externalApiUrlCompleted: externalApiUrlCompleted,
                              apiKey: null,
                              apiKeyConfigured: false
                            }
                          });
                        }
                      });
                    } catch (error) {
                      console.error('Error processing external_api_url config:', error);
                      res.status(500).json({
                        success: false,
                        error: error.message || 'Internal server error'
                      });
                    }
                  });
                } catch (error) {
                  console.error('Error processing external_api_url_completed config:', error);
                  res.status(500).json({
                    success: false,
                    error: error.message || 'Internal server error'
                  });
                }
              });
            } catch (error) {
              console.error('Error processing external_api_url_active config:', error);
              res.status(500).json({
                success: false,
                error: error.message || 'Internal server error'
              });
            }
          });
        });
      });
    });
  } catch (error) {
    console.error('Unexpected error in GET /api/admin/config:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// PUT admin configuration
app.put('/api/admin/config', (req, res) => {
  const { sessionId, odooBaseUrl, externalApiUrl, externalApiUrlActive, externalApiUrlCompleted, apiKey } = req.body;
  
  if (sessionId && sessionId.length < 20) {
    return res.status(400).json({ success: false, error: 'Session ID must be at least 20 characters' });
  }

  // Check if table exists, if not create it
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='admin_config'", (tableErr, tableRow) => {
    if (tableErr || !tableRow) {
      // Create table if it doesn't exist
      db.run(`CREATE TABLE IF NOT EXISTS admin_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        config_key TEXT NOT NULL UNIQUE,
        config_value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (createErr) => {
        if (createErr) {
          return res.status(500).json({ success: false, error: createErr.message });
        }
        // Continue with insert after table creation
        insertConfig();
      });
    } else {
      // Table exists, proceed with insert
      insertConfig();
    }
  });

  function insertConfig() {
    // Save sessionId if provided
    if (sessionId) {
      db.run(
        `INSERT OR REPLACE INTO admin_config (config_key, config_value, updated_at) 
         VALUES ('odoo_session_id', ?, CURRENT_TIMESTAMP)`,
        [sessionId],
        function(err) {
          if (err) {
            console.error('Error saving session_id config:', err);
            return res.status(500).json({ success: false, error: err.message });
          }
          
          saveOdooBaseUrl();
        }
      );
    } else {
      saveOdooBaseUrl();
    }
    
    function saveOdooBaseUrl() {
      // Save odooBaseUrl if provided
      if (odooBaseUrl !== undefined) {
        db.run(
          `INSERT OR REPLACE INTO admin_config (config_key, config_value, updated_at) 
           VALUES ('odoo_base_url', ?, CURRENT_TIMESTAMP)`,
          [odooBaseUrl || 'https://foomx.odoo.com'],
          function(err2) {
            if (err2) {
              console.error('Error saving base_url config:', err2);
              return res.status(500).json({ success: false, error: err2.message });
            }
            
            saveExternalApiUrl();
          }
        );
      } else {
        saveExternalApiUrl();
      }
    }
    
    function saveExternalApiUrl() {
      // Save externalApiUrl (general/fallback) if provided
      if (externalApiUrl !== undefined) {
        db.run(
          `INSERT OR REPLACE INTO admin_config (config_key, config_value, updated_at) 
           VALUES ('external_api_url', ?, CURRENT_TIMESTAMP)`,
          [externalApiUrl || 'https://foom-dash.vercel.app/API'],
          function(err3) {
            if (err3) {
              console.error('Error saving external_api_url config:', err3);
              return res.status(500).json({ success: false, error: err3.message });
            }
            
            saveExternalApiUrls();
          }
        );
      } else {
        saveExternalApiUrls();
      }
    }
    
    function saveExternalApiUrls() {
      // Save externalApiUrlActive if provided
      if (externalApiUrlActive !== undefined) {
        db.run(
          `INSERT OR REPLACE INTO admin_config (config_key, config_value, updated_at) 
           VALUES ('external_api_url_active', ?, CURRENT_TIMESTAMP)`,
          [externalApiUrlActive || 'https://foom-dash.vercel.app/API'],
          function(err4) {
            if (err4) {
              console.error('Error saving external_api_url_active config:', err4);
              return res.status(500).json({ success: false, error: err4.message });
            }
            
            saveExternalApiUrlCompleted();
          }
        );
      } else {
        saveExternalApiUrlCompleted();
      }
    }
    
    function saveExternalApiUrlCompleted() {
      // Save externalApiUrlCompleted if provided
      if (externalApiUrlCompleted !== undefined) {
        db.run(
          `INSERT OR REPLACE INTO admin_config (config_key, config_value, updated_at) 
           VALUES ('external_api_url_completed', ?, CURRENT_TIMESTAMP)`,
          [externalApiUrlCompleted || 'https://foom-dash.vercel.app/API'],
          function(err5) {
            if (err5) {
              console.error('Error saving external_api_url_completed config:', err5);
              return res.status(500).json({ success: false, error: err5.message });
            }
            
            saveApiKey();
          }
        );
      } else {
        saveApiKey();
      }
    }
    
    function saveApiKey() {
      // Save API key if provided (only if explicitly set, not on every config save)
      if (apiKey !== undefined && apiKey !== null && apiKey !== '') {
        db.run(
          `INSERT OR REPLACE INTO admin_config (config_key, config_value, updated_at) 
           VALUES ('api_key', ?, CURRENT_TIMESTAMP)`,
          [apiKey],
          function(err6) {
            if (err6) {
              console.error('Error saving api_key config:', err6);
              return res.status(500).json({ success: false, error: err6.message });
            }
            
            res.json({ success: true, message: 'Configuration saved successfully' });
          }
        );
      } else {
        res.json({ success: true, message: 'Configuration saved successfully' });
      }
    }
  }
});

// Generate API Key endpoint
app.post('/api/admin/generate-api-key', (req, res) => {
  try {
    // Generate a secure random API key (64 characters)
    const apiKey = crypto.randomBytes(32).toString('hex');
    
    // Check if table exists, if not create it
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='admin_config'", (tableErr, tableRow) => {
      if (tableErr || !tableRow) {
        // Create table if it doesn't exist
        db.run(`CREATE TABLE IF NOT EXISTS admin_config (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          config_key TEXT NOT NULL UNIQUE,
          config_value TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (createErr) => {
          if (createErr) {
            return res.status(500).json({ success: false, error: createErr.message });
          }
          // Continue with save after table creation
          saveApiKey();
        });
      } else {
        // Table exists, proceed with save
        saveApiKey();
      }
    });
    
    function saveApiKey() {
      db.run(
        `INSERT OR REPLACE INTO admin_config (config_key, config_value, updated_at) 
         VALUES ('api_key', ?, CURRENT_TIMESTAMP)`,
        [apiKey],
        function(err) {
          if (err) {
            console.error('Error saving API key:', err);
            return res.status(500).json({ success: false, error: err.message });
          }
          
          // Return the API key (only shown once when generated)
          res.json({ 
            success: true, 
            message: 'API key generated successfully',
            apiKey: apiKey,
            warning: 'Please save this API key securely. It will not be shown again.'
          });
        }
      );
    }
  } catch (error) {
    console.error('Error generating API key:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET admin config helper function
function getAdminConfig(callback) {
  db.get('SELECT config_value FROM admin_config WHERE config_key = ?', ['odoo_session_id'], (err, row) => {
    if (err) {
      return callback(err, null);
    }
    
    const sessionId = row ? row.config_value : process.env.ODOO_SESSION_ID || 'bc6b1450c0cd3b05e3ac199521e02f7b639e39ae';
    
    db.get('SELECT config_value FROM admin_config WHERE config_key = ?', ['odoo_base_url'], (err2, row2) => {
      if (err2) {
        return callback(err2, null);
      }
      
      const odooBaseUrl = row2 ? row2.config_value : process.env.ODOO_API_URL || 'https://foomx.odoo.com';
      
      callback(null, { sessionId, odooBaseUrl });
    });
  });
}

// Get detailed MO cache stats for debugging
app.get('/api/admin/mo-cache-details', (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ success: false, error: 'Database not available' });
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    // Get sample of old records based on create_date (not fetched_at)
    db.all(
      `SELECT mo_number, fetched_at, create_date, 
              datetime('now') as current_time,
              datetime('now', '-7 days') as threshold
       FROM odoo_mo_cache 
       WHERE datetime(create_date) < datetime('now', '-7 days')
       ORDER BY create_date ASC 
       LIMIT 10`,
      [],
      (err, oldRows) => {
        if (err) {
          return res.status(500).json({ success: false, error: err.message });
        }

        // Get sample of recent records based on create_date
        db.all(
          `SELECT mo_number, fetched_at, create_date 
           FROM odoo_mo_cache 
           WHERE datetime(create_date) >= datetime('now', '-7 days')
           ORDER BY create_date DESC 
           LIMIT 10`,
          [],
          (err2, recentRows) => {
            if (err2) {
              return res.status(500).json({ success: false, error: err2.message });
            }

            // Get date range info based on create_date
            db.get(
              `SELECT 
                 MIN(create_date) as oldest_create_date,
                 MAX(create_date) as newest_create_date,
                 MIN(fetched_at) as oldest_fetched,
                 MAX(fetched_at) as newest_fetched,
                 COUNT(*) as total,
                 datetime('now') as current_time,
                 datetime('now', '-7 days') as threshold
               FROM odoo_mo_cache`,
              (err3, rangeRow) => {
                if (err3) {
                  return res.status(500).json({ success: false, error: err3.message });
                }

                res.json({
                  success: true,
                  currentTime: rangeRow.current_time,
                  threshold: rangeRow.threshold,
                  dateRange: {
                    oldest_create_date: rangeRow.oldest_create_date,
                    newest_create_date: rangeRow.newest_create_date,
                    oldest_fetched: rangeRow.oldest_fetched,
                    newest_fetched: rangeRow.newest_fetched,
                    total: rangeRow.total
                  },
                  oldRecordsSample: oldRows || [],
                  recentRecordsSample: recentRows || [],
                  oldRecordsCount: oldRows ? oldRows.length : 0,
                  recentRecordsCount: recentRows ? recentRows.length : 0
                });
              }
            );
          }
        );
      }
    );
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test Odoo query - get MO data without filter
app.get('/api/admin/test-odoo-query', async (req, res) => {
  getAdminConfig(async (err, config) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }

    try {
      const https = require('https');
      const url = require('url');
      const ODOO_URL = `${config.odooBaseUrl}/web/dataset/call_kw/mrp.production/search_read`;
      const COOKIE_HEADER = `session_id=${config.sessionId}; session_id=${config.sessionId}`;

      // Query without filter to see all MO data
      const requestData = {
        "jsonrpc": "2.0",
        "method": "call",
        "params": {
          "model": "mrp.production",
          "method": "search_read",
          "args": [[]],
          "kwargs": {
            "fields": ["id", "name", "product_id", "product_qty", "note", "create_date"],
            "limit": 10,
            "order": "create_date desc"
          }
        }
      };

      const parsedUrl = url.parse(ODOO_URL);
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

      const postData = JSON.stringify(requestData);

      const response = await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let responseData = '';
          res.on('data', (chunk) => {
            responseData += chunk;
          });
          res.on('end', () => {
            try {
              const jsonResponse = JSON.parse(responseData);
              if (jsonResponse.error) {
                reject(new Error(jsonResponse.error.message || 'Odoo API error'));
              } else {
                resolve(jsonResponse);
              }
            } catch (e) {
              reject(new Error('Failed to parse Odoo response'));
            }
          });
        });

        req.on('error', (error) => {
          reject(error);
        });

        req.setTimeout(30000, () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });

        req.write(postData);
        req.end();
      });

      if (response.result && Array.isArray(response.result)) {
        // Show sample notes to help debug filter
        const sampleNotes = response.result
          .filter(mo => mo.note)
          .map(mo => ({ mo: mo.name, note: mo.note.substring(0, 100) }))
          .slice(0, 5);

        res.json({
          success: true,
          totalRecords: response.result.length,
          sampleNotes: sampleNotes,
          allRecords: response.result.map(mo => ({
            mo_number: mo.name,
            note: mo.note || '(no note)',
            product: mo.product_id ? mo.product_id[1] : 'N/A',
            create_date: mo.create_date
          }))
        });
      } else {
        res.json({
          success: true,
          message: 'No results or unexpected format',
          response: response
        });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message || 'Connection test failed' });
    }
  });
});

// Test Odoo connection
app.get('/api/admin/test-connection', async (req, res) => {
  getAdminConfig(async (err, config) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }

    try {
      const https = require('https');
      const url = require('url');
      const ODOO_URL = `${config.odooBaseUrl}/web/dataset/call_kw/mrp.production/search_read`;
      const COOKIE_HEADER = `session_id=${config.sessionId}; session_id=${config.sessionId}`;

      const requestData = {
        "jsonrpc": "2.0",
        "method": "call",
        "params": {
          "model": "mrp.production",
          "method": "search_read",
          "args": [[]],
          "kwargs": {
            "fields": ["id", "name"],
            "limit": 1
          }
        }
      };

      const parsedUrl = url.parse(ODOO_URL);
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

      const postData = JSON.stringify(requestData);

      const response = await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let responseData = '';
          res.on('data', (chunk) => {
            responseData += chunk;
          });
          res.on('end', () => {
            try {
              const jsonResponse = JSON.parse(responseData);
              if (jsonResponse.error) {
                reject(new Error(jsonResponse.error.message || 'Odoo API error'));
              } else {
                resolve(jsonResponse);
              }
            } catch (e) {
              reject(new Error('Failed to parse Odoo response'));
            }
          });
        });

        req.on('error', (error) => {
          reject(error);
        });

        req.setTimeout(30000, () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });

        req.write(postData);
        req.end();
      });

      res.json({ success: true, message: 'Connection test successful' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message || 'Connection test failed' });
    }
  });
});

// Get MO stats
app.get('/api/admin/mo-stats', (req, res) => {
  try {
    if (!db) {
      console.error('Database connection not available');
      return res.json({
        success: true,
        stats: {
          total: 0,
          last7Days: 0,
          deleted: 0
        }
      });
    }

    // Check if table exists first
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='odoo_mo_cache'", (tableErr, tableRow) => {
      if (tableErr) {
        console.error('Error checking odoo_mo_cache table:', tableErr);
        // Return zero stats on error
        return res.json({
          success: true,
          stats: {
            total: 0,
            last7Days: 0,
            deleted: 0
          }
        });
      }

      if (!tableRow) {
        // Table doesn't exist, return zero stats
        return res.json({
          success: true,
          stats: {
            total: 0,
            last7Days: 0,
            deleted: 0
          }
        });
      }

      // Count total MO records
      db.get('SELECT COUNT(*) as total FROM odoo_mo_cache', (err, row) => {
        if (err) {
          console.error('Error counting MO records:', err);
          return res.json({
            success: true,
            stats: {
              total: 0,
              last7Days: 0,
              deleted: 0
            }
          });
        }

        const total = row ? row.total : 0;
        
        // Calculate 7 days ago using datetime arithmetic
        // SQLite uses datetime('now', '-7 days') for proper date calculation
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        const sevenDaysAgoStr = sevenDaysAgo.toISOString().replace('T', ' ').substring(0, 19);

        console.log(`📊 [MO Stats] Total records in cache: ${total}`);
        console.log(`📅 [MO Stats] Current date: ${now.toISOString()}`);
        console.log(`📅 [MO Stats] 7 days ago: ${sevenDaysAgoStr}`);

        // Count MO records from last 7 days based on create_date (when MO was created in Odoo)
        // Use create_date, not fetched_at
        db.get(
          `SELECT COUNT(*) as count FROM odoo_mo_cache 
           WHERE datetime(create_date) >= datetime('now', '-7 days')`,
          [],
          (err2, row2) => {
            if (err2) {
              console.error('Error counting MO records from last 7 days:', err2);
              return res.json({
                success: true,
                stats: {
                  total: total,
                  last7Days: 0,
                  deleted: 0
                }
              });
            }

            const last7Days = row2 ? row2.count : 0;
            
            // Count records older than 7 days based on create_date
            db.get(
              `SELECT COUNT(*) as count FROM odoo_mo_cache 
               WHERE datetime(create_date) < datetime('now', '-7 days')`,
              [],
              (err3, row3) => {
                if (err3) {
                  console.error('Error counting old MO records:', err3);
                  const deleted = total - last7Days;
                  return res.json({
                    success: true,
                    stats: {
                      total: total,
                      last7Days: last7Days,
                      deleted: deleted > 0 ? deleted : 0
                    }
                  });
                }

                const deleted = row3 ? row3.count : 0;

                console.log(`📊 [MO Stats] Records with create_date from last 7 days: ${last7Days}`);
                console.log(`📊 [MO Stats] Records with create_date older than 7 days: ${deleted}`);

                res.json({
                  success: true,
                  stats: {
                    total: total,
                    last7Days: last7Days,
                    deleted: deleted
                  }
                });
              }
            );
          }
        );
      });
    });
  } catch (error) {
    console.error('Unexpected error in GET /api/admin/mo-stats:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// Cleanup MO data (delete older than 7 days)
app.post('/api/admin/cleanup-mo', async (req, res) => {
  getAdminConfig(async (err, config) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }

    try {
      // First, fetch MO data from last 7 days from Odoo
      const https = require('https');
      const url = require('url');
      const ODOO_URL = `${config.odooBaseUrl}/web/dataset/call_kw/mrp.production/search_read`;
      const COOKIE_HEADER = `session_id=${config.sessionId}; session_id=${config.sessionId}`;

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0] + ' 00:00:00';

      const requestData = {
        "jsonrpc": "2.0",
        "method": "call",
        "params": {
          "model": "mrp.production",
          "method": "search_read",
          "args": [[["create_date", ">=", sevenDaysAgoStr]]],
          "kwargs": {
            "fields": ["id", "name", "product_id", "product_qty", "product_uom_id", "note", "create_date"],
            "limit": 10000,
            "order": "create_date desc"
          }
        }
      };

      const parsedUrl = url.parse(ODOO_URL);
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

      const postData = JSON.stringify(requestData);

      const response = await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let responseData = '';
          res.on('data', (chunk) => {
            responseData += chunk;
          });
          res.on('end', () => {
            try {
              const jsonResponse = JSON.parse(responseData);
              if (jsonResponse.error) {
                reject(new Error(jsonResponse.error.message || 'Odoo API error'));
              } else {
                resolve(jsonResponse);
              }
            } catch (e) {
              reject(new Error('Failed to parse Odoo response'));
            }
          });
        });

        req.on('error', (error) => {
          reject(error);
        });

        req.setTimeout(30000, () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });

        req.write(postData);
        req.end();
      });

      // Get MO numbers from last 7 days
      const moNumbersFrom7Days = new Set();
      if (response.result && Array.isArray(response.result)) {
        response.result.forEach(mo => {
          moNumbersFrom7Days.add(mo.name);
        });
      }

      console.log(`📊 [Cleanup] Found ${moNumbersFrom7Days.size} MO numbers from last 7 days in Odoo`);

      // First, count how many records have create_date older than 7 days
      // We use create_date (from Odoo) not fetched_at (when we cached it)
      db.get(
        `SELECT COUNT(*) as count FROM odoo_mo_cache 
         WHERE datetime(create_date) < datetime('now', '-7 days')`,
        (countErr, countRow) => {
          if (countErr) {
            console.error('❌ [Cleanup] Error counting old records:', countErr);
            return res.status(500).json({ success: false, error: countErr.message });
          }

          const oldRecordsCount = countRow ? countRow.count : 0;
          console.log(`📊 [Cleanup] Found ${oldRecordsCount} records with create_date older than 7 days in cache`);

          // Also get sample of old records for debugging
          db.all(
            `SELECT mo_number, create_date, fetched_at, 
                    datetime('now') as current_time, 
                    datetime('now', '-7 days') as threshold
             FROM odoo_mo_cache 
             WHERE datetime(create_date) < datetime('now', '-7 days')
             LIMIT 5`,
            (sampleErr, sampleRows) => {
              if (!sampleErr && sampleRows && sampleRows.length > 0) {
                console.log(`📋 [Cleanup] Sample of old records (by create_date):`, sampleRows);
              }

              // Delete MO records where create_date is older than 7 days
              // This is based on when the MO was created in Odoo, not when we cached it
              const deleteQuery = `DELETE FROM odoo_mo_cache 
                                   WHERE datetime(create_date) < datetime('now', '-7 days')`;

              console.log(`🗑️  [Cleanup] Executing delete query to remove records with create_date older than 7 days...`);
              console.log(`🗑️  [Cleanup] Query: ${deleteQuery}`);
              console.log(`🗑️  [Cleanup] Records to delete: ${oldRecordsCount}`);

              db.run(deleteQuery, [], function(deleteErr) {
                if (deleteErr) {
                  console.error('❌ [Cleanup] Error deleting old MO data:', deleteErr);
                  return res.status(500).json({ success: false, error: deleteErr.message });
                }

                const deletedCount = this.changes;
                console.log(`✅ [Cleanup] Successfully deleted ${deletedCount} old MO records (based on create_date)`);

                // After cleanup, verify the count
                db.get('SELECT COUNT(*) as count FROM odoo_mo_cache', (verifyErr, verifyRow) => {
                  const remainingCount = verifyRow ? verifyRow.count : 0;
                  console.log(`📊 [Cleanup] Remaining records in cache: ${remainingCount}`);

                  res.json({ 
                    success: true, 
                    deletedCount: deletedCount,
                    remainingCount: remainingCount,
                    message: `Deleted ${deletedCount} MO records with create_date older than 7 days. ${remainingCount} records remaining.`,
                    oldRecordsFound: oldRecordsCount,
                    moFromLast7Days: moNumbersFrom7Days.size
                  });
                });
              });
            }
          );
        }
      );
    } catch (error) {
      console.error('Error cleaning up MO:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to cleanup MO data' });
    }
  });
});

// Sync production data to production_results table
app.post('/api/admin/sync-production-data', (req, res) => {
  let totalCount = 0;

  // Sync from production_liquid
  db.all('SELECT * FROM production_liquid', (err, liquidRows) => {
    if (err) {
      console.error('Error fetching production_liquid:', err);
      return res.status(500).json({ success: false, error: err.message });
    }

    totalCount += liquidRows ? liquidRows.length : 0;

    // Sync from production_device
    db.all('SELECT * FROM production_device', (err2, deviceRows) => {
      if (err2) {
        console.error('Error fetching production_device:', err2);
        return res.status(500).json({ success: false, error: err2.message });
      }

      totalCount += deviceRows ? deviceRows.length : 0;

      // Sync from production_cartridge
      db.all('SELECT * FROM production_cartridge', (err3, cartridgeRows) => {
        if (err3) {
          console.error('Error fetching production_cartridge:', err3);
          return res.status(500).json({ success: false, error: err3.message });
        }

        totalCount += cartridgeRows ? cartridgeRows.length : 0;

        // Combine all rows and filter out rows with missing required fields
        const allRows = [
          ...(liquidRows || []).map(r => ({ ...r, production_type: 'liquid' })),
          ...(deviceRows || []).map(r => ({ ...r, production_type: 'device' })),
          ...(cartridgeRows || []).map(r => ({ ...r, production_type: 'cartridge' }))
        ].filter(row => {
          // Filter out rows with missing required fields
          return row.session_id && row.mo_number && row.pic && row.created_at;
        });

        if (allRows.length === 0) {
          return res.json({
            success: true,
            syncedCount: 0,
            totalCount: totalCount,
            message: 'No valid data to sync'
          });
        }

        // Check which rows already exist in production_results
        const checkPromises = allRows.map(row => {
          return new Promise((resolve, reject) => {
            db.get(
              `SELECT id FROM production_results 
               WHERE production_type = ? AND session_id = ? AND mo_number = ? AND pic = ? AND created_at = ?`,
              [row.production_type, row.session_id || '', row.mo_number || '', row.pic || '', row.created_at || ''],
              (err4, existing) => {
                if (err4) {
                  console.error('Error checking existing row:', err4);
                  reject(err4);
                } else {
                  resolve({ row, exists: !!existing });
                }
              }
            );
          });
        });

        Promise.all(checkPromises)
          .then(results => {
            const newRows = results.filter(r => !r.exists).map(r => r.row);

            if (newRows.length === 0) {
              return res.json({
                success: true,
                syncedCount: 0,
                totalCount: totalCount,
                message: 'All data already synced'
              });
            }

            // Insert new rows
            const insertPromises = newRows.map((row) => {
              return new Promise((resolve, reject) => {
                db.run(
                  `INSERT INTO production_results 
                   (production_type, session_id, leader_name, shift_number, pic, mo_number, sku_name, 
                    authenticity_data, status, created_at, synced_at) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                  [
                    row.production_type || '',
                    row.session_id || '',
                    row.leader_name || '',
                    row.shift_number || '',
                    row.pic || '',
                    row.mo_number || '',
                    row.sku_name || '',
                    row.authenticity_data || '[]',
                    row.status || 'active',
                    row.created_at || new Date().toISOString()
                  ],
                  function(err5) {
                    if (err5) {
                      console.error('Error inserting row:', err5);
                      reject(err5);
                    } else {
                      resolve(this.lastID);
                    }
                  }
                );
              });
            });

            Promise.all(insertPromises)
              .then(() => {
                res.json({
                  success: true,
                  syncedCount: newRows.length,
                  totalCount: totalCount,
                  message: `Synced ${newRows.length} records successfully`
                });
              })
              .catch((err6) => {
                console.error('Error inserting rows:', err6);
                res.status(500).json({ success: false, error: err6.message });
              });
          })
          .catch((checkErr) => {
            console.error('Error checking existing rows:', checkErr);
            res.status(500).json({ success: false, error: checkErr.message || 'Failed to check existing rows' });
          });
      });
    });
  });
});

// Odoo API Integration - Get MO data filtered by production type from cache
app.get('/api/odoo/mo-list', async (req, res) => {
  const { productionType } = req.query; // 'liquid', 'device', or 'cartridge'
  
  if (!productionType) {
    return res.status(400).json({ error: 'productionType is required (liquid, device, or cartridge)' });
  }

  // Map production type to note filter (case-insensitive search)
  const noteFilter = productionType.toLowerCase();
  
  if (!['cartridge', 'liquid', 'device'].includes(noteFilter)) {
    return res.status(400).json({ error: 'Invalid productionType. Must be: liquid, device, or cartridge' });
  }

  try {
    // Get MO data from cache filtered by note and create_date (last 7 days)
    // Use case-insensitive search for note field
    // Note: SQLite LOWER() function for case-insensitive comparison
    const query = `
      SELECT mo_number, sku_name, quantity, uom, note, create_date
      FROM odoo_mo_cache
      WHERE LOWER(note) LIKE LOWER(?)
        AND datetime(create_date) >= datetime('now', '-7 days')
      ORDER BY create_date DESC
      LIMIT 1000
    `;

    // Search pattern with wildcards for case-insensitive match
    const searchPattern = `%${noteFilter}%`;

    console.log(`🔍 [MO List] Querying cache for ${productionType} with pattern: ${searchPattern}`);

    db.all(query, [searchPattern], (err, rows) => {
      if (err) {
        console.error('Error fetching MO data from cache:', err);
        return res.status(500).json({
          success: false,
          error: err.message || 'Failed to fetch MO data from cache'
        });
      }

      if (!rows || rows.length === 0) {
        console.log(`ℹ️  [MO List] No MO records found in cache for ${productionType}`);
        return res.json({
          success: true,
          count: 0,
          data: [],
          message: `No MO records found for ${productionType} in the last 7 days`
        });
      }

      const moList = rows.map(row => ({
        mo_number: row.mo_number,
        sku_name: row.sku_name,
        quantity: row.quantity || 0,
        uom: row.uom || '',
        create_date: row.create_date,
        note: row.note || ''
      }));

      console.log(`✅ [MO List] Found ${moList.length} MO records for ${productionType} from cache`);

      res.json({
        success: true,
        count: moList.length,
        data: moList
      });
    });
  } catch (error) {
    console.error('Error fetching MO data from cache:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch MO data from cache'
    });
  }
});

// Combined Production API endpoints
// GET - Query berdasarkan MO Number dan Created_at
app.get('/api/production/combined', (req, res) => {
  const { moNumber, created_at, production_type, startDate, endDate } = req.query;
  
  let query = 'SELECT * FROM production_combined WHERE 1=1';
  const params = [];
  
  // Filter by MO Number
  if (moNumber) {
    query += ' AND mo_number = ?';
    params.push(moNumber);
  }
  
  // Filter by exact Created_at
  if (created_at) {
    query += ' AND DATE(created_at) = DATE(?)';
    params.push(created_at);
  }
  
  // Filter by date range
  if (startDate) {
    query += ' AND DATE(created_at) >= DATE(?)';
    params.push(startDate);
  }
  
  if (endDate) {
    query += ' AND DATE(created_at) <= DATE(?)';
    params.push(endDate);
  }
  
  // Filter by production type
  if (production_type) {
    query += ' AND production_type = ?';
    params.push(production_type);
  }
  
  query += ' ORDER BY created_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Parse JSON strings back to objects
    const parsedRows = rows.map(row => {
      try {
        return {
          ...row,
          authenticity_data: typeof row.authenticity_data === 'string' 
            ? JSON.parse(row.authenticity_data) 
            : row.authenticity_data
        };
      } catch (e) {
        return {
          ...row,
          authenticity_data: []
        };
      }
    });
    
    res.json({
      count: parsedRows.length,
      data: parsedRows
    });
  });
});

// POST - Insert data dummy atau data baru
app.post('/api/production/combined', (req, res) => {
  const { production_type, session_id, leader_name, shift_number, pic, mo_number, sku_name, authenticity_data, status } = req.body;
  
  // Validation
  if (!production_type || !['liquid', 'device', 'cartridge'].includes(production_type)) {
    res.status(400).json({ error: 'production_type is required and must be: liquid, device, or cartridge' });
    return;
  }
  
  if (!session_id || !leader_name || !shift_number || !pic || !mo_number || !sku_name || !authenticity_data) {
    res.status(400).json({ error: 'Missing required fields: session_id, leader_name, shift_number, pic, mo_number, sku_name, authenticity_data' });
    return;
  }
  
  // Ensure authenticity_data is an array
  const authenticityRows = Array.isArray(authenticity_data) ? authenticity_data : [authenticity_data];
  
  // Create separate row for each authenticity data entry (each roll number)
  const insertPromises = authenticityRows.map((row) => {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO production_combined (production_type, session_id, leader_name, shift_number, pic, mo_number, sku_name, authenticity_data, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          production_type,
          session_id,
          leader_name,
          shift_number,
          pic,
          mo_number,
          sku_name,
          JSON.stringify([row]),
          status || 'active'
        ],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, row });
          }
        }
      );
    });
  });
  
  Promise.all(insertPromises)
    .then((results) => {
      res.json({ 
        message: 'Data saved successfully',
        saved_count: results.length,
        data: results.map(r => ({
          id: r.id,
          production_type,
          session_id,
          leader_name,
          shift_number,
          pic,
          mo_number,
          sku_name,
          authenticity_data: [r.row],
          status: status || 'active'
        }))
      });
    })
    .catch((err) => {
      res.status(500).json({ error: err.message });
    });
});

// POST - Sync data dari tabel existing ke production_combined
app.post('/api/production/combined/sync', (req, res) => {
  const { production_type } = req.body;
  
  let sourceTable = '';
  if (production_type === 'liquid') {
    sourceTable = 'production_liquid';
  } else if (production_type === 'device') {
    sourceTable = 'production_device';
  } else if (production_type === 'cartridge') {
    sourceTable = 'production_cartridge';
  } else {
    res.status(400).json({ error: 'production_type must be: liquid, device, or cartridge' });
    return;
  }
  
  // Get all data from source table
  db.all(`SELECT * FROM ${sourceTable}`, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (rows.length === 0) {
      res.json({ message: 'No data to sync', synced_count: 0 });
      return;
    }
    
    // Check which rows already exist in production_combined
    const checkPromises = rows.map(row => {
      return new Promise((resolve) => {
        db.get(
          `SELECT id FROM production_combined WHERE production_type = ? AND session_id = ? AND mo_number = ? AND pic = ? AND created_at = ?`,
          [production_type, row.session_id, row.mo_number, row.pic, row.created_at],
          (err, existing) => {
            resolve({ row, exists: !!existing });
          }
        );
      });
    });
    
    Promise.all(checkPromises).then(results => {
      const newRows = results.filter(r => !r.exists).map(r => r.row);
      
      if (newRows.length === 0) {
        res.json({ message: 'All data already synced', synced_count: 0 });
        return;
      }
      
      // Insert new rows
      const insertPromises = newRows.map((row) => {
        return new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO production_combined (production_type, session_id, leader_name, shift_number, pic, mo_number, sku_name, authenticity_data, status, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              production_type,
              row.session_id,
              row.leader_name,
              row.shift_number,
              row.pic,
              row.mo_number,
              row.sku_name,
              row.authenticity_data,
              row.status || 'active',
              row.created_at
            ],
            function(err) {
              if (err) {
                reject(err);
              } else {
                resolve(this.lastID);
              }
            }
          );
        });
      });
      
      Promise.all(insertPromises)
        .then(() => {
          res.json({ 
            message: 'Data synced successfully',
            synced_count: newRows.length,
            total_in_source: rows.length
          });
        })
        .catch((err) => {
          res.status(500).json({ error: err.message });
        });
    });
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});

// Scheduler Functions
// Function to update MO data from Odoo for all production types
async function updateMoDataFromOdoo() {
  console.log('🔄 [Scheduler] Starting MO data update from Odoo...');
  
  getAdminConfig(async (err, config) => {
    if (err) {
      console.error('❌ [Scheduler] Error getting admin config:', err);
      return;
    }

    const productionTypes = ['liquid', 'device', 'cartridge'];
    let totalUpdated = 0;

    for (const productionType of productionTypes) {
      try {
        const https = require('https');
        const url = require('url');
        const noteFilter = productionType.toLowerCase();
        let domainFilter;
        
        if (noteFilter === 'cartridge') {
          domainFilter = ['note', 'ilike', 'cartridge'];
        } else if (noteFilter === 'liquid') {
          domainFilter = ['note', 'ilike', 'liquid'];
        } else if (noteFilter === 'device') {
          domainFilter = ['note', 'ilike', 'device'];
        } else {
          continue;
        }

        // Calculate date 7 days ago
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0] + ' 00:00:00';

        console.log(`🔍 [Scheduler] Querying Odoo for ${productionType} with filter:`, domainFilter);
        console.log(`📅 [Scheduler] Date range: From ${sevenDaysAgoStr} to now`);

        const ODOO_URL = `${config.odooBaseUrl}/web/dataset/call_kw/mrp.production/search_read`;
        const COOKIE_HEADER = `session_id=${config.sessionId}; session_id=${config.sessionId}`;

        // Combine domain filter with date filter (last 7 days)
        const combinedDomain = [
          domainFilter,
          ["create_date", ">=", sevenDaysAgoStr]
        ];

        const requestData = {
          "jsonrpc": "2.0",
          "method": "call",
          "params": {
            "model": "mrp.production",
            "method": "search_read",
            "args": [combinedDomain],
            "kwargs": {
              "fields": ["id", "name", "product_id", "product_qty", "product_uom_id", "note", "create_date"],
              "limit": 1000,
              "order": "create_date desc"
            }
          }
        };

        const parsedUrl = url.parse(ODOO_URL);
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

        const postData = JSON.stringify(requestData);

        const response = await new Promise((resolve, reject) => {
          const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => {
              responseData += chunk;
            });
            res.on('end', () => {
              try {
                const jsonResponse = JSON.parse(responseData);
                if (jsonResponse.error) {
                  reject(new Error(jsonResponse.error.message || 'Odoo API error'));
                } else {
                  resolve(jsonResponse);
                }
              } catch (e) {
                reject(new Error('Failed to parse Odoo response'));
              }
            });
          });

          req.on('error', (error) => {
            reject(error);
          });

          req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
          });

          req.write(postData);
          req.end();
        });

        console.log(`📥 [Scheduler] Odoo API response for ${productionType}:`, {
          hasResult: !!response.result,
          resultType: Array.isArray(response.result) ? 'array' : typeof response.result,
          resultLength: Array.isArray(response.result) ? response.result.length : 'N/A',
          hasError: !!response.error
        });

        // Update odoo_mo_cache table
        if (response.result && Array.isArray(response.result)) {
          console.log(`📊 [Scheduler] Received ${response.result.length} MO records from Odoo for ${productionType}`);
          
          if (response.result.length === 0) {
            console.log(`ℹ️  [Scheduler] No MO records found for ${productionType} (filter: note ilike '${noteFilter}')`);
            continue;
          }

          // Use Promise.all to properly wait for all inserts
          const insertPromises = response.result.map((mo) => {
            return new Promise((resolve, reject) => {
              // Parse create_date from Odoo to ensure we have the original date
              const moCreateDate = mo.create_date || new Date().toISOString();
              
              db.run(
                `INSERT OR REPLACE INTO odoo_mo_cache 
                 (mo_number, sku_name, quantity, uom, note, create_date, fetched_at, last_updated) 
                 VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [
                  mo.name,
                  mo.product_id ? mo.product_id[1] : 'N/A',
                  mo.product_qty || 0,
                  mo.product_uom_id ? mo.product_uom_id[1] : '',
                  mo.note || '',
                  moCreateDate
                ],
                function(insertErr) {
                  if (insertErr) {
                    console.error(`❌ [Scheduler] Error inserting MO ${mo.name}:`, insertErr.message);
                    reject(insertErr);
                  } else {
                    resolve(this.lastID);
                  }
                }
              );
            });
          });

          try {
            await Promise.all(insertPromises);
            totalUpdated += response.result.length;
            console.log(`✅ [Scheduler] Successfully updated ${response.result.length} MO records for ${productionType}`);
          } catch (insertError) {
            console.error(`❌ [Scheduler] Error inserting MO records for ${productionType}:`, insertError.message);
          }
        } else {
          console.log(`⚠️  [Scheduler] Unexpected response format for ${productionType}:`, response);
        }
      } catch (error) {
        console.error(`❌ [Scheduler] Error updating MO data for ${productionType}:`, error.message);
        console.error(`   Error details:`, error);
      }
    }

    console.log(`✅ [Scheduler] MO data update completed. Total updated: ${totalUpdated}`);
  });
}

// Function to cleanup MO data older than 7 days
function cleanupOldMoData() {
  console.log('🧹 [Scheduler] Starting cleanup of old MO data...');
  
  getAdminConfig(async (err, config) => {
    if (err) {
      console.error('❌ [Scheduler] Error getting admin config:', err);
      return;
    }

    try {
      const https = require('https');
      const url = require('url');
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0] + ' 00:00:00';

      const ODOO_URL = `${config.odooBaseUrl}/web/dataset/call_kw/mrp.production/search_read`;
      const COOKIE_HEADER = `session_id=${config.sessionId}; session_id=${config.sessionId}`;

      const requestData = {
        "jsonrpc": "2.0",
        "method": "call",
        "params": {
          "model": "mrp.production",
          "method": "search_read",
          "args": [[["create_date", ">=", sevenDaysAgoStr]]],
          "kwargs": {
            "fields": ["id", "name"],
            "limit": 10000,
            "order": "create_date desc"
          }
        }
      };

      const parsedUrl = url.parse(ODOO_URL);
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

      const postData = JSON.stringify(requestData);

      const response = await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let responseData = '';
          res.on('data', (chunk) => {
            responseData += chunk;
          });
          res.on('end', () => {
            try {
              const jsonResponse = JSON.parse(responseData);
              if (jsonResponse.error) {
                reject(new Error(jsonResponse.error.message || 'Odoo API error'));
              } else {
                resolve(jsonResponse);
              }
            } catch (e) {
              reject(new Error('Failed to parse Odoo response'));
            }
          });
        });

        req.on('error', (error) => {
          reject(error);
        });

        req.setTimeout(30000, () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });

        req.write(postData);
        req.end();
      });

      const moNumbersFrom7Days = new Set();
      if (response.result && Array.isArray(response.result)) {
        response.result.forEach(mo => {
          moNumbersFrom7Days.add(mo.name);
        });
      }

      // Delete MO records older than 7 days
      db.run(
        `DELETE FROM odoo_mo_cache 
         WHERE DATE(fetched_at) < DATE('now', '-7 days') 
         AND mo_number NOT IN (${Array.from(moNumbersFrom7Days).map(() => '?').join(',')})`,
        Array.from(moNumbersFrom7Days),
        function(deleteErr) {
          if (deleteErr) {
            console.error('❌ [Scheduler] Error deleting old MO data:', deleteErr);
          } else {
            console.log(`✅ [Scheduler] Cleanup completed. Deleted ${this.changes} old MO records.`);
          }
        }
      );
    } catch (error) {
      console.error('❌ [Scheduler] Error during cleanup:', error.message);
    }
  });
}

// Function to sync production data automatically
function syncProductionData() {
  console.log('🔄 [Scheduler] Starting automatic production data sync...');
  
  let totalCount = 0;

  db.all('SELECT * FROM production_liquid', (err, liquidRows) => {
    if (err) {
      console.error('❌ [Scheduler] Error fetching production_liquid:', err);
      return;
    }

    totalCount += liquidRows ? liquidRows.length : 0;

    db.all('SELECT * FROM production_device', (err2, deviceRows) => {
      if (err2) {
        console.error('❌ [Scheduler] Error fetching production_device:', err2);
        return;
      }

      totalCount += deviceRows ? deviceRows.length : 0;

      db.all('SELECT * FROM production_cartridge', (err3, cartridgeRows) => {
        if (err3) {
          console.error('❌ [Scheduler] Error fetching production_cartridge:', err3);
          return;
        }

        totalCount += cartridgeRows ? cartridgeRows.length : 0;

        const allRows = [
          ...(liquidRows || []).map(r => ({ ...r, production_type: 'liquid' })),
          ...(deviceRows || []).map(r => ({ ...r, production_type: 'device' })),
          ...(cartridgeRows || []).map(r => ({ ...r, production_type: 'cartridge' }))
        ].filter(row => row.session_id && row.mo_number && row.pic && row.created_at);

        if (allRows.length === 0) {
          console.log('ℹ️  [Scheduler] No valid data to sync');
          return;
        }

        const checkPromises = allRows.map(row => {
          return new Promise((resolve) => {
            db.get(
              `SELECT id FROM production_results 
               WHERE production_type = ? AND session_id = ? AND mo_number = ? AND pic = ? AND created_at = ?`,
              [row.production_type, row.session_id || '', row.mo_number || '', row.pic || '', row.created_at || ''],
              (err4, existing) => {
                resolve({ row, exists: !!existing });
              }
            );
          });
        });

        Promise.all(checkPromises)
          .then(results => {
            const newRows = results.filter(r => !r.exists).map(r => r.row);

            if (newRows.length === 0) {
              console.log('ℹ️  [Scheduler] All data already synced');
              return;
            }

            const insertPromises = newRows.map((row) => {
              return new Promise((resolve, reject) => {
                db.run(
                  `INSERT INTO production_results 
                   (production_type, session_id, leader_name, shift_number, pic, mo_number, sku_name, 
                    authenticity_data, status, created_at, synced_at) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                  [
                    row.production_type || '',
                    row.session_id || '',
                    row.leader_name || '',
                    row.shift_number || '',
                    row.pic || '',
                    row.mo_number || '',
                    row.sku_name || '',
                    row.authenticity_data || '[]',
                    row.status || 'active',
                    row.created_at || new Date().toISOString()
                  ],
                  function(err5) {
                    if (err5) {
                      reject(err5);
                    } else {
                      resolve(this.lastID);
                    }
                  }
                );
              });
            });

            Promise.all(insertPromises)
              .then(() => {
                console.log(`✅ [Scheduler] Synced ${newRows.length} production records successfully`);
              })
              .catch((err6) => {
                console.error('❌ [Scheduler] Error inserting rows:', err6);
              });
          })
          .catch((checkErr) => {
            console.error('❌ [Scheduler] Error checking existing rows:', checkErr);
          });
      });
    });
  });
}

// Function to send MO list for liquid production to external API
async function sendMoListToExternalAPI() {
  console.log('📤 [Scheduler] Starting to send MO list for liquid production to external API...');
  
  try {
    // Get MO list from odoo_mo_cache filtered for liquid production (last 7 days)
    const query = `
      SELECT mo_number, sku_name, quantity
      FROM odoo_mo_cache
      WHERE LOWER(note) LIKE LOWER('%liquid%')
        AND datetime(create_date) >= datetime('now', '-7 days')
      ORDER BY create_date DESC
    `;
    
    db.all(query, [], async (err, rows) => {
      if (err) {
        console.error('❌ [Scheduler] Error fetching MO list for liquid:', err);
        return;
      }
      
      if (!rows || rows.length === 0) {
        console.log('ℹ️  [Scheduler] No MO records found for liquid production to send');
        return;
      }
      
      console.log(`📊 [Scheduler] Found ${rows.length} MO records for liquid production`);
      
      // Prepare list of MOs to send
      const moList = rows.map(row => ({
        mo: row.mo_number,
        sku: row.sku_name,
        target_qty: Math.floor(row.quantity || 0) // Convert to integer
      }));
      
      // Send list to external API using fallback URL (MO list doesn't have status)
      // If API expects array, send as array; otherwise send individual items
      // Use fallback URL for MO list (no status)
      getFallbackUrl(async (err, fallbackUrl) => {
        if (err || !fallbackUrl || fallbackUrl.trim() === '') {
          console.log('⚠️  [Scheduler] Fallback URL not configured, skipping MO list send');
          return;
        }
        
        // Check circuit breaker before attempting
        if (!checkCircuitBreaker()) {
          const stats = externalApiCircuitBreaker.errorStats;
          console.log(`⚠️  [Scheduler] Circuit breaker is OPEN - skipping MO list send. ` +
                     `Recent errors: 405 (${stats['405']}), Other (${stats['other']})`);
          return;
        }
        
        try {
          // Try sending as array first (list format)
          await sendToExternalAPIWithUrl({ mo_list: moList }, fallbackUrl);
          console.log(`✅ [Scheduler] Successfully sent MO list (${moList.length} items) to external API`);
        } catch (arrayError) {
          // If array format fails, try sending individual items with batch processing
          console.log(`⚠️  [Scheduler] Array format failed, trying individual items in batches...`);
          
          const BATCH_SIZE = 10; // Process 10 items at a time
          const BATCH_DELAY = 2000; // 2 seconds delay between batches
          let successCount = 0;
          let errorCount = 0;
          let skippedCount = 0;
          const errorDetails = {
            '405': [],
            'other': [],
            'network': []
          };
          
          // Process in batches
          for (let i = 0; i < moList.length; i += BATCH_SIZE) {
            const batch = moList.slice(i, i + BATCH_SIZE);
            
            // Check circuit breaker before each batch
            if (!checkCircuitBreaker()) {
              skippedCount += batch.length;
              continue;
            }
            
            // Process batch in parallel
            const batchPromises = batch.map(async (moData) => {
              try {
                const result = await sendToExternalAPIWithUrl(moData, fallbackUrl);
                if (result.success) {
                  successCount++;
                } else if (result.skipped) {
                  skippedCount++;
                }
              } catch (apiError) {
                errorCount++;
                // Categorize errors
                const errorMsg = apiError.message || '';
                if (errorMsg.includes('405')) {
                  errorDetails['405'].push(moData.mo);
                } else if (errorMsg.includes('timeout') || errorMsg.includes('ECONNREFUSED') || errorMsg.includes('ENOTFOUND')) {
                  errorDetails['network'].push(moData.mo);
                } else {
                  errorDetails['other'].push(moData.mo);
                }
              }
            });
            
            await Promise.all(batchPromises);
            
            // Add delay between batches (except for the last batch)
            if (i + BATCH_SIZE < moList.length) {
              await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
            }
          }
          
          // Summary logging instead of individual errors
          const totalProcessed = successCount + errorCount + skippedCount;
          console.log(`📊 [Scheduler] Completed sending MO list:`);
          console.log(`   ✅ Success: ${successCount}`);
          console.log(`   ❌ Errors: ${errorCount}`);
          console.log(`   ⏭️  Skipped (circuit breaker): ${skippedCount}`);
          
          // Only show error details if there are errors and not too many
          if (errorCount > 0 && errorCount <= 20) {
            if (errorDetails['405'].length > 0) {
              console.log(`   ⚠️  405 Errors (${errorDetails['405'].length}): ${errorDetails['405'].slice(0, 5).join(', ')}${errorDetails['405'].length > 5 ? '...' : ''}`);
            }
            if (errorDetails['network'].length > 0) {
              console.log(`   ⚠️  Network Errors (${errorDetails['network'].length}): ${errorDetails['network'].slice(0, 5).join(', ')}${errorDetails['network'].length > 5 ? '...' : ''}`);
            }
            if (errorDetails['other'].length > 0) {
              console.log(`   ⚠️  Other Errors (${errorDetails['other'].length}): ${errorDetails['other'].slice(0, 5).join(', ')}${errorDetails['other'].length > 5 ? '...' : ''}`);
            }
          } else if (errorCount > 20) {
            console.log(`   ⚠️  Too many errors (${errorCount}) - circuit breaker may activate`);
          }
          
          // Log circuit breaker state if open
          if (externalApiCircuitBreaker.state === 'OPEN') {
            console.log(`   🔴 Circuit breaker is OPEN - future requests will be skipped`);
          }
        }
      }, process.env.EXTERNAL_API_URL || 'https://foom-dash.vercel.app/API');
    });
  } catch (error) {
    console.error('❌ [Scheduler] Error in sendMoListToExternalAPI:', error.message);
  }
}

// Setup Schedulers
// Update MO data from Odoo every 6 hours
cron.schedule('0 */6 * * *', () => {
  updateMoDataFromOdoo();
}, {
  scheduled: true,
  timezone: "Asia/Jakarta"
});

// Cleanup old MO data daily at 2 AM
cron.schedule('0 2 * * *', () => {
  cleanupOldMoData();
}, {
  scheduled: true,
  timezone: "Asia/Jakarta"
});

// Sync production data every 12 hours
cron.schedule('0 */12 * * *', () => {
  syncProductionData();
}, {
  scheduled: true,
  timezone: "Asia/Jakarta"
});

// Send MO list for liquid production to external API every 6 hours (after MO data update)
cron.schedule('10 */6 * * *', () => {
  sendMoListToExternalAPI();
}, {
  scheduled: true,
  timezone: "Asia/Jakarta"
});

// Run initial sync on server start (after 30 seconds delay)
setTimeout(() => {
  console.log('🚀 [Scheduler] Running initial tasks...');
  updateMoDataFromOdoo();
  syncProductionData();
  // Send MO list after a delay to ensure MO data is updated first
  setTimeout(() => {
    sendMoListToExternalAPI();
  }, 35000);
}, 30000);

console.log('📅 [Scheduler] Schedulers initialized:');
console.log('   - MO data update: Every 6 hours');
console.log('   - Cleanup old MO data: Daily at 2 AM');
console.log('   - Sync production data: Every 12 hours');
console.log('   - Send MO list to external API: Every 6 hours (10 minutes after MO update)');

// Serve static files AFTER all API routes (only for non-API routes)
const staticMiddleware = express.static(path.join(__dirname, '../client/public'));
app.use((req, res, next) => {
  // Skip static file serving for API routes
  if (req.path.startsWith('/api/')) {
    return next();
  }
  // Serve static files for non-API routes
  staticMiddleware(req, res, next);
});

// Error handling middleware (must be last, after all routes)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (!res.headersSent) {
    res.status(500).json({
      success: false,
      error: err.message || 'Internal server error'
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Access at: http://localhost:${PORT}`);
  
  // Signal PM2 that the app is ready
  if (process.send) {
    process.send('ready');
  }
});

// Handle server errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
  } else {
    console.error('❌ Server error:', err);
  }
  process.exit(1);
});

// Increase server timeout for long-running requests
server.timeout = 60000; // 60 seconds
server.keepAliveTimeout = 65000; // 65 seconds
server.headersTimeout = 66000; // 66 seconds

