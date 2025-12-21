const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

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
  db.run(`ALTER TABLE production_device ADD COLUMN session_id TEXT`, () => {});
  db.run(`ALTER TABLE production_device ADD COLUMN status TEXT DEFAULT 'active'`, () => {});
  db.run(`ALTER TABLE production_cartridge ADD COLUMN session_id TEXT`, () => {});
  db.run(`ALTER TABLE production_cartridge ADD COLUMN status TEXT DEFAULT 'active'`, () => {});

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

// Authentication endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === 'production' && password === 'production123') {
    res.json({ success: true, message: 'Login successful' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
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

// POST endpoints
app.post('/api/production/liquid', (req, res) => {
  const { session_id, leader_name, shift_number, pic, mo_number, sku_name, authenticity_data } = req.body;
  
  // Ensure authenticity_data is an array
  const authenticityRows = Array.isArray(authenticity_data) ? authenticity_data : [authenticity_data];
  
  // Create separate row for each authenticity data entry (each roll number)
  const insertPromises = authenticityRows.map((row) => {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO production_liquid (session_id, leader_name, shift_number, pic, mo_number, sku_name, authenticity_data, status) 
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

app.post('/api/production/device', (req, res) => {
  const { session_id, leader_name, shift_number, pic, mo_number, sku_name, authenticity_data } = req.body;
  
  // Ensure authenticity_data is an array
  const authenticityRows = Array.isArray(authenticity_data) ? authenticity_data : [authenticity_data];
  
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
  const authenticityRows = Array.isArray(authenticity_data) ? authenticity_data : [authenticity_data];
  
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
  
  db.run(
    `INSERT INTO buffer_liquid (session_id, pic, mo_number, sku_name, authenticity_numbers) 
     VALUES (?, ?, ?, ?, ?)`,
    [session_id, pic, mo_number, sku_name, JSON.stringify(authenticity_numbers)],
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
  
  db.run(
    `INSERT INTO buffer_device (session_id, pic, mo_number, sku_name, authenticity_numbers) 
     VALUES (?, ?, ?, ?, ?)`,
    [session_id, pic, mo_number, sku_name, JSON.stringify(authenticity_numbers)],
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
  
  db.run(
    `INSERT INTO buffer_cartridge (session_id, pic, mo_number, sku_name, authenticity_numbers) 
     VALUES (?, ?, ?, ?, ?)`,
    [session_id, pic, mo_number, sku_name, JSON.stringify(authenticity_numbers)],
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

