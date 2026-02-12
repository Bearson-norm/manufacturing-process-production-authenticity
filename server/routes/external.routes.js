const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { apiKeyAuth } = require('../middleware/auth.middleware');
const { parseAuthenticityData } = require('../utils/authenticity.utils');

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
          `SELECT *, $1 as production_type FROM ${table.name} ORDER BY created_at DESC`,
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

// GET /api/external/authenticity
router.get('/authenticity', apiKeyAuth, async (req, res) => {
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

// POST /api/external/authenticity
router.post('/authenticity', apiKeyAuth, async (req, res) => {
  try {
    const { type, status, start_date, end_date } = req.body || {};
    const data = await fetchProductionData({ type, status, start_date, end_date });
    res.json({ count: data.length, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/external/manufacturing-data
router.get('/manufacturing-data', apiKeyAuth, async (req, res) => {
  try {
    const { mo_number, completed_at } = req.query;
    
    if (!mo_number) {
      return res.status(400).json({ 
        success: false, 
        error: 'MO Number is required' 
      });
    }

    const tables = [
      { name: 'production_liquid', type: 'liquid' },
      { name: 'production_device', type: 'device' },
      { name: 'production_cartridge', type: 'cartridge' }
    ];

    const productionPromises = tables.map(table => {
      return new Promise((resolve, reject) => {
        let query = `SELECT *, '${table.type}' as production_type FROM ${table.name} WHERE mo_number = $1 AND status = 'completed'`;
        const params = [mo_number];
        
        if (completed_at && completed_at !== 'all') {
          query += ` AND completed_at IS NOT NULL AND DATE(completed_at) = DATE($2)`;
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

    const bufferPromises = [
      { name: 'buffer_liquid', type: 'liquid' },
      { name: 'buffer_device', type: 'device' },
      { name: 'buffer_cartridge', type: 'cartridge' }
    ].map(table => {
      return new Promise((resolve, reject) => {
        db.all(
          `SELECT * FROM ${table.name} WHERE mo_number = $1 ORDER BY created_at ASC`,
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

    const rejectPromises = [
      { name: 'reject_liquid', type: 'liquid' },
      { name: 'reject_device', type: 'device' },
      { name: 'reject_cartridge', type: 'cartridge' }
    ].map(table => {
      return new Promise((resolve, reject) => {
        db.all(
          `SELECT * FROM ${table.name} WHERE mo_number = $1 ORDER BY created_at ASC`,
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

// GET /api/external/manufacturing-data/status
router.get('/manufacturing-data/status', apiKeyAuth, async (req, res) => {
  try {
    const { mo_number, completed_at } = req.query;
    
    if (!mo_number) {
      return res.status(400).json({ 
        success: false, 
        error: 'MO Number is required' 
      });
    }

    const tables = [
      { name: 'production_liquid', type: 'liquid' },
      { name: 'production_device', type: 'device' },
      { name: 'production_cartridge', type: 'cartridge' }
    ];

    const activePromises = tables.map(table => {
      return new Promise((resolve, reject) => {
        let query = `SELECT COUNT(*) as count FROM ${table.name} WHERE mo_number = $1 AND status = 'active'`;
        db.get(query, [mo_number], (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(row ? parseInt(row.count) : 0);
        });
      });
    });

    const completedPromises = tables.map(table => {
      return new Promise((resolve, reject) => {
        let query = `SELECT COUNT(*) as count FROM ${table.name} WHERE mo_number = $1 AND status = 'completed'`;
        const params = [mo_number];
        
        if (completed_at && completed_at !== 'all') {
          query += ` AND completed_at IS NOT NULL AND DATE(completed_at) = DATE($2)`;
          params.push(completed_at);
        }
        
        db.get(query, params, (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(row ? parseInt(row.count) : 0);
        });
      });
    });

    const [activeCounts, completedCounts] = await Promise.all([
      Promise.all(activePromises),
      Promise.all(completedPromises)
    ]);

    const totalActive = activeCounts.reduce((sum, count) => sum + count, 0);
    const totalCompleted = completedCounts.reduce((sum, count) => sum + count, 0);

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

// GET /api/external/manufacturing-data/by-date
router.get('/manufacturing-data/by-date', apiKeyAuth, async (req, res) => {
  try {
    const { completed_at } = req.query;
    
    if (!completed_at) {
      return res.status(400).json({ 
        success: false, 
        error: 'completed_at parameter is required. Format: YYYY-MM-DD' 
      });
    }

    const tables = [
      { name: 'production_liquid', type: 'liquid' },
      { name: 'production_device', type: 'device' },
      { name: 'production_cartridge', type: 'cartridge' }
    ];

    const productionPromises = tables.map(table => {
      return new Promise((resolve, reject) => {
        db.all(
          `SELECT DISTINCT mo_number, '${table.type}' as production_type 
           FROM ${table.name} 
           WHERE status = 'completed' 
           AND completed_at IS NOT NULL 
           AND DATE(completed_at) = DATE($1)
           ORDER BY mo_number ASC`,
          [completed_at],
          (err, rows) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(rows);
          }
        );
      });
    });

    const results = await Promise.all(productionPromises);
    const allMOs = results.flat();
    
    // Get unique MO numbers
    const uniqueMOs = [...new Set(allMOs.map(r => r.mo_number))];

    res.json({
      success: true,
      completed_at: completed_at,
      total_mos: uniqueMOs.length,
      mo_numbers: uniqueMOs.sort()
    });

  } catch (error) {
    console.error('Error fetching MOs by date:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// GET /api/external/manufacturing-report/simple
router.get('/manufacturing-report/simple', apiKeyAuth, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    if (!start_date || !end_date) {
      return res.status(400).json({ 
        success: false, 
        error: 'start_date and end_date parameters are required. Format: YYYY-MM-DD' 
      });
    }

    const tables = [
      { name: 'production_liquid', type: 'liquid' },
      { name: 'production_device', type: 'device' },
      { name: 'production_cartridge', type: 'cartridge' }
    ];

    const productionPromises = tables.map(table => {
      return new Promise((resolve, reject) => {
        db.all(
          `SELECT 
            mo_number,
            sku_name,
            pic,
            leader_name,
            shift_number,
            session_id,
            '${table.type}' as production_type,
            completed_at
           FROM ${table.name} 
           WHERE status = 'completed' 
           AND completed_at IS NOT NULL 
           AND DATE(completed_at) >= DATE($1)
           AND DATE(completed_at) <= DATE($2)
           ORDER BY completed_at ASC`,
          [start_date, end_date],
          (err, rows) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(rows);
          }
        );
      });
    });

    const results = await Promise.all(productionPromises);
    const allData = results.flat();

    res.json({
      success: true,
      start_date: start_date,
      end_date: end_date,
      total_records: allData.length,
      data: allData
    });

  } catch (error) {
    console.error('Error fetching manufacturing report:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

module.exports = router;
