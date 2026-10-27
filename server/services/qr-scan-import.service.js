const { pool } = require('../database');
const {
  normalizeQrScanBarcode,
  resolveVendorForBarcode,
  normalizePicName,
  normalizeShiftNumber,
  assertActivePic,
  buildVendorMapFromRows,
} = require('../utils/qr-scan.utils');
const { parseImportWorkbook } = require('../utils/qr-scan-excel.utils');

const DEFAULT_PRODUCTION_TYPE = 'cartridge';

async function loadVendorMap(client) {
  const result = await client.query(
    'SELECT name, digit_count FROM authenticity_vendor WHERE is_active = 1'
  );
  return buildVendorMapFromRows(result.rows);
}

/**
 * @param {Buffer} fileBuffer
 */
async function importQrScanWorkbook(fileBuffer) {
  const parsed = await parseImportWorkbook(fileBuffer);
  if (!parsed.ok) {
    return { httpStatus: 400, body: { error: parsed.error, code: parsed.code } };
  }

  const picResult = normalizePicName(parsed.pic);
  if (!picResult.ok) {
    return { httpStatus: 400, body: { error: picResult.error, code: picResult.code } };
  }

  const shiftResult = normalizeShiftNumber(parsed.shift_number);
  if (!shiftResult.ok) {
    return { httpStatus: 400, body: { error: shiftResult.error, code: shiftResult.code } };
  }

  const client = await pool.connect();
  let sessionId;
  let sessionNumber;
  let canonicalPic;

  try {
    await client.query('BEGIN');
    const picCheck = await assertActivePic(client, picResult.pic);
    if (!picCheck.ok) {
      await client.query('ROLLBACK');
      return { httpStatus: 400, body: { error: picCheck.error, code: picCheck.code } };
    }
    canonicalPic = picCheck.pic;

    const insert = await client.query(
      `INSERT INTO qr_scan_session (pic, shift_number, production_type)
       VALUES ($1, $2, $3)
       RETURNING id, session_number`,
      [canonicalPic, shiftResult.shift_number, DEFAULT_PRODUCTION_TYPE]
    );
    sessionId = insert.rows[0].id;
    sessionNumber = insert.rows[0].session_number;
    await client.query('COMMIT');

    const vendorMap = await loadVendorMap(client);
    const seenInFile = new Set();
    let inserted = 0;
    const skipped = [];
    const errors = [];

    for (let i = 0; i < parsed.barcodes.length; i += 1) {
    const rowNum = i + 2;
    const raw = parsed.barcodes[i];
    const barcodeResult = normalizeQrScanBarcode(raw);
    if (!barcodeResult.ok) {
      errors.push({ row: rowNum, code: barcodeResult.code, barcode: String(raw) });
      continue;
    }

    if (seenInFile.has(barcodeResult.barcode)) {
      skipped.push({ barcode: barcodeResult.barcode, code: 'DUPLICATE_IN_FILE' });
      continue;
    }
    seenInFile.add(barcodeResult.barcode);

    const vendorResult = resolveVendorForBarcode(barcodeResult.barcode, vendorMap);
    if (!vendorResult.ok) {
      errors.push({ row: rowNum, code: vendorResult.code, barcode: barcodeResult.barcode });
      continue;
    }

    try {
      await client.query(
        `INSERT INTO qr_scan_item (session_id, production_type, barcode)
         VALUES ($1, $2, $3)`,
        [sessionId, DEFAULT_PRODUCTION_TYPE, barcodeResult.barcode]
      );
      inserted += 1;
    } catch (insertErr) {
      if (insertErr.code === '23505') {
        skipped.push({ barcode: barcodeResult.barcode, code: 'BARCODE_ALREADY_USED' });
      } else {
        throw insertErr;
      }
    }
    }

    return {
      httpStatus: 201,
      body: {
        session_number: sessionNumber,
        pic: canonicalPic,
        shift_number: shiftResult.shift_number,
        inserted,
        skipped,
        errors,
      },
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { importQrScanWorkbook };
