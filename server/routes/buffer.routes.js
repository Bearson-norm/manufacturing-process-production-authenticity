const express = require('express');
const router = express.Router();
const { db } = require('../database');
const {
  normalizeAuthenticityNumbers,
  normalizeVendorName,
  loadActiveVendorMapDb,
  validateAuthenticityNumbersVendorDigits
} = require('../utils/authenticity.utils');

// Helper function to create buffer endpoints for a type
function createBufferEndpoints(type) {
  const table = `buffer_${type}`;
  
  // GET /api/buffer/:type
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
  
  // POST /api/buffer/:type
  router.post(`/${type}`, (req, res) => {
    const { session_id, pic, mo_number, sku_name, authenticity_numbers, vendor_name } = req.body;
    const normalizedNumbers = normalizeAuthenticityNumbers(authenticity_numbers);
    const vname = normalizeVendorName(vendor_name);

    loadActiveVendorMapDb(db, (mapErr, vendorMap) => {
      if (mapErr) {
        res.status(500).json({ error: mapErr.message });
        return;
      }
      const digitErr = validateAuthenticityNumbersVendorDigits(normalizedNumbers, vname, vendorMap);
      if (digitErr) {
        res.status(400).json({ error: digitErr });
        return;
      }

      db.run(
        `INSERT INTO ${table} (session_id, pic, mo_number, sku_name, authenticity_numbers, vendor_name) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
        [session_id, pic, mo_number, sku_name, JSON.stringify(normalizedNumbers), vname],
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
  });
  
  // POST /api/buffer/:type/batch — all buffer rows for many MO numbers in one query (avoids N parallel connections)
  router.post(`/${type}/batch`, (req, res) => {
    const raw = req.body && req.body.moNumbers;
    if (!Array.isArray(raw)) {
      res.status(400).json({ error: 'moNumbers must be an array' });
      return;
    }
    const unique = [...new Set(raw.map((m) => String(m).trim()).filter(Boolean))];
    if (unique.length === 0) {
      res.json({});
      return;
    }
    if (unique.length > 2000) {
      res.status(400).json({ error: 'Too many moNumbers (max 2000)' });
      return;
    }
    const sql = `SELECT * FROM ${table} WHERE mo_number = ANY($1::text[]) ORDER BY mo_number, created_at DESC`;
    db.all(sql, [unique], (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      const map = Object.fromEntries(unique.map((mo) => [mo, []]));
      for (const row of rows) {
        const parsed = {
          ...row,
          authenticity_numbers:
            typeof row.authenticity_numbers === 'string'
              ? JSON.parse(row.authenticity_numbers)
              : row.authenticity_numbers
        };
        if (map[row.mo_number] !== undefined) {
          map[row.mo_number].push(parsed);
        }
      }
      res.json(map);
    });
  });

  // PUT /api/buffer/:type/:id
  router.put(`/${type}/:id`, (req, res) => {
    const { id } = req.params;
    const { pic, mo_number, sku_name, authenticity_numbers, vendor_name } = req.body;
    const normalizedNumbers = normalizeAuthenticityNumbers(authenticity_numbers);
    const vname = normalizeVendorName(vendor_name);

    loadActiveVendorMapDb(db, (mapErr, vendorMap) => {
      if (mapErr) {
        res.status(500).json({ error: mapErr.message });
        return;
      }
      const digitErr = validateAuthenticityNumbersVendorDigits(normalizedNumbers, vname, vendorMap);
      if (digitErr) {
        res.status(400).json({ error: digitErr });
        return;
      }

      db.run(
        `UPDATE ${table} SET pic = $1, mo_number = $2, sku_name = $3, authenticity_numbers = $4, vendor_name = $5 WHERE id = $6`,
        [pic, mo_number, sku_name, JSON.stringify(normalizedNumbers), vname, id],
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
  });
}

// Create endpoints for all buffer types
createBufferEndpoints('liquid');
createBufferEndpoints('device');
createBufferEndpoints('cartridge');

module.exports = router;
