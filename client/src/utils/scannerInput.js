/**
 * HID barcode scanners often suffix reads with CR, LF, or CRLF.
 */
function isScannerControlChar(code) {
  return code === 0x0a || code === 0x0d || code <= 0x1f || code === 0x7f;
}

export function stripScannerLineEndings(value) {
  const s = String(value ?? '');
  let out = '';
  for (let i = 0; i < s.length; i += 1) {
    const code = s.charCodeAt(i);
    if (!isScannerControlChar(code)) {
      out += s[i];
    }
  }
  return out.trim();
}

export function hasScannerLineTerminator(value) {
  const s = String(value ?? '');
  for (let i = 0; i < s.length; i += 1) {
    const code = s.charCodeAt(i);
    if (code === 0x0a || code === 0x0d) return true;
  }
  return false;
}

export function isScannerSubmitKey(e) {
  if (!e) return false;
  if (e.key === 'Enter') return true;
  const code = e.keyCode ?? e.which;
  return code === 13 || code === 10;
}
