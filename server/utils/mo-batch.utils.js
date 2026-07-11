const MAX_MO_BATCH = 5000;

function parseMoNumbersFromBody(body) {
  if (!body || typeof body !== 'object') {
    return { error: 'Request body is required', moNumbers: [] };
  }

  const raw = body.moNumbers ?? body.mo_numbers ?? body.moList;
  if (raw === undefined || raw === null) {
    return { error: 'moNumbers must be an array', moNumbers: [] };
  }
  if (!Array.isArray(raw)) {
    return { error: 'moNumbers must be an array', moNumbers: [] };
  }

  const moNumbers = [...new Set(raw.map((m) => String(m).trim()).filter(Boolean))];
  return { error: null, moNumbers };
}

module.exports = {
  MAX_MO_BATCH,
  parseMoNumbersFromBody
};
