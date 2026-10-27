const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeQrScanBarcode,
  resolveVendorForBarcode,
  validateClientScanId,
  parseSessionNumberParam,
  normalizeShiftNumber,
} = require('../utils/qr-scan.utils');
const { buildActiveVendorMapByLowerName } = require('../utils/authenticity.utils');

describe('qr-scan.utils', () => {
  it('normalizeQrScanBarcode trims and validates digits', () => {
    assert.deepEqual(normalizeQrScanBarcode('  12345  '), { ok: true, barcode: '12345' });
    assert.deepEqual(normalizeQrScanBarcode('12345\r\n'), { ok: true, barcode: '12345' });
    assert.equal(normalizeQrScanBarcode('').ok, false);
    assert.equal(normalizeQrScanBarcode('12a').code, 'BARCODE_NOT_DIGITS');
  });

  it('resolveVendorForBarcode matches digit_count', () => {
    const map = buildActiveVendorMapByLowerName([
      { name: 'VendorA', digit_count: 13 },
      { name: 'VendorB', digit_count: 16 },
    ]);
    assert.equal(resolveVendorForBarcode('1234567890123', map).ok, true);
    assert.equal(resolveVendorForBarcode('1234567890123', map).vendorName, 'VendorA');
    assert.equal(resolveVendorForBarcode('123', map).code, 'BARCODE_DIGIT_MISMATCH');
  });

  it('resolveVendorForBarcode detects ambiguous vendors', () => {
    const map = buildActiveVendorMapByLowerName([
      { name: 'A', digit_count: 10 },
      { name: 'B', digit_count: 10 },
    ]);
    assert.equal(resolveVendorForBarcode('1234567890', map).code, 'BARCODE_VENDOR_AMBIGUOUS');
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

  it('normalizeShiftNumber accepts digits only', () => {
    assert.deepEqual(normalizeShiftNumber('2'), { ok: true, shift_number: '2' });
    assert.equal(normalizeShiftNumber('').ok, false);
    assert.equal(normalizeShiftNumber('1a').ok, false);
  });
});
