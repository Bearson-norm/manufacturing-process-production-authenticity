'use strict';

const { db } = require('../database');
const {
  sendToExternalAPIWithUrl,
  getExternalManufacturingConfig,
  buildManufacturingCollectionUrl,
  buildManufacturingItemUrl,
  buildManufacturingItemStatusUrl,
  fetchManufacturingV1ListRows,
  getManufacturingIdentityByMoNumber,
  parseExternalManufacturingId
} = require('./external-api.service');

const LIQUID_PRODUCTION_TYPE = 'liquid';
const IDLE_LEADER_PLACEHOLDER = '-';

/** SKU / product names that must not be synced to external manufacturing. */
function isExcludedFromExternalLiquidManufacturing(skuName) {
  const s = String(skuName || '').toUpperCase();
  return s.includes('MIXING') || s.includes('BRAY');
}

function upsertExternalManufacturingMap(moNumber, externalId, callback) {
  db.run(
    `INSERT INTO external_manufacturing_map (mo_number, production_type, external_resource_id, created_at, updated_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (mo_number, production_type)
     DO UPDATE SET external_resource_id = EXCLUDED.external_resource_id, updated_at = CURRENT_TIMESTAMP`,
    [moNumber, LIQUID_PRODUCTION_TYPE, String(externalId)],
    callback
  );
}

function getExternalManufacturingMapRow(moNumber, callback) {
  db.get(
    'SELECT external_resource_id FROM external_manufacturing_map WHERE mo_number = $1 AND production_type = $2',
    [moNumber, LIQUID_PRODUCTION_TYPE],
    callback
  );
}

/**
 * @param {{ mo_number: string, sku_name?: string, quantity?: number }} moRow
 * @param {string} [leaderName]
 */
function buildIdleManufacturingPayload(moRow, leaderName = IDLE_LEADER_PLACEHOLDER) {
  const name = String((moRow && moRow.sku_name) || '').trim() || 'Unknown';
  const leader = String(leaderName || IDLE_LEADER_PLACEHOLDER).trim() || IDLE_LEADER_PLACEHOLDER;
  return {
    manufacturing_id: moRow.mo_number,
    sku: name,
    sku_name: name,
    target_qty: Number(moRow.quantity) || 0,
    done_qty: 0,
    status: 'idle',
    manual_finished_qty: 0,
    leader_name: leader,
    started_at: null,
    finished_at: null
  };
}

/** PATCH .../manufacturing/:id/status — v1 gateway has no route for PATCH on the item root (404). */
function patchManufacturingResourceStatus(baseUrl, bearerToken, externalId, body, callback) {
  const url = buildManufacturingItemStatusUrl(baseUrl, externalId);
  sendToExternalAPIWithUrl(body, url, 'PATCH', bearerToken)
    .then(() => callback(null))
    .catch((e) => callback(e));
}

function patchManufacturingSubresourceStatus(baseUrl, bearerToken, externalId, body, callback) {
  const url = buildManufacturingItemStatusUrl(baseUrl, externalId);
  sendToExternalAPIWithUrl(body, url, 'PATCH', bearerToken)
    .then(() => callback(null))
    .catch((e) => callback(e));
}

/**
 * Crosscheck by mo_number: local map → remote list → POST idle. Invokes callback(err, { externalId, action }).
 * action: 'skipped' | 'linked_remote' | 'posted'
 * @param {{ idleLeaderName?: string, preloadedListRows?: Array<object> }} [options] — preloadedListRows: v1 list from batch prefetch (push idle / cron).
 */
function resolveOrCreateExternalManufacturingId(moRow, cfg, options, callback) {
  const idleLeader =
    options && options.idleLeaderName != null && String(options.idleLeaderName).trim() !== ''
      ? String(options.idleLeaderName).trim()
      : IDLE_LEADER_PLACEHOLDER;
  const moNumber = moRow.mo_number;

  getExternalManufacturingMapRow(moNumber, (mapErr, mapRow) => {
    if (mapErr) {
      return callback(mapErr);
    }
    if (mapRow && mapRow.external_resource_id) {
      return callback(null, { externalId: mapRow.external_resource_id, action: 'skipped' });
    }

    if (isExcludedFromExternalLiquidManufacturing(moRow.sku_name)) {
      return callback(new Error('SKU excluded from external manufacturing (MIXING or BRAY)'));
    }

    const postIdle = () => {
      const payload = buildIdleManufacturingPayload(moRow, idleLeader);
      const createUrl = buildManufacturingCollectionUrl(cfg.baseUrl);
      sendToExternalAPIWithUrl(payload, createUrl, 'POST', cfg.bearerToken)
        .then((result) => {
          if (!result.success) {
            return callback(new Error(result.message || 'POST idle skipped'));
          }
          const id = result.parsedId || parseExternalManufacturingId(result.data || '');
          if (!id) {
            return callback(new Error('POST idle succeeded but no id in response'));
          }
          upsertExternalManufacturingMap(moNumber, id, (upErr) => {
            if (upErr) {
              console.error(`❌ [External API] Failed to save external id map for MO ${moNumber}:`, upErr.message);
            }
            callback(null, { externalId: id, action: 'posted' });
          });
        })
        .catch((e) => callback(e));
    };

    const lookupOpts =
      options && Array.isArray(options.preloadedListRows) ? { preloadedListRows: options.preloadedListRows } : {};

    getManufacturingIdentityByMoNumber(moNumber, cfg.baseUrl, cfg.bearerToken, lookupOpts)
      .then((getResult) => {
        if (getResult && getResult.success && getResult.id) {
          const extId = String(getResult.id);
          upsertExternalManufacturingMap(moNumber, extId, (upErr) => {
            if (upErr) {
              console.error(`❌ [External API] Failed upsert map after remote hit MO ${moNumber}:`, upErr.message);
            }
            callback(null, { externalId: extId, action: 'linked_remote' });
          });
          return;
        }
        postIdle();
      })
      .catch((e) => {
        console.log(`⚠️  [External API] Remote lookup failed for MO ${moNumber}: ${e.message} — trying POST idle`);
        postIdle();
      });
  });
}

/**
 * Confirm Input: ensure external row (idle + map) then PATCH main resource { status: started }.
 */
function ensureLiquidExternalIdAndPatchStarted(moNumber, skuName, targetQty, leaderName, callback) {
  if (isExcludedFromExternalLiquidManufacturing(skuName)) {
    console.log(`⚠️  [External API] Skip confirm sync for MO ${moNumber} — SKU excluded (MIXING or BRAY)`);
    return callback();
  }

  getExternalManufacturingConfig((cfgErr, cfg) => {
    if (cfgErr) {
      console.error(`❌ [External API] Config error for MO ${moNumber}:`, cfgErr.message);
      return callback();
    }
    if (!cfg.baseUrl) {
      console.log(`⚠️  [External API] external_api_base_url not set, skipping confirm sync for MO ${moNumber}`);
      return callback();
    }

    const moRow = { mo_number: moNumber, sku_name: skuName, quantity: targetQty };
    resolveOrCreateExternalManufacturingId(moRow, cfg, { idleLeaderName: leaderName }, (resolveErr, resolved) => {
      if (resolveErr) {
        console.error(`❌ [External API] resolve/create external id failed for MO ${moNumber}:`, resolveErr.message);
        return callback();
      }
      patchManufacturingResourceStatus(
        cfg.baseUrl,
        cfg.bearerToken,
        resolved.externalId,
        { status: 'started', started_at: null },
        (patchErr) => {
        if (patchErr) {
          console.error(`❌ [External API] PATCH started failed for MO ${moNumber}:`, patchErr.message);
        } else {
          console.log(`✅ [External API] PATCH started OK for MO ${moNumber} (id ${resolved.externalId}, ${resolved.action})`);
        }
        callback();
      });
    });
  });
}

/**
 * Submit / finalize: PUT full body then PATCH .../status { finished }.
 */
function finalizeLiquidManufacturingExternal(moNumber, formattedPutBody, callback) {
  const skuLabel = (formattedPutBody && (formattedPutBody.sku_name || formattedPutBody.sku)) || '';
  if (isExcludedFromExternalLiquidManufacturing(skuLabel)) {
    console.log(`⚠️  [External API] Skip finalize for MO ${moNumber} — SKU excluded (MIXING or BRAY)`);
    return callback();
  }

  getExternalManufacturingConfig((cfgErr, cfg) => {
    if (cfgErr || !cfg.baseUrl) {
      if (cfgErr) console.error(`❌ [External API] Config error for MO ${moNumber}:`, cfgErr.message);
      return callback();
    }

    const doPutThenPatch = (externalId) => {
      const putUrl = buildManufacturingItemUrl(cfg.baseUrl, externalId);
      sendToExternalAPIWithUrl(formattedPutBody, putUrl, 'PUT', cfg.bearerToken)
        .then(() => {
          console.log(`✅ [External API] PUT completed for MO ${moNumber}`);
          patchManufacturingSubresourceStatus(
            cfg.baseUrl,
            cfg.bearerToken,
            externalId,
            { status: 'finished' },
            (statusErr) => {
              if (statusErr) {
                console.error(
                  `❌ [External API] PATCH /status finished failed for MO ${moNumber} (local MO already saved):`,
                  statusErr.message
                );
              } else {
                console.log(`✅ [External API] PATCH /status finished OK for MO ${moNumber}`);
              }
              callback();
            }
          );
        })
        .catch((e) => {
          console.error(`❌ [External API] PUT failed for MO ${moNumber}:`, e.message);
          callback();
        });
    };

    getExternalManufacturingMapRow(moNumber, (mapErr, mapRow) => {
      if (mapErr) {
        console.error(`❌ [External API] Map read error:`, mapErr.message);
        return callback();
      }
      if (mapRow && mapRow.external_resource_id) {
        return doPutThenPatch(mapRow.external_resource_id);
      }

      getManufacturingIdentityByMoNumber(moNumber, cfg.baseUrl, cfg.bearerToken)
        .then((getResult) => {
          if (!getResult.success || !getResult.id) {
            console.error(`❌ [External API] No external id for MO ${moNumber} (map empty and list lookup failed)`);
            return callback();
          }
          upsertExternalManufacturingMap(moNumber, getResult.id, () => {});
          doPutThenPatch(getResult.id);
        })
        .catch((e) => {
          console.error(`❌ [External API] Lookup failed for MO ${moNumber}:`, e.message);
          callback();
        });
    });
  });
}

/**
 * Cron / admin: POST idle for liquid MOs in cache without map (after crosscheck).
 * Prefetches GET /api/v1/manufacturing once per run so each MO does not re-download the full list (avoids gateway timeouts).
 * @param {{ limit?: number }} [opts] — max MO rows from odoo_mo_cache this run (default 200 admin-style; cron passes 2000).
 * @returns {Promise<{ posted: number, skipped: number, linkedFromRemote: number, limitUsed: number, errors: Array<{ mo_number: string, message: string }> }>}
 */
function pushIdleManufacturingForLiquidMosFromCache(opts = {}) {
  const limitUsed = Math.min(2000, Math.max(1, parseInt(String(opts.limit), 10) || 200));

  return new Promise((resolve) => {
    const summary = { posted: 0, skipped: 0, linkedFromRemote: 0, limitUsed, errors: [] };

    getExternalManufacturingConfig((cfgErr, cfg) => {
      if (cfgErr || !cfg.baseUrl) {
        if (cfgErr) console.error('❌ [pushIdle] Config error:', cfgErr.message);
        else console.log('⚠️  [pushIdle] external_api_base_url not set, skipping');
        return resolve(summary);
      }

      const listUrl = buildManufacturingCollectionUrl(cfg.baseUrl);
      const prefetch = listUrl
        ? fetchManufacturingV1ListRows(listUrl, cfg.bearerToken).catch((prefErr) => {
            console.warn(`⚠️  [pushIdle] v1 list prefetch failed (${prefErr.message}); falling back to per-MO lookups`);
            return null;
          })
        : Promise.resolve(null);

      prefetch.then((preloadedRows) => {
        const resolveOpts =
          preloadedRows != null && Array.isArray(preloadedRows) ? { preloadedListRows: preloadedRows } : {};

        const query = `
          SELECT mo_number, sku_name, quantity, uom, note, create_date
          FROM odoo_mo_cache
          WHERE note ILIKE $1
            AND sku_name NOT ILIKE '%MIXING%'
            AND sku_name NOT ILIKE '%BRAY%'
          ORDER BY create_date DESC, mo_number ASC
          LIMIT $2
        `;

        db.all(query, ['%liquid%', limitUsed], (err, rows) => {
          if (err) {
            console.error('❌ [pushIdle] Query odoo_mo_cache failed:', err.message);
            return resolve(summary);
          }
          if (!rows || rows.length === 0) {
            return resolve(summary);
          }

          let index = 0;
          const next = () => {
            if (index >= rows.length) {
              console.log(
                `✅ [pushIdle] Done (limit=${limitUsed}): posted=${summary.posted} skipped=${summary.skipped} linkedFromRemote=${summary.linkedFromRemote} errors=${summary.errors.length}`
              );
              return resolve(summary);
            }
            const row = rows[index++];
            resolveOrCreateExternalManufacturingId(row, cfg, resolveOpts, (e, result) => {
              if (e) {
                summary.errors.push({ mo_number: row.mo_number, message: e.message });
                if (summary.errors.length <= 20) {
                  console.error(`❌ [pushIdle] MO ${row.mo_number}:`, e.message);
                }
              } else if (result.action === 'skipped') {
                summary.skipped += 1;
              } else if (result.action === 'linked_remote') {
                summary.linkedFromRemote += 1;
              } else if (result.action === 'posted') {
                summary.posted += 1;
              }
              setImmediate(next);
            });
          };
          next();
        });
      });
    });
  });
}

module.exports = {
  LIQUID_PRODUCTION_TYPE,
  upsertExternalManufacturingMap,
  getExternalManufacturingMapRow,
  buildIdleManufacturingPayload,
  isExcludedFromExternalLiquidManufacturing,
  ensureLiquidExternalIdAndPatchStarted,
  finalizeLiquidManufacturingExternal,
  pushIdleManufacturingForLiquidMosFromCache,
  resolveOrCreateExternalManufacturingId
};
