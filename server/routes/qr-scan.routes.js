const express = require('express');
const { pool } = require('../database');
const { buildActiveVendorMapByLowerName } = require('../utils/authenticity.utils');
const {
  normalizeQrScanBarcode,
  resolveVendorForBarcode,
  parseSessionNumberParam,
  validateClientScanId,
  normalizePicName,
  assertActivePic,
} = require('../utils/qr-scan.utils');

const router = express.Router();

const DEFAULT_PRODUCTION_TYPE = 'cartridge';
const GENERIC_DB_ERROR = 'Database error';

async function loadActiveVendorMap(client) {
  const result = await client.query(
    'SELECT name, digit_count FROM authenticity_vendor WHERE is_active = 1'
  );
  return buildActiveVendorMapByLowerName(result.rows);
}

async function countSessionItems(client, sessionId) {
  const result = await client.query(
    'SELECT COUNT(*)::int AS qty FROM qr_scan_item WHERE session_id = $1',
    [sessionId]
  );
  return result.rows[0]?.qty ?? 0;
}

async function findExistingSessionNumberForBarcode(client, productionType, barcode) {
  const result = await client.query(
    `SELECT s.session_number
     FROM qr_scan_item i
     INNER JOIN qr_scan_session s ON s.id = i.session_id
     WHERE i.production_type = $1 AND i.barcode = $2
     LIMIT 1`,
    [productionType, barcode]
  );
  return result.rows[0]?.session_number ?? null;
}

// GET /api/qr-scan/sessions
router.get('/sessions', async (req, res) => {
  const productionType = String(req.query.production_type || DEFAULT_PRODUCTION_TYPE).trim();
  const statusFilter = req.query.status
    ? String(req.query.status).trim().toLowerCase()
    : null;

  if (statusFilter && statusFilter !== 'ongoing' && statusFilter !== 'finished') {
    return res.status(400).json({ error: 'status harus ongoing atau finished' });
  }

  try {
    const params = [productionType];
    let statusClause = '';
    if (statusFilter) {
      statusClause = ' AND s.status = $2';
      params.push(statusFilter);
    }

    const result = await pool.query(
      `SELECT
         s.session_number,
         s.pic,
         s.status,
         s.created_at,
         s.finished_at,
         COALESCE(COUNT(i.id), 0)::int AS qty
       FROM qr_scan_session s
       LEFT JOIN qr_scan_item i ON i.session_id = s.id
       WHERE s.production_type = $1${statusClause}
       GROUP BY s.id
       ORDER BY s.created_at DESC`,
      params
    );

    res.json({
      sessions: result.rows.map((row) => ({
        session_number: row.session_number,
        pic: row.pic,
        status: row.status,
        qty: row.qty,
        created_at: row.created_at,
        finished_at: row.finished_at,
      })),
    });
  } catch (err) {
    console.error('qr-scan GET /sessions:', err);
    res.status(500).json({ error: GENERIC_DB_ERROR });
  }
});

// POST /api/qr-scan/sessions
router.post('/sessions', async (req, res) => {
  const picResult = normalizePicName(req.body?.pic);
  if (!picResult.ok) {
    return res.status(400).json({ error: picResult.error, code: picResult.code });
  }

  const productionType = String(req.body?.production_type || DEFAULT_PRODUCTION_TYPE).trim();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const picCheck = await assertActivePic(client, picResult.pic);
    if (!picCheck.ok) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: picCheck.error, code: picCheck.code });
    }

    const insert = await client.query(
      `INSERT INTO qr_scan_session (pic, production_type)
       VALUES ($1, $2)
       RETURNING session_number, pic, status, created_at`,
      [picCheck.pic, productionType]
    );
    await client.query('COMMIT');

    const row = insert.rows[0];
    res.status(201).json({
      session_number: row.session_number,
      pic: row.pic,
      status: row.status,
      created_at: row.created_at,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('qr-scan POST /sessions:', err);
    res.status(500).json({ error: GENERIC_DB_ERROR });
  } finally {
    client.release();
  }
});

// GET /api/qr-scan/sessions/:sessionNumber
router.get('/sessions/:sessionNumber', async (req, res) => {
  const parsed = parseSessionNumberParam(req.params.sessionNumber);
  if (!parsed.ok) {
    return res.status(400).json({ error: parsed.error });
  }

  let limit = Number.parseInt(req.query.limit, 10);
  if (Number.isNaN(limit) || limit <= 0) limit = 50;
  if (limit > 200) limit = 200;

  let offset = Number.parseInt(req.query.offset, 10);
  if (Number.isNaN(offset) || offset < 0) offset = 0;

  try {
    const sessionResult = await pool.query(
      `SELECT id, session_number, pic, status, created_at, finished_at, production_type
       FROM qr_scan_session
       WHERE session_number = $1`,
      [parsed.sessionNumber]
    );
    if (sessionResult.rowCount === 0) {
      return res.status(404).json({ error: 'Sesi tidak ditemukan', code: 'SESSION_NOT_FOUND' });
    }
    const session = sessionResult.rows[0];

    const countResult = await pool.query(
      'SELECT COUNT(*)::int AS total FROM qr_scan_item WHERE session_id = $1',
      [session.id]
    );
    const itemsTotal = countResult.rows[0]?.total ?? 0;

    const itemsResult = await pool.query(
      `SELECT barcode FROM qr_scan_item
       WHERE session_id = $1
       ORDER BY scanned_at DESC, id DESC
       LIMIT $2 OFFSET $3`,
      [session.id, limit, offset]
    );

    res.json({
      session_number: session.session_number,
      pic: session.pic,
      status: session.status,
      qty: itemsTotal,
      created_at: session.created_at,
      finished_at: session.finished_at,
      items: itemsResult.rows.map((r) => r.barcode),
      items_total: itemsTotal,
      limit,
      offset,
    });
  } catch (err) {
    console.error('qr-scan GET /sessions/:sessionNumber:', err);
    res.status(500).json({ error: GENERIC_DB_ERROR });
  }
});

// POST /api/qr-scan/sessions/:sessionNumber/scans
router.post('/sessions/:sessionNumber/scans', async (req, res) => {
  const parsed = parseSessionNumberParam(req.params.sessionNumber);
  if (!parsed.ok) {
    return res.status(400).json({ error: parsed.error });
  }

  const barcodeResult = normalizeQrScanBarcode(req.body?.barcode);
  if (!barcodeResult.ok) {
    return res.status(400).json({ error: barcodeResult.error, code: barcodeResult.code });
  }

  const clientScanResult = validateClientScanId(req.body?.client_scan_id);
  if (!clientScanResult.ok) {
    return res.status(400).json({ error: clientScanResult.error, code: clientScanResult.code });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const sessionResult = await client.query(
      `SELECT id, status, production_type
       FROM qr_scan_session
       WHERE session_number = $1
       FOR UPDATE`,
      [parsed.sessionNumber]
    );
    if (sessionResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Sesi tidak ditemukan', code: 'SESSION_NOT_FOUND' });
    }
    const session = sessionResult.rows[0];

    if (session.status === 'finished') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Sesi sudah selesai', code: 'SESSION_FINISHED' });
    }

    const vendorMap = await loadActiveVendorMap(client);
    const vendorResult = resolveVendorForBarcode(barcodeResult.barcode, vendorMap);
    if (!vendorResult.ok) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: vendorResult.error, code: vendorResult.code });
    }

    if (clientScanResult.clientScanId) {
      const existing = await client.query(
        `SELECT barcode FROM qr_scan_item
         WHERE session_id = $1 AND client_scan_id = $2`,
        [session.id, clientScanResult.clientScanId]
      );
      if (existing.rowCount > 0) {
        const qty = await countSessionItems(client, session.id);
        await client.query('COMMIT');
        return res.status(200).json({
          barcode: existing.rows[0].barcode,
          qty,
          idempotent: true,
        });
      }
    }

    try {
      await client.query(
        `INSERT INTO qr_scan_item (session_id, production_type, barcode, client_scan_id)
         VALUES ($1, $2, $3, $4)`,
        [
          session.id,
          session.production_type,
          barcodeResult.barcode,
          clientScanResult.clientScanId,
        ]
      );
    } catch (insertErr) {
      if (insertErr.code === '23505') {
        await client.query('ROLLBACK');
        const existingSessionNumber = await findExistingSessionNumberForBarcode(
          client,
          session.production_type,
          barcodeResult.barcode
        );
        return res.status(409).json({
          error: 'Barcode sudah terdaftar di sistem Input QR Cartridge',
          code: 'BARCODE_ALREADY_USED',
          existing_session_number: existingSessionNumber,
        });
      }
      throw insertErr;
    }

    const qty = await countSessionItems(client, session.id);
    await client.query('COMMIT');
    res.status(201).json({ barcode: barcodeResult.barcode, qty });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('qr-scan POST /sessions/:sessionNumber/scans:', err);
    res.status(500).json({ error: GENERIC_DB_ERROR });
  } finally {
    client.release();
  }
});

// PATCH /api/qr-scan/sessions/:sessionNumber/finish
router.patch('/sessions/:sessionNumber/finish', async (req, res) => {
  const parsed = parseSessionNumberParam(req.params.sessionNumber);
  if (!parsed.ok) {
    return res.status(400).json({ error: parsed.error });
  }

  try {
    const result = await pool.query(
      `UPDATE qr_scan_session
       SET status = 'finished', finished_at = NOW()
       WHERE session_number = $1 AND status = 'ongoing'
       RETURNING session_number, pic, status, created_at, finished_at`,
      [parsed.sessionNumber]
    );

    if (result.rowCount === 0) {
      const existing = await pool.query(
        'SELECT status FROM qr_scan_session WHERE session_number = $1',
        [parsed.sessionNumber]
      );
      if (existing.rowCount === 0) {
        return res.status(404).json({ error: 'Sesi tidak ditemukan', code: 'SESSION_NOT_FOUND' });
      }
      return res.status(409).json({ error: 'Sesi sudah selesai', code: 'SESSION_ALREADY_FINISHED' });
    }

    const row = result.rows[0];
    const qtyResult = await pool.query(
      `SELECT COUNT(*)::int AS qty FROM qr_scan_item i
       INNER JOIN qr_scan_session s ON s.id = i.session_id
       WHERE s.session_number = $1`,
      [parsed.sessionNumber]
    );

    res.json({
      session_number: row.session_number,
      pic: row.pic,
      status: row.status,
      created_at: row.created_at,
      finished_at: row.finished_at,
      qty: qtyResult.rows[0]?.qty ?? 0,
    });
  } catch (err) {
    console.error('qr-scan PATCH finish:', err);
    res.status(500).json({ error: GENERIC_DB_ERROR });
  }
});

module.exports = router;
