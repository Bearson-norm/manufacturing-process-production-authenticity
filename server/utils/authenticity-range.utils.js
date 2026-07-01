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

module.exports = {
  extractNumeric,
  isNumberInAuthenticityRange,
  normalizeAuthenticityData,
  collectRangesFromProductionRow,
  findMatchingRanges
};
