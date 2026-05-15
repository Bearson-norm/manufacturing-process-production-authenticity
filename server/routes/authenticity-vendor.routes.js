const express = require('express');
const router = express.Router();
const { db } = require('../database');

// GET /api/authenticity-vendors/list — active vendors for production dropdowns
router.get('/list', (req, res) => {
  db.all(
    'SELECT id, name, digit_count FROM authenticity_vendor WHERE is_active = 1 ORDER BY name ASC',
    [],
    (err, rows) => {
      if (err) {
        console.error('Error fetching authenticity vendors:', err);
        return res.status(500).json({ success: false, error: err.message });
      }
      res.json({ success: true, data: rows || [] });
    }
  );
});

// GET /api/authenticity-vendors/all — admin (include inactive)
router.get('/all', (req, res) => {
  db.all(
    'SELECT * FROM authenticity_vendor ORDER BY name ASC',
    [],
    (err, rows) => {
      if (err) {
        console.error('Error fetching all authenticity vendors:', err);
        return res.status(500).json({ success: false, error: err.message });
      }
      res.json({ success: true, data: rows || [] });
    }
  );
});

router.post('/add', (req, res) => {
  const { name, digit_count } = req.body;
  if (!name || String(name).trim() === '') {
    return res.status(400).json({ success: false, error: 'Nama vendor wajib diisi' });
  }
  const dc = parseInt(String(digit_count), 10);
  if (!Number.isFinite(dc) || dc < 1 || dc > 64) {
    return res.status(400).json({ success: false, error: 'digit_count harus antara 1 dan 64' });
  }

  db.run(
    'INSERT INTO authenticity_vendor (name, digit_count) VALUES ($1, $2)',
    [String(name).trim(), dc],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE') || err.message.includes('duplicate')) {
          return res.status(400).json({ success: false, error: 'Nama vendor sudah ada' });
        }
        console.error('Error adding vendor:', err);
        return res.status(500).json({ success: false, error: err.message });
      }
      res.json({ success: true, id: this.lastID, message: 'Vendor berhasil ditambahkan' });
    }
  );
});

router.put('/update/:id', (req, res) => {
  const { id } = req.params;
  const { name, digit_count, is_active } = req.body;
  if (!name || String(name).trim() === '') {
    return res.status(400).json({ success: false, error: 'Nama vendor wajib diisi' });
  }
  const dc = parseInt(String(digit_count), 10);
  if (!Number.isFinite(dc) || dc < 1 || dc > 64) {
    return res.status(400).json({ success: false, error: 'digit_count harus antara 1 dan 64' });
  }
  const active = is_active !== undefined && is_active !== null ? (parseInt(String(is_active), 10) ? 1 : 0) : 1;

  db.run(
    'UPDATE authenticity_vendor SET name = $1, digit_count = $2, is_active = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
    [String(name).trim(), dc, active, id],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE') || err.message.includes('duplicate')) {
          return res.status(400).json({ success: false, error: 'Nama vendor sudah ada' });
        }
        console.error('Error updating vendor:', err);
        return res.status(500).json({ success: false, error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ success: false, error: 'Vendor tidak ditemukan' });
      }
      res.json({ success: true, message: 'Vendor berhasil diperbarui' });
    }
  );
});

router.delete('/delete/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM authenticity_vendor WHERE id = $1', [id], function (err) {
    if (err) {
      console.error('Error deleting vendor:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ success: false, error: 'Vendor tidak ditemukan' });
    }
    res.json({ success: true, message: 'Vendor dihapus' });
  });
});

module.exports = router;
