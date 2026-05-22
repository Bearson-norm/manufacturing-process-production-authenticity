const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { parseAuthenticityData } = require('../utils/authenticity.utils');

function queryAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function parseAuthenticityNumbersRows(rows) {
  return (rows || []).map((row) => ({
    ...row,
    authenticity_numbers:
      typeof row.authenticity_numbers === 'string'
        ? JSON.parse(row.authenticity_numbers)
        : row.authenticity_numbers
  }));
}

function countAuthenticityNumbers(rows) {
  let count = 0;
  for (const row of rows) {
    if (Array.isArray(row.authenticity_numbers)) {
      count += row.authenticity_numbers.filter(
        (n) => n !== undefined && n !== null && String(n).trim() !== ''
      ).length;
    }
  }
  return count;
}

async function fetchBufferRejectByType(productionType, moNumbers) {
  if (!moNumbers.length) {
    return new Map();
  }

  const bufferTable = `buffer_${productionType}`;
  const rejectTable = `reject_${productionType}`;
  const sql = (table) =>
    `SELECT * FROM ${table} WHERE mo_number = ANY($1::text[]) ORDER BY mo_number, created_at DESC`;

  const [bufferRows, rejectRows] = await Promise.all([
    queryAll(sql(bufferTable), [moNumbers]),
    queryAll(sql(rejectTable), [moNumbers])
  ]);

  const map = new Map();
  for (const mo of moNumbers) {
    map.set(mo, { buffers: [], rejects: [] });
  }

  for (const row of parseAuthenticityNumbersRows(bufferRows)) {
    const entry = map.get(row.mo_number);
    if (entry) entry.buffers.push(row);
  }

  for (const row of parseAuthenticityNumbersRows(rejectRows)) {
    const entry = map.get(row.mo_number);
    if (entry) entry.rejects.push(row);
  }

  return map;
}

// GET /api/reports/manufacturing
router.get('/manufacturing', async (req, res) => {
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
      return res.status(400).json({
        success: false,
        error: 'Invalid production type'
      });
    }

    const allResults = [];

    for (const table of tables) {
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
        query += ` AND mo_number ILIKE $${params.length + 1}`;
        params.push(`%${moNumber}%`);
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

      const rows = await queryAll(query, params);
      allResults.push(...rows.map((row) => parseAuthenticityData(row)));
    }

    allResults.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const moByType = new Map();
    for (const row of allResults) {
      const key = `${row.production_type}::${row.mo_number}`;
      if (!moByType.has(key)) {
        moByType.set(key, { production_type: row.production_type, mo_number: row.mo_number });
      }
    }

    const moNumbersByType = {};
    for (const { production_type, mo_number } of moByType.values()) {
      if (!moNumbersByType[production_type]) {
        moNumbersByType[production_type] = [];
      }
      moNumbersByType[production_type].push(mo_number);
    }

    const bufferRejectLookup = new Map();
    await Promise.all(
      Object.entries(moNumbersByType).map(async ([productionType, moNumbers]) => {
        const uniqueMoNumbers = [...new Set(moNumbers)];
        const typeMap = await fetchBufferRejectByType(productionType, uniqueMoNumbers);
        for (const [mo, data] of typeMap.entries()) {
          bufferRejectLookup.set(`${productionType}::${mo}`, data);
        }
      })
    );

    const enrichedRows = allResults.map((row) => {
      const bufferReject = bufferRejectLookup.get(`${row.production_type}::${row.mo_number}`) || {
        buffers: [],
        rejects: []
      };
      const buffer_count = countAuthenticityNumbers(bufferReject.buffers);
      const reject_count = countAuthenticityNumbers(bufferReject.rejects);

      return {
        ...row,
        buffers: bufferReject.buffers,
        rejects: bufferReject.rejects,
        buffer_count,
        reject_count
      };
    });

    res.json({
      success: true,
      total: enrichedRows.length,
      data: enrichedRows
    });
  } catch (error) {
    console.error('Error in /api/reports/manufacturing:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

module.exports = router;
