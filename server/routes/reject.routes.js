const express = require('express');
const router = express.Router();
const { db } = require('../database');
const {
  normalizeAuthenticityNumbers,
  validateAuthenticityNumbersDigitLength
} = require('../utils/authenticity.utils');

function fetchActiveVendorById(vendor_id, callback) {
  const vid = parseInt(String(vendor_id), 10);
  if (!Number.isFinite(vid)) {
    return callback({ status: 400, message: 'vendor_id wajib dan valid' });
  }
  db.get(
    'SELECT id, name, digit_count FROM authenticity_vendor WHERE id = $1 AND is_active = 1',
    [vid],
    (err, vendor) => {
      if (err) return callback({ status: 500, message: err.message });
      if (!vendor) return callback({ status: 400, message: 'Vendor tidak valid atau tidak aktif' });
      callback(null, vendor);
    }
  );
}

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
      const parsedRows = rows.map((row) => ({
        ...row,
        authenticity_numbers:
          typeof row.authenticity_numbers === 'string'
            ? JSON.parse(row.authenticity_numbers)
            : row.authenticity_numbers
      }));
      res.json(parsedRows);
    });
  });

  // POST /api/reject/:type/batch — all reject rows for many MO numbers in one query
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

  // POST /api/reject/:type
  router.post(`/${type}`, (req, res) => {
    const { session_id, pic, mo_number, sku_name, authenticity_numbers, vendor_id } = req.body;
    fetchActiveVendorById(vendor_id, (e, vendor) => {
      if (e) {
        return res.status(e.status || 400).json({ error: e.message });
      }
      const normalizedNumbers = normalizeAuthenticityNumbers(authenticity_numbers);
      const digitCheck = validateAuthenticityNumbersDigitLength(normalizedNumbers, vendor.digit_count);
      if (!digitCheck.valid) {
        return res.status(400).json({ error: digitCheck.message });
      }

      db.run(
        `INSERT INTO ${table} (session_id, pic, mo_number, sku_name, authenticity_numbers, vendor_id, vendor_name, vendor_digit_count) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          session_id,
          pic,
          mo_number,
          sku_name,
          JSON.stringify(normalizedNumbers),
          vendor.id,
          vendor.name,
          vendor.digit_count
        ],
        function (err) {
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
  });

  // PUT /api/reject/:type/:id
  router.put(`/${type}/:id`, (req, res) => {
    const { id } = req.params;
    const { pic, mo_number, sku_name, authenticity_numbers, vendor_id } = req.body;
    fetchActiveVendorById(vendor_id, (e, vendor) => {
      if (e) {
        return res.status(e.status || 400).json({ error: e.message });
      }
      const normalizedNumbers = normalizeAuthenticityNumbers(authenticity_numbers);
      const digitCheck = validateAuthenticityNumbersDigitLength(normalizedNumbers, vendor.digit_count);
      if (!digitCheck.valid) {
        return res.status(400).json({ error: digitCheck.message });
      }

      db.run(
        `UPDATE ${table} SET pic = $1, mo_number = $2, sku_name = $3, authenticity_numbers = $4, vendor_id = $5, vendor_name = $6, vendor_digit_count = $7 WHERE id = $8`,
        [
          pic,
          mo_number,
          sku_name,
          JSON.stringify(normalizedNumbers),
          vendor.id,
          vendor.name,
          vendor.digit_count,
          id
        ],
        function (err) {
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
  });
}

// Create endpoints for all reject types
createRejectEndpoints('liquid');
createRejectEndpoints('device');
createRejectEndpoints('cartridge');

module.exports = router;
