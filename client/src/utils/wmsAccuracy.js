export const ACCURACY_ERROR_WARN_MAX = 5;

export function formatPercent(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })}%`;
}

export function getAccuracyColorClass(errorRatePercent) {
  if (errorRatePercent == null || Number.isNaN(Number(errorRatePercent))) {
    return 'wms-accuracy-neutral';
  }

  const rate = Number(errorRatePercent);
  if (rate === 0) return 'wms-accuracy-ok';
  if (rate <= ACCURACY_ERROR_WARN_MAX) return 'wms-accuracy-warn';
  return 'wms-accuracy-fail';
}

export function formatWmsCompareStatus(wmsStatus) {
  switch (wmsStatus) {
    case 'both':
      return { label: 'Sudah compare', className: 'wms-compare-badge-ok' };
    case 'wms_only':
      return { label: 'WMS saja', className: 'wms-compare-badge-warn' };
    case 'production_only':
    default:
      return { label: 'Belum sync WMS', className: 'wms-compare-badge-pending' };
  }
}

export function formatQtyVarianceStatus(status) {
  switch (status) {
    case 'match':
      return { label: 'Match', className: 'wms-compare-badge-ok' };
    case 'shortage':
      return { label: 'Shortage', className: 'wms-compare-badge-fail' };
    case 'surplus':
      return { label: 'Surplus WMS', className: 'wms-compare-badge-warn' };
    case 'no_wms':
      return { label: 'Belum sync WMS', className: 'wms-compare-badge-pending' };
    case 'no_production':
      return { label: 'Tanpa production', className: 'wms-compare-badge-pending' };
    default:
      return { label: status || '—', className: 'wms-compare-badge-pending' };
  }
}
