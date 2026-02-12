const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { getAdminConfig } = require('./admin.routes');

// GET /api/odoo/mo-list
// Get MO list from cache (odoo_mo_cache) filtered by production type
// Supports both productionType (from frontend) and production_type (for backward compatibility)
router.get('/mo-list', async (req, res) => {
  try {
    // Support both camelCase (from frontend) and snake_case
    const productionType = req.query.productionType || req.query.production_type;
    
    // Build query to get MO from cache
    let query = `
      SELECT mo_number, sku_name, quantity, uom, note, create_date, fetched_at
      FROM odoo_mo_cache
      WHERE 1=1
    `;
    const params = [];
    
    // Filter by production type based on note field
    if (productionType) {
      const typeLower = productionType.toLowerCase();
      if (typeLower === 'liquid') {
        query += ` AND (note ILIKE $${params.length + 1})`;
        params.push('%liquid%');
      } else if (typeLower === 'device') {
        query += ` AND (note ILIKE $${params.length + 1})`;
        params.push('%device%');
      } else if (typeLower === 'cartridge') {
        query += ` AND (note ILIKE $${params.length + 1} OR note ILIKE $${params.length + 2} OR note ILIKE $${params.length + 3})`;
        params.push('%cartridge%', '%cartirdge%', '%cartrige%');
      }
      // If productionType is 'all' or not specified, return all
    }
    
    query += ` ORDER BY create_date DESC, mo_number ASC LIMIT 1000`;
    
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error('Error fetching MO list from cache:', err);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch MO list from cache: ' + err.message
        });
      }
      
      const moList = rows.map(row => ({
        mo_number: row.mo_number,
        sku_name: row.sku_name || 'N/A',
        quantity: row.quantity || 0,
        uom: row.uom || '',
        note: row.note || '',
        create_date: row.create_date
      }));
      
      res.json({
        success: true,
        count: moList.length,
        data: moList,
        source: 'cache',
        productionType: productionType || 'all'
      });
    });
  } catch (error) {
    console.error('Error in /api/odoo/mo-list:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

module.exports = router;
