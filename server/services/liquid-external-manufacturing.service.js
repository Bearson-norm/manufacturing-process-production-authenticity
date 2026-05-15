'use strict';

const { getExternalAPIUrl, sendToExternalAPIWithUrl } = require('./external-api.service');

/** Same payload shape as `formatManufacturingData` in production.routes.js (active / started). */
function formatManufacturingPayload(moNumber, skuName, targetQty, leaderName) {
  return {
    manufacturing_id: moNumber,
    sku: skuName,
    sku_name: `Product ${skuName}`,
    target_qty: targetQty || 0,
    done_qty: null,
    leader_name: leaderName || '',
    finished_at: null
  };
}

/**
 * After new liquid production input is saved (status active), notify external manufacturing API.
 * Mirrors the device POST flow (get "active" URL + POST payload). Fire-and-forget safe for HTTP handlers.
 */
function ensureLiquidExternalIdAndPatchStarted(mo_number, sku_name, targetQty, leader_name, callback) {
  const done = (err) => {
    if (typeof callback === 'function') {
      try {
        callback(err);
      } catch (_) {
        /* ignore */
      }
    }
  };

  try {
    getExternalAPIUrl('active', (err, externalApiUrl) => {
      if (err) {
        console.error('❌ [Liquid External] getExternalAPIUrl:', err);
        return done(err);
      }
      if (!externalApiUrl || String(externalApiUrl).trim() === '') {
        console.log(
          `⚠️  [Liquid External] External API URL for active not configured, skipping MO ${mo_number}`
        );
        return done();
      }

      const formattedData = formatManufacturingPayload(mo_number, sku_name, targetQty, leader_name);
      sendToExternalAPIWithUrl(formattedData, externalApiUrl, 'POST')
        .then((result) => {
          if (result.success) {
            console.log(`✅ [Liquid External] Active status sent for MO ${mo_number}`);
          } else {
            console.log(
              `⚠️  [Liquid External] Send skipped for MO ${mo_number}: ${result.message || 'unknown'}`
            );
          }
        })
        .catch((apiErr) => {
          console.error(`❌ [Liquid External] POST failed for MO ${mo_number}:`, apiErr.message);
        })
        .finally(() => done());
    });
  } catch (e) {
    console.error('❌ [Liquid External] ensureLiquidExternalIdAndPatchStarted:', e);
    done(e);
  }
}

module.exports = {
  ensureLiquidExternalIdAndPatchStarted
};
