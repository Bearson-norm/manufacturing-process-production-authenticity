/** Panjang hanya digit (nol di depan dihitung). */
export function digitOnlyLength(value) {
  const s = value === undefined || value === null ? '' : String(value);
  return s.replace(/\D/g, '').length;
}

export function formatVendorDisplayName(authRow) {
  if (!authRow) return '—';
  const n = authRow.vendorName;
  if (n != null && String(n).trim() !== '') return String(n).trim();
  return '—';
}

/** Validasi angka + selisih (tanpa cek digit vendor). */
export function validateAuthenticityNumericAndRange(firstAuth, lastAuth) {
  if (!firstAuth || !lastAuth || firstAuth.trim() === '' || lastAuth.trim() === '') {
    return { valid: true, message: '' };
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
  return { valid: true, message: '' };
}

/**
 * @param {string} firstAuth
 * @param {string} lastAuth
 * @param {number|null|undefined} vendorDigitCount — null = legacy, skip digit length
 */
export function validateAuthenticityWithVendorDigit(firstAuth, lastAuth, vendorDigitCount) {
  const base = validateAuthenticityNumericAndRange(firstAuth, lastAuth);
  if (!base.valid) return base;
  if (!firstAuth.trim() || !lastAuth.trim()) {
    return { valid: true, message: '' };
  }
  const n = vendorDigitCount;
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

export function validateBufferRejectNumbers(numbers, vendorDigitCount) {
  const list = (Array.isArray(numbers) ? numbers : [])
    .map((n) => (n === undefined || n === null ? '' : String(n).trim()))
    .filter((n) => n !== '');
  if (list.length === 0) {
    return { valid: false, message: 'Minimal satu nomor authenticity' };
  }
  const n = vendorDigitCount;
  if (n == null || n <= 0) {
    return { valid: true, message: '' };
  }
  for (let i = 0; i < list.length; i++) {
    if (digitOnlyLength(list[i]) !== n) {
      return { valid: false, message: `Setiap nomor harus tepat ${n} digit (vendor)` };
    }
  }
  return { valid: true, message: '' };
}
