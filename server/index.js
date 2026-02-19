const app = require('./app');
const { initializeTables } = require('./database');
const cron = require('node-cron');

const PORT = process.env.PORT || 1234;

// Initialize database tables using PostgreSQL
initializeTables().then(() => {
  console.log('\n✅ Database initialized and ready');
  console.log('🚀 Server starting...\n');
}).catch(err => {
  console.error('\n❌ Failed to initialize database:', err);
  console.error('\n💡 Tips:');
  console.error('   1. Check database configuration in server/config.js or .env file');
  console.error('   2. Verify PostgreSQL is running');
  console.error('   3. Ensure database exists: CREATE DATABASE <db_name>;');
  console.error('   4. Run: node server/check-database.js to verify connection\n');
  process.exit(1);
});

// Import scheduler functions (keep schedulers in index.js for now)
// TODO: Move to services/scheduler.service.js in future refactoring
const { getAdminConfig } = require('./routes/admin.routes');
const { db } = require('./database');
const { sendToExternalAPIWithUrl, sendToExternalAPI, getExternalAPIUrl } = require('./services/external-api.service');

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

// All external API functions are imported from services/external-api.service.js

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

// Production Report API - Get detailed report with PIC, SKU, MO ID, Roll, First/Last Authenticity ID
app.get('/api/production/report', (req, res) => {
  const { type, mo_number, pic, date_from, date_to, status, limit, offset } = req.query;
  
  // Determine which tables to query
  const tables = [];
  if (!type || type === 'all' || type === 'liquid') {
    tables.push({ name: 'production_liquid', type: 'liquid' });
  }
  if (!type || type === 'all' || type === 'device') {
    tables.push({ name: 'production_device', type: 'device' });
  }
  if (!type || type === 'all' || type === 'cartridge') {
    tables.push({ name: 'production_cartridge', type: 'cartridge' });
  }
  
  const allResults = [];
  let completedQueries = 0;
  
  // Query each table
  tables.forEach((table) => {
    let query = `
      SELECT 
        pic as pic_input,
        sku_name,
        mo_number,
        json_extract(authenticity_data, '$[0].rollNumber') as roll,
        json_extract(authenticity_data, '$[0].firstAuthenticity') as first_authenticity_id,
        json_extract(authenticity_data, '$[0].lastAuthenticity') as last_authenticity_id,
        leader_name,
        shift_number,
        status,
        created_at,
        completed_at,
        '${table.type}' as production_type
      FROM ${table.name}
      WHERE 1=1
    `;
    
    const params = [];
    
    // Apply filters
    if (mo_number) {
      query += ' AND mo_number = ?';
      params.push(mo_number);
    }
    
    if (pic) {
      query += ' AND pic LIKE ?';
      params.push(`%${pic}%`);
    }
    
    if (date_from) {
      query += ' AND date(created_at) >= ?';
      params.push(date_from);
    }
    
    if (date_to) {
      query += ' AND date(created_at) <= ?';
      params.push(date_to);
    }
    
    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC';
    
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error(`Error querying ${table.name}:`, err);
      } else {
        allResults.push(...rows);
      }
      
      completedQueries++;
      
      // When all tables have been queried
      if (completedQueries === tables.length) {
        // Sort by created_at descending
        allResults.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        // Apply pagination if specified
        let paginatedResults = allResults;
        const limitNum = parseInt(limit) || 0;
        const offsetNum = parseInt(offset) || 0;
        
        if (limitNum > 0) {
          paginatedResults = allResults.slice(offsetNum, offsetNum + limitNum);
        }
        
        res.json({
          success: true,
          total: allResults.length,
          limit: limitNum || null,
          offset: offsetNum || 0,
          data: paginatedResults
        });
      }
    });
  });
  
  // Handle case where no tables to query
  if (tables.length === 0) {
    res.status(400).json({
      success: false,
      error: 'Invalid production type'
    });
  }
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

// Endpoint untuk mendapatkan data MO dengan format sederhana berdasarkan range waktu
app.get('/api/external/manufacturing-report/simple', apiKeyAuth, async (req, res) => {
  try {
    const { start_date, end_date, completed_at } = req.query;
    
    // Jika completed_at diberikan, gunakan untuk single date
    // Jika start_date dan end_date diberikan, gunakan untuk range
    let dateCondition = '';
    let params = [];
    
    if (completed_at) {
      // Single date query
      dateCondition = 'DATE(completed_at) = DATE(?)';
      params = [completed_at];
    } else if (start_date && end_date) {
      // Date range query
      dateCondition = 'DATE(completed_at) BETWEEN DATE(?) AND DATE(?)';
      params = [start_date, end_date];
    } else if (start_date) {
      // Only start_date provided, get from that date onwards
      dateCondition = 'DATE(completed_at) >= DATE(?)';
      params = [start_date];
    } else if (end_date) {
      // Only end_date provided, get up to that date
      dateCondition = 'DATE(completed_at) <= DATE(?)';
      params = [end_date];
    } else {
      return res.status(400).json({ 
        success: false, 
        error: 'Parameter required: completed_at (YYYY-MM-DD) OR start_date and/or end_date (YYYY-MM-DD)' 
      });
    }

    // Query semua tabel production
    const tables = [
      { name: 'production_liquid', type: 'liquid' },
      { name: 'production_device', type: 'device' },
      { name: 'production_cartridge', type: 'cartridge' }
    ];

    const productionPromises = tables.map(table => {
      return new Promise((resolve, reject) => {
        const query = `
          SELECT 
            pic as pic_input,
            sku_name,
            mo_number as mo_id,
            authenticity_data,
            completed_at,
            '${table.type}' as production_type
          FROM ${table.name}
          WHERE status = 'completed' 
            AND completed_at IS NOT NULL 
            AND ${dateCondition}
          ORDER BY completed_at ASC, mo_number ASC
        `;
        
        db.all(query, params, (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(rows);
        });
      });
    });

    const productionResults = await Promise.all(productionPromises);
    const allProduction = productionResults.flat();

    if (allProduction.length === 0) {
      return res.json({
        success: true,
        filter: completed_at ? { completed_at } : { start_date, end_date },
        total_records: 0,
        data: []
      });
    }

    // Parse dan flatten data untuk setiap roll
    const flattenedData = [];
    
    allProduction.forEach(row => {
      let authenticityData;
      try {
        authenticityData = typeof row.authenticity_data === 'string' 
          ? JSON.parse(row.authenticity_data) 
          : row.authenticity_data;
      } catch (e) {
        authenticityData = [];
      }

      // Setiap roll mendapat row tersendiri
      if (Array.isArray(authenticityData)) {
        authenticityData.forEach(auth => {
          flattenedData.push({
            pic_input: row.pic_input || '',
            sku: row.sku_name || '',
            mo_id: row.mo_id || '',
            roll: auth.rollNumber || '',
            first_authenticity_id: auth.firstAuthenticity || '',
            last_authenticity_id: auth.lastAuthenticity || '',
            completed_at: row.completed_at || null,
            production_type: row.production_type || ''
          });
        });
      }
    });

    res.json({
      success: true,
      filter: completed_at ? { completed_at } : { start_date, end_date },
      total_records: flattenedData.length,
      data: flattenedData
    });

  } catch (error) {
    console.error('Error fetching simple manufacturing report:', error);
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

// PUT endpoints to update buffer data
app.put('/api/buffer/liquid/:id', (req, res) => {
  const { id } = req.params;
  const { pic, mo_number, sku_name, authenticity_numbers } = req.body;
  const normalizedNumbers = normalizeAuthenticityNumbers(authenticity_numbers);
  
  db.run(
    `UPDATE buffer_liquid SET pic = ?, mo_number = ?, sku_name = ?, authenticity_numbers = ? WHERE id = ?`,
    [pic, mo_number, sku_name, JSON.stringify(normalizedNumbers), id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Buffer data not found' });
        return;
      }
      res.json({ 
        id: id, 
        message: 'Buffer data updated successfully'
      });
    }
  );
});

app.put('/api/buffer/device/:id', (req, res) => {
  const { id } = req.params;
  const { pic, mo_number, sku_name, authenticity_numbers } = req.body;
  const normalizedNumbers = normalizeAuthenticityNumbers(authenticity_numbers);
  
  db.run(
    `UPDATE buffer_device SET pic = ?, mo_number = ?, sku_name = ?, authenticity_numbers = ? WHERE id = ?`,
    [pic, mo_number, sku_name, JSON.stringify(normalizedNumbers), id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Buffer data not found' });
        return;
      }
      res.json({ 
        id: id, 
        message: 'Buffer data updated successfully'
      });
    }
  );
});

app.put('/api/buffer/cartridge/:id', (req, res) => {
  const { id } = req.params;
  const { pic, mo_number, sku_name, authenticity_numbers } = req.body;
  const normalizedNumbers = normalizeAuthenticityNumbers(authenticity_numbers);
  
  db.run(
    `UPDATE buffer_cartridge SET pic = ?, mo_number = ?, sku_name = ?, authenticity_numbers = ? WHERE id = ?`,
    [pic, mo_number, sku_name, JSON.stringify(normalizedNumbers), id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Buffer data not found' });
        return;
      }
      res.json({ 
        id: id, 
        message: 'Buffer data updated successfully'
      });
    }
  );
});

// PUT endpoints to update reject data
app.put('/api/reject/liquid/:id', (req, res) => {
  const { id } = req.params;
  const { pic, mo_number, sku_name, authenticity_numbers } = req.body;
  const normalizedNumbers = normalizeAuthenticityNumbers(authenticity_numbers);
  
  db.run(
    `UPDATE reject_liquid SET pic = ?, mo_number = ?, sku_name = ?, authenticity_numbers = ? WHERE id = ?`,
    [pic, mo_number, sku_name, JSON.stringify(normalizedNumbers), id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Reject data not found' });
        return;
      }
      res.json({ 
        id: id, 
        message: 'Reject data updated successfully'
      });
    }
  );
});

app.put('/api/reject/device/:id', (req, res) => {
  const { id } = req.params;
  const { pic, mo_number, sku_name, authenticity_numbers } = req.body;
  const normalizedNumbers = normalizeAuthenticityNumbers(authenticity_numbers);
  
  db.run(
    `UPDATE reject_device SET pic = ?, mo_number = ?, sku_name = ?, authenticity_numbers = ? WHERE id = ?`,
    [pic, mo_number, sku_name, JSON.stringify(normalizedNumbers), id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Reject data not found' });
        return;
      }
      res.json({ 
        id: id, 
        message: 'Reject data updated successfully'
      });
    }
  );
});

app.put('/api/reject/cartridge/:id', (req, res) => {
  const { id } = req.params;
  const { pic, mo_number, sku_name, authenticity_numbers } = req.body;
  const normalizedNumbers = normalizeAuthenticityNumbers(authenticity_numbers);
  
  db.run(
    `UPDATE reject_cartridge SET pic = ?, mo_number = ?, sku_name = ?, authenticity_numbers = ? WHERE id = ?`,
    [pic, mo_number, sku_name, JSON.stringify(normalizedNumbers), id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Reject data not found' });
        return;
      }
      res.json({ 
        id: id, 
        message: 'Reject data updated successfully'
      });
    }
  );
});

// Manufacturing Report API Endpoint
// GET manufacturing report data with calculations
app.get('/api/reports/manufacturing', async (req, res) => {
  try {
    const { type, startDate, endDate, moNumber } = req.query;
    
    // Build WHERE clause for filtering
    let whereConditions = [];
    let params = [];
    
    // Filter by production type if specified
    if (type && type !== 'all') {
      whereConditions.push('production_type = ?');
      params.push(type);
    }
    
    // Filter by date range if specified
    if (startDate) {
      whereConditions.push('DATE(created_at) >= ?');
      params.push(startDate);
    }
    
    if (endDate) {
      whereConditions.push('DATE(created_at) <= ?');
      params.push(endDate);
    }
    
    // Filter by MO Number if specified
    if (moNumber) {
      whereConditions.push('mo_number LIKE ?');
      params.push(`%${moNumber}%`);
    }
    
    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';
    
    // Query production data from all tables
    const queries = {
      liquid: `SELECT 'liquid' as production_type, * FROM production_liquid ${whereClause}`,
      device: `SELECT 'device' as production_type, * FROM production_device ${whereClause}`,
      cartridge: `SELECT 'cartridge' as production_type, * FROM production_cartridge ${whereClause}`
    };
    
    // If type is specified, only query that table
    let queryToRun;
    let queryParams;
    if (type && type !== 'all') {
      queryToRun = queries[type];
      queryParams = params;
    } else {
      // Combine all queries with UNION
      queryToRun = `${queries.liquid} UNION ${queries.device} UNION ${queries.cartridge} ORDER BY created_at DESC`;
      // Duplicate params for each UNION clause (3 times for 3 tables)
      queryParams = [...params, ...params, ...params];
    }
    
    // Execute production query
    db.all(queryToRun, queryParams, async (err, productionRows) => {
      if (err) {
        console.error('Error fetching production data:', err);
        return res.status(500).json({ error: err.message });
      }
      
      // Parse authenticity data
      const parsedRows = productionRows.map(row => ({
        ...row,
        authenticity_data: typeof row.authenticity_data === 'string' 
          ? JSON.parse(row.authenticity_data) 
          : row.authenticity_data
      }));
      
      // Get all unique MO numbers and production types
      const moMap = new Map();
      parsedRows.forEach(row => {
        const key = `${row.mo_number}_${row.production_type}`;
        if (!moMap.has(key)) {
          moMap.set(key, { mo_number: row.mo_number, production_type: row.production_type });
        }
      });
      
      // Fetch buffer and reject counts for each MO
      const bufferRejectPromises = Array.from(moMap.values()).map(async ({ mo_number, production_type }) => {
        return new Promise((resolve) => {
          // Get buffer count
          db.all(
            `SELECT * FROM buffer_${production_type} WHERE mo_number = ?`,
            [mo_number],
            (bufferErr, bufferRows) => {
              if (bufferErr) {
                console.error(`Error fetching buffer for ${mo_number}:`, bufferErr);
                resolve({ mo_number, buffers: [], rejects: [] });
                return;
              }
              
              // Get reject count
              db.all(
                `SELECT * FROM reject_${production_type} WHERE mo_number = ?`,
                [mo_number],
                (rejectErr, rejectRows) => {
                  if (rejectErr) {
                    console.error(`Error fetching reject for ${mo_number}:`, rejectErr);
                    resolve({ mo_number, buffers: bufferRows || [], rejects: [] });
                    return;
                  }
                  
                  // Parse buffer and reject data
                  const parsedBuffers = (bufferRows || []).map(row => ({
                    ...row,
                    authenticity_numbers: typeof row.authenticity_numbers === 'string'
                      ? JSON.parse(row.authenticity_numbers)
                      : row.authenticity_numbers
                  }));
                  
                  const parsedRejects = (rejectRows || []).map(row => ({
                    ...row,
                    authenticity_numbers: typeof row.authenticity_numbers === 'string'
                      ? JSON.parse(row.authenticity_numbers)
                      : row.authenticity_numbers
                  }));
                  
                  resolve({ mo_number, buffers: parsedBuffers, rejects: parsedRejects });
                }
              );
            }
          );
        });
      });
      
      // Wait for all buffer/reject queries
      const bufferRejectData = await Promise.all(bufferRejectPromises);
      
      // Create a map for quick lookup
      const bufferRejectMap = new Map();
      bufferRejectData.forEach(data => {
        bufferRejectMap.set(data.mo_number, {
          buffers: data.buffers,
          rejects: data.rejects
        });
      });
      
      // Attach buffer and reject data to production rows
      const enrichedRows = parsedRows.map(row => {
        const bufferReject = bufferRejectMap.get(row.mo_number);
        
        // Calculate buffer count
        let buffer_count = 0;
        if (bufferReject && bufferReject.buffers) {
          bufferReject.buffers.forEach(buffer => {
            if (Array.isArray(buffer.authenticity_numbers)) {
              buffer_count += buffer.authenticity_numbers.filter(n => n && n.trim() !== '').length;
            }
          });
        }
        
        // Calculate reject count
        let reject_count = 0;
        if (bufferReject && bufferReject.rejects) {
          bufferReject.rejects.forEach(reject => {
            if (Array.isArray(reject.authenticity_numbers)) {
              reject_count += reject.authenticity_numbers.filter(n => n && n.trim() !== '').length;
            }
          });
        }
        
        return {
          ...row,
          buffer_count,
          reject_count
        };
      });
      
      res.json(enrichedRows);
    });
  } catch (error) {
    console.error('Error in manufacturing report:', error);
    res.status(500).json({ error: error.message });
  }
});

// Production Statistics API Endpoints
// GET production statistics by leader
app.get('/api/statistics/production-by-leader', (req, res) => {
  const { period, startDate, endDate, productionType } = req.query;
  
  // Build date filter based on period (PostgreSQL syntax)
  let dateFilter = '';
  if (period === 'day') {
    // Last 7 days
    dateFilter = "AND created_at::date >= CURRENT_DATE - INTERVAL '7 days'";
  } else if (period === 'week') {
    // Last 8 weeks
    dateFilter = "AND created_at::date >= CURRENT_DATE - INTERVAL '56 days'";
  } else if (period === 'month') {
    // Last 12 months
    dateFilter = "AND created_at::date >= CURRENT_DATE - INTERVAL '12 months'";
  } else if (startDate && endDate) {
    // Custom date range
    dateFilter = `AND created_at::date BETWEEN '${startDate}'::date AND '${endDate}'::date`;
  }
  
  // Build production type filter
  const types = [];
  if (!productionType || productionType === 'all') {
    types.push('liquid', 'device', 'cartridge');
  } else {
    types.push(productionType);
  }
  
  // Query each production type
  const queries = types.map(type => {
    return new Promise((resolve, reject) => {
      // Validate type to prevent SQL injection
      const validTypes = ['liquid', 'device', 'cartridge'];
      if (!validTypes.includes(type)) {
        return reject(new Error(`Invalid production type: ${type}`));
      }
      
      const query = `
        SELECT 
          $1 as production_type,
          leader_name,
          created_at::date as date,
          session_id,
          mo_number,
          authenticity_data
        FROM production_${type}
        WHERE 1=1 ${dateFilter}
        ORDER BY created_at DESC
      `;
      
      db.all(query, [type], (err, rows) => {
        if (err) {
          console.error(`Error querying production_${type}:`, err);
          console.error('Query:', query);
          console.error('Error details:', err.message);
          reject(err);
        } else {
          // Parse authenticity data and calculate quantities
          const parsedRows = rows.map(row => {
            let authenticityData;
            try {
              authenticityData = typeof row.authenticity_data === 'string' 
                ? JSON.parse(row.authenticity_data) 
                : row.authenticity_data;
            } catch (e) {
              authenticityData = [];
            }
            
            // Calculate production quantity from authenticity data
            let productionQty = 0;
            if (Array.isArray(authenticityData)) {
              authenticityData.forEach(auth => {
                if (auth.firstAuthenticity && auth.lastAuthenticity) {
                  const first = parseInt(auth.firstAuthenticity) || 0;
                  const last = parseInt(auth.lastAuthenticity) || 0;
                  productionQty += (last - first);
                }
              });
            }
            
            return {
              ...row,
              production_qty: productionQty
            };
          });
          
          // Get buffer and reject data for each MO
          const moNumbers = [...new Set(parsedRows.map(r => r.mo_number))];
          
          const bufferRejectPromises = moNumbers.map(moNumber => {
            return new Promise((resolveInner) => {
              // Get buffer count - validate type first
              if (!['liquid', 'device', 'cartridge'].includes(type)) {
                return resolveInner({ mo_number: moNumber, buffer_count: 0, reject_count: 0 });
              }
              
              db.all(
                `SELECT authenticity_numbers FROM buffer_${type} WHERE mo_number = $1`,
                [moNumber],
                (bufferErr, bufferRows) => {
                  let bufferCount = 0;
                  if (!bufferErr && bufferRows) {
                    bufferRows.forEach(buffer => {
                      try {
                        const numbers = typeof buffer.authenticity_numbers === 'string'
                          ? JSON.parse(buffer.authenticity_numbers)
                          : buffer.authenticity_numbers;
                        if (Array.isArray(numbers)) {
                          bufferCount += numbers.filter(n => n && n.trim() !== '').length;
                        }
                      } catch (e) {}
                    });
                  }
                  
                  // Get reject count
                  db.all(
                    `SELECT authenticity_numbers FROM reject_${type} WHERE mo_number = $1`,
                    [moNumber],
                    (rejectErr, rejectRows) => {
                      let rejectCount = 0;
                      if (!rejectErr && rejectRows) {
                        rejectRows.forEach(reject => {
                          try {
                            const numbers = typeof reject.authenticity_numbers === 'string'
                              ? JSON.parse(reject.authenticity_numbers)
                              : reject.authenticity_numbers;
                            if (Array.isArray(numbers)) {
                              rejectCount += numbers.filter(n => n && n.trim() !== '').length;
                            }
                          } catch (e) {}
                        });
                      }
                      
                      resolveInner({ 
                        mo_number: moNumber, 
                        buffer_count: bufferCount, 
                        reject_count: rejectCount 
                      });
                    }
                  );
                }
              );
            });
          });
          
          Promise.all(bufferRejectPromises).then(bufferRejectData => {
            const bufferRejectMap = new Map();
            bufferRejectData.forEach(data => {
              bufferRejectMap.set(data.mo_number, {
                buffer: data.buffer_count,
                reject: data.reject_count
              });
            });
            
            // Add buffer and reject to each row
            const enrichedRows = parsedRows.map(row => {
              const bufferReject = bufferRejectMap.get(row.mo_number);
              const buffer = bufferReject?.buffer || 0;
              const reject = bufferReject?.reject || 0;
              
              return {
                ...row,
                buffer_count: buffer,
                reject_count: reject,
                net_production: row.production_qty - reject + buffer
              };
            });
            
            resolve(enrichedRows);
          });
        }
      });
    });
  });
  
  Promise.all(queries)
    .then(results => {
      // Combine all results
      const combinedData = results.flat();
      
      // Group by period
      const groupedData = {};
      const sessionSet = {};
      
      combinedData.forEach(row => {
        // Skip rows without date
        if (!row.date) {
          return;
        }
        
        let periodKey;
        const dateStr = String(row.date);
        const date = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
          console.warn('Invalid date:', row.date);
          return;
        }
        
        if (period === 'day') {
          // Group by day
          periodKey = dateStr.split('T')[0]; // Get YYYY-MM-DD part
        } else if (period === 'week') {
          // Group by week (start of week)
          const dayOfWeek = date.getDay();
          const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
          const weekStart = new Date(date);
          weekStart.setDate(diff);
          periodKey = weekStart.toISOString().split('T')[0];
        } else if (period === 'month') {
          // Group by month
          periodKey = dateStr.substring(0, 7); // YYYY-MM
        } else {
          periodKey = dateStr.split('T')[0];
        }
        
        const key = `${periodKey}_${row.leader_name}_${row.production_type}`;
        
        if (!groupedData[key]) {
          groupedData[key] = {
            period: periodKey,
            leader_name: row.leader_name,
            production_type: row.production_type,
            session_count: 0,
            input_count: 0,
            production_qty: 0,
            buffer_count: 0,
            reject_count: 0,
            net_production: 0
          };
          sessionSet[key] = new Set();
        }
        
        // Count unique sessions
        sessionSet[key].add(row.session_id);
        
        // Sum up quantities
        groupedData[key].input_count += 1;
        groupedData[key].production_qty += row.production_qty || 0;
        groupedData[key].buffer_count += row.buffer_count || 0;
        groupedData[key].reject_count += row.reject_count || 0;
        groupedData[key].net_production += row.net_production || 0;
      });
      
      // Update session counts
      Object.keys(groupedData).forEach(key => {
        groupedData[key].session_count = sessionSet[key].size;
      });
      
      // Convert to array and sort
      const resultArray = Object.values(groupedData).sort((a, b) => {
        // Ensure period is string for comparison
        const periodA = String(a.period || '');
        const periodB = String(b.period || '');
        const leaderA = String(a.leader_name || '');
        const leaderB = String(b.leader_name || '');
        const typeA = String(a.production_type || '');
        const typeB = String(b.production_type || '');
        
        if (periodA !== periodB) return periodB.localeCompare(periodA);
        if (leaderA !== leaderB) return leaderA.localeCompare(leaderB);
        return typeA.localeCompare(typeB);
      });
      
      res.json({ success: true, data: resultArray, period: period || 'custom' });
    })
    .catch(err => {
      console.error('Error fetching production statistics:', err);
      res.status(500).json({ success: false, error: err.message });
    });
});

// GET leader list for filter
app.get('/api/statistics/leaders', (req, res) => {
  const queries = [
    'SELECT DISTINCT leader_name FROM production_liquid WHERE leader_name IS NOT NULL',
    'SELECT DISTINCT leader_name FROM production_device WHERE leader_name IS NOT NULL',
    'SELECT DISTINCT leader_name FROM production_cartridge WHERE leader_name IS NOT NULL'
  ];
  
  Promise.all(queries.map(query => {
    return new Promise((resolve, reject) => {
      db.all(query, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }))
    .then(results => {
      // Combine and deduplicate leader names
      const leaders = new Set();
      results.flat().forEach(row => {
        if (row.leader_name) leaders.add(row.leader_name);
      });
      
      const sortedLeaders = Array.from(leaders).sort();
      res.json({ success: true, data: sortedLeaders });
    })
    .catch(err => {
      console.error('Error fetching leaders:', err);
      res.status(500).json({ success: false, error: err.message });
    });
});

// PIC (Person in Charge) API Endpoints
// GET all active PICs
app.get('/api/pic/list', (req, res) => {
  db.all('SELECT * FROM pic_list WHERE is_active = 1 ORDER BY name ASC', (err, rows) => {
    if (err) {
      console.error('Error fetching PIC list:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, data: rows });
  });
});

// GET all PICs (including inactive)
app.get('/api/pic/all', (req, res) => {
  db.all('SELECT * FROM pic_list ORDER BY name ASC', (err, rows) => {
    if (err) {
      console.error('Error fetching all PIC list:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, data: rows });
  });
});

// POST add new PIC
app.post('/api/pic/add', (req, res) => {
  const { name } = req.body;
  
  if (!name || name.trim() === '') {
    return res.status(400).json({ success: false, error: 'PIC name is required' });
  }
  
  db.run(
    'INSERT INTO pic_list (name) VALUES (?)',
    [name.trim()],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ success: false, error: 'PIC name already exists' });
        }
        console.error('Error adding PIC:', err);
        return res.status(500).json({ success: false, error: err.message });
      }
      res.json({ success: true, id: this.lastID, message: 'PIC added successfully' });
    }
  );
});

// PUT update PIC
app.put('/api/pic/update/:id', (req, res) => {
  const { id } = req.params;
  const { name, is_active } = req.body;
  
  if (!name || name.trim() === '') {
    return res.status(400).json({ success: false, error: 'PIC name is required' });
  }
  
  db.run(
    'UPDATE pic_list SET name = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name.trim(), is_active !== undefined ? is_active : 1, id],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ success: false, error: 'PIC name already exists' });
        }
        console.error('Error updating PIC:', err);
        return res.status(500).json({ success: false, error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ success: false, error: 'PIC not found' });
      }
      res.json({ success: true, message: 'PIC updated successfully' });
    }
  );
});

// DELETE PIC (soft delete by setting is_active to 0)
app.delete('/api/pic/delete/:id', (req, res) => {
  const { id } = req.params;
  
  db.run(
    'UPDATE pic_list SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [id],
    function(err) {
      if (err) {
        console.error('Error deleting PIC:', err);
        return res.status(500).json({ success: false, error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ success: false, error: 'PIC not found' });
      }
      res.json({ success: true, message: 'PIC deleted successfully' });
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
    db.get("SELECT table_name as name FROM information_schema.tables WHERE table_schema='public' AND table_name='admin_config'", (tableErr, tableRow) => {
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
  db.get("SELECT table_name as name FROM information_schema.tables WHERE table_schema='public' AND table_name='admin_config'", (tableErr, tableRow) => {
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
        `INSERT INTO admin_config (config_key, config_value, updated_at) 
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (config_key) DO UPDATE SET config_value = $2, updated_at = CURRENT_TIMESTAMP`,
        ['odoo_session_id', sessionId],
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
          `INSERT INTO admin_config (config_key, config_value, updated_at) 
           VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (config_key) DO UPDATE SET config_value = $2, updated_at = CURRENT_TIMESTAMP`,
          ['odoo_base_url', odooBaseUrl || 'https://foomx.odoo.com'],
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
          `INSERT INTO admin_config (config_key, config_value, updated_at) 
           VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (config_key) DO UPDATE SET config_value = $2, updated_at = CURRENT_TIMESTAMP`,
          ['external_api_url', externalApiUrl || 'https://foom-dash.vercel.app/API'],
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
          `INSERT INTO admin_config (config_key, config_value, updated_at) 
           VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (config_key) DO UPDATE SET config_value = $2, updated_at = CURRENT_TIMESTAMP`,
          ['external_api_url_active', externalApiUrlActive || 'https://foom-dash.vercel.app/API'],
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
          `INSERT INTO admin_config (config_key, config_value, updated_at) 
           VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (config_key) DO UPDATE SET config_value = $2, updated_at = CURRENT_TIMESTAMP`,
          ['external_api_url_completed', externalApiUrlCompleted || 'https://foom-dash.vercel.app/API'],
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
          `INSERT INTO admin_config (config_key, config_value, updated_at) 
           VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (config_key) DO UPDATE SET config_value = $2, updated_at = CURRENT_TIMESTAMP`,
          ['api_key', apiKey],
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
    db.get("SELECT table_name as name FROM information_schema.tables WHERE table_schema='public' AND table_name='admin_config'", (tableErr, tableRow) => {
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
        `INSERT INTO admin_config (config_key, config_value, updated_at) 
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (config_key) DO UPDATE SET config_value = $2, updated_at = CURRENT_TIMESTAMP`,
        ['api_key', apiKey],
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

// getAdminConfig is imported from routes/admin.routes.js

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
              NOW() as current_time,
              NOW() - INTERVAL '7 days' as threshold
       FROM odoo_mo_cache 
       WHERE create_date::TIMESTAMP < NOW() - INTERVAL '7 days'
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
           WHERE create_date::TIMESTAMP >= NOW() - INTERVAL '7 days'
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
                 NOW() as current_time,
                 NOW() - INTERVAL '7 days' as threshold
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
    db.get("SELECT table_name as name FROM information_schema.tables WHERE table_schema='public' AND table_name='odoo_mo_cache'", (tableErr, tableRow) => {
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
        // PostgreSQL uses NOW() - INTERVAL '7 days' for proper date calculation
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
           WHERE create_date::TIMESTAMP >= NOW() - INTERVAL '7 days'`,
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
               WHERE create_date::TIMESTAMP < NOW() - INTERVAL '7 days'`,
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
      // First, fetch MO data from last 60 days from Odoo (for consistency with sync)
      const https = require('https');
      const url = require('url');
      const ODOO_URL = `${config.odooBaseUrl}/web/dataset/call_kw/mrp.production/search_read`;
      const COOKIE_HEADER = `session_id=${config.sessionId}; session_id=${config.sessionId}`;

      const daysBack = 60; // Keep same as cleanup function
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);
      const startDateStr = startDate.toISOString().split('T')[0] + ' 00:00:00';

      const requestData = {
        "jsonrpc": "2.0",
        "method": "call",
        "params": {
          "model": "mrp.production",
          "method": "search_read",
          "args": [[["create_date", ">=", startDateStr]]],
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
         WHERE create_date::TIMESTAMP < NOW() - INTERVAL '7 days'`,
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
                    NOW() as current_time, 
                    NOW() - INTERVAL '7 days' as threshold
             FROM odoo_mo_cache 
             WHERE create_date::TIMESTAMP < NOW() - INTERVAL '7 days'
             LIMIT 5`,
            (sampleErr, sampleRows) => {
              if (!sampleErr && sampleRows && sampleRows.length > 0) {
                console.log(`📋 [Cleanup] Sample of old records (by create_date):`, sampleRows);
              }

              // Delete MO records where create_date is older than 7 days
              // This is based on when the MO was created in Odoo, not when we cached it
              const deleteQuery = `DELETE FROM odoo_mo_cache 
                                   WHERE create_date::TIMESTAMP < NOW() - INTERVAL '7 days'`;

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
    // Get MO data from cache filtered by note and create_date (last 30 days)
    // Use case-insensitive search for note field with typo tolerance
    // Note: PostgreSQL LOWER() function for case-insensitive comparison
    let query = `
      SELECT mo_number, sku_name, quantity, uom, note, create_date
      FROM odoo_mo_cache
      WHERE (LOWER(note) LIKE LOWER($1)`;
    
    // Add OR conditions for variations
    if (noteFilter === 'cartridge') {
      query += ` OR LOWER(note) LIKE LOWER($2) OR LOWER(note) LIKE LOWER($3)`;
    } else if (noteFilter === 'liquid') {
      query += ` OR LOWER(note) LIKE LOWER($2)`;
    }
    
    query += `)
        AND create_date::TIMESTAMP >= NOW() - INTERVAL '30 days'
      ORDER BY create_date DESC
      LIMIT 1000
    `;

    // Search pattern with wildcards for case-insensitive match
    const searchPattern = `%${noteFilter}%`;
    
    // Additional patterns for variations
    let queryParams = [searchPattern];
    if (noteFilter === 'cartridge') {
      queryParams.push('%cartirdge%', '%cartrige%');
      console.log(`🔍 [MO List] Querying cache for ${productionType} with patterns: cartridge, cartirdge, cartrige`);
    } else if (noteFilter === 'liquid') {
      queryParams.push('%TEAM LIQUID%');
      console.log(`🔍 [MO List] Querying cache for ${productionType} with patterns: TEAM LIQUID, liquid`);
    } else {
      console.log(`🔍 [MO List] Querying cache for ${productionType} with pattern: ${searchPattern}`);
    }

    db.all(query, queryParams, (err, rows) => {
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
          message: `No MO records found for ${productionType} in the last 30 days`
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

// Debug endpoint - Check MO sync status
app.get('/api/odoo/debug/mo-sync', async (req, res) => {
  const { moNumber } = req.query;
  
  try {
    const debugInfo = {
      timestamp: new Date().toISOString(),
      moNumber: moNumber || 'all'
    };
    
    // Check last sync time
    const lastSyncQuery = 'SELECT MAX(fetched_at) as last_sync, COUNT(*) as total_mos FROM odoo_mo_cache';
    db.get(lastSyncQuery, [], (err, syncInfo) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      debugInfo.lastSync = syncInfo?.last_sync;
      debugInfo.totalMosInCache = syncInfo?.total_mos;
      
      if (syncInfo?.last_sync) {
        const lastSync = new Date(syncInfo.last_sync);
        const now = new Date();
        const hoursSinceSync = (now - lastSync) / (1000 * 60 * 60);
        debugInfo.hoursSinceLastSync = hoursSinceSync.toFixed(2);
        debugInfo.syncStatus = hoursSinceSync > 6 ? 'OUTDATED' : 'OK';
      } else {
        debugInfo.syncStatus = 'NEVER_SYNCED';
      }
      
      // If specific MO number is provided, check if it exists
      if (moNumber) {
        db.get(
          'SELECT * FROM odoo_mo_cache WHERE mo_number = $1',
          [moNumber],
          (err2, moRow) => {
            if (err2) {
              debugInfo.moCheckError = err2.message;
            } else if (moRow) {
              debugInfo.moFound = true;
              debugInfo.moData = moRow;
            } else {
              debugInfo.moFound = false;
              debugInfo.message = `MO ${moNumber} not found in cache. Possible reasons: not synced yet, create_date > 7 days old, note doesn't match filter, or doesn't exist in Odoo.`;
            }
            
            return res.json(debugInfo);
          }
        );
      } else {
        // Get recent MOs by production type
        const recentQuery = `
          SELECT production_type, COUNT(*) as count 
          FROM (
            SELECT 
              CASE 
                WHEN LOWER(note) LIKE '%cartridge%' THEN 'cartridge'
                WHEN LOWER(note) LIKE '%liquid%' THEN 'liquid'
                WHEN LOWER(note) LIKE '%device%' THEN 'device'
                ELSE 'unknown'
              END as production_type
            FROM odoo_mo_cache
            WHERE create_date::TIMESTAMP >= NOW() - INTERVAL '30 days'
          ) as categorized
          GROUP BY production_type
        `;
        
        db.all(recentQuery, [], (err3, typeStats) => {
          if (err3) {
            debugInfo.typeStatsError = err3.message;
          } else {
            debugInfo.mosByType = typeStats;
          }
          
          return res.json(debugInfo);
        });
      }
    });
  } catch (error) {
    res.status(500).json({
      error: error.message || 'Failed to get debug info'
    });
  }
});

// Manual trigger MO sync from Odoo
app.post('/api/admin/sync-mo', async (req, res) => {
  try {
    console.log('🔄 [Manual Sync] Triggered by API call');
    
    res.json({
      success: true,
      message: 'MO sync started. Check server logs for progress.',
      timestamp: new Date().toISOString()
    });
    
    // Run sync in background
    updateMoDataFromOdoo();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to start sync'
    });
  }
});

// Check if MO has been used in production
app.get('/api/production/check-mo-used', (req, res) => {
  const { moNumber, productionType } = req.query;
  
  if (!moNumber) {
    return res.status(400).json({ error: 'moNumber parameter is required' });
  }
  
  const type = productionType || 'liquid'; // default to liquid
  const table = `production_${type}`;
  
  // Check if MO exists in production table
  db.all(
    `SELECT id, session_id, leader_name, shift_number, pic, status, created_at 
     FROM ${table} 
     WHERE mo_number = $1
     ORDER BY created_at DESC`,
    [moNumber],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (rows && rows.length > 0) {
        const activeCount = rows.filter(r => r.status === 'active').length;
        const completedCount = rows.filter(r => r.status === 'completed').length;
        
        return res.json({
          used: true,
          count: rows.length,
          activeCount,
          completedCount,
          records: rows,
          message: `MO ${moNumber} telah digunakan ${rows.length} kali (${activeCount} active, ${completedCount} completed)`
        });
      } else {
        return res.json({
          used: false,
          count: 0,
          activeCount: 0,
          completedCount: 0,
          records: [],
          message: `MO ${moNumber} belum pernah digunakan`
        });
      }
    }
  );
});

// Debug endpoint - Query specific MO from Odoo directly
app.get('/api/odoo/debug/query-mo', async (req, res) => {
  const { moNumber } = req.query;
  
  if (!moNumber) {
    return res.status(400).json({ error: 'moNumber parameter is required' });
  }
  
  getAdminConfig(async (err, config) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    try {
      const https = require('https');
      const url = require('url');
      
      const ODOO_URL = `${config.odooBaseUrl}/web/dataset/call_kw/mrp.production/search_read`;
      const COOKIE_HEADER = `session_id=${config.sessionId}; session_id=${config.sessionId}`;
      
      // Query specific MO by name (no date filter)
      const requestData = {
        "jsonrpc": "2.0",
        "method": "call",
        "params": {
          "model": "mrp.production",
          "method": "search_read",
          "args": [[["name", "=", moNumber]]],
          "kwargs": {
            "fields": ["id", "name", "product_id", "product_qty", "product_uom_id", "note", "create_date", "state"],
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
              resolve(jsonResponse);
            } catch (e) {
              reject(new Error('Failed to parse Odoo response: ' + e.message));
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
      
      if (response.error) {
        return res.status(500).json({
          success: false,
          error: response.error.message || 'Odoo API error',
          odooError: response.error
        });
      }
      
      if (response.result && Array.isArray(response.result) && response.result.length > 0) {
        const mo = response.result[0];
        const moData = {
          found: true,
          mo_number: mo.name,
          sku_name: mo.product_id ? mo.product_id[1] : 'N/A',
          quantity: mo.product_qty || 0,
          uom: mo.product_uom_id ? mo.product_uom_id[1] : '',
          note: mo.note || '',
          create_date: mo.create_date,
          state: mo.state,
          raw_data: mo
        };
        
        // Check if it would pass filters
        const createDate = new Date(mo.create_date);
        const now = new Date();
        const daysOld = (now - createDate) / (1000 * 60 * 60 * 24);
        
        // Check for cartridge with typo tolerance
        const noteText = (mo.note || '').toLowerCase();
        const hasCartridge = noteText.includes('cartridge') || 
                           noteText.includes('cartirdge') || // Common typo
                           noteText.includes('cartrige');    // Another common typo
        
        moData.analysis = {
          create_date_parsed: createDate.toISOString(),
          days_old: daysOld.toFixed(2),
          within_30_days: daysOld <= 30,
          note_contains_cartridge: hasCartridge,
          would_pass_filter: daysOld <= 30 && hasCartridge,
          server_time: now.toISOString()
        };
        
        return res.json(moData);
      } else {
        return res.json({
          found: false,
          message: `MO ${moNumber} not found in Odoo`,
          server_time: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error querying Odoo:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to query Odoo'
      });
    }
  });
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
    query += ' AND created_at::date = $' + (params.length + 1) + '::date';
    params.push(created_at);
  }
  
  // Filter by date range
  if (startDate) {
    query += ' AND created_at::date >= $' + (params.length + 1) + '::date';
    params.push(startDate);
  }
  
  if (endDate) {
    query += ' AND created_at::date <= $' + (params.length + 1) + '::date';
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
          domainFilter = ['|', '|', 
            ['note', 'ilike', 'cartridge'],
            ['note', 'ilike', 'cartirdge'],
            ['note', 'ilike', 'cartrige']
          ];
        } else if (noteFilter === 'liquid') {
          // Use OR condition to catch "TEAM LIQUID" and "liquid" variations
          domainFilter = ['|', 
            ['note', 'ilike', 'TEAM LIQUID'],  // Primary filter: TEAM LIQUID
            ['note', 'ilike', 'liquid']         // Fallback: any note with "liquid"
          ];
        } else if (noteFilter === 'device') {
          domainFilter = ['note', 'ilike', 'device'];
        } else {
          continue;
        }

        const daysBack = 30;
        const now = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysBack);
        const startDateStr = startDate.toISOString().split('T')[0] + ' 00:00:00';

        let combinedDomain;
        if (noteFilter === 'cartridge') {
          combinedDomain = [
            '&',
            '|', '|',
            ['note', 'ilike', 'cartridge'],
            ['note', 'ilike', 'cartirdge'],
            ['note', 'ilike', 'cartrige'],
            ["create_date", ">=", startDateStr]
          ];
        } else if (noteFilter === 'liquid') {
          // Need '&' operator to combine OR condition with date filter
          combinedDomain = [
            '&',  // AND operator
            '|',  // OR for TEAM LIQUID and liquid
            ['note', 'ilike', 'TEAM LIQUID'],
            ['note', 'ilike', 'liquid'],
            ["create_date", ">=", startDateStr]
          ];
        } else {
          // Simple AND (implicit) for device
          combinedDomain = [
            domainFilter,
            ["create_date", ">=", startDateStr]
          ];
        }

        const ODOO_URL = `${config.odooBaseUrl}/web/dataset/call_kw/mrp.production/search_read`;
        const COOKIE_HEADER = `session_id=${config.sessionId}; session_id=${config.sessionId}`;

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

        if (response.result && Array.isArray(response.result)) {
          console.log(`📊 [Scheduler] Received ${response.result.length} MO records from Odoo for ${productionType}`);
          
          const insertPromises = response.result.map((mo) => {
            return new Promise((resolve, reject) => {
              const moCreateDate = mo.create_date || new Date().toISOString();
              const productName = mo.product_id ? mo.product_id[1] : 'N/A';
              const productQty = mo.product_qty || 0;
              const productUom = mo.product_uom_id ? mo.product_uom_id[1] : '';
              const moNote = mo.note || '';
              
              db.run(
                `INSERT INTO odoo_mo_cache 
                 (mo_number, sku_name, quantity, uom, note, create_date, fetched_at, last_updated) 
                 VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                 ON CONFLICT (mo_number) DO UPDATE SET 
                   sku_name = $2, quantity = $3, uom = $4, note = $5, 
                   create_date = $6, last_updated = CURRENT_TIMESTAMP`,
                [
                  mo.name,
                  productName,
                  productQty,
                  productUom,
                  moNote,
                  moCreateDate
                ],
                function(insertErr) {
                  if (insertErr) {
                    reject(insertErr);
                  } else {
                    resolve();
                  }
                }
              );
            });
          });

            await Promise.all(insertPromises);
            totalUpdated += response.result.length;
          console.log(`✅ [Scheduler] Updated ${response.result.length} MO records for ${productionType}`);
        }
      } catch (error) {
        console.error(`❌ [Scheduler] Error updating MO data for ${productionType}:`, error.message);
      }
    }

    console.log(`✅ [Scheduler] MO data update completed. Total updated: ${totalUpdated}`);
  });
}

// Function to send MO list to external API
async function sendMoListToExternalAPI() {
  console.log('📤 [Scheduler] Starting to send MO list for liquid production to external API...');
  
  db.all('SELECT mo_number, sku_name, quantity, uom, note FROM odoo_mo_cache ORDER BY mo_number ASC', [], async (err, rows) => {
      if (err) {
      console.error('❌ [Scheduler] Error fetching MO list:', err);
        return;
      }
      
    if (rows.length === 0) {
      console.log('ℹ️  [Scheduler] No MO data to send');
        return;
      }
      
      const moList = rows.map(row => ({
      mo_number: row.mo_number,
      sku_name: row.sku_name,
      quantity: row.quantity,
      uom: row.uom,
      note: row.note
    }));

    try {
      db.get('SELECT config_value FROM admin_config WHERE config_key = $1', ['external_api_url'], (err2, row2) => {
        if (err2) {
          console.error('❌ [Scheduler] Error fetching external_api_url config:', err2);
          return;
        }
        
        const externalApiUrl = row2 ? row2.config_value : (process.env.EXTERNAL_API_URL || 'https://foom-dash.vercel.app/API');
        
        if (!externalApiUrl || externalApiUrl.trim() === '') {
          console.log('⚠️  [Scheduler] External API URL not configured, skipping send');
          return;
        }
        
        sendToExternalAPIWithUrl({ mo_list: moList }, externalApiUrl)
          .then((result) => {
                if (result.success) {
              console.log(`✅ [Scheduler] Successfully sent MO list (${moList.length} items) to external API`);
                } else {
              console.log(`⚠️  [Scheduler] MO list send skipped: ${result.message}`);
            }
          })
          .catch((error) => {
            console.error(`❌ [Scheduler] Error sending MO list to external API:`, error.message);
          });
    });
  } catch (error) {
      console.error('❌ [Scheduler] Error preparing MO list for external API:', error);
  }
  });
}

// Setup cron jobs
// Update MO data from Odoo every 6 hours
cron.schedule('0 */6 * * *', () => {
  console.log('⏰ [Scheduler] Triggered: Update MO data from Odoo');
  updateMoDataFromOdoo();
});

// Send MO list to external API every 6 hours (after MO data update)
cron.schedule('10 */6 * * *', () => {
  console.log('⏰ [Scheduler] Triggered: Send MO list to external API');
  sendMoListToExternalAPI();
});

console.log('📅 [Scheduler] Cron jobs configured:');
console.log('   - Update MO data from Odoo: Every 6 hours (cron: 0 */6 * * *)');
console.log('   - Send MO list to external API: Every 6 hours (cron: 10 */6 * * *)');

// Initial MO sync on server startup (after 5 seconds delay to ensure DB is ready)
const runInitialSync = () => {
  console.log('\n🔄 [Initial Sync] Starting initial MO sync from Odoo...');
  console.log('   This will run once on server startup to populate MO cache');
  
  setTimeout(() => {
    updateMoDataFromOdoo()
      .then(() => {
        console.log('✅ [Initial Sync] Initial MO sync completed');
      })
      .catch((err) => {
        console.error('❌ [Initial Sync] Initial MO sync failed:', err.message);
        console.error('   You can manually trigger sync using: POST /api/admin/sync-mo');
      });
  }, 5000); // Wait 5 seconds for database to be fully ready
};

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Access at: http://localhost:${PORT}`);
  
  // Run initial sync after server starts
  runInitialSync();
  
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

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  const { db } = require('./database');
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
  const { db } = require('./database');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});