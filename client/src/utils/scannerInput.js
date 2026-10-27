/**
 * HID barcode scanners often suffix reads with CR, LF, or CRLF.
 */
export function stripScannerLineEndings(value) {
  return String(value ?? '')
    .replace(/[\r\n\u0000-\u001F\u007F]+/g, '')
    .trim();
}

export function hasScannerLineTerminator(value) {
  return /[\r\n]/.test(String(value ?? ''));
}

export function isScannerSubmitKey(e) {
  if (!e) return false;
  if (e.key === 'Enter') return true;
  const code = e.keyCode ?? e.which;
  return code === 13 || code === 10;
}
