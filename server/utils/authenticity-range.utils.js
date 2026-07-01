function extractNumeric(value) {
  if (value == null || value === '') return null;
  const match = String(value).trim().match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

function isNumberInAuthenticityRange(inputNumber, firstAuth, lastAuth) {
  const input = extractNumeric(inputNumber);
  const first = extractNumeric(firstAuth);
  const last = extractNumeric(lastAuth);
  if (input == null || first == null || last == null) return false;
  const lo = Math.min(first, last);
  const hi = Math.max(first, last);
  return input >= lo && input <= hi;
}

function normalizeAuthenticityData(authenticityData) {
  if (!authenticityData) return [];
  if (Array.isArray(authenticityData)) return authenticityData;
  if (typeof authenticityData === 'string') {
    try {
      const parsed = JSON.parse(authenticityData);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [];
    }
  }
  if (typeof authenticityData === 'object') return [authenticityData];
  return [];
}

function collectRangesFromProductionRow(row) {
  const entries = normalizeAuthenticityData(row.authenticity_data);
  return entries
    .filter((e) => e && (e.firstAuthenticity || e.lastAuthenticity))
    .map((e) => ({
      production_result_id: row.id,
      production_type: row.production_type,
      sku_name: row.sku_name,
      pic: row.pic,
      leader_name: row.leader_name,
      rollNumber: e.rollNumber || '',
      firstAuthenticity: e.firstAuthenticity || '',
      lastAuthenticity: e.lastAuthenticity || ''
    }));
}

function findMatchingRanges(productionRows, authenticityNumber) {
  const allRanges = [];
  const matchedRanges = [];

  for (const row of productionRows) {
    const ranges = collectRangesFromProductionRow(row);
    for (const range of ranges) {
      allRanges.push(range);
      if (isNumberInAuthenticityRange(authenticityNumber, range.firstAuthenticity, range.lastAuthenticity)) {
        matchedRanges.push(range);
      }
    }
  }

  return { allRanges, matchedRanges };
}

function collectAllRangesFromProduction(productionRows) {
  const allRanges = [];
  for (const row of productionRows || []) {
    allRanges.push(...collectRangesFromProductionRow(row));
  }
  return allRanges;
}

function verifyQrBarcodeAgainstProduction(productionRows, barcode) {
  const barcodeStr = String(barcode || '').trim();
  if (!barcodeStr) {
    return { in_range: false, reason: 'empty_barcode', matched_ranges: [] };
  }

  const numeric = extractNumeric(barcodeStr);
  if (numeric == null) {
    return { in_range: false, reason: 'invalid_barcode', matched_ranges: [] };
  }

  const { matchedRanges } = findMatchingRanges(productionRows, barcodeStr);
  return {
    in_range: matchedRanges.length > 0,
    reason: matchedRanges.length > 0 ? null : 'out_of_range',
    matched_ranges: matchedRanges
  };
}

function normalizeCartonQrList(carton) {
  const raw = carton && carton.qr_list;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((q) => q && q !== null);
  return [];
}

/**
 * Verify all QR barcodes in WMS cartons against production_results ranges.
 * @param {Array<object>} productionRows
 * @param {Array<{ id, barcode, stock_transfer_order_id, counting, total_carton, qr_list }>} cartonsWithQr
 */
function verifyMoQrAgainstProduction(productionRows, cartonsWithQr) {
  const allRanges = collectAllRangesFromProduction(productionRows);
  const noProductionRanges = allRanges.length === 0;

  let totalQr = 0;
  let matched = 0;
  let unmatched = 0;

  const cartons = (cartonsWithQr || []).map((carton) => {
    const qrList = normalizeCartonQrList(carton);
    let cartonMatched = 0;
    let cartonUnmatched = 0;

    const qrItems = qrList.map((qr) => {
      const verification = noProductionRanges
        ? { in_range: false, reason: 'no_production_ranges', matched_ranges: [] }
        : verifyQrBarcodeAgainstProduction(productionRows, qr.barcode);

      totalQr += 1;
      if (verification.in_range) {
        matched += 1;
        cartonMatched += 1;
      } else {
        unmatched += 1;
        cartonUnmatched += 1;
      }

      return {
        prieds_qr_id: qr.prieds_qr_id || qr.id || null,
        barcode: qr.barcode || '',
        qty: qr.qty != null ? Number(qr.qty) : 1,
        in_range: verification.in_range,
        reason: verification.reason || null,
        matched_ranges: verification.matched_ranges || []
      };
    });

    return {
      carton_id: carton.id,
      barcode: carton.barcode || '',
      stock_transfer_order_id: carton.stock_transfer_order_id || null,
      counting: carton.counting,
      total_carton: carton.total_carton,
      qr_total: qrItems.length,
      matched: cartonMatched,
      unmatched: cartonUnmatched,
      all_ok: cartonUnmatched === 0 && qrItems.length > 0,
      qr_items: qrItems
    };
  });

  const summary = {
    total_cartons: cartons.length,
    total_qr: totalQr,
    matched,
    unmatched,
    production_range_count: allRanges.length,
    no_production_ranges: noProductionRanges,
    all_ok: unmatched === 0 && totalQr > 0,
    message: null
  };

  if (cartons.length === 0) {
    summary.message = 'Belum ada data WMS untuk MO ini — sync dari WMS terlebih dahulu.';
  } else if (noProductionRanges) {
    summary.message = 'MO belum punya range authenticity di production_results.';
  } else if (totalQr === 0) {
    summary.message = 'Carton WMS ditemukan tetapi tidak ada QR barcode.';
  }

  return { summary, cartons, all_ranges: allRanges };
}

module.exports = {
  extractNumeric,
  isNumberInAuthenticityRange,
  normalizeAuthenticityData,
  collectRangesFromProductionRow,
  collectAllRangesFromProduction,
  findMatchingRanges,
  verifyQrBarcodeAgainstProduction,
  verifyMoQrAgainstProduction
};
