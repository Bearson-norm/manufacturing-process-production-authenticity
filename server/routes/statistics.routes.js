const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { resolveProductionQuantity } = require('../utils/authenticity.utils');

const VALID_PERIODS = ['week', 'four_weeks', 'month', 'three_months'];
const VALID_TYPES = ['liquid', 'device', 'cartridge'];

const PERIOD_CONFIG = {
  week: { interval: '56 days', buckets: 8 },
  four_weeks: { interval: '168 days', buckets: 6 },
  month: { interval: '12 months', buckets: 12 },
  three_months: { interval: '24 months', buckets: 8 }
};

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

function toDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function formatDateYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Monday (local) of the week containing `date`. */
function startOfWeekMonday(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfQuarter(date) {
  const qMonth = Math.floor(date.getMonth() / 3) * 3;
  return new Date(date.getFullYear(), qMonth, 1);
}

/**
 * four_weeks buckets are aligned to the Monday of the lookback window start,
 * then stepped every 28 days.
 */
function getFourWeekAnchor(now) {
  const lookbackStart = new Date(now);
  lookbackStart.setDate(lookbackStart.getDate() - 168);
  return startOfWeekMonday(lookbackStart);
}

function getPeriodKey(date, period, fourWeekAnchor) {
  if (period === 'week') {
    return formatDateYMD(startOfWeekMonday(date));
  }
  if (period === 'four_weeks') {
    const monday = startOfWeekMonday(date);
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysFromAnchor = Math.floor((monday - fourWeekAnchor) / msPerDay);
    const bucketIndex = Math.floor(daysFromAnchor / 28);
    const bucketStart = new Date(fourWeekAnchor);
    bucketStart.setDate(bucketStart.getDate() + bucketIndex * 28);
    return formatDateYMD(bucketStart);
  }
  if (period === 'month') {
    const m = startOfMonth(date);
    return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
  }
  // three_months — calendar quarter
  const q = startOfQuarter(date);
  const qNum = Math.floor(q.getMonth() / 3) + 1;
  return `${q.getFullYear()}-Q${qNum}`;
}

// GET /api/statistics/production-by-leader
router.get('/production-by-leader', async (req, res) => {
  try {
    let { period = 'week', productionType } = req.query;

    if (!VALID_PERIODS.includes(period)) {
      return res.status(400).json({
        success: false,
        error: `Invalid period. Use: ${VALID_PERIODS.join(', ')}`
      });
    }

    const tables = [];
    if (!productionType || productionType === 'all') {
      VALID_TYPES.forEach((type) => {
        tables.push({ name: `production_${type}`, type });
      });
    } else if (VALID_TYPES.includes(productionType)) {
      tables.push({ name: `production_${productionType}`, type: productionType });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid production type'
      });
    }

    const config = PERIOD_CONFIG[period];
    const now = new Date();
    const fourWeekAnchor = getFourWeekAnchor(now);

    const allRows = [];
    for (const table of tables) {
      const query = `
        SELECT
          leader_name,
          session_id,
          mo_number,
          authenticity_data,
          created_at,
          '${table.type}' AS production_type
        FROM ${table.name}
        WHERE created_at >= NOW() - INTERVAL '${config.interval}'
        ORDER BY created_at ASC
      `;
      const rows = await queryAll(query, []);
      allRows.push(...rows);
    }

    const moByType = new Map();
    for (const row of allRows) {
      if (!row.mo_number) continue;
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
      Object.entries(moNumbersByType).map(async ([type, moNumbers]) => {
        const uniqueMoNumbers = [...new Set(moNumbers)];
        const typeMap = await fetchBufferRejectByType(type, uniqueMoNumbers);
        for (const [mo, data] of typeMap.entries()) {
          bufferRejectLookup.set(`${type}::${mo}`, data);
        }
      })
    );

    // Aggregate per (periodKey, leader, type)
    const aggregates = new Map();

    for (const row of allRows) {
      const created = toDate(row.created_at);
      if (!created) continue;

      const periodKey = getPeriodKey(created, period, fourWeekAnchor);
      const leaderName = row.leader_name || 'Unknown';
      const prodType = row.production_type;
      const aggKey = `${periodKey}::${leaderName}::${prodType}`;

      if (!aggregates.has(aggKey)) {
        aggregates.set(aggKey, {
          period: periodKey,
          leader_name: leaderName,
          production_type: prodType,
          session_ids: new Set(),
          counted_mos: new Set(),
          input_count: 0,
          production_qty: 0,
          buffer_count: 0,
          reject_count: 0
        });
      }

      const agg = aggregates.get(aggKey);
      agg.input_count += 1;
      if (row.session_id) agg.session_ids.add(row.session_id);

      agg.production_qty += resolveProductionQuantity(row);

      // Buffer/reject are MO-scoped — count once per MO inside this bucket
      if (row.mo_number && !agg.counted_mos.has(row.mo_number)) {
        agg.counted_mos.add(row.mo_number);
        const bufferReject = bufferRejectLookup.get(`${prodType}::${row.mo_number}`) || {
          buffers: [],
          rejects: []
        };
        agg.buffer_count += countAuthenticityNumbers(bufferReject.buffers);
        agg.reject_count += countAuthenticityNumbers(bufferReject.rejects);
      }
    }

    const data = Array.from(aggregates.values())
      .map((agg) => ({
        period: agg.period,
        leader_name: agg.leader_name,
        production_type: agg.production_type,
        session_count: agg.session_ids.size,
        input_count: agg.input_count,
        production_qty: agg.production_qty,
        buffer_count: agg.buffer_count,
        reject_count: agg.reject_count,
        net_production: agg.production_qty - agg.reject_count + agg.buffer_count
      }))
      .sort((a, b) => {
        if (a.period !== b.period) return a.period < b.period ? -1 : 1;
        if (a.production_type !== b.production_type) {
          return a.production_type.localeCompare(b.production_type);
        }
        return a.leader_name.localeCompare(b.leader_name);
      });

    res.json({
      success: true,
      period,
      data
    });
  } catch (error) {
    console.error('Error fetching production statistics:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// GET /api/statistics/leaders
router.get('/leaders', (req, res) => {
  db.all(
    `
    SELECT DISTINCT leader_name
    FROM (
      SELECT leader_name FROM production_liquid
      UNION
      SELECT leader_name FROM production_device
      UNION
      SELECT leader_name FROM production_cartridge
    ) as combined
    WHERE leader_name IS NOT NULL AND TRIM(leader_name) <> ''
    ORDER BY leader_name ASC
  `,
    [],
    (err, rows) => {
      if (err) {
        console.error('Error fetching leaders:', err);
        return res.status(500).json({ success: false, error: err.message });
      }

      res.json({
        success: true,
        data: rows.map((r) => r.leader_name)
      });
    }
  );
});

module.exports = router;
