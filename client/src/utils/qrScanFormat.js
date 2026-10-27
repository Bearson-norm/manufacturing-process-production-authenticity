export function formatQrScanDateTime(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      dateStyle: 'medium',
      timeStyle: 'medium',
    });
  } catch {
    return String(value);
  }
}

export function formatShiftPreviewNow() {
  return new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'medium',
    timeStyle: 'medium',
  });
}
