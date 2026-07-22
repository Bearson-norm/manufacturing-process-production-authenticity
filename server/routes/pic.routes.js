const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { requireRole } = require('../middleware/auth.middleware');

const GENERIC_DB_ERROR = 'Database error';

// GET /api/pic/list — active PICs (production + admin)
router.get('/list', (req, res) => {
  db.all('SELECT * FROM pic_list WHERE is_active = 1 ORDER BY name ASC', (err, rows) => {
    if (err) {
      console.error('Error fetching PIC list:', err);
      return res.status(500).json({ success: false, error: GENERIC_DB_ERROR });
    }
    res.json({ success: true, data: rows });
  });
});

// GET /api/pic/all — admin only
router.get('/all', requireRole('admin'), (req, res) => {
  db.all('SELECT * FROM pic_list ORDER BY name ASC', (err, rows) => {
    if (err) {
      console.error('Error fetching all PIC list:', err);
      return res.status(500).json({ success: false, error: GENERIC_DB_ERROR });
    }
    res.json({ success: true, data: rows });
  });
});

// POST /api/pic/add — admin only
router.post('/add', requireRole('admin'), (req, res) => {
  const { name } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ success: false, error: 'PIC name is required' });
  }

  db.run(
    'INSERT INTO pic_list (name) VALUES ($1)',
    [name.trim()],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE') || err.message.includes('duplicate')) {
          return res.status(400).json({ success: false, error: 'PIC name already exists' });
        }
        console.error('Error adding PIC:', err);
        return res.status(500).json({ success: false, error: GENERIC_DB_ERROR });
      }
      res.json({ success: true, id: this.lastID, message: 'PIC added successfully' });
    }
  );
});

// PUT /api/pic/update/:id — admin only
router.put('/update/:id', requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const { name, is_active } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ success: false, error: 'PIC name is required' });
  }

  db.run(
    'UPDATE pic_list SET name = $1, is_active = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
    [name.trim(), is_active !== undefined ? is_active : 1, id],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE') || err.message.includes('duplicate')) {
          return res.status(400).json({ success: false, error: 'PIC name already exists' });
        }
        console.error('Error updating PIC:', err);
        return res.status(500).json({ success: false, error: GENERIC_DB_ERROR });
      }
      if (this.changes === 0) {
        return res.status(404).json({ success: false, error: 'PIC not found' });
      }
      res.json({ success: true, message: 'PIC updated successfully' });
    }
  );
});

// DELETE /api/pic/delete/:id — admin only
router.delete('/delete/:id', requireRole('admin'), (req, res) => {
  const { id } = req.params;

  db.run(
    'UPDATE pic_list SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
    [id],
    function (err) {
      if (err) {
        console.error('Error deleting PIC:', err);
        return res.status(500).json({ success: false, error: GENERIC_DB_ERROR });
      }
      if (this.changes === 0) {
        return res.status(404).json({ success: false, error: 'PIC not found' });
      }
      res.json({ success: true, message: 'PIC deleted successfully' });
    }
  );
});

module.exports = router;
