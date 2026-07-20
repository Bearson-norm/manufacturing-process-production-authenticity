const {
  extractNumeric,
  isNumberInAuthenticityRange,
  collectAllRangesFromProduction,
  verifyQrBarcodeAgainstProduction
} = require('./authenticity-range.utils');
const { resolveProductionQuantity } = require('./authenticity.utils');

function roundPercent(value) {
  return Math.round(value * 100) / 100;
}

function rangeSize(range) {
  const first = extractNumeric(range.firstAuthenticity);
  const last = extractNumeric(range.lastAuthenticity);
  if (first == null || last == null) return 0;
  return Math.abs(last - first) + 1;
}

function rangeKey(range) {
  return [
    range.production_result_id ?? '',
    range.production_type ?? '',
    range.rollNumber ?? '',
    range.firstAuthenticity ?? '',
    range.lastAuthenticity ?? ''
  ].join('|');
}

function normalizeCartonQrList(carton) {
  const raw = carton && carton.qr_list;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((q) => q && q !== null);
  return [];
}

function resolveCompareStatus({ hasWms, hasProduction, missingQty, surplusWmsQty }) {
  if (!hasProduction) return 'no_production';
  if (!hasWms) return 'no_wms';
  if (missingQty > 0) return 'shortage';
  if (surplusWmsQty > 0) return 'surplus';
  return 'match';
}

/**
 * Compare production_results (SoT) qty/coverage against WMS QR cartons.
 * Reverse coverage is range-level: a range is uncovered if no WMS QR falls in it.
 * Missing breakdown includes partially covered ranges/sessions (qty production not in WMS).
 *
 * @param {Array<object>} productionRows — rows from production_results
 * @param {Array<object>} cartonsWithQr
 * @param {{ wmsCartonQty?: number }} [options]
 */
function compareProductionQtyToWms(productionRows, cartonsWithQr, options = {}) {
  const rows = productionRows || [];
  const hasProduction = rows.length > 0;

  let productionQty = 0;
  const byTypeMap = new Map();
  const sessionMap = new Map();

  for (const row of rows) {
    const qty = resolveProductionQuantity(row);
    productionQty += qty;

    const typeKey = row.production_type || 'unknown';
    if (!byTypeMap.has(typeKey)) {
      byTypeMap.set(typeKey, {
        production_type: typeKey,
        session_count: 0,
        total_quantity: 0,
        sku_name: row.sku_name || null
      });
    }
    const typeEntry = byTypeMap.get(typeKey);
    typeEntry.session_count += 1;
    typeEntry.total_quantity += qty;
    if (!typeEntry.sku_name && row.sku_name) typeEntry.sku_name = row.sku_name;

    sessionMap.set(row.id, {
      production_result_id: row.id,
      production_type: row.production_type || null,
      session_id: row.session_id || null,
      sku_name: row.sku_name || null,
      pic: row.pic || null,
      leader_name: row.leader_name || null,
      shift_number: row.shift_number || null,
      completed_at: row.completed_at || null,
      production_qty: qty,
      range_count: 0,
      covered_qty: 0,
      missing_qty: 0
    });
  }

  const allRanges = collectAllRangesFromProduction(rows);
  const rangeStats = allRanges.map((range) => ({
    ...range,
    range_size: rangeSize(range),
    hit_count: 0,
    hit_qty: 0,
    _key: rangeKey(range)
  }));
  const statsByKey = new Map(rangeStats.map((r) => [r._key, r]));

  for (const range of rangeStats) {
    const session = sessionMap.get(range.production_result_id);
    if (session) session.range_count += 1;
  }

  let wmsQrQty = 0;
  let wmsCoveredQty = 0;
  let surplusWmsQty = 0;
  let totalQr = 0;
  let matchedQr = 0;
  let unmatchedQr = 0;
  const cartonBreakdown = [];

  const cartons = cartonsWithQr || [];
  const hasWms = cartons.length > 0;

  for (const carton of cartons) {
    let cartonQrTotal = 0;
    let cartonMatchedQr = 0;
    let cartonUnmatchedQr = 0;
    let cartonQrQty = 0;
    let cartonCoveredQty = 0;
    let cartonSurplusQty = 0;
    const unmatchedQrs = [];

    for (const qr of normalizeCartonQrList(carton)) {
      const qty = qr.qty != null ? Number(qr.qty) : 1;
      totalQr += 1;
      cartonQrTotal += 1;
      wmsQrQty += qty;
      cartonQrQty += qty;

      const verification = allRanges.length === 0
        ? { in_range: false, reason: 'no_production_ranges', matched_ranges: [] }
        : verifyQrBarcodeAgainstProduction(rows, qr.barcode);

      if (verification.in_range) {
        matchedQr += 1;
        cartonMatchedQr += 1;
        wmsCoveredQty += qty;
        cartonCoveredQty += qty;

        let attributed = false;
        const matched = verification.matched_ranges || [];

        // Mark all matched ranges as hit for uncovered detection,
        // but attribute qty to the first matching range only (avoid double-count).
        for (let i = 0; i < matched.length; i += 1) {
          const key = rangeKey(matched[i]);
          const stat = statsByKey.get(key);
          if (!stat) continue;
          stat.hit_count += 1;
          if (!attributed) {
            stat.hit_qty += qty;
            attributed = true;
          }
        }

        if (!attributed) {
          for (const stat of rangeStats) {
            if (isNumberInAuthenticityRange(qr.barcode, stat.firstAuthenticity, stat.lastAuthenticity)) {
              stat.hit_count += 1;
              if (!attributed) {
                stat.hit_qty += qty;
                attributed = true;
              }
            }
          }
        }
      } else {
        unmatchedQr += 1;
        cartonUnmatchedQr += 1;
        surplusWmsQty += qty;
        cartonSurplusQty += qty;
        unmatchedQrs.push({
          qr_barcode: qr.barcode || '',
          qty,
          reason: verification.reason || 'out_of_range'
        });
      }
    }

    const cartonQty = Number(carton.qty) || cartonQrQty;
    cartonBreakdown.push({
      carton_id: carton.id,
      carton_barcode: carton.barcode || '',
      stock_transfer_order_id: carton.stock_transfer_order_id || null,
      counting: carton.counting ?? null,
      total_carton: carton.total_carton ?? null,
      carton_qty: cartonQty,
      qr_total: cartonQrTotal,
      matched_qr: cartonMatchedQr,
      unmatched_qr: cartonUnmatchedQr,
      qr_qty: cartonQrQty,
      covered_qty: cartonCoveredQty,
      surplus_qty: cartonSurplusQty,
      all_ok: cartonUnmatchedQr === 0 && cartonQrTotal > 0,
      has_issue: cartonUnmatchedQr > 0 || cartonQrTotal === 0,
      unmatched_qrs: unmatchedQrs
    });
  }

  cartonBreakdown.sort((a, b) => {
    if (b.surplus_qty !== a.surplus_qty) return b.surplus_qty - a.surplus_qty;
    return (a.counting || 0) - (b.counting || 0);
  });

  const surplusCartons = cartonBreakdown.filter((c) => c.surplus_qty > 0 || c.qr_total === 0);

  const unmatchedQrItems = [];
  for (const carton of cartonBreakdown) {
    for (const qr of carton.unmatched_qrs || []) {
      unmatchedQrItems.push({
        carton_id: carton.carton_id,
        carton_barcode: carton.carton_barcode,
        stock_transfer_order_id: carton.stock_transfer_order_id,
        counting: carton.counting,
        total_carton: carton.total_carton,
        qr_barcode: qr.qr_barcode,
        qty: qr.qty,
        reason: qr.reason
      });
    }
  }

  const rangeBreakdown = rangeStats.map(({ _key, hit_count, hit_qty, ...rest }) => {
    const coveredQty = Math.min(hit_qty, rest.range_size || 0);
    const missingQty = Math.max(0, (rest.range_size || 0) - hit_qty);
    return {
      ...rest,
      hit_count,
      hit_qty,
      covered_qty: coveredQty,
      missing_qty: missingQty,
      fully_uncovered: hit_count === 0
    };
  });

  // Roll up covered qty to sessions (capped per range)
  for (const range of rangeBreakdown) {
    const session = sessionMap.get(range.production_result_id);
    if (!session) continue;
    session.covered_qty += range.covered_qty;
  }

  const missingBreakdownSessions = [];
  for (const session of sessionMap.values()) {
    // Cap covered at session production qty (SoT)
    session.covered_qty = Math.min(session.covered_qty, session.production_qty);
    session.missing_qty = Math.max(0, session.production_qty - session.covered_qty);
    if (session.missing_qty > 0) {
      missingBreakdownSessions.push(session);
    }
  }
  missingBreakdownSessions.sort((a, b) => b.missing_qty - a.missing_qty);

  const missingBreakdownRanges = rangeBreakdown
    .filter((r) => r.missing_qty > 0)
    .sort((a, b) => b.missing_qty - a.missing_qty);

  const uncoveredRanges = rangeBreakdown
    .filter((r) => r.fully_uncovered)
    .map(({ hit_count, hit_qty, covered_qty, missing_qty, fully_uncovered, ...rest }) => ({
      ...rest,
      range_size: rest.range_size,
      missing_qty
    }));

  const uncoveredRangeQty = uncoveredRanges.reduce((sum, r) => sum + (r.range_size || 0), 0);
  const missingQty = Math.max(0, productionQty - wmsCoveredQty);
  const qtyDelta = wmsCoveredQty - productionQty;
  const qtyVariancePercent = productionQty > 0
    ? roundPercent((Math.abs(qtyDelta) / productionQty) * 100)
    : null;

  const wmsCartonQty = options.wmsCartonQty != null
    ? Number(options.wmsCartonQty) || 0
    : cartons.reduce((sum, c) => sum + (Number(c.qty) || 0), 0);

  const status = resolveCompareStatus({
    hasWms,
    hasProduction,
    missingQty,
    surplusWmsQty
  });

  return {
    summary: {
      production_qty: productionQty,
      wms_carton_qty: wmsCartonQty,
      wms_qr_qty: wmsQrQty,
      wms_covered_qty: wmsCoveredQty,
      missing_qty: missingQty,
      surplus_wms_qty: surplusWmsQty,
      qty_delta: qtyDelta,
      qty_variance_percent: qtyVariancePercent,
      production_range_count: allRanges.length,
      uncovered_range_count: uncoveredRanges.length,
      uncovered_range_qty: uncoveredRangeQty,
      missing_range_count: missingBreakdownRanges.length,
      missing_session_count: missingBreakdownSessions.length,
      carton_count: cartonBreakdown.length,
      surplus_carton_count: surplusCartons.length,
      unmatched_qr_count: unmatchedQrItems.length,
      total_qr: totalQr,
      matched_qr: matchedQr,
      unmatched_qr: unmatchedQr,
      has_wms_data: hasWms,
      has_production: hasProduction,
      status
    },
    by_type: Array.from(byTypeMap.values()),
    uncovered_ranges: uncoveredRanges,
    missing_breakdown_ranges: missingBreakdownRanges,
    missing_breakdown_sessions: missingBreakdownSessions,
    carton_breakdown: cartonBreakdown,
    surplus_cartons: surplusCartons,
    unmatched_qr_items: unmatchedQrItems
  };
}

module.exports = {
  compareProductionQtyToWms,
  resolveCompareStatus,
  rangeSize
};
