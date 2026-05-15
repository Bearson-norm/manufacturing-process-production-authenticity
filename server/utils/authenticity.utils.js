// Helper: length of digit-only substring (leading zeros preserved in string form)
function digitOnlyLength(value) {
  const s = value === undefined || value === null ? '' : String(value);
  const digits = s.replace(/\D/g, '');
  return digits.length;
}

function nullVendorSnapshot() {
  return { vendorId: null, vendorName: null, vendorDigitCount: null };
}

function coerceVendorId(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function coerceVendorDigitCount(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Helper function to parse authenticity data (each roll gets explicit vendor fields)
function parseAuthenticityData(row) {
  try {
    let authenticity_data =
      typeof row.authenticity_data === 'string' ? JSON.parse(row.authenticity_data) : row.authenticity_data;
    if (!Array.isArray(authenticity_data)) {
      authenticity_data = authenticity_data ? [authenticity_data] : [];
    }
    authenticity_data = authenticity_data.map((r) => normalizeAuthenticityRow(r));
    return {
      ...row,
      authenticity_data
    };
  } catch (e) {
    return {
      ...row,
      authenticity_data: []
    };
  }
}

// Normalize authenticity rows so leading zeros are preserved as strings; vendor keys always present
function normalizeAuthenticityRow(row = {}) {
  const safeRow = typeof row === 'object' && row !== null ? row : {};
  const toText = (v) => (v === undefined || v === null ? '' : String(v).trim());
  const vendorId = coerceVendorId(safeRow.vendorId);
  const vendorDigitCount = coerceVendorDigitCount(safeRow.vendorDigitCount);
  const rawName = safeRow.vendorName;
  const vendorName =
    rawName !== undefined && rawName !== null && String(rawName).trim() !== ''
      ? String(rawName).trim()
      : null;

  return {
    firstAuthenticity: toText(safeRow.firstAuthenticity),
    lastAuthenticity: toText(safeRow.lastAuthenticity),
    rollNumber: toText(safeRow.rollNumber),
    vendorId,
    vendorName,
    vendorDigitCount
  };
}

function normalizeAuthenticityArray(data) {
  const rows = Array.isArray(data) ? data : [data];
  return rows.map(normalizeAuthenticityRow);
}

function normalizeAuthenticityNumbers(numbers) {
  const arr = Array.isArray(numbers) ? numbers : [numbers];
  return arr.map((n) => (n === undefined || n === null ? '' : String(n).trim())).filter((n) => n !== '');
}

/** Attach resolved vendor snapshot to each row (server-side before INSERT). */
function applyVendorSnapshotToRows(rows, vendor) {
  const base = normalizeAuthenticityArray(rows);
  if (!vendor || !vendor.id) {
    return base.map((r) => ({
      ...r,
      ...nullVendorSnapshot()
    }));
  }
  return base.map((r) => ({
    ...r,
    vendorId: vendor.id,
    vendorName: String(vendor.name || '').trim() || null,
    vendorDigitCount: Number(vendor.digit_count) || null
  }));
}

/**
 * Validate one production authenticity row (first/last numeric range + optional digit length).
 * @returns {{ valid: boolean, message: string }}
 */
function validateProductionAuthenticityRow(row) {
  const firstAuth = row.firstAuthenticity || '';
  const lastAuth = row.lastAuthenticity || '';
  if (!firstAuth.trim() || !lastAuth.trim()) {
    return { valid: false, message: 'First dan Last Authenticity wajib diisi' };
  }

  const first = parseInt(firstAuth, 10);
  const last = parseInt(lastAuth, 10);
  if (Number.isNaN(first) || Number.isNaN(last)) {
    return { valid: false, message: 'First dan Last Authenticity harus berupa angka' };
  }

  const difference = last - first;
  if (difference < 0) {
    return { valid: false, message: 'Selisih tidak boleh negatif' };
  }
  if (difference === 0) {
    return { valid: false, message: 'First dan Last Authenticity tidak boleh sama' };
  }
  if (difference > 7000) {
    return { valid: false, message: 'Selisih tidak boleh lebih dari 7000' };
  }

  const n = row.vendorDigitCount;
  if (n != null && n > 0) {
    if (digitOnlyLength(firstAuth) !== n || digitOnlyLength(lastAuth) !== n) {
      return {
        valid: false,
        message: `First dan Last Authenticity harus masing-masing tepat ${n} digit (vendor)`
      };
    }
  }

  return { valid: true, message: '' };
}

/** True when first, last, and roll are all empty (after trim). */
function isProductionAuthenticityRowBlank(row) {
  const f = String(row?.firstAuthenticity ?? '').trim();
  const l = String(row?.lastAuthenticity ?? '').trim();
  const r = String(row?.rollNumber ?? '').trim();
  return !f && !l && !r;
}

/**
 * Validate one production row: allow incomplete rows (First-only or Last-only) so
 * operators can save from the label modal and complete the pair on edit. Blank rows
 * are treated as valid (caller should skip persisting them).
 * @returns {{ valid: boolean, message: string }}
 */
function validateProductionAuthenticityRowFlexible(row) {
  if (isProductionAuthenticityRowBlank(row)) {
    return { valid: true, message: '' };
  }

  const firstAuth = row.firstAuthenticity || '';
  const lastAuth = row.lastAuthenticity || '';
  const hf = firstAuth.trim();
  const hl = lastAuth.trim();
  const roll = String(row.rollNumber ?? '').trim();

  if (hf && hl) {
    return validateProductionAuthenticityRow(row);
  }

  if (!roll) {
    return {
      valid: false,
      message:
        'Nomor roll wajib diisi untuk setiap baris yang memiliki First atau Last Authenticity (termasuk jika hanya salah satu yang diisi dulu)'
    };
  }

  if (!hf && !hl) {
    return {
      valid: false,
      message: 'First atau Last Authenticity wajib diisi bersama nomor roll'
    };
  }

  const n = row.vendorDigitCount;
  if (hf) {
    const first = parseInt(hf, 10);
    if (Number.isNaN(first)) {
      return { valid: false, message: 'First Authenticity harus berupa angka' };
    }
    if (n != null && n > 0 && digitOnlyLength(firstAuth) !== n) {
      return {
        valid: false,
        message: `First Authenticity harus tepat ${n} digit (vendor)`
      };
    }
  }
  if (hl) {
    const last = parseInt(hl, 10);
    if (Number.isNaN(last)) {
      return { valid: false, message: 'Last Authenticity harus berupa angka' };
    }
    if (n != null && n > 0 && digitOnlyLength(lastAuth) !== n) {
      return {
        valid: false,
        message: `Last Authenticity harus tepat ${n} digit (vendor)`
      };
    }
  }

  return { valid: true, message: '' };
}

/** @returns {string|null} First error message or null if all rows valid. */
function validateProductionAuthenticityRowsOrError(rows) {
  if (!Array.isArray(rows)) {
    return 'authenticity_data harus berupa array';
  }
  for (let i = 0; i < rows.length; i++) {
    const v = validateProductionAuthenticityRowFlexible(rows[i]);
    if (!v.valid) {
      return v.message;
    }
  }
  return null;
}

/**
 * Validate buffer/reject number strings against optional vendor digit count.
 * @returns {{ valid: boolean, message: string }}
 */
function validateAuthenticityNumbersDigitLength(numbers, vendorDigitCount) {
  const list = normalizeAuthenticityNumbers(numbers);
  if (list.length === 0) {
    return { valid: false, message: 'Minimal satu nomor authenticity' };
  }
  const n = vendorDigitCount;
  if (n == null || n <= 0) {
    return { valid: true, message: '' };
  }
  for (let i = 0; i < list.length; i++) {
    if (digitOnlyLength(list[i]) !== n) {
      return {
        valid: false,
        message: `Setiap nomor authenticity harus tepat ${n} digit (vendor)`
      };
    }
  }
  return { valid: true, message: '' };
}

module.exports = {
  parseAuthenticityData,
  normalizeAuthenticityRow,
  normalizeAuthenticityArray,
  normalizeAuthenticityNumbers,
  digitOnlyLength,
  nullVendorSnapshot,
  applyVendorSnapshotToRows,
  validateProductionAuthenticityRow,
  isProductionAuthenticityRowBlank,
  validateProductionAuthenticityRowFlexible,
  validateProductionAuthenticityRowsOrError,
  validateAuthenticityNumbersDigitLength
};
