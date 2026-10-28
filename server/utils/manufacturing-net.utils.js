const { parseAuthenticityData, calculateQuantityFromAuthenticity } = require('./authenticity.utils');

function parseAuthenticityNumbersRows(rows) {
  return (rows || []).map((row) => ({
    ...row,
    authenticity_numbers:
      typeof row.authenticity_numbers === 'string'
        ? JSON.parse(row.authenticity_numbers)
        : row.authenticity_numbers
  }));
}

function countAuthenticityNumbers(rows) {
  let count = 0;
  for (const row of rows) {
    if (Array.isArray(row.authenticity_numbers)) {
      count += row.authenticity_numbers.filter(
        (n) => n !== undefined && n !== null && String(n).trim() !== ''
      ).length;
    }
  }
  return count;
}

function calculateNetProduction(authenticityCount, bufferCount, rejectCount) {
  return authenticityCount - rejectCount + bufferCount;
}

function collectSessionBufferReject(inputs, sessionId) {
  const bufferMap = new Map();
  const rejectMap = new Map();

  inputs.forEach((input) => {
    (input.buffers || []).forEach((buffer) => {
      if (buffer.session_id === sessionId && !bufferMap.has(buffer.id)) {
        bufferMap.set(buffer.id, buffer);
      }
    });
    (input.rejects || []).forEach((reject) => {
      if (reject.session_id === sessionId && !rejectMap.has(reject.id)) {
        rejectMap.set(reject.id, reject);
      }
    });
  });

  return {
    buffers: [...bufferMap.values()],
    rejects: [...rejectMap.values()]
  };
}

function groupBySession(data) {
  if (!Array.isArray(data)) return [];

  const grouped = {};

  data.forEach((item) => {
    const key = `${item.production_type}::${item.session_id}`;
    if (!grouped[key]) {
      grouped[key] = {
        session_id: item.session_id,
        production_type: item.production_type,
        inputs: []
      };
    }
    grouped[key].inputs.push(item);
  });

  return Object.values(grouped).map((session) => {
    const { buffers, rejects } = collectSessionBufferReject(session.inputs, session.session_id);
    const totalAuthenticity = session.inputs.reduce(
      (sum, input) => sum + calculateQuantityFromAuthenticity(input.authenticity_data),
      0
    );
    const totalBuffer = countAuthenticityNumbers(buffers);
    const totalReject = countAuthenticityNumbers(rejects);
    const netProduction = calculateNetProduction(totalAuthenticity, totalBuffer, totalReject);

    return {
      ...session,
      buffers,
      rejects,
      totalAuthenticity,
      totalBuffer,
      totalReject,
      netProduction
    };
  });
}

function getJakartaDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === 'year').value;
  const month = parts.find((p) => p.type === 'month').value;
  const day = parts.find((p) => p.type === 'day').value;
  return { year: Number(year), ymd: `${year}-${month}-${day}` };
}

async function fetchBufferRejectByType(queryAll, productionType, moNumbers) {
  if (!moNumbers.length) {
    return new Map();
  }

  const bufferTable = `buffer_${productionType}`;
  const rejectTable = `reject_${productionType}`;
  const sql = (table) =>
    `SELECT * FROM ${table} WHERE mo_number = ANY($1::text[]) ORDER BY mo_number, created_at DESC`;

  const [bufferRows, rejectRows] = await Promise.all([
    queryAll(sql(bufferTable), [moNumbers]),
    queryAll(sql(rejectTable), [moNumbers])
  ]);

  const map = new Map();
  for (const mo of moNumbers) {
    map.set(mo, { buffers: [], rejects: [] });
  }

  for (const row of parseAuthenticityNumbersRows(bufferRows)) {
    const entry = map.get(row.mo_number);
    if (entry) entry.buffers.push(row);
  }

  for (const row of parseAuthenticityNumbersRows(rejectRows)) {
    const entry = map.get(row.mo_number);
    if (entry) entry.rejects.push(row);
  }

  return map;
}

const PRODUCTION_TABLES = [
  { name: 'production_liquid', type: 'liquid' },
  { name: 'production_device', type: 'device' },
  { name: 'production_cartridge', type: 'cartridge' }
];

/**
 * Sum net production (per session, no double-count) for YTD in Asia/Jakarta.
 * @param {(sql: string, params?: unknown[]) => Promise<unknown[]>} queryAll
 */
async function computeYtdNetProductionTotal(queryAll) {
  const { year, ymd: periodEnd } = getJakartaDateParts(new Date());
  const periodStart = `${year}-01-01`;

  const dateFilterSql = `
    AND DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta') >= $1
    AND DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta') <= $2
  `;

  const allResults = [];

  for (const table of PRODUCTION_TABLES) {
    const query = `
      SELECT
        id,
        session_id,
        leader_name,
        shift_number,
        pic,
        mo_number,
        sku_name,
        authenticity_data,
        status,
        created_at,
        '${table.type}' AS production_type
      FROM ${table.name}
      WHERE status IN ('active', 'completed')
      ${dateFilterSql}
    `;
    const rows = await queryAll(query, [periodStart, periodEnd]);
    allResults.push(...rows.map((row) => parseAuthenticityData(row)));
  }

  const moByType = new Map();
  for (const row of allResults) {
    const key = `${row.production_type}::${row.mo_number}`;
    if (!moByType.has(key)) {
      moByType.set(key, { production_type: row.production_type, mo_number: row.mo_number });
    }
  }

  const moNumbersByType = {};
  for (const { production_type, mo_number } of moByType.values()) {
    if (!moNumbersByType[production_type]) {
      moNumbersByType[production_type] = [];
    }
    moNumbersByType[production_type].push(mo_number);
  }

  const bufferRejectLookup = new Map();
  await Promise.all(
    Object.entries(moNumbersByType).map(async ([productionType, moNumbers]) => {
      const uniqueMoNumbers = [...new Set(moNumbers)];
      const typeMap = await fetchBufferRejectByType(queryAll, productionType, uniqueMoNumbers);
      for (const [mo, data] of typeMap.entries()) {
        bufferRejectLookup.set(`${productionType}::${mo}`, data);
      }
    })
  );

  const enrichedRows = allResults.map((row) => {
    const bufferReject = bufferRejectLookup.get(`${row.production_type}::${row.mo_number}`) || {
      buffers: [],
      rejects: []
    };
    return {
      ...row,
      buffers: bufferReject.buffers,
      rejects: bufferReject.rejects
    };
  });

  const sessions = groupBySession(enrichedRows);
  const totalNetProduction = sessions.reduce((sum, session) => sum + session.netProduction, 0);

  return {
    year,
    periodStart,
    periodEnd,
    totalNetProduction,
    sessionCount: sessions.length
  };
}

module.exports = {
  groupBySession,
  computeYtdNetProductionTotal,
  getJakartaDateParts
};
