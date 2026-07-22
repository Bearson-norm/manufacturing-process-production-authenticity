const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { requireRole } = require('../middleware/auth.middleware');

const GENERIC_DB_ERROR = 'Database error';

// GET /api/authenticity-vendors — active only (production dropdown)
router.get('/', (req, res) => {
  db.all(
    `SELECT id, name, digit_count, is_active, created_at, updated_at
     FROM authenticity_vendor
     WHERE is_active = 1
     ORDER BY name ASC`,
    [],
    (err, rows) => {
      if (err) {
        console.error('Error fetching authenticity vendors:', err);
        return res.status(500).json({ success: false, error: GENERIC_DB_ERROR });
      }
      res.json({ success: true, data: rows });
    }
  );
});

// GET /api/authenticity-vendors/all — admin list
router.get('/all', requireRole('admin'), (req, res) => {
  db.all(
    `SELECT id, name, digit_count, is_active, created_at, updated_at
     FROM authenticity_vendor
     ORDER BY name ASC`,
    [],
    (err, rows) => {
      if (err) {
        console.error('Error fetching all authenticity vendors:', err);
        return res.status(500).json({ success: false, error: GENERIC_DB_ERROR });
      }
      res.json({ success: true, data: rows });
    }
  );
});

// POST /api/authenticity-vendors — admin only
router.post('/', requireRole('admin'), (req, res) => {
  const { name, digit_count, is_active } = req.body;
  const trimmed = name != null ? String(name).trim() : '';
  if (!trimmed) {
    return res.status(400).json({ success: false, error: 'Nama vendor wajib diisi' });
  }
  const dc = parseInt(String(digit_count), 10);
  if (Number.isNaN(dc) || dc < 1) {
    return res.status(400).json({ success: false, error: 'digit_count harus bilangan bulat positif' });
  }
  const active = is_active === undefined || is_active === null ? 1 : (is_active ? 1 : 0);

  db.run(
    `INSERT INTO authenticity_vendor (name, digit_count, is_active)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [trimmed, dc, active],
    function (insertErr) {
      if (insertErr) {
        if (insertErr.message && (insertErr.message.includes('UNIQUE') || insertErr.message.includes('duplicate'))) {
          return res.status(400).json({ success: false, error: 'Nama vendor sudah ada' });
        }
        console.error('Error adding authenticity vendor:', insertErr);
        return res.status(500).json({ success: false, error: GENERIC_DB_ERROR });
      }
      res.json({ success: true, id: this.lastID, message: 'Vendor berhasil ditambahkan' });
    }
  );
});

// PUT /api/authenticity-vendors/:id — admin only
router.put('/:id', requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const { name, digit_count, is_active } = req.body;
  const trimmed = name != null ? String(name).trim() : '';
  if (!trimmed) {
    return res.status(400).json({ success: false, error: 'Nama vendor wajib diisi' });
  }
  const dc = parseInt(String(digit_count), 10);
  if (Number.isNaN(dc) || dc < 1) {
    return res.status(400).json({ success: false, error: 'digit_count harus bilangan bulat positif' });
  }
  const active = is_active === undefined || is_active === null ? 1 : (is_active ? 1 : 0);

  db.run(
    `UPDATE authenticity_vendor
     SET name = $1, digit_count = $2, is_active = $3, updated_at = CURRENT_TIMESTAMP
     WHERE id = $4`,
    [trimmed, dc, active, id],
    function (updateErr) {
      if (updateErr) {
        if (updateErr.message && (updateErr.message.includes('UNIQUE') || updateErr.message.includes('duplicate'))) {
          return res.status(400).json({ success: false, error: 'Nama vendor sudah ada' });
        }
        console.error('Error updating authenticity vendor:', updateErr);
        return res.status(500).json({ success: false, error: GENERIC_DB_ERROR });
      }
      if (this.changes === 0) {
        return res.status(404).json({ success: false, error: 'Vendor tidak ditemukan' });
      }
      res.json({ success: true, message: 'Vendor berhasil diperbarui' });
    }
  );
});

// DELETE /api/authenticity-vendors/:id — soft delete (admin only)
router.delete('/:id', requireRole('admin'), (req, res) => {
  const { id } = req.params;
  db.run(
    `UPDATE authenticity_vendor SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [id],
    function (updateErr) {
      if (updateErr) {
        console.error('Error deleting authenticity vendor:', updateErr);
        return res.status(500).json({ success: false, error: GENERIC_DB_ERROR });
      }
      if (this.changes === 0) {
        return res.status(404).json({ success: false, error: 'Vendor tidak ditemukan' });
      }
      res.json({ success: true, message: 'Vendor dinonaktifkan' });
    }
  );
});

module.exports = router;
