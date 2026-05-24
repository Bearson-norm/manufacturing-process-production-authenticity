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
    query += ` AND UPPER(BTRIM(COALESCE(team_name, ''))) LIKE 'DEV%'`;
    query += ` AND COALESCE(sku_name, '') NOT ILIKE '%cartridge%'`;
    return {
      query: `${query} ORDER BY create_date DESC, mo_number ASC LIMIT 1000`,
      params,
      filterDescription: 'team_name prefix DEV',
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
  CARTRIDGE_NOTE_PATTERNS,
  matchesCartridgeNote,
};
