const express = require('express');
const router = express.Router();
const { db } = require('../database');

// GET /api/statistics/production-by-leader
router.get('/production-by-leader', (req, res) => {
  const { startDate, endDate, leader } = req.query;
  
  let query = `
    SELECT 
      leader_name,
      COUNT(*) as total_inputs,
      COUNT(DISTINCT mo_number) as unique_mos,
      COUNT(DISTINCT session_id) as unique_sessions,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_inputs,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_inputs
    FROM (
      SELECT leader_name, mo_number, session_id, status FROM production_liquid
      UNION ALL
      SELECT leader_name, mo_number, session_id, status FROM production_device
      UNION ALL
      SELECT leader_name, mo_number, session_id, status FROM production_cartridge
    ) as combined
    WHERE 1=1
  `;
  
  const params = [];
  
  if (startDate) {
    query += ` AND created_at >= $${params.length + 1}`;
    params.push(startDate);
  }
  
  if (endDate) {
    query += ` AND created_at <= $${params.length + 1}`;
    params.push(endDate);
  }
  
  if (leader) {
    query += ` AND leader_name = $${params.length + 1}`;
    params.push(leader);
  }
  
  query += ' GROUP BY leader_name ORDER BY total_inputs DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error fetching production statistics:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
    
    res.json({
      success: true,
      data: rows
    });
  });
});

// GET /api/statistics/leaders
router.get('/leaders', (req, res) => {
  db.all(`
    SELECT DISTINCT leader_name 
    FROM (
      SELECT leader_name FROM production_liquid
      UNION
      SELECT leader_name FROM production_device
      UNION
      SELECT leader_name FROM production_cartridge
    ) as combined
    ORDER BY leader_name ASC
  `, [], (err, rows) => {
    if (err) {
      console.error('Error fetching leaders:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
    
    res.json({
      success: true,
      data: rows.map(r => r.leader_name)
    });
  });
});

module.exports = router;
