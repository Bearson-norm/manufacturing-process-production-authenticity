const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeQrScanBarcode,
  validateClientScanId,
  parseSessionNumberParam,
  normalizeShiftNumber,
} = require('../utils/qr-scan.utils');

describe('qr-scan.utils', () => {
  it('normalizeQrScanBarcode trims and allows alphanumeric', () => {
    assert.deepEqual(normalizeQrScanBarcode('  12345  '), { ok: true, barcode: '12345' });
    assert.deepEqual(normalizeQrScanBarcode('12345\r\n'), { ok: true, barcode: '12345' });
    assert.deepEqual(normalizeQrScanBarcode('ABC-123_45'), { ok: true, barcode: 'ABC-123_45' });
    assert.equal(normalizeQrScanBarcode('').ok, false);
    assert.equal(normalizeQrScanBarcode('12 a').code, 'BARCODE_INVALID');
  });

  it('validateClientScanId accepts UUID v4 only', () => {
    assert.equal(validateClientScanId(undefined).ok, true);
    assert.equal(
      validateClientScanId('550e8400-e29b-41d4-a716-446655440000').ok,
      true
    );
    assert.equal(validateClientScanId('not-a-uuid').code, 'INVALID_CLIENT_SCAN_ID');
  });

  it('parseSessionNumberParam rejects invalid numbers', () => {
    assert.equal(parseSessionNumberParam('0').ok, false);
    assert.equal(parseSessionNumberParam('3').sessionNumber, 3);
  });

  it('normalizeShiftNumber accepts alphanumeric tokens', () => {
    assert.deepEqual(normalizeShiftNumber('2'), { ok: true, shift_number: '2' });
    assert.deepEqual(normalizeShiftNumber('Shift-A'), { ok: true, shift_number: 'Shift-A' });
    assert.equal(normalizeShiftNumber('').ok, false);
    assert.equal(normalizeShiftNumber('1 a').ok, false);
  });
});
