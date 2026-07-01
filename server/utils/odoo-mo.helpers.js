const ODOO_MO_SYNC_FIELDS = [
  'id',
  'name',
  'product_id',
  'product_qty',
  'product_uom_id',
  'note',
  'create_date',
  'group_worker',
];

const ODOO_MO_CACHE_UPSERT_SQL = `INSERT INTO odoo_mo_cache 
  (mo_number, sku_name, quantity, uom, note, team_name, create_date, fetched_at, last_updated) 
  VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT (mo_number) DO UPDATE SET 
    sku_name = $2, quantity = $3, uom = $4, note = $5, team_name = $6,
    create_date = $7, last_updated = CURRENT_TIMESTAMP`;

function stripNoteText(note) {
  return String(note || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractGroupWorkerName(groupWorker) {
  if (!groupWorker || groupWorker === false) {
    return '';
  }
  if (Array.isArray(groupWorker)) {
    return groupWorker[1] || '';
  }
  if (typeof groupWorker === 'object' && groupWorker !== null) {
    return groupWorker.display_name || groupWorker.name || '';
  }
  return String(groupWorker);
}

function extractTeamNameFromNote(note) {
  const trimmed = stripNoteText(note);
  if (!trimmed) {
    return '';
  }

  const upper = trimmed.toUpperCase();

  if (
    upper.includes('TEAM ') ||
    upper.includes('TIM ') ||
    upper.includes('SHIFT') ||
    upper.includes('PRODUCTION TEAM')
  ) {
    return trimmed;
  }

  return '';
}

function resolveTeamName(mo) {
  const fromGroupWorker = extractGroupWorkerName(mo.group_worker);
  if (fromGroupWorker) {
    return fromGroupWorker;
  }
  return extractTeamNameFromNote(mo.note);
}

function mapOdooMoToCacheRow(mo) {
  return {
    mo_number: mo.name,
    sku_name: mo.product_id ? mo.product_id[1] : 'N/A',
    quantity: mo.product_qty || 0,
    uom: mo.product_uom_id ? mo.product_uom_id[1] : '',
    note: mo.note || '',
    team_name: resolveTeamName(mo),
    create_date: mo.create_date || new Date().toISOString(),
  };
}

function mapOdooMoToCacheParams(mo) {
  const row = mapOdooMoToCacheRow(mo);
  return [
    row.mo_number,
    row.sku_name,
    row.quantity,
    row.uom,
    row.note,
    row.team_name,
    row.create_date,
  ];
}

const DEVICE_NOTE_ILIKE_VALUES = [
  'TIM DEVICE - SHIFT 1',
  'TIM DEVICE - SHIFT 2',
  'TIM DEVICE - SHIFT 3',
  'TEAM DEVICE - SHIFT 1',
  'TEAM DEVICE - SHIFT 2',
  'TEAM DEVICE - SHIFT 3',
  'TIM DEVICE SHIFT 1',
  'TIM DEVICE SHIFT 2',
  'TIM DEVICE SHIFT 3',
  'TEAM DEVICE SHIFT 1',
  'TEAM DEVICE SHIFT 2',
  'TEAM DEVICE SHIFT 3',
];

const DEVICE_SYNC_NOTE_ILIKE_VALUES = [
  ...DEVICE_NOTE_ILIKE_VALUES,
  'TIM DEVICE CT - SHIFT 1',
  'TIM DEVICE CT - SHIFT 2',
  'TIM DEVICE CT - SHIFT 3',
  'TEAM DEVICE CT - SHIFT 1',
  'TEAM DEVICE CT - SHIFT 2',
  'TEAM DEVICE CT - SHIFT 3',
];

const DEVICE_NOTE_SQL_PATTERNS = DEVICE_NOTE_ILIKE_VALUES.map((value) => `%${value}%`);

function buildOdooOrDomain(noteValues, startDateStr) {
  const branches = [
    ...noteValues.map((value) => ['note', 'ilike', value]),
    ['note', '=', false],
    ['note', '=', ''],
  ];
  const orOperators = Array(Math.max(0, branches.length - 1)).fill('|');
  return ['&', ...orOperators, ...branches, ['create_date', '>=', startDateStr]];
}

function buildDeviceSyncDomain(startDateStr) {
  return buildOdooOrDomain(DEVICE_SYNC_NOTE_ILIKE_VALUES, startDateStr);
}

function buildDeviceNoteFilterSql(params) {
  const conditions = DEVICE_NOTE_SQL_PATTERNS.map((pattern) => {
    params.push(pattern);
    return `note ILIKE $${params.length}`;
  });
  return `(${conditions.join(' OR ')})`;
}

function matchesDeviceNote(note) {
  const text = stripNoteText(note).toUpperCase();
  if (!text) {
    return false;
  }

  if (text.includes(' DEVICE CT')) {
    return false;
  }

  const cartridgeWords = ['CARTRIDGE', 'CARTIRDGE', 'CARTRDIGE', 'CARTRIGE', 'CARTDIGE'];
  if (cartridgeWords.some((word) => text.includes(word))) {
    return false;
  }

  const hasTeamTim = text.includes('TEAM') || text.includes('TIM');
  if (!hasTeamTim || !text.includes(' DEVICE ') || !text.includes(' SHIFT ')) {
    return false;
  }

  return true;
}

const CARTRIDGE_NOTE_PATTERNS = [
  '%TEAM CARTRIDGE%',
  '%TEAM CARTIRDGE%',
  '%TEAM CARTRDIGE%',
  '%TEAM CARTRIGE%',
  '%TIM CARTRIDGE%',
  '%TIM CARTIRDGE%',
  '%cartridge%',
  '%cartirdge%',
  '%cartrige%',
  '%cartrdige%',
  '%cartdidge%',
  '%TIM CARTRIDGE - SHIFT 1%',
  '%TIM CARTRIDGE - SHIFT 2%',
  '%TIM CARTRIDGE - SHIFT 3%',
  '%TEAM CARTRIDGE - SHIFT 1%',
  '%TEAM CARTRIDGE - SHIFT 2%',
  '%TEAM CARTRIDGE - SHIFT 3%',
  '%TIM DEVICE CT - SHIFT 1%',
  '%TIM DEVICE CT - SHIFT 2%',
  '%TIM DEVICE CT - SHIFT 3%',
  '%TEAM DEVICE CT - SHIFT 1%',
  '%TEAM DEVICE CT - SHIFT 2%',
  '%TEAM DEVICE CT - SHIFT 3%',
];

function buildCartridgeNoteFilterSql(params) {
  const conditions = CARTRIDGE_NOTE_PATTERNS.map((pattern) => {
    params.push(pattern);
    return `note ILIKE $${params.length}`;
  });
  return `(${conditions.join(' OR ')})`;
}

function matchesCartridgeNote(note) {
  const text = stripNoteText(note).toUpperCase();
  if (!text) {
    return false;
  }

  const cartridgeWords = [
    'CARTRIDGE',
    'CARTIRDGE',
    'CARTRDIGE',
    'CARTRIGE',
    'CARTDIGE',
  ];
  const hasCartridgeWord = cartridgeWords.some((word) => text.includes(word));

  const hasTeamCartridge =
    (text.includes('TEAM') || text.includes('TIM')) &&
    (hasCartridgeWord || text.includes(' DEVICE CT'));

  const hasCtShift =
    text.includes(' DEVICE CT - SHIFT ') ||
    (text.includes(' CT - SHIFT ') && (text.includes('TEAM') || text.includes('TIM')));

  return hasTeamCartridge || hasCtShift || hasCartridgeWord;
}

function buildCachedMoListQuery(productionType) {
  const params = [];
  let query = `
    SELECT mo_number, sku_name, quantity, uom, note, team_name, create_date, fetched_at
    FROM odoo_mo_cache
    WHERE create_date::TIMESTAMP >= NOW() - INTERVAL '30 days'
  `;
  const type = (productionType || '').toLowerCase();

  if (type === 'liquid') {
    query += ` AND UPPER(BTRIM(COALESCE(team_name, ''))) LIKE 'LIQ%'`;
    return {
      query: `${query} ORDER BY create_date DESC, mo_number ASC LIMIT 1000`,
      params,
      filterDescription: 'team_name prefix LIQ',
    };
  }

  if (type === 'device') {
    const deviceNoteSql = buildDeviceNoteFilterSql(params);
    query += ` AND (
      UPPER(BTRIM(COALESCE(team_name, ''))) LIKE 'DEV%'
      OR ${deviceNoteSql}
    )`;
    query += ` AND COALESCE(sku_name, '') NOT ILIKE '%cartridge%'`;
    query += ` AND NOT (note ILIKE '%DEVICE CT%')`;
    return {
      query: `${query} ORDER BY create_date DESC, mo_number ASC LIMIT 1000`,
      params,
      filterDescription: 'team_name DEV% or note TEAM/TIM DEVICE SHIFT (with/without dash)',
    };
  }

  if (type === 'cartridge') {
    query += ` AND ${buildCartridgeNoteFilterSql(params)}`;
    return {
      query: `${query} ORDER BY create_date DESC, mo_number ASC LIMIT 1000`,
      params,
      filterDescription: 'note: TEAM/TIM cartridge typos + DEVICE CT shift',
    };
  }

  return {
    query: `${query} ORDER BY create_date DESC, mo_number ASC LIMIT 1000`,
    params,
    filterDescription: 'all (no production type filter)',
  };
}

const EXTERNAL_MFG_MIN_CREATE_DATE = process.env.EXTERNAL_MFG_MIN_CREATE_DATE || '2026-07-01';
const EXTERNAL_MFG_WINDOW_DAYS_BACK = Math.max(
  0,
  parseInt(String(process.env.EXTERNAL_MFG_WINDOW_DAYS_BACK || '6'), 10) || 6
);
const EXTERNAL_MFG_WINDOW_DAYS_FORWARD = Math.max(
  0,
  parseInt(String(process.env.EXTERNAL_MFG_WINDOW_DAYS_FORWARD || '6'), 10) || 6
);

/**
 * MO rows eligible for external manufacturing idle POST (liquid only).
 * @param {{ limit?: number }} [opts]
 * @returns {{ query: string, params: unknown[], limitUsed: number, dateWindow: { from: string, to: string, minCreateDate: string }, filterDescription: string }}
 */
function buildExternalManufacturingIdlePushQuery(opts = {}) {
  const limitUsed = Math.min(2000, Math.max(1, parseInt(String(opts.limit), 10) || 200));
  const params = [];
  const cartridgeNoteSql = buildCartridgeNoteFilterSql(params);
  const deviceNoteSql = buildDeviceNoteFilterSql(params);

  params.push(EXTERNAL_MFG_MIN_CREATE_DATE);
  const minDateParam = params.length;

  params.push(EXTERNAL_MFG_WINDOW_DAYS_BACK);
  const daysBackParam = params.length;

  params.push(EXTERNAL_MFG_WINDOW_DAYS_FORWARD);
  const daysForwardParam = params.length;

  params.push(limitUsed);
  const limitParam = params.length;

  const query = `
    SELECT mo_number, sku_name, quantity, uom, note, create_date
    FROM odoo_mo_cache
    WHERE UPPER(BTRIM(COALESCE(team_name, ''))) LIKE 'LIQ%'
      AND sku_name NOT ILIKE '%MIXING%'
      AND sku_name NOT ILIKE '%BRAY%'
      AND sku_name NOT ILIKE '%bundling%'
      AND sku_name NOT ILIKE '%15 ML%'
      AND sku_name NOT ILIKE '%15ML%'
      AND NOT (${cartridgeNoteSql})
      AND NOT (
        UPPER(BTRIM(COALESCE(team_name, ''))) LIKE 'DEV%'
        OR ${deviceNoteSql}
      )
      AND DATE(create_date::TIMESTAMP) >= GREATEST(
        DATE(NOW() - ($${daysBackParam} || ' days')::INTERVAL),
        DATE($${minDateParam}::TIMESTAMP)
      )
      AND DATE(create_date::TIMESTAMP) <= DATE(NOW() + ($${daysForwardParam} || ' days')::INTERVAL)
    ORDER BY create_date DESC, mo_number ASC
    LIMIT $${limitParam}
  `;

  return {
    query,
    params,
    limitUsed,
    dateWindow: {
      minCreateDate: EXTERNAL_MFG_MIN_CREATE_DATE,
      daysBack: EXTERNAL_MFG_WINDOW_DAYS_BACK,
      daysForward: EXTERNAL_MFG_WINDOW_DAYS_FORWARD,
    },
    filterDescription:
      'team_name LIQ%, exclude MIXING/BRAY/bundling/15ML, exclude cartridge/device notes, create_date rolling window',
  };
}

async function backfillMoCacheTeamNames(pool) {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT mo_number, note
      FROM odoo_mo_cache
      WHERE team_name IS NULL OR BTRIM(COALESCE(team_name, '')) = ''
    `);

    let updated = 0;
    for (const row of rows) {
      const teamName = extractTeamNameFromNote(row.note);
      if (!teamName) {
        continue;
      }
      await client.query(
        `UPDATE odoo_mo_cache
         SET team_name = $1, last_updated = CURRENT_TIMESTAMP
         WHERE mo_number = $2`,
        [teamName, row.mo_number]
      );
      updated += 1;
    }

    if (updated > 0) {
      console.log(`✅ Backfilled team_name for ${updated} MO cache row(s) from note`);
    }

    return updated;
  } finally {
    client.release();
  }
}

module.exports = {
  ODOO_MO_SYNC_FIELDS,
  ODOO_MO_CACHE_UPSERT_SQL,
  extractGroupWorkerName,
  extractTeamNameFromNote,
  resolveTeamName,
  mapOdooMoToCacheRow,
  mapOdooMoToCacheParams,
  backfillMoCacheTeamNames,
  buildCachedMoListQuery,
  buildExternalManufacturingIdlePushQuery,
  buildDeviceSyncDomain,
  buildDeviceNoteFilterSql,
  matchesDeviceNote,
  matchesCartridgeNote,
  CARTRIDGE_NOTE_PATTERNS,
  DEVICE_NOTE_ILIKE_VALUES,
};
