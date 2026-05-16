// Helper function to parse authenticity data
function parseAuthenticityData(row) {
  try {
    return {
      ...row,
      authenticity_data: typeof row.authenticity_data === 'string'
        ? JSON.parse(row.authenticity_data)
        : row.authenticity_data
    };
  } catch (e) {
    return {
      ...row,
      authenticity_data: []
    };
  }
}

function normalizeVendorName(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

// Normalize authenticity rows so leading zeros are preserved as strings
function normalizeAuthenticityRow(row = {}) {
  const safeRow = typeof row === 'object' && row !== null ? row : {};
  const toText = (v) => (v === undefined || v === null) ? '' : String(v).trim();
  return {
    firstAuthenticity: toText(safeRow.firstAuthenticity),
    lastAuthenticity: toText(safeRow.lastAuthenticity),
    rollNumber: toText(safeRow.rollNumber),
    vendorName: normalizeVendorName(safeRow.vendorName)
  };
}

function normalizeAuthenticityArray(data) {
  const rows = Array.isArray(data) ? data : [data];
  return rows.map(normalizeAuthenticityRow);
}

function normalizeAuthenticityNumbers(numbers) {
  const arr = Array.isArray(numbers) ? numbers : [numbers];
  return arr
    .map((n) => (n === undefined || n === null) ? '' : String(n).trim())
    .filter((n) => n !== '');
}

/** @param {Array<{ name: string, digit_count: number }>} vendorRows */
function buildActiveVendorMapByLowerName(vendorRows) {
  const map = new Map();
  for (const r of vendorRows || []) {
    const name = String(r.name || '').trim();
    if (!name) continue;
    map.set(name.toLowerCase(), { name, digit_count: Number(r.digit_count) || 0 });
  }
  return map;
}

/**
 * @param {{ firstAuthenticity?: string, lastAuthenticity?: string, vendorName?: string|null }} row
 * @param {Map<string, { name: string, digit_count: number }>} vendorMap lower-case name -> spec
 * @returns {string|null} error message or null if OK / vendor skipped
 */
function validateProductionAuthRowVendorDigits(row, vendorMap) {
  const vendorLabel = normalizeVendorName(row.vendorName);
  if (!vendorLabel) return null;

  const spec = vendorMap.get(vendorLabel.toLowerCase());
  if (!spec || !spec.digit_count) {
    return `Vendor "${vendorLabel}" tidak dikenali atau tidak aktif`;
  }
  const dc = spec.digit_count;
  const first = String(row.firstAuthenticity || '').trim();
  const last = String(row.lastAuthenticity || '').trim();

  if (!/^\d+$/.test(first)) {
    return `First Authenticity harus hanya angka (vendor ${spec.name})`;
  }
  if (!/^\d+$/.test(last)) {
    return `Last Authenticity harus hanya angka (vendor ${spec.name})`;
  }
  if (first.length !== dc) {
    return `First Authenticity harus tepat ${dc} digit untuk vendor ${spec.name}`;
  }
  if (last.length !== dc) {
    return `Last Authenticity harus tepat ${dc} digit untuk vendor ${spec.name}`;
  }
  return null;
}

/**
 * @param {string[]} numbers normalized non-empty strings
 * @param {string|null} vendorName
 * @param {Map<string, { name: string, digit_count: number }>} vendorMap
 */
function validateAuthenticityNumbersVendorDigits(numbers, vendorName, vendorMap) {
  const vendorLabel = normalizeVendorName(vendorName);
  if (!vendorLabel) return null;

  const spec = vendorMap.get(vendorLabel.toLowerCase());
  if (!spec || !spec.digit_count) {
    return `Vendor "${vendorLabel}" tidak dikenali atau tidak aktif`;
  }
  const dc = spec.digit_count;
  for (let i = 0; i < numbers.length; i++) {
    const s = numbers[i];
    if (!/^\d+$/.test(s)) {
      return `Nomor authenticity #${i + 1} harus hanya angka (vendor ${spec.name})`;
    }
    if (s.length !== dc) {
      return `Nomor authenticity #${i + 1} harus tepat ${dc} digit untuk vendor ${spec.name}`;
    }
  }
  return null;
}

function loadActiveVendorMapDb(db, callback) {
  db.all(
    'SELECT name, digit_count FROM authenticity_vendor WHERE is_active = 1',
    [],
    (err, rows) => {
      if (err) {
        return callback(err);
      }
      callback(null, buildActiveVendorMapByLowerName(rows));
    }
  );
}

module.exports = {
  parseAuthenticityData,
  normalizeVendorName,
  normalizeAuthenticityRow,
  normalizeAuthenticityArray,
  normalizeAuthenticityNumbers,
  buildActiveVendorMapByLowerName,
  loadActiveVendorMapDb,
  validateProductionAuthRowVendorDigits,
  validateAuthenticityNumbersVendorDigits
};
