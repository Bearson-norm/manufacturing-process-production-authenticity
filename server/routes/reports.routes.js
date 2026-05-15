const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { parseAuthenticityData } = require('../utils/authenticity.utils');

// GET /api/reports/manufacturing
router.get('/manufacturing', async (req, res) => {
  const sendJson = (status, body) => {
    if (!res.headersSent) {
      res.status(status).json(body);
    }
  };

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

    if (tables.length === 0) {
      return sendJson(400, {
        success: false,
        error: 'Invalid production type'
      });
    }

    const allResults = [];
    let completedQueries = 0;
    let queryError = null;

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
          queryError = queryError || err;
        } else {
          try {
            const safeRows = Array.isArray(rows) ? rows : [];
            const parsedRows = safeRows.map((row) => parseAuthenticityData(row));
            allResults.push(...parsedRows);
          } catch (parseErr) {
            console.error(`Error parsing rows from ${table.name}:`, parseErr);
            queryError = queryError || parseErr;
          }
        }

        completedQueries++;

        if (completedQueries === tables.length) {
          if (queryError && allResults.length === 0) {
            return sendJson(500, {
              success: false,
              error: queryError.message || 'Database error'
            });
          }
          allResults.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          return sendJson(200, {
            success: true,
            total: allResults.length,
            data: allResults,
            ...(queryError ? { partial: true, warning: 'Some production tables failed to load' } : {})
          });
        }
      });
    });
  } catch (error) {
    console.error('Error in /api/reports/manufacturing:', error);
    sendJson(500, {
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

module.exports = router;
