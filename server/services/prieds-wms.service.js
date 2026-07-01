const { pool } = require('../database');

const WMS_LIST_PATH = '/add-on-custom-api/repacking-production/get-repacking-production-report-list';
const PAGE_LIMIT = 100;
const MAX_CARTONS_PER_MO = 500;

function normalizeAccessToken(token) {
  let value = String(token || '').trim();
  if (/^bearer\s+/i.test(value)) {
    value = value.replace(/^bearer\s+/i, '').trim();
  }
  return value;
}

function decodeJwtPayload(token) {
  const normalized = normalizeAccessToken(token);
  const parts = normalized.split('.');
  if (parts.length < 2) {
    return null;
  }

  const segment = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = segment + '='.repeat((4 - (segment.length % 4)) % 4);

  try {
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

/** Align intercept_request identity with JWT claims when Admin fields are empty. */
function enrichConfigFromToken(config) {
  const accessToken = normalizeAccessToken(config.accessToken);
  const payload = decodeJwtPayload(accessToken);
  if (!payload) {
    return { ...config, accessToken };
  }

  return {
    ...config,
    accessToken,
    username: String(config.username || '').trim() || String(payload.username || '').trim() || 'user',
    companyId: String(config.companyId || '').trim() || String(payload.company_id || '').trim() || 'FOOM'
  };
}

function getConfigValue(key, envKey, fallback = '') {
  return new Promise((resolve, reject) => {
    const { db } = require('../database');
    db.get('SELECT config_value FROM admin_config WHERE config_key = $1', [key], (err, row) => {
      if (err) return reject(err);
      const val = row && row.config_value != null ? String(row.config_value).trim() : '';
      resolve(val || (process.env[envKey] || fallback));
    });
  });
}

async function getWmsConfig() {
  const [apiBaseUrl, accessToken, username, companyId, site] = await Promise.all([
    getConfigValue('wms_api_base_url', 'WMS_API_BASE_URL', 'https://wms.foom.id/api'),
    getConfigValue('wms_access_token', 'WMS_ACCESS_TOKEN', ''),
    getConfigValue('wms_username', 'WMS_USERNAME', ''),
    getConfigValue('wms_company_id', 'WMS_COMPANY_ID', 'FOOM'),
    getConfigValue('wms_site', 'WMS_SITE', 'PROD')
  ]);

  return {
    apiBaseUrl: apiBaseUrl.replace(/\/+$/, ''),
    accessToken,
    username,
    companyId,
    site
  };
}

function buildInterceptPayload(config, body) {
  return {
    intercept_request: {
      request_id: `${config.username || 'user'}-${Date.now()}`,
      username: config.username || 'user',
      company_id: config.companyId,
      current_page: 'https://wms.foom.id/OMS/repacking-production-report'
    },
    body
  };
}

function buildMoLookupVariants(moNumber) {
  const raw = String(moNumber || '').trim();
  if (!raw) return [];

  const variants = [];
  const add = (value) => {
    const v = String(value || '').trim();
    if (v && !variants.includes(v)) variants.push(v);
  };

  add(raw);
  add(raw.toUpperCase());

  const prodMatch = raw.match(/^PROD\/MO\/(.+)$/i);
  if (prodMatch) {
    add(`PROD/MO/${prodMatch[1].toUpperCase()}`);
    add(prodMatch[1]);
  }

  const moSlashMatch = raw.match(/^MO\/(.+)$/i);
  if (moSlashMatch) {
    add(`MO/${moSlashMatch[1]}`);
    add(`PROD/MO/${moSlashMatch[1]}`);
  }

  const numMatch = raw.match(/(\d+)\s*$/);
  if (numMatch) {
    const num = numMatch[1];
    add(num);
    add(`PROD/MO/${num}`);
    add(`MO/${num}`);
  }

  return variants;
}

/** Normalize Prieds list API payloads (data may be nested under body/result). */
function parseWmsListResponse(payload) {
  if (!payload || typeof payload !== 'object') {
    return { rows: [], total: 0 };
  }

  if (typeof payload.body === 'string') {
    try {
      return parseWmsListResponse(JSON.parse(payload.body));
    } catch {
      // fall through
    }
  }

  if (Array.isArray(payload)) {
    return { rows: payload, total: payload.length };
  }

  const nodes = [payload, payload.body, payload.result, payload.response, payload.data].filter(
    (node) => node && typeof node === 'object'
  );

  for (const node of nodes) {
    if (Array.isArray(node)) {
      return { rows: node, total: node.length };
    }
    if (Array.isArray(node.data)) {
      return {
        rows: node.data,
        total:
          typeof node.total === 'number'
            ? node.total
            : typeof node.count === 'number'
              ? node.count
              : node.data.length
      };
    }
    if (Array.isArray(node.list)) {
      return { rows: node.list, total: typeof node.total === 'number' ? node.total : node.list.length };
    }
    if (Array.isArray(node.records)) {
      return { rows: node.records, total: typeof node.total === 'number' ? node.total : node.records.length };
    }
  }

  if (Array.isArray(payload.data)) {
    return {
      rows: payload.data,
      total: typeof payload.total === 'number' ? payload.total : payload.data.length
    };
  }

  return { rows: [], total: 0 };
}

function isWmsTokenError(payload) {
  const message = String((payload && payload.message) || '').toLowerCase();
  return (
    message === 'token invalid!' ||
    message.includes('token invalid') ||
    message.includes('jwt') ||
    message.includes('unauthorized') ||
    message.includes('not login')
  );
}

async function callWmsApi(config, body) {
  const resolved = enrichConfigFromToken(config);

  if (!resolved.accessToken) {
    throw new Error('WMS access token is not configured. Set it in Admin → WMS Prieds Configuration.');
  }

  const url = `${resolved.apiBaseUrl}${WMS_LIST_PATH}`;
  const payload = buildInterceptPayload(resolved, body);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-access-token': resolved.accessToken
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Invalid WMS API response: ${text.slice(0, 200)}`);
  }

  if (isWmsTokenError(data)) {
    const jwtPayload = decodeJwtPayload(resolved.accessToken);
    const jwtUser = jwtPayload && jwtPayload.username ? String(jwtPayload.username) : null;
    const hint = jwtUser
      ? ` JWT memuat username "${jwtUser}" — pastikan field Username sama, token masih aktif (login ulang di WMS), dan Company ID = ${jwtPayload.company_id || 'FOOM'}.`
      : ' Paste token JWT terbaru dari header x-access-token setelah login di https://wms.foom.id.';
    throw new Error(`${data.message || 'WMS token invalid'}${hint}`);
  }

  if (!response.ok) {
    throw new Error(data.message || `WMS API HTTP ${response.status}`);
  }

  if (data.statusCode === 0 && parseWmsListResponse(data).rows.length === 0) {
    const msg = String(data.message || '').trim();
    if (msg && !/not found|no data|empty|tidak ada/i.test(msg)) {
      throw new Error(msg);
    }
  }

  return data;
}

function buildMoSearchConditions(config, moVariant) {
  const base = { manufacturing_order_id: moVariant };
  const withCompany = { company_id: config.companyId, site: config.site, ...base };
  const withCompanyOnly = { company_id: config.companyId, ...base };
  const conditions = [withCompany, withCompanyOnly, base];

  const numMatch = String(moVariant).match(/(\d+)\s*$/);
  if (numMatch) {
    const regexCond = {
      company_id: config.companyId,
      site: config.site,
      manufacturing_order_id: { $regex: numMatch[1], $options: 'i' }
    };
    conditions.push(regexCond);
  }

  return conditions;
}

async function fetchCartonsPage(config, condition, { page = 1, limit = PAGE_LIMIT } = {}) {
  const result = await callWmsApi(config, {
    condition,
    page,
    limit,
    sort: { created_time: -1 }
  });
  return parseWmsListResponse(result);
}

async function fetchCartonsByMo(moNumber, { page = 1, limit = PAGE_LIMIT, config: configOverride } = {}) {
  const config = enrichConfigFromToken(configOverride || (await getWmsConfig()));
  const variants = buildMoLookupVariants(moNumber);

  for (const moVariant of variants) {
    for (const condition of buildMoSearchConditions(config, moVariant)) {
      const { rows, total } = await fetchCartonsPage(config, condition, { page, limit });
      if (rows.length > 0 || total > 0) {
        if (page === 1 && rows.length === 0 && total > 0) {
          return fetchCartonsPage(config, condition, { page, limit });
        }
        return { data: rows, total, matched_mo: moVariant, condition };
      }
    }
  }

  return { data: [], total: 0, matched_mo: null, condition: null };
}

async function fetchAllCartonsByMo(moNumber) {
  const config = enrichConfigFromToken(await getWmsConfig());
  const variants = buildMoLookupVariants(moNumber);
  let matchedCondition = null;
  let matchedMo = null;
  let total = 0;

  for (const moVariant of variants) {
    for (const condition of buildMoSearchConditions(config, moVariant)) {
      const probe = await fetchCartonsPage(config, condition, { page: 1, limit: 1 });
      if (probe.rows.length > 0 || probe.total > 0) {
        matchedCondition = condition;
        matchedMo = moVariant;
        total = probe.total;
        break;
      }
    }
    if (matchedCondition) break;
  }

  if (!matchedCondition) {
    console.log(`ℹ️  [WMS] No cartons for MO "${moNumber}" (tried variants: ${variants.join(', ')})`);
    return [];
  }

  const all = [];
  let page = 1;

  while (all.length < total && all.length < MAX_CARTONS_PER_MO) {
    const { rows } = await fetchCartonsPage(config, matchedCondition, { page, limit: PAGE_LIMIT });
    if (!rows.length) break;
    all.push(...rows);
    if (rows.length < PAGE_LIMIT) break;
    page += 1;
  }

  if (matchedMo && matchedMo !== String(moNumber).trim()) {
    console.log(`ℹ️  [WMS] MO "${moNumber}" matched WMS as "${matchedMo}"`);
  }

  return all.slice(0, MAX_CARTONS_PER_MO);
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function mapCartonRow(row, moNumberCanonical) {
  const priedsId = row._id != null ? row._id : row.id;
  return {
    prieds_id: priedsId != null ? String(priedsId) : `${row.manufacturing_order_id || 'unknown'}-${row.barcode || Date.now()}`,
    manufacturing_order_id: String(moNumberCanonical || row.manufacturing_order_id || '').trim(),
    stock_transfer_order_id: row.stock_transfer_order_id || null,
    company_id: row.company_id || null,
    site: row.site || null,
    barcode: row.barcode || null,
    carton_label: row.carton_label || null,
    sku: row.sku || null,
    sku_number: row.sku_number || null,
    description: row.description || null,
    production_date: parseDate(row.production_date),
    expired_date: parseDate(row.expired_date),
    created_time: parseDate(row.created_time),
    inbound_time: parseDate(row.inbound_time),
    counting: row.counting != null ? Number(row.counting) : null,
    total_carton: row.total_carton != null ? Number(row.total_carton) : null,
    qty: row.qty != null ? Number(row.qty) : null,
    uom: row.uom || null,
    status: row.status != null ? Number(row.status) : null,
    team_name: row.team_name || null,
    sloc: row.sloc || null,
    line: row.line || null,
    cost: row.cost != null ? Number(row.cost) : null,
    sku_count: row.sku_count != null ? String(row.sku_count) : null,
    custom_field: row.custom_field || null,
    attribute_list: row.attribute_list || null,
    raw_payload: row,
    qr_list: Array.isArray(row.qr_list) ? row.qr_list : []
  };
}

async function upsertCartonWithQr(client, mapped) {
  const upsertResult = await client.query(
    `INSERT INTO wms_repacking_carton (
      prieds_id, manufacturing_order_id, stock_transfer_order_id, company_id, site,
      barcode, carton_label, sku, sku_number, description,
      production_date, expired_date, created_time, inbound_time,
      counting, total_carton, qty, uom, status,
      team_name, sloc, line, cost, sku_count,
      custom_field, attribute_list, raw_payload, synced_at, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
    )
    ON CONFLICT (prieds_id) DO UPDATE SET
      manufacturing_order_id = EXCLUDED.manufacturing_order_id,
      stock_transfer_order_id = EXCLUDED.stock_transfer_order_id,
      company_id = EXCLUDED.company_id,
      site = EXCLUDED.site,
      barcode = EXCLUDED.barcode,
      carton_label = EXCLUDED.carton_label,
      sku = EXCLUDED.sku,
      sku_number = EXCLUDED.sku_number,
      description = EXCLUDED.description,
      production_date = EXCLUDED.production_date,
      expired_date = EXCLUDED.expired_date,
      created_time = EXCLUDED.created_time,
      inbound_time = EXCLUDED.inbound_time,
      counting = EXCLUDED.counting,
      total_carton = EXCLUDED.total_carton,
      qty = EXCLUDED.qty,
      uom = EXCLUDED.uom,
      status = EXCLUDED.status,
      team_name = EXCLUDED.team_name,
      sloc = EXCLUDED.sloc,
      line = EXCLUDED.line,
      cost = EXCLUDED.cost,
      sku_count = EXCLUDED.sku_count,
      custom_field = EXCLUDED.custom_field,
      attribute_list = EXCLUDED.attribute_list,
      raw_payload = EXCLUDED.raw_payload,
      synced_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    RETURNING id`,
    [
      mapped.prieds_id,
      mapped.manufacturing_order_id,
      mapped.stock_transfer_order_id,
      mapped.company_id,
      mapped.site,
      mapped.barcode,
      mapped.carton_label,
      mapped.sku,
      mapped.sku_number,
      mapped.description,
      mapped.production_date,
      mapped.expired_date,
      mapped.created_time,
      mapped.inbound_time,
      mapped.counting,
      mapped.total_carton,
      mapped.qty,
      mapped.uom,
      mapped.status,
      mapped.team_name,
      mapped.sloc,
      mapped.line,
      mapped.cost,
      mapped.sku_count,
      JSON.stringify(mapped.custom_field),
      JSON.stringify(mapped.attribute_list),
      JSON.stringify(mapped.raw_payload)
    ]
  );

  const cartonId = upsertResult.rows[0].id;
  await client.query('DELETE FROM wms_repacking_qr WHERE carton_id = $1', [cartonId]);

  let qrCount = 0;
  for (const qr of mapped.qr_list) {
    const priedsQrId = qr._id ? String(qr._id) : `${cartonId}-${qr.barcode}-${qrCount}`;
    await client.query(
      `INSERT INTO wms_repacking_qr (carton_id, prieds_qr_id, barcode, qty, synced_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (carton_id, prieds_qr_id) DO UPDATE SET
         barcode = EXCLUDED.barcode,
         qty = EXCLUDED.qty,
         synced_at = CURRENT_TIMESTAMP`,
      [cartonId, priedsQrId, qr.barcode || '', qr.qty != null ? Number(qr.qty) : 1]
    );
    qrCount += 1;
  }

  return { cartonId, qrCount };
}

async function syncMoFromWms(moNumber) {
  const client = await pool.connect();
  const wmsConfig = enrichConfigFromToken(await getWmsConfig());
  let cartonsUpserted = 0;
  let qrUpserted = 0;

  try {
    const rows = await fetchAllCartonsByMo(moNumber);
    await client.query('BEGIN');

    for (const row of rows) {
      const mapped = mapCartonRow(row, moNumber);
      const { qrCount } = await upsertCartonWithQr(client, mapped);
      cartonsUpserted += 1;
      qrUpserted += qrCount;
    }

    await client.query(
      `INSERT INTO wms_sync_log (manufacturing_order_id, cartons_upserted, qr_upserted, status, synced_at)
       VALUES ($1, $2, $3, 'success', CURRENT_TIMESTAMP)`,
      [moNumber, cartonsUpserted, qrUpserted]
    );

    await client.query('COMMIT');

    const variantsTried = buildMoLookupVariants(moNumber);
    const result = {
      success: true,
      mo_number: moNumber,
      cartons_upserted: cartonsUpserted,
      qr_upserted: qrUpserted,
      fetched_from_wms: rows.length,
      mo_variants_tried: variantsTried
    };

    if (rows.length === 0) {
      result.warning =
        `WMS tidak mengembalikan data repacking untuk MO "${moNumber}". ` +
        `Pastikan MO sudah ada di WMS Repacking Production Report (format: PROD/MO/xxxxx) ` +
        `dan Site/Company ID di Admin sesuai data WMS (Site: ${wmsConfig.site}, Company: ${wmsConfig.companyId}).`;
    }

    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    await client.query(
      `INSERT INTO wms_sync_log (manufacturing_order_id, cartons_upserted, qr_upserted, status, error_message, synced_at)
       VALUES ($1, $2, $3, 'error', $4, CURRENT_TIMESTAMP)`,
      [moNumber, cartonsUpserted, qrUpserted, error.message]
    );
    throw error;
  } finally {
    client.release();
  }
}

async function testWmsConnection(overrides = {}) {
  const stored = await getWmsConfig();
  const pick = (overrideVal, storedVal) => {
    if (overrideVal !== undefined && overrideVal !== null && String(overrideVal).trim() !== '') {
      return String(overrideVal).trim();
    }
    return storedVal;
  };

  const config = enrichConfigFromToken({
    apiBaseUrl: pick(overrides.wmsApiBaseUrl || overrides.apiBaseUrl, stored.apiBaseUrl).replace(/\/+$/, ''),
    accessToken: pick(overrides.wmsAccessToken || overrides.accessToken, stored.accessToken),
    username: pick(overrides.wmsUsername || overrides.username, stored.username),
    companyId: pick(overrides.wmsCompanyId || overrides.companyId, stored.companyId),
    site: pick(overrides.wmsSite || overrides.site, stored.site)
  });

  const result = await callWmsApi(config, {
    condition: { company_id: config.companyId, site: config.site },
    page: 1,
    limit: 1,
    sort: { created_time: -1 }
  });
  return {
    success: true,
    statusCode: result.statusCode,
    message: 'WMS connection successful'
  };
}

module.exports = {
  getWmsConfig,
  buildInterceptPayload,
  normalizeAccessToken,
  decodeJwtPayload,
  enrichConfigFromToken,
  buildMoLookupVariants,
  parseWmsListResponse,
  fetchCartonsByMo,
  fetchAllCartonsByMo,
  mapCartonRow,
  upsertCartonWithQr,
  syncMoFromWms,
  testWmsConnection
};
