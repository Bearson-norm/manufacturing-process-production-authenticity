const { buildActiveVendorMapByLowerName } = require('./authenticity.utils');

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeQrScanBarcode(raw) {
  const barcode = String(raw ?? '')
    .replace(/[\r\n\u0000-\u001F\u007F]+/g, '')
    .trim();
  if (!barcode) {
    return { ok: false, error: 'Barcode wajib diisi', code: 'BARCODE_EMPTY' };
  }
  if (!/^\d+$/.test(barcode)) {
    return { ok: false, error: 'Barcode harus hanya angka', code: 'BARCODE_NOT_DIGITS' };
  }
  return { ok: true, barcode };
}

function resolveVendorForBarcode(barcode, vendorMap) {
  const matches = [];
  for (const spec of vendorMap.values()) {
    if (barcode.length === spec.digit_count) {
      matches.push(spec.name);
    }
  }
  if (matches.length === 0) {
    return {
      ok: false,
      error: 'Panjang barcode tidak cocok dengan vendor aktif',
      code: 'BARCODE_DIGIT_MISMATCH',
    };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      error: 'Panjang barcode ambigu untuk beberapa vendor',
      code: 'BARCODE_VENDOR_AMBIGUOUS',
    };
  }
  return { ok: true, vendorName: matches[0] };
}

function parseSessionNumberParam(raw) {
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isInteger(n) || n < 1) {
    return { ok: false, error: 'Nomor sesi tidak valid' };
  }
  return { ok: true, sessionNumber: n };
}

function validateClientScanId(raw) {
  if (raw === undefined || raw === null || raw === '') {
    return { ok: true, clientScanId: null };
  }
  const clientScanId = String(raw).trim();
  if (clientScanId.length > 64) {
    return { ok: false, error: 'client_scan_id tidak valid', code: 'INVALID_CLIENT_SCAN_ID' };
  }
  if (!UUID_V4_RE.test(clientScanId)) {
    return { ok: false, error: 'client_scan_id tidak valid', code: 'INVALID_CLIENT_SCAN_ID' };
  }
  return { ok: true, clientScanId };
}

function normalizePicName(raw) {
  const pic = String(raw ?? '').trim();
  if (!pic) {
    return { ok: false, error: 'PIC wajib diisi', code: 'PIC_REQUIRED' };
  }
  return { ok: true, pic };
}

/**
 * @param {import('pg').PoolClient} client
 */
async function assertActivePic(client, pic) {
  const result = await client.query(
    `SELECT name FROM pic_list
     WHERE is_active = 1 AND lower(trim(name)) = lower(trim($1))
     LIMIT 1`,
    [pic]
  );
  if (result.rowCount === 0) {
    return {
      ok: false,
      error: 'PIC tidak dikenali atau tidak aktif',
      code: 'PIC_NOT_FOUND',
    };
  }
  return { ok: true, pic: result.rows[0].name };
}

function buildVendorMapFromRows(rows) {
  return buildActiveVendorMapByLowerName(rows);
}

module.exports = {
  normalizeQrScanBarcode,
  resolveVendorForBarcode,
  parseSessionNumberParam,
  validateClientScanId,
  normalizePicName,
  assertActivePic,
  buildVendorMapFromRows,
};
