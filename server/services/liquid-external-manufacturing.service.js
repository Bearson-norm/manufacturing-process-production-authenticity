'use strict';

const { db } = require('../database');
const { buildExternalManufacturingIdlePushQuery } = require('../utils/odoo-mo.helpers');
const {
  sendToExternalAPIWithUrl,
  getEnabledExternalManufacturingTargets,
  buildManufacturingCollectionUrl,
  buildManufacturingItemUrl,
  buildManufacturingItemStatusUrl,
  fetchManufacturingV1ListRows,
  fetchManufacturingV1ItemByUuid,
  getManufacturingIdentityByMoNumber,
  parseExternalManufacturingId
} = require('./external-api.service');

const LIQUID_PRODUCTION_TYPE = 'liquid';
const IDLE_LEADER_PLACEHOLDER = '-';
const DEFAULT_TARGET_ID = 'default';

const LIQUID_SKU_EXTERNAL_EXCLUDE = ['MIXING', 'BRAY', 'BUNDLING'];

function normalizeSkuForExternalExclusion(skuName) {
  return String(skuName || '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** SKU / product names that must not be synced to external manufacturing. */
function isExcludedFromExternalLiquidManufacturing(skuName) {
  const s = normalizeSkuForExternalExclusion(skuName);
  if (s.includes('15 ML') || s.includes('15ML')) {
    return true;
  }
  return LIQUID_SKU_EXTERNAL_EXCLUDE.some((key) => s.includes(key));
}

function logTag(targetId) {
  return targetId && targetId !== DEFAULT_TARGET_ID ? `External API:${targetId}` : 'External API';
}

/**
 * @param {string} moNumber
 * @param {string} externalId
 * @param {string} [targetId]
 * @param {function} callback
 */
function upsertExternalManufacturingMap(moNumber, externalId, targetId, callback) {
  if (typeof targetId === 'function') {
    callback = targetId;
    targetId = DEFAULT_TARGET_ID;
  }
  const target = String(targetId || DEFAULT_TARGET_ID);
  db.run(
    `INSERT INTO external_manufacturing_map (mo_number, production_type, target, external_resource_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (mo_number, production_type, target)
     DO UPDATE SET external_resource_id = EXCLUDED.external_resource_id, updated_at = CURRENT_TIMESTAMP`,
    [moNumber, LIQUID_PRODUCTION_TYPE, target, String(externalId)],
    callback
  );
}

/**
 * @param {string} moNumber
 * @param {string} [targetId]
 * @param {function} callback
 */
function getExternalManufacturingMapRow(moNumber, targetId, callback) {
  if (typeof targetId === 'function') {
    callback = targetId;
    targetId = DEFAULT_TARGET_ID;
  }
  const target = String(targetId || DEFAULT_TARGET_ID);
  db.get(
    'SELECT external_resource_id, target FROM external_manufacturing_map WHERE mo_number = $1 AND production_type = $2 AND target = $3',
    [moNumber, LIQUID_PRODUCTION_TYPE, target],
    callback
  );
}

/**
 * Run fn(targets[i], done) sequentially for each enabled target.
 */
function forEachEnabledTarget(fn, done) {
  getEnabledExternalManufacturingTargets((err, targets) => {
    if (err) {
      return done(err);
    }
    if (!targets || targets.length === 0) {
      return done(null, { skippedNoTargets: true });
    }
    let i = 0;
    const next = () => {
      if (i >= targets.length) {
        return done(null);
      }
      const target = targets[i++];
      fn(target, () => setImmediate(next));
    };
    next();
  });
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

/** Fallback: PUT .../manufacturing/:id with { leader_name } only when GET by uuid is unavailable. */
function putManufacturingLeaderNameOnly(baseUrl, bearerToken, externalId, leaderName, callback) {
  const trimmed = String(leaderName || '').trim();
  const leader = trimmed === '' ? IDLE_LEADER_PLACEHOLDER : trimmed;
  const url = buildManufacturingItemUrl(baseUrl, externalId);
  sendToExternalAPIWithUrl({ leader_name: leader }, url, 'PUT', bearerToken)
    .then(() => callback(null))
    .catch((e) => callback(e));
}

/** Build FOOM PUT body from GET row; only leader_name comes from confirm form. */
function buildPutBodyFromV1ItemRow(row, leaderNameFromForm) {
  const trimmed = String(leaderNameFromForm || '').trim();
  const leader = trimmed === '' ? IDLE_LEADER_PLACEHOLDER : trimmed;
  const skuFallback = String((row && row.sku_name) || (row && row.sku) || 'Unknown').trim() || 'Unknown';
  const sku = String((row && row.sku) || '').trim() || skuFallback;
  const skuName = String((row && row.sku_name) || '').trim() || skuFallback;
  return {
    manufacturing_id: row.manufacturing_id,
    sku,
    sku_name: skuName,
    target_qty: Number(row.target_qty) || 0,
    done_qty: row.done_qty == null || row.done_qty === '' ? 0 : Number(row.done_qty),
    status: row.status != null && String(row.status).trim() !== '' ? String(row.status).trim() : 'started',
    manual_finished_qty: row.manual_finished_qty == null || row.manual_finished_qty === '' ? 0 : Number(row.manual_finished_qty),
    leader_name: leader,
    started_at: row.started_at !== undefined ? row.started_at : null,
    finished_at: row.finished_at !== undefined ? row.finished_at : null
  };
}

/**
 * After PATCH started: GET /api/v1/manufacturing/:id (uuid from map), merge leader_name from form, PUT full body.
 * Falls back to leader-only PUT if GET fails or returns empty.
 */
function putManufacturingMergedLeaderFromRemote(baseUrl, bearerToken, externalId, leaderName, targetId, callback) {
  const tag = logTag(targetId);
  fetchManufacturingV1ItemByUuid(baseUrl, externalId, bearerToken)
    .then((row) => {
      if (!row) {
        console.log(`⚠️  [${tag}] GET manufacturing by uuid empty — fallback PUT leader_name only`);
        return putManufacturingLeaderNameOnly(baseUrl, bearerToken, externalId, leaderName, callback);
      }
      const putBody = buildPutBodyFromV1ItemRow(row, leaderName);
      const url = buildManufacturingItemUrl(baseUrl, externalId);
      return sendToExternalAPIWithUrl(putBody, url, 'PUT', bearerToken)
        .then(() => callback(null))
        .catch((e) => callback(e));
    })
    .catch((e) => {
      console.log(`⚠️  [${tag}] GET manufacturing by uuid failed (${e.message}) — fallback PUT leader_name only`);
      putManufacturingLeaderNameOnly(baseUrl, bearerToken, externalId, leaderName, callback);
    });
}

/**
 * Crosscheck by mo_number: local map → remote list → POST idle. Invokes callback(err, { externalId, action }).
 * action: 'skipped' | 'linked_remote' | 'posted'
 * @param {{ idleLeaderName?: string, preloadedListRows?: Array<object> }} [options]
 * @param {{ id: string, baseUrl: string, bearerToken: string }} cfg — must include target id
 */
function resolveOrCreateExternalManufacturingId(moRow, cfg, options, callback) {
  const idleLeader =
    options && options.idleLeaderName != null && String(options.idleLeaderName).trim() !== ''
      ? String(options.idleLeaderName).trim()
      : IDLE_LEADER_PLACEHOLDER;
  const moNumber = moRow.mo_number;
  const targetId = (cfg && cfg.id) || DEFAULT_TARGET_ID;
  const tag = logTag(targetId);

  getExternalManufacturingMapRow(moNumber, targetId, (mapErr, mapRow) => {
    if (mapErr) {
      return callback(mapErr);
    }
    if (mapRow && mapRow.external_resource_id) {
      return callback(null, { externalId: mapRow.external_resource_id, action: 'skipped' });
    }

    if (isExcludedFromExternalLiquidManufacturing(moRow.sku_name)) {
      return callback(new Error('SKU excluded from external manufacturing (MIXING, BRAY, BUNDLING, or 15 ML)'));
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
          upsertExternalManufacturingMap(moNumber, id, targetId, (upErr) => {
            if (upErr) {
              console.error(`❌ [${tag}] Failed to save external id map for MO ${moNumber}:`, upErr.message);
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
          upsertExternalManufacturingMap(moNumber, extId, targetId, (upErr) => {
            if (upErr) {
              console.error(`❌ [${tag}] Failed upsert map after remote hit MO ${moNumber}:`, upErr.message);
            }
            callback(null, { externalId: extId, action: 'linked_remote' });
          });
          return;
        }
        postIdle();
      })
      .catch((e) => {
        console.log(`⚠️  [${tag}] Remote lookup failed for MO ${moNumber}: ${e.message} — trying POST idle`);
        postIdle();
      });
  });
}

function syncConfirmForTarget(target, moRow, leaderName, done) {
  const tag = logTag(target.id);
  const moNumber = moRow.mo_number;
  resolveOrCreateExternalManufacturingId(moRow, target, { idleLeaderName: leaderName }, (resolveErr, resolved) => {
    if (resolveErr) {
      console.error(`❌ [${tag}] resolve/create external id failed for MO ${moNumber}:`, resolveErr.message);
      return done();
    }
    patchManufacturingResourceStatus(
      target.baseUrl,
      target.bearerToken,
      resolved.externalId,
      { status: 'started', started_at: null },
      (patchErr) => {
        if (patchErr) {
          console.error(`❌ [${tag}] PATCH started failed for MO ${moNumber}:`, patchErr.message);
          return done();
        }
        console.log(`✅ [${tag}] PATCH started OK for MO ${moNumber} (id ${resolved.externalId}, ${resolved.action})`);
        putManufacturingMergedLeaderFromRemote(
          target.baseUrl,
          target.bearerToken,
          resolved.externalId,
          leaderName,
          target.id,
          (putErr) => {
            if (putErr) {
              console.error(`❌ [${tag}] PUT after confirm failed for MO ${moNumber}:`, putErr.message);
            } else {
              console.log(`✅ [${tag}] PUT after confirm OK for MO ${moNumber} (GET merge or leader-only fallback)`);
            }
            done();
          }
        );
      }
    );
  });
}

/**
 * Confirm Input: for each enabled target — resolve/create, PATCH started, PUT merged leader.
 */
function ensureLiquidExternalIdAndPatchStarted(moNumber, skuName, targetQty, leaderName, callback) {
  if (isExcludedFromExternalLiquidManufacturing(skuName)) {
    console.log(`⚠️  [External API] Skip confirm sync for MO ${moNumber} — SKU excluded (MIXING, BRAY, BUNDLING, or 15 ML)`);
    return callback();
  }

  const moRow = { mo_number: moNumber, sku_name: skuName, quantity: targetQty };
  forEachEnabledTarget(
    (target, done) => syncConfirmForTarget(target, moRow, leaderName, done),
    (err, meta) => {
      if (err) {
        console.error(`❌ [External API] Config error for MO ${moNumber}:`, err.message);
      } else if (meta && meta.skippedNoTargets) {
        console.log(`⚠️  [External API] No enabled external_api targets, skipping confirm sync for MO ${moNumber}`);
      }
      callback();
    }
  );
}

function syncFinalizeForTarget(target, moNumber, formattedPutBody, done) {
  const tag = logTag(target.id);

  const doPutThenPatch = (externalId) => {
    const putUrl = buildManufacturingItemUrl(target.baseUrl, externalId);
    sendToExternalAPIWithUrl(formattedPutBody, putUrl, 'PUT', target.bearerToken)
      .then(() => {
        console.log(`✅ [${tag}] PUT completed for MO ${moNumber}`);
        patchManufacturingSubresourceStatus(
          target.baseUrl,
          target.bearerToken,
          externalId,
          { status: 'finished' },
          (statusErr) => {
            if (statusErr) {
              console.error(
                `❌ [${tag}] PATCH /status finished failed for MO ${moNumber} (local MO already saved):`,
                statusErr.message
              );
            } else {
              console.log(`✅ [${tag}] PATCH /status finished OK for MO ${moNumber}`);
            }
            done();
          }
        );
      })
      .catch((e) => {
        console.error(`❌ [${tag}] PUT failed for MO ${moNumber}:`, e.message);
        done();
      });
  };

  getExternalManufacturingMapRow(moNumber, target.id, (mapErr, mapRow) => {
    if (mapErr) {
      console.error(`❌ [${tag}] Map read error:`, mapErr.message);
      return done();
    }
    if (mapRow && mapRow.external_resource_id) {
      return doPutThenPatch(mapRow.external_resource_id);
    }

    getManufacturingIdentityByMoNumber(moNumber, target.baseUrl, target.bearerToken)
      .then((getResult) => {
        if (!getResult.success || !getResult.id) {
          console.error(`❌ [${tag}] No external id for MO ${moNumber} (map empty and list lookup failed)`);
          return done();
        }
        upsertExternalManufacturingMap(moNumber, getResult.id, target.id, () => {});
        doPutThenPatch(getResult.id);
      })
      .catch((e) => {
        console.error(`❌ [${tag}] Lookup failed for MO ${moNumber}:`, e.message);
        done();
      });
  });
}

/**
 * Submit / finalize: PUT full body then PATCH finished — for each enabled target.
 */
function finalizeLiquidManufacturingExternal(moNumber, formattedPutBody, callback) {
  const skuLabel = (formattedPutBody && (formattedPutBody.sku_name || formattedPutBody.sku)) || '';
  if (isExcludedFromExternalLiquidManufacturing(skuLabel)) {
    console.log(`⚠️  [External API] Skip finalize for MO ${moNumber} — SKU excluded (MIXING, BRAY, BUNDLING, or 15 ML)`);
    return callback();
  }

  forEachEnabledTarget(
    (target, done) => syncFinalizeForTarget(target, moNumber, formattedPutBody, done),
    (err, meta) => {
      if (err) {
        console.error(`❌ [External API] Config error for MO ${moNumber}:`, err.message);
      } else if (meta && meta.skippedNoTargets) {
        // silent — same as previous empty baseUrl skip
      }
      callback();
    }
  );
}

/**
 * Push idle for one target against a list of MO rows (sequential).
 */
function pushIdleForTarget(target, rows, summary) {
  const tag = `pushIdle:${target.id}`;
  const listUrl = buildManufacturingCollectionUrl(target.baseUrl);

  return (listUrl
    ? fetchManufacturingV1ListRows(listUrl, target.bearerToken).catch((prefErr) => {
        console.warn(`⚠️  [${tag}] v1 list prefetch failed (${prefErr.message}); falling back to per-MO lookups`);
        return null;
      })
    : Promise.resolve(null)
  ).then((preloadedRows) => {
    const resolveOpts =
      preloadedRows != null && Array.isArray(preloadedRows) ? { preloadedListRows: preloadedRows } : {};

    return new Promise((resolve) => {
      let index = 0;
      const next = () => {
        if (index >= rows.length) {
          return resolve();
        }
        const row = rows[index++];
        resolveOrCreateExternalManufacturingId(row, target, resolveOpts, (e, result) => {
          if (e) {
            summary.errors.push({ mo_number: row.mo_number, target: target.id, message: e.message });
            if (summary.errors.length <= 20) {
              console.error(`❌ [${tag}] MO ${row.mo_number}:`, e.message);
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
}

/**
 * Cron / admin: POST idle for liquid MOs in cache without map (after crosscheck).
 * Runs for each enabled target (prefetch list per host).
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<{ posted: number, skipped: number, linkedFromRemote: number, limitUsed: number, errors: Array<object>, targetsProcessed: number }>}
 */
function pushIdleManufacturingForLiquidMosFromCache(opts = {}) {
  const { query, params, limitUsed, dateWindow, filterDescription } =
    buildExternalManufacturingIdlePushQuery(opts);

  return new Promise((resolve) => {
    const summary = {
      posted: 0,
      skipped: 0,
      linkedFromRemote: 0,
      limitUsed,
      dateWindow,
      errors: [],
      targetsProcessed: 0
    };

    getEnabledExternalManufacturingTargets((cfgErr, targets) => {
      if (cfgErr || !targets || targets.length === 0) {
        if (cfgErr) console.error('❌ [pushIdle] Config error:', cfgErr.message);
        else console.log('⚠️  [pushIdle] No enabled external_api targets, skipping');
        return resolve(summary);
      }

      console.log(
        `🔍 [pushIdle] ${filterDescription}; create_date window: >= GREATEST(today-${dateWindow.daysBack}d, ${dateWindow.minCreateDate}) .. today+${dateWindow.daysForward}d; limit=${limitUsed}; targets=${targets.length}`
      );

      db.all(query, params, (err, rows) => {
        if (err) {
          console.error('❌ [pushIdle] Query odoo_mo_cache failed:', err.message);
          return resolve(summary);
        }
        if (!rows || rows.length === 0) {
          console.log('ℹ️  [pushIdle] No eligible MO rows in cache for current filters');
          return resolve(summary);
        }

        let tIndex = 0;
        const nextTarget = () => {
          if (tIndex >= targets.length) {
            console.log(
              `✅ [pushIdle] Done (limit=${limitUsed}, targets=${summary.targetsProcessed}): posted=${summary.posted} skipped=${summary.skipped} linkedFromRemote=${summary.linkedFromRemote} errors=${summary.errors.length}`
            );
            return resolve(summary);
          }
          const target = targets[tIndex++];
          summary.targetsProcessed += 1;
          console.log(`🔍 [pushIdle:${target.id}] Processing ${rows.length} MO(s) → ${target.baseUrl}`);
          pushIdleForTarget(target, rows, summary)
            .then(() => setImmediate(nextTarget))
            .catch((e) => {
              console.error(`❌ [pushIdle:${target.id}] Unexpected error:`, e.message);
              setImmediate(nextTarget);
            });
        };
        nextTarget();
      });
    });
  });
}

module.exports = {
  LIQUID_PRODUCTION_TYPE,
  DEFAULT_TARGET_ID,
  upsertExternalManufacturingMap,
  getExternalManufacturingMapRow,
  buildIdleManufacturingPayload,
  isExcludedFromExternalLiquidManufacturing,
  ensureLiquidExternalIdAndPatchStarted,
  finalizeLiquidManufacturingExternal,
  pushIdleManufacturingForLiquidMosFromCache,
  resolveOrCreateExternalManufacturingId
};
