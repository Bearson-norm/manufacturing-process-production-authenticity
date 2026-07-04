const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const {
  syncMoFromWms,
  testWmsConnection
} = require('../services/prieds-wms.service');
const { findMatchingRanges, verifyMoQrAgainstProduction } = require('../utils/authenticity-range.utils');

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

const MAX_CARTONS_VERIFY = 500;

async function getAllCartonsWithQrByMo(moNumber) {
  const cartonsResult = await pool.query(
    `SELECT c.*
     FROM wms_repacking_carton c
     WHERE c.manufacturing_order_id = $1
     ORDER BY c.created_time DESC NULLS LAST, c.id DESC
     LIMIT $2`,
    [moNumber, MAX_CARTONS_VERIFY]
  );

  if (cartonsResult.rows.length === 0) {
    return [];
  }

  const cartonIds = cartonsResult.rows.map((r) => r.id);
  const qrResult = await pool.query(
    `SELECT * FROM wms_repacking_qr
     WHERE carton_id = ANY($1::int[])
     ORDER BY carton_id ASC, id ASC`,
    [cartonIds]
  );

  const qrByCarton = qrResult.rows.reduce((acc, qr) => {
    if (!acc[qr.carton_id]) acc[qr.carton_id] = [];
    acc[qr.carton_id].push(qr);
    return acc;
  }, {});

  return cartonsResult.rows.map((row) => ({
    ...row,
    qr_list: qrByCarton[row.id] || []
  }));
}

async function getProductionRowsByMo(moNumber) {
  const result = await pool.query(
    `SELECT id, production_type, session_id, leader_name, shift_number, pic,
            mo_number, sku_name, authenticity_data, status, quantity,
            completed_at, created_at
     FROM production_results
     WHERE mo_number = $1
     ORDER BY created_at DESC`,
    [moNumber]
  );
  return result.rows;
}

async function getWmsSummary(moNumber) {
  const result = await pool.query(
    `SELECT
       COUNT(*)::int AS carton_count,
       COALESCE(MAX(total_carton), 0)::int AS total_carton,
       COALESCE(SUM(qty), 0)::int AS total_qty,
       MAX(sku) AS sku,
       MAX(description) AS description,
       MAX(stock_transfer_order_id) AS sfp,
       MAX(synced_at) AS last_synced_at
     FROM wms_repacking_carton
     WHERE manufacturing_order_id = $1`,
    [moNumber]
  );
  return result.rows[0] || {
    carton_count: 0,
    total_carton: 0,
    total_qty: 0,
    sku: null,
    description: null,
    sfp: null,
    last_synced_at: null
  };
}

function parseOptionalDate(value, endOfDay) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  if (endOfDay) {
    parsed.setHours(23, 59, 59, 999);
  } else {
    parsed.setHours(0, 0, 0, 0);
  }
  return parsed.toISOString();
}

async function buildMoAccuracyReportRow(moNumber, baseRow) {
  const hasWmsData = (baseRow.wms_carton_count || 0) > 0;
  const hasProduction = (baseRow.session_count || 0) > 0;

  let wmsStatus = 'production_only';
  if (hasWmsData && hasProduction) wmsStatus = 'both';
  else if (hasWmsData) wmsStatus = 'wms_only';

  if (!hasWmsData) {
    return {
      mo_number: moNumber,
      session_count: baseRow.session_count,
      first_completed_at: baseRow.first_completed_at,
      last_completed_at: baseRow.last_completed_at,
      sku_name: baseRow.sku_name,
      wms_status: wmsStatus,
      has_wms_data: false,
      wms_carton_count: 0,
      last_synced_at: null,
      total_wms_qty: 0,
      matched_qty: 0,
      failed_qty: 0,
      accuracy_percent: null,
      error_rate_percent: null,
      verify_message: 'Belum sync WMS'
    };
  }

  const [productionRows, cartonsWithQr] = await Promise.all([
    getProductionRowsByMo(moNumber),
    getAllCartonsWithQrByMo(moNumber)
  ]);

  const { summary } = verifyMoQrAgainstProduction(productionRows, cartonsWithQr);

  return {
    mo_number: moNumber,
    session_count: baseRow.session_count,
    first_completed_at: baseRow.first_completed_at,
    last_completed_at: baseRow.last_completed_at,
    sku_name: baseRow.sku_name,
    wms_status: wmsStatus,
    has_wms_data: true,
    wms_carton_count: baseRow.wms_carton_count,
    last_synced_at: baseRow.last_synced_at,
    total_wms_qty: summary.total_wms_qty,
    matched_qty: summary.matched_qty,
    failed_qty: summary.failed_qty,
    accuracy_percent: summary.accuracy_percent,
    error_rate_percent: summary.error_rate_percent,
    verify_message: summary.total_wms_qty === 0 ? summary.message : null
  };
}

async function getLocalSummary(moNumber) {
  const rows = await getProductionRowsByMo(moNumber);
  const byTypeMap = new Map();

  for (const row of rows) {
    const key = row.production_type || 'unknown';
    if (!byTypeMap.has(key)) {
      byTypeMap.set(key, {
        production_type: key,
        session_count: 0,
        sku_name: row.sku_name,
        total_quantity: 0
      });
    }
    const entry = byTypeMap.get(key);
    entry.session_count += 1;
    entry.total_quantity += Number(row.quantity) || 0;
    if (!entry.sku_name && row.sku_name) entry.sku_name = row.sku_name;
  }

  return {
    session_count: rows.length,
    by_type: Array.from(byTypeMap.values()),
    sku_names: [...new Set(rows.map((r) => r.sku_name).filter(Boolean))]
  };
}

// POST /api/wms/sync-mo
router.post('/sync-mo', async (req, res) => {
  try {
    const moNumber = (req.body.mo_number || req.body.moNumber || '').trim();
    if (!moNumber) {
      return res.status(400).json({ success: false, error: 'mo_number is required' });
    }

    const result = await syncMoFromWms(moNumber);
    res.json(result);
  } catch (error) {
    console.error('POST /api/wms/sync-mo:', error);
    res.status(500).json({ success: false, error: error.message || 'Sync failed' });
  }
});

// GET /api/wms/cartons
router.get('/cartons', async (req, res) => {
  try {
    const moNumber = (req.query.mo_number || req.query.moNumber || '').trim();
    if (!moNumber) {
      return res.status(400).json({ success: false, error: 'mo_number is required' });
    }

    const { page, limit, offset } = parsePagination(req.query);

    const countResult = await pool.query(
      'SELECT COUNT(*)::int AS total FROM wms_repacking_carton WHERE manufacturing_order_id = $1',
      [moNumber]
    );
    const total = countResult.rows[0].total;

    const cartonsResult = await pool.query(
      `SELECT * FROM wms_repacking_carton
       WHERE manufacturing_order_id = $1
       ORDER BY created_time DESC NULLS LAST, id DESC
       LIMIT $2 OFFSET $3`,
      [moNumber, limit, offset]
    );

    const cartonIds = cartonsResult.rows.map((r) => r.id);
    let qrByCarton = {};

    if (cartonIds.length > 0) {
      const qrResult = await pool.query(
        `SELECT * FROM wms_repacking_qr
         WHERE carton_id = ANY($1::int[])
         ORDER BY id ASC`,
        [cartonIds]
      );
      qrByCarton = qrResult.rows.reduce((acc, qr) => {
        if (!acc[qr.carton_id]) acc[qr.carton_id] = [];
        acc[qr.carton_id].push(qr);
        return acc;
      }, {});
    }

    const summary = await getWmsSummary(moNumber);

    res.json({
      success: true,
      mo_number: moNumber,
      total,
      page,
      limit,
      summary,
      data: cartonsResult.rows.map((row) => ({
        ...row,
        qr_list: qrByCarton[row.id] || []
      }))
    });
  } catch (error) {
    console.error('GET /api/wms/cartons:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/wms/cartons/:id
router.get('/cartons/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) {
      return res.status(400).json({ success: false, error: 'Invalid carton id' });
    }

    const cartonResult = await pool.query('SELECT * FROM wms_repacking_carton WHERE id = $1', [id]);
    if (cartonResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Carton not found' });
    }

    const qrResult = await pool.query(
      'SELECT * FROM wms_repacking_qr WHERE carton_id = $1 ORDER BY id ASC',
      [id]
    );

    res.json({
      success: true,
      data: {
        ...cartonResult.rows[0],
        qr_list: qrResult.rows
      }
    });
  } catch (error) {
    console.error('GET /api/wms/cartons/:id:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/wms/compare
router.get('/compare', async (req, res) => {
  try {
    const moNumber = (req.query.mo_number || req.query.moNumber || '').trim();
    if (!moNumber) {
      return res.status(400).json({ success: false, error: 'mo_number is required' });
    }

    const wms = await getWmsSummary(moNumber);
    const local = await getLocalSummary(moNumber);

    const hasWms = wms.carton_count > 0;
    const hasLocal = local.session_count > 0;
    let match_status = 'local_only';
    if (hasWms && hasLocal) match_status = 'both';
    else if (hasWms) match_status = 'wms_only';

    const wmsSkuLabel = wms.description || wms.sku || '';
    const localSkuLabel = local.sku_names.join(', ');
    const sku_match = !wmsSkuLabel || !localSkuLabel
      ? null
      : local.sku_names.some((s) =>
          String(s).toLowerCase().includes(String(wmsSkuLabel).toLowerCase()) ||
          String(wmsSkuLabel).toLowerCase().includes(String(s).toLowerCase())
        );

    res.json({
      success: true,
      mo_number: moNumber,
      match_status,
      wms,
      local,
      summary: {
        carton_vs_sessions: `${wms.carton_count} carton vs ${local.session_count} session(s)`,
        sku_match
      }
    });
  } catch (error) {
    console.error('GET /api/wms/compare:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/wms/mo-list
router.get('/mo-list', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const { page, limit, offset } = parsePagination(req.query);

    const params = [];
    let where = 'WHERE 1=1';
    if (search) {
      params.push(`%${search}%`);
      where += ` AND c.manufacturing_order_id ILIKE $${params.length}`;
    }

    const countQuery = `
      SELECT COUNT(DISTINCT c.manufacturing_order_id)::int AS total
      FROM wms_repacking_carton c
      ${where}
    `;
    const countResult = await pool.query(countQuery, params);
    const total = countResult.rows[0].total;

    params.push(limit, offset);
    const listQuery = `
      SELECT
        c.manufacturing_order_id AS mo_number,
        COUNT(*)::int AS carton_count,
        MAX(c.description) AS description,
        MAX(c.sku) AS sku,
        MAX(c.synced_at) AS last_synced_at,
        EXISTS (
          SELECT 1 FROM production_results pr
          WHERE pr.mo_number = c.manufacturing_order_id
        ) AS in_production_results
      FROM wms_repacking_carton c
      ${where}
      GROUP BY c.manufacturing_order_id
      ORDER BY MAX(c.synced_at) DESC NULLS LAST
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const listResult = await pool.query(listQuery, params);

    res.json({
      success: true,
      total,
      page,
      limit,
      data: listResult.rows
    });
  } catch (error) {
    console.error('GET /api/wms/mo-list:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/wms/test-connection
router.post('/test-connection', async (req, res) => {
  try {
    const result = await testWmsConnection(req.body || {});
    res.json(result);
  } catch (error) {
    console.error('POST /api/wms/test-connection:', error);
    res.status(500).json({ success: false, error: error.message || 'Connection failed' });
  }
});

// POST /api/wms/verify-authenticity
router.post('/verify-authenticity', async (req, res) => {
  try {
    const moNumber = (req.body.mo_number || req.body.moNumber || '').trim();
    const authenticityNumber = (req.body.authenticity_number || req.body.authenticityNumber || '').trim();

    if (!moNumber) {
      return res.status(400).json({ success: false, error: 'mo_number is required' });
    }
    if (!authenticityNumber) {
      return res.status(400).json({ success: false, error: 'authenticity_number is required' });
    }

    const productionRows = await getProductionRowsByMo(moNumber);
    const { allRanges, matchedRanges } = findMatchingRanges(productionRows, authenticityNumber);

    res.json({
      success: true,
      mo_number: moNumber,
      authenticity_number: authenticityNumber,
      in_range: matchedRanges.length > 0,
      matched_ranges: matchedRanges,
      all_ranges: allRanges
    });
  } catch (error) {
    console.error('POST /api/wms/verify-authenticity:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/wms/verify-all-qr — bulk verify every QR in every carton vs production_results
router.post('/verify-all-qr', async (req, res) => {
  try {
    const moNumber = (req.body.mo_number || req.body.moNumber || req.query.mo_number || '').trim();
    if (!moNumber) {
      return res.status(400).json({ success: false, error: 'mo_number is required' });
    }

    const [productionRows, cartonsWithQr] = await Promise.all([
      getProductionRowsByMo(moNumber),
      getAllCartonsWithQrByMo(moNumber)
    ]);

    const { summary, cartons, all_ranges } = verifyMoQrAgainstProduction(productionRows, cartonsWithQr);

    res.json({
      success: true,
      mo_number: moNumber,
      summary,
      cartons,
      all_ranges
    });
  } catch (error) {
    console.error('POST /api/wms/verify-all-qr:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/wms/mo-accuracy-report — MO list from production_results with qty-weighted error metrics
router.get('/mo-accuracy-report', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const dateFrom = parseOptionalDate(req.query.date_from || req.query.dateFrom, false);
    const dateTo = parseOptionalDate(req.query.date_to || req.query.dateTo, true);
    const { page, limit, offset } = parsePagination(req.query);

    const params = [];
    const filters = [`pr.mo_number IS NOT NULL`, `TRIM(pr.mo_number) <> ''`];

    if (dateFrom) {
      params.push(dateFrom);
      filters.push(`pr.completed_at >= $${params.length}`);
    }
    if (dateTo) {
      params.push(dateTo);
      filters.push(`pr.completed_at <= $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      filters.push(`pr.mo_number ILIKE $${params.length}`);
    }

    const whereClause = filters.join(' AND ');

    const countResult = await pool.query(
      `SELECT COUNT(DISTINCT pr.mo_number)::int AS total
       FROM production_results pr
       WHERE ${whereClause}`,
      params
    );
    const total = countResult.rows[0].total;

    const listParams = [...params, limit, offset];
    const listResult = await pool.query(
      `SELECT
         pr.mo_number,
         COUNT(DISTINCT pr.id)::int AS session_count,
         MIN(pr.completed_at) AS first_completed_at,
         MAX(pr.completed_at) AS last_completed_at,
         MAX(pr.sku_name) AS sku_name,
         COALESCE(w.carton_count, 0)::int AS wms_carton_count,
         w.last_synced_at
       FROM production_results pr
       LEFT JOIN (
         SELECT manufacturing_order_id,
                COUNT(*)::int AS carton_count,
                MAX(synced_at) AS last_synced_at
         FROM wms_repacking_carton
         GROUP BY manufacturing_order_id
       ) w ON w.manufacturing_order_id = pr.mo_number
       WHERE ${whereClause}
       GROUP BY pr.mo_number, w.carton_count, w.last_synced_at
       ORDER BY MAX(pr.completed_at) DESC NULLS LAST
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );

    const rows = await Promise.all(
      listResult.rows.map((row) => buildMoAccuracyReportRow(row.mo_number, row))
    );

    const withWms = rows.filter((row) => row.has_wms_data).length;
    const measurable = rows.filter((row) => row.total_wms_qty > 0);
    const avgErrorRate = measurable.length > 0
      ? Math.round(
        (measurable.reduce((sum, row) => sum + (row.error_rate_percent || 0), 0) / measurable.length) * 100
      ) / 100
      : null;

    res.json({
      success: true,
      total,
      page,
      limit,
      date_from: dateFrom,
      date_to: dateTo,
      overall: {
        mo_count: rows.length,
        with_wms: withWms,
        avg_error_rate_percent: avgErrorRate
      },
      data: rows
    });
  } catch (error) {
    console.error('GET /api/wms/mo-accuracy-report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
