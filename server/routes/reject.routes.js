const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { normalizeAuthenticityNumbers } = require('../utils/authenticity.utils');

// Helper function to create reject endpoints for a type
function createRejectEndpoints(type) {
  const table = `reject_${type}`;
  
  // GET /api/reject/:type
  router.get(`/${type}`, (req, res) => {
    const { moNumber } = req.query;
    if (!moNumber) {
      res.status(400).json({ error: 'MO Number is required' });
      return;
    }
    db.all(`SELECT * FROM ${table} WHERE mo_number = $1 ORDER BY created_at DESC`, [moNumber], (err, rows) => {
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
  
  // POST /api/reject/:type
  router.post(`/${type}`, (req, res) => {
    const { session_id, pic, mo_number, sku_name, authenticity_numbers } = req.body;
    const normalizedNumbers = normalizeAuthenticityNumbers(authenticity_numbers);
    
    db.run(
      `INSERT INTO ${table} (session_id, pic, mo_number, sku_name, authenticity_numbers) 
       VALUES ($1, $2, $3, $4, $5)`,
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
  
  // PUT /api/reject/:type/:id
  router.put(`/${type}/:id`, (req, res) => {
    const { id } = req.params;
    const { pic, mo_number, sku_name, authenticity_numbers } = req.body;
    const normalizedNumbers = normalizeAuthenticityNumbers(authenticity_numbers);
    
    db.run(
      `UPDATE ${table} SET pic = $1, mo_number = $2, sku_name = $3, authenticity_numbers = $4 WHERE id = $5`,
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
}

// Create endpoints for all reject types
createRejectEndpoints('liquid');
createRejectEndpoints('device');
createRejectEndpoints('cartridge');

module.exports = router;
