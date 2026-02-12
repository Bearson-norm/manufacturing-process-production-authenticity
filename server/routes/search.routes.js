const express = require('express');
const router = express.Router();
const { db } = require('../database');

// GET /api/search/mo
router.get('/mo', (req, res) => {
  const { q } = req.query;
  
  if (!q || q.trim() === '') {
    return res.status(400).json({ 
      success: false, 
      error: 'Search query (q) is required' 
    });
  }
  
  const searchTerm = `%${q.trim()}%`;
  
  db.all(
    `SELECT mo_number, sku_name, quantity, uom, note, create_date 
     FROM odoo_mo_cache 
     WHERE mo_number ILIKE $1 OR sku_name ILIKE $1
     ORDER BY mo_number ASC
     LIMIT 50`,
    [searchTerm],
    (err, rows) => {
      if (err) {
        console.error('Error searching MO:', err);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to search MO' 
        });
      }
      
      res.json({
        success: true,
        query: q,
        count: rows.length,
        data: rows
      });
    }
  );
});

module.exports = router;
