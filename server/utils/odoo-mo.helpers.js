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

const ODOO_MO_LAST_SYNC_CONFIG_KEY = 'odoo_mo_last_sync_at';
const MO_CACHE_SYNC_INTERVAL_CONFIG_KEY = 'odoo_mo_cache_sync_interval_minutes';
const DEFAULT_MO_CACHE_SYNC_INTERVAL_MINUTES = 3;
const MIN_MO_CACHE_SYNC_INTERVAL_MINUTES = 1;
const MAX_MO_CACHE_SYNC_INTERVAL_MINUTES = 60;

/**
 * @param {string|null|undefined} value
 * @returns {number}
 */
function parseMoCacheSyncIntervalMinutes(value) {
  if (value == null || String(value).trim() === '') {
    return DEFAULT_MO_CACHE_SYNC_INTERVAL_MINUTES;
  }
  const parsed = parseInt(String(value).trim(), 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_MO_CACHE_SYNC_INTERVAL_MINUTES;
  }
  return Math.min(
    MAX_MO_CACHE_SYNC_INTERVAL_MINUTES,
    Math.max(MIN_MO_CACHE_SYNC_INTERVAL_MINUTES, parsed)
  );
}

/**
 * @param {object|null} db
 * @param {function(Error|null, number): void} callback
 */
function getMoCacheSyncIntervalMinutes(db, callback) {
  if (!db) {
    return callback(null, DEFAULT_MO_CACHE_SYNC_INTERVAL_MINUTES);
  }
  db.get(
    'SELECT config_value FROM admin_config WHERE config_key = $1',
    [MO_CACHE_SYNC_INTERVAL_CONFIG_KEY],
    (err, row) => {
      if (err) {
        return callback(err, DEFAULT_MO_CACHE_SYNC_INTERVAL_MINUTES);
      }
      callback(null, parseMoCacheSyncIntervalMinutes(row && row.config_value));
    }
  );
}

const ODOO_MO_CACHE_UPSERT_SQL = `INSERT INTO odoo_mo_cache 
  (mo_number, sku_name, quantity, uom, note, team_name, create_date, fetched_at, last_updated) 
  VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT (mo_number) DO UPDATE SET 
    sku_name = $2, quantity = $3, uom = $4, note = $5, team_name = $6,
    create_date = $7, fetched_at = CURRENT_TIMESTAMP, last_updated = CURRENT_TIMESTAMP`;

/**
 * Persist the time of the last completed Odoo → odoo_mo_cache pull.
 * Used by Admin "Last sync" so the value is the pull itself, not MAX(fetched_at)
 * of first-insert-only rows.
 *
 * @param {object} db - SQLite-style database wrapper from `database.js`.
 * @returns {Promise<string|null>} ISO timestamp that was stored, or null if `db` is missing.
 */
function recordMoCacheLastSync(db) {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve(null);
      return;
    }
    const value = new Date().toISOString();
    db.run(
      `INSERT INTO admin_config (config_key, config_value, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (config_key) DO UPDATE SET config_value = $2, updated_at = CURRENT_TIMESTAMP`,
      [ODOO_MO_LAST_SYNC_CONFIG_KEY, value],
      (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(value);
        }
      }
    );
  });
}

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

const LIQUID_NOTE_ILIKE_VALUES = [
  'TIM LIQUID - SHIFT 1',
  'TIM LIQUID - SHIFT 2',
  'TIM LIQUID - SHIFT 3',
  'TEAM LIQUID - SHIFT 1',
  'TEAM LIQUID - SHIFT 2',
  'TEAM LIQUID - SHIFT 3',
  'TIM LIQUID SHIFT 1',
  'TIM LIQUID SHIFT 2',
  'TIM LIQUID SHIFT 3',
  'TEAM LIQUID SHIFT 1',
  'TEAM LIQUID SHIFT 2',
  'TEAM LIQUID SHIFT 3',
];

const LIQUID_SYNC_NOTE_ILIKE_VALUES = [
  ...LIQUID_NOTE_ILIKE_VALUES,
  'TEAM LIQUID',
  'TIM LIQUID',
  'liquid',
];

const LIQUID_NOTE_SQL_PATTERNS = LIQUID_NOTE_ILIKE_VALUES.map((value) => `%${value}%`);

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

/**
 * Odoo `search_read` domain for liquid MO sync (scheduler and POST `/api/admin/sync-mo`).
 * Includes TEAM/TIM LIQUID SHIFT notes, generic `liquid`, and empty note (team may be G1).
 */
function buildLiquidSyncDomain(startDateStr) {
  return buildOdooOrDomain(LIQUID_SYNC_NOTE_ILIKE_VALUES, startDateStr);
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

function buildLiquidNoteFilterSql(params) {
  const conditions = LIQUID_NOTE_SQL_PATTERNS.map((pattern) => {
    params.push(pattern);
    return `note ILIKE $${params.length}`;
  });
  return `(${conditions.join(' OR ')})`;
}

/**
 * Liquid MO from Odoo note `TEAM/TIM LIQUID - SHIFT n` (dash optional).
 * Used by cache list SQL counterpart `matchesLiquidNote` on the client picker.
 * Excludes cartridge and DEVICE so those stay on their own pages.
 *
 * @param {unknown} note
 * @returns {boolean}
 */
function matchesLiquidNote(note) {
  const text = stripNoteText(note).toUpperCase();
  if (!text) {
    return false;
  }

  if (text.includes(' DEVICE CT') || text.includes(' DEVICE ')) {
    return false;
  }

  const cartridgeWords = ['CARTRIDGE', 'CARTIRDGE', 'CARTRDIGE', 'CARTRIGE', 'CARTDIGE'];
  if (cartridgeWords.some((word) => text.includes(word))) {
    return false;
  }

  const hasTeamTim = text.includes('TEAM') || text.includes('TIM');
  if (!hasTeamTim || !text.includes(' LIQUID ') || !text.includes(' SHIFT ')) {
    return false;
  }

  return true;
}

/**
 * Liquid team from Odoo `group_worker`: historic `LIQ…` plus new `G1`/`G2`/… codes.
 * `G1` is a whole token (`G1`, `G1 - …`); `G1LIQUID` does not match.
 *
 * @param {string} teamName
 * @returns {boolean}
 */
function matchesLiquidTeamName(teamName) {
  const team = String(teamName || '').trim().toUpperCase();
  if (!team) {
    return false;
  }
  if (team.startsWith('LIQ')) {
    return true;
  }
  return /^G[0-9]+([\s-].*)?$/.test(team);
}

/**
 * SQL fragment for liquid cache/idle eligibility.
 * Mutates `params` with liquid note ILIKE binds.
 * Callers: `/api/odoo/mo-list` and idle MES push — not the Odoo sync domain.
 *
 * @param {unknown[]} params
 * @returns {string}
 */
function buildLiquidEligibilitySql(params) {
  const liquidNoteSql = buildLiquidNoteFilterSql(params);
  return `(
    UPPER(BTRIM(COALESCE(team_name, ''))) LIKE 'LIQ%'
    OR UPPER(BTRIM(COALESCE(team_name, ''))) ~ '^G[0-9]+([\\s-].*)?$'
    OR ${liquidNoteSql}
  )`;
}

/**
 * Odoo note ILIKE patterns for cartridge MO list/cache filters.
 * Typos in Odoo (`cartirdge`, `cartrige`, `cartrdige`, …) are part of the contract —
 * do not collapse this list to a single `cartridge` token.
 */
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

/**
 * SQL fragment `(note ILIKE $n OR …)` for cartridge notes, including typo variants
 * and DEVICE CT shift notes. Mutates `params` with each pattern (PostgreSQL `$n` binds).
 *
 * @param {unknown[]} params
 * @returns {string}
 */
function buildCartridgeNoteFilterSql(params) {
  const conditions = CARTRIDGE_NOTE_PATTERNS.map((pattern) => {
    params.push(pattern);
    return `note ILIKE $${params.length}`;
  });
  return `(${conditions.join(' OR ')})`;
}

/**
 * In-memory counterpart of `buildCartridgeNoteFilterSql` (typo-tolerant cartridge / DEVICE CT).
 * Used when a row is already loaded and must match the same contract as the SQL filter.
 */
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

const CARTRIDGE_SKU_ILIKE_PATTERNS = [
  '%CARTRIDGE%',
  '%CARTIRDGE%',
  '%CARTRDIGE%',
  '%CARTRIGE%',
  '%CARTDIGE%',
  '%CARTDIDGE%',
];

function buildSkuHasCartridgeSql() {
  return `(${CARTRIDGE_SKU_ILIKE_PATTERNS.map((pattern) => `sku_name ILIKE '${pattern}'`).join(' OR ')})`;
}

function buildSkuHasPodSql() {
  return `(sku_name ~* '\\yPOD\\y')`;
}

function buildSkuHasCtTokenSql() {
  return `(sku_name ~* '\\yCT\\y')`;
}

/** Note empty after stripping HTML tags — counterpart of JS `isNoteEmptyForSkuFallback`. */
function buildEmptyNoteSql() {
  return `BTRIM(regexp_replace(COALESCE(note, ''), '<[^>]+>', ' ', 'g')) = ''`;
}

function buildTeamBlocksSkuFallbackSql() {
  return `(
    UPPER(BTRIM(COALESCE(team_name, ''))) LIKE 'LIQ%'
    OR UPPER(BTRIM(COALESCE(team_name, ''))) ~ '^G[0-9]+([\\s-].*)?$'
    OR UPPER(BTRIM(COALESCE(team_name, ''))) LIKE 'DEV%'
  )`;
}

/**
 * Gate for SKU page fallback: empty note and team_name not LIQ… / G1/G2/… / DEV….
 * Note/team filters still win when they match.
 */
function buildSkuFallbackGateSql() {
  return `(${buildEmptyNoteSql()} AND NOT ${buildTeamBlocksSkuFallbackSql()})`;
}

function buildSkuFallbackCartridgeSql() {
  return `(
    ${buildSkuFallbackGateSql()}
    AND sku_name NOT ILIKE '%MIXING%'
    AND (${buildSkuHasCartridgeSql()} OR ${buildSkuHasCtTokenSql()})
  )`;
}

function buildSkuFallbackDeviceSql() {
  return `(
    ${buildSkuFallbackGateSql()}
    AND sku_name NOT ILIKE '%MIXING%'
    AND ${buildSkuHasPodSql()}
    AND NOT ${buildSkuHasCartridgeSql()}
    AND NOT ${buildSkuHasCtTokenSql()}
  )`;
}

/** Liquid 15 ml or 30 ml via SKU when note+team do not match (MIXING/BRAY/POD/cartridge/CT excluded). */
function buildSkuFallbackLiquidSql() {
  return `(
    ${buildSkuFallbackGateSql()}
    AND sku_name NOT ILIKE '%MIXING%'
    AND sku_name NOT ILIKE '%BRAY%'
    AND NOT ${buildSkuHasPodSql()}
    AND NOT ${buildSkuHasCartridgeSql()}
    AND NOT ${buildSkuHasCtTokenSql()}
  )`;
}

/**
 * Cached MO dropdown query for `/api/odoo/mo-list`.
 * `productionType` is the UI page (liquid/device/cartridge), not the MO string format.
 * Liquid: team_name `LIQ%` or `G1`/`G2`/…, or note TEAM/TIM LIQUID SHIFT,
 * or empty-note SKU fallback (not MIXING/BRAY/POD/cartridge/CT) → 15 ml or 30 ml on the client.
 * Device: `DEV%` or device notes, exclude cartridge SKU and DEVICE CT notes,
 * or empty-note SKU with POD token only.
 * Cartridge: typo-tolerant note OR (see `CARTRIDGE_NOTE_PATTERNS`),
 * or empty-note SKU with CARTRIDGE/typos or token CT.
 * Window: last 30 days, limit 1000.
 *
 * @param {string} productionType
 * @returns {{ query: string, params: unknown[], filterDescription: string }}
 */
function buildCachedMoListQuery(productionType) {
  const params = [];
  let query = `
    SELECT mo_number, sku_name, quantity, uom, note, team_name, create_date, fetched_at
    FROM odoo_mo_cache
    WHERE create_date::TIMESTAMP >= NOW() - INTERVAL '30 days'
  `;
  const type = (productionType || '').toLowerCase();

  if (type === 'liquid') {
    query += ` AND (
      ${buildLiquidEligibilitySql(params)}
      OR ${buildSkuFallbackLiquidSql()}
    )`;
    return {
      query: `${query} ORDER BY create_date DESC, mo_number ASC LIMIT 1000`,
      params,
      filterDescription:
        'team_name LIQ% or G1/G2/… or note TEAM/TIM LIQUID SHIFT, or empty-note SKU fallback (not MIXING/BRAY/POD/cartridge/CT)',
    };
  }

  if (type === 'device') {
    const deviceNoteSql = buildDeviceNoteFilterSql(params);
    query += ` AND (
      (
        UPPER(BTRIM(COALESCE(team_name, ''))) LIKE 'DEV%'
        OR ${deviceNoteSql}
      )
      AND COALESCE(sku_name, '') NOT ILIKE '%cartridge%'
      AND NOT (note ILIKE '%DEVICE CT%')
      OR ${buildSkuFallbackDeviceSql()}
    )`;
    return {
      query: `${query} ORDER BY create_date DESC, mo_number ASC LIMIT 1000`,
      params,
      filterDescription:
        'team_name DEV% or note TEAM/TIM DEVICE SHIFT (with/without dash), or empty-note SKU with POD only',
    };
  }

  if (type === 'cartridge') {
    query += ` AND (
      ${buildCartridgeNoteFilterSql(params)}
      OR ${buildSkuFallbackCartridgeSql()}
    )`;
    return {
      query: `${query} ORDER BY create_date DESC, mo_number ASC LIMIT 1000`,
      params,
      filterDescription:
        'note: TEAM/TIM cartridge typos + DEVICE CT shift, or empty-note SKU with CARTRIDGE/CT',
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
  const liquidEligibilitySql = buildLiquidEligibilitySql(params);
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
    WHERE ${liquidEligibilitySql}
      AND sku_name NOT ILIKE '%MIXING%'
      AND sku_name NOT ILIKE '%BRAY%'
      AND sku_name NOT ILIKE '%bundling%'
      AND sku_name NOT ILIKE '%slof%'
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
      'team_name LIQ% or G1/G2/… or note TEAM/TIM LIQUID SHIFT, exclude MIXING/BRAY/bundling/slof/15ML (30ml only), exclude cartridge/device notes, create_date rolling window',
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
  ODOO_MO_LAST_SYNC_CONFIG_KEY,
  MO_CACHE_SYNC_INTERVAL_CONFIG_KEY,
  DEFAULT_MO_CACHE_SYNC_INTERVAL_MINUTES,
  MIN_MO_CACHE_SYNC_INTERVAL_MINUTES,
  MAX_MO_CACHE_SYNC_INTERVAL_MINUTES,
  parseMoCacheSyncIntervalMinutes,
  getMoCacheSyncIntervalMinutes,
  ODOO_MO_CACHE_UPSERT_SQL,
  recordMoCacheLastSync,
  extractGroupWorkerName,
  extractTeamNameFromNote,
  resolveTeamName,
  mapOdooMoToCacheRow,
  mapOdooMoToCacheParams,
  backfillMoCacheTeamNames,
  buildCachedMoListQuery,
  buildExternalManufacturingIdlePushQuery,
  buildDeviceSyncDomain,
  buildLiquidSyncDomain,
  buildDeviceNoteFilterSql,
  buildLiquidNoteFilterSql,
  matchesDeviceNote,
  matchesLiquidNote,
  matchesLiquidTeamName,
  matchesCartridgeNote,
  CARTRIDGE_NOTE_PATTERNS,
  DEVICE_NOTE_ILIKE_VALUES,
  LIQUID_NOTE_ILIKE_VALUES,
};
