/**
 * @param {string} value
 * @param {number|null|undefined} digitCount
 * @param {string} fieldLabel
 * @returns {string|null} error message or null if OK / skipped
 */
export function validateNumericDigitLength(value, digitCount, fieldLabel) {
  if (digitCount == null || digitCount < 1) {
    return null;
  }
  const s = String(value || '').trim();
  if (!s) {
    return null;
  }
  if (!/^\d+$/.test(s)) {
    return `${fieldLabel} harus hanya angka`;
  }
  if (s.length !== digitCount) {
    return `${fieldLabel} harus tepat ${digitCount} digit`;
  }
  return null;
}

/** @param {Array<{ name?: string, digit_count?: number }>} vendors */
export function buildVendorDigitMap(vendors) {
  const m = new Map();
  (vendors || []).forEach((v) => {
    const n = String(v.name || '').trim();
    if (!n) return;
    m.set(n.toLowerCase(), Number(v.digit_count) || 0);
  });
  return m;
}

/**
 * @param {string|null|undefined} vendorName
 * @param {Map<string, number>} digitMap lower-case name -> digit_count
 */
export function resolveDigitCountForVendorName(vendorName, digitMap) {
  if (!vendorName || !digitMap) return null;
  const key = String(vendorName).trim().toLowerCase();
  if (!key) return null;
  const dc = digitMap.get(key);
  return dc > 0 ? dc : null;
}
