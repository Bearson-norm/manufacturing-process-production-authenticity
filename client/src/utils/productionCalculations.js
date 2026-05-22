export function calculateSingleAuthenticityRow(row) {
  if (!row?.firstAuthenticity || !row?.lastAuthenticity) return 0;

  const firstMatch = String(row.firstAuthenticity).trim().match(/\d+/);
  const lastMatch = String(row.lastAuthenticity).trim().match(/\d+/);
  if (!firstMatch || !lastMatch) return 0;

  const first = parseInt(firstMatch[0], 10);
  const last = parseInt(lastMatch[0], 10);
  if (last < first) return 0;

  return last - first + 1;
}

export function calculateTotalAuthenticity(authenticityData) {
  if (!authenticityData || !Array.isArray(authenticityData)) return 0;

  let total = 0;
  authenticityData.forEach((row) => {
    total += calculateSingleAuthenticityRow(row);
  });
  return total;
}

export function countAuthenticityNumbers(entries) {
  if (!Array.isArray(entries)) return 0;

  let count = 0;
  entries.forEach((entry) => {
    if (Array.isArray(entry.authenticity_numbers)) {
      count += entry.authenticity_numbers.filter(
        (n) => n !== undefined && n !== null && String(n).trim() !== ''
      ).length;
    }
  });
  return count;
}

/** Produk Dihasilkan = (Last - First + 1) - Reject + Buffer */
export function calculateNetProduction(authenticityCount, bufferCount, rejectCount) {
  return authenticityCount - rejectCount + bufferCount;
}
