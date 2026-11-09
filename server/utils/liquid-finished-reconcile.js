'use strict';

const {
  isExcludedFromExternalLiquidManufacturing
} = require('./liquid-sku.helpers');

/**
 * Decide whether a FOOM MES row should be patched to finished.
 * Remote `idle` is included: daily idle POST plus End Session can complete
 * the MO locally without ever transitioning MES to started.
 * @param {object|null} mesRow
 * @param {{ active_rows?: number, completed_rows?: number }|null} localAgg
 */
function classifyMesRowAgainstLocal(mesRow, localAgg) {
  const mesStatus = String((mesRow && mesRow.status) || '').trim().toLowerCase();
  const moNumber = mesRow && mesRow.manufacturing_id != null ? String(mesRow.manufacturing_id) : '';
  const recordId = mesRow && mesRow.id != null ? String(mesRow.id) : '';
  const skuLabel = (mesRow && (mesRow.sku_name || mesRow.sku)) || '';

  const active = localAgg ? parseInt(localAgg.active_rows, 10) || 0 : 0;
  const completed = localAgg ? parseInt(localAgg.completed_rows, 10) || 0 : 0;
  const remoteOpen = mesStatus === 'started' || mesStatus === 'idle';

  if (isExcludedFromExternalLiquidManufacturing(skuLabel)) {
    return { action: 'skippedExcluded', moNumber, recordId, mesStatus };
  }
  if (mesStatus === 'finished' && completed > 0 && active === 0) {
    return { action: 'alreadyMatched', moNumber, recordId, mesStatus };
  }
  if (remoteOpen && active > 0) {
    return { action: 'skippedActive', moNumber, recordId, mesStatus };
  }
  if (remoteOpen && active === 0 && completed > 0) {
    return { action: 'wouldPatch', moNumber, recordId, mesStatus };
  }
  if (remoteOpen && (completed === 0 && active === 0)) {
    return { action: 'skippedNoLocal', moNumber, recordId, mesStatus };
  }
  return { action: 'skippedOther', moNumber, recordId, mesStatus };
}

module.exports = {
  classifyMesRowAgainstLocal
};
