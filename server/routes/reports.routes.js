const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { parseAuthenticityData } = require('../utils/authenticity.utils');

// GET /api/reports/manufacturing
router.get('/manufacturing', async (req, res) => {
  try {
    const { type, startDate, endDate, moNumber } = req.query;
    
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
    
    tables.forEach((table) => {
      let query = `
        SELECT 
          id,
          session_id,
          leader_name,
          shift_number,
          pic,
          mo_number,
          sku_name,
          authenticity_data,
          status,
          created_at,
          completed_at,
          '${table.type}' as production_type
        FROM ${table.name}
        WHERE 1=1
      `;
      
      const params = [];
      
      if (moNumber) {
        query += ` AND mo_number = $${params.length + 1}`;
        params.push(moNumber);
      }
      
      if (startDate) {
        query += ` AND DATE(created_at) >= $${params.length + 1}`;
        params.push(startDate);
      }
      
      if (endDate) {
        query += ` AND DATE(created_at) <= $${params.length + 1}`;
        params.push(endDate);
      }
      
      query += ' ORDER BY created_at DESC';
      
      db.all(query, params, (err, rows) => {
        if (err) {
          console.error(`Error querying ${table.name}:`, err);
        } else {
          const parsedRows = rows.map(row => parseAuthenticityData(row));
          allResults.push(...parsedRows);
        }
        
        completedQueries++;
        
        if (completedQueries === tables.length) {
          // Sort by created_at descending
          allResults.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          
          res.json({
            success: true,
            total: allResults.length,
            data: allResults
          });
        }
      });
    });
    
    if (tables.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Invalid production type'
      });
    }
  } catch (error) {
    console.error('Error in /api/reports/manufacturing:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

module.exports = router;
