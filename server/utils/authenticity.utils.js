// Helper function to parse authenticity data
function parseAuthenticityData(row) {
  try {
    return {
      ...row,
      authenticity_data: typeof row.authenticity_data === 'string' 
        ? JSON.parse(row.authenticity_data) 
        : row.authenticity_data
    };
  } catch (e) {
    return {
      ...row,
      authenticity_data: []
    };
  }
}

// Normalize authenticity rows so leading zeros are preserved as strings
function normalizeAuthenticityRow(row = {}) {
  const safeRow = typeof row === 'object' && row !== null ? row : {};
  const toText = (v) => (v === undefined || v === null) ? '' : String(v).trim();
  return {
    firstAuthenticity: toText(safeRow.firstAuthenticity),
    lastAuthenticity: toText(safeRow.lastAuthenticity),
    rollNumber: toText(safeRow.rollNumber)
  };
}

function normalizeAuthenticityArray(data) {
  const rows = Array.isArray(data) ? data : [data];
  return rows.map(normalizeAuthenticityRow);
}

function normalizeAuthenticityNumbers(numbers) {
  const arr = Array.isArray(numbers) ? numbers : [numbers];
  return arr
    .map((n) => (n === undefined || n === null) ? '' : String(n).trim())
    .filter((n) => n !== '');
}

module.exports = {
  parseAuthenticityData,
  normalizeAuthenticityRow,
  normalizeAuthenticityArray,
  normalizeAuthenticityNumbers
};
