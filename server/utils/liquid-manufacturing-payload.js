'use strict';

const { convertDBTimestampToJakarta } = require('./timezone.utils');

/**
 * Calculate done_qty from authenticity_data array (handle multiple rolls).
 * @param {Array<{ authenticity_data?: string|object|Array }>} authenticityDataArray
 * @returns {number}
 */
function calculateDoneQty(authenticityDataArray) {
  let totalDoneQty = 0;

  if (!Array.isArray(authenticityDataArray)) {
    return 0;
  }

  authenticityDataArray.forEach((record) => {
    if (!record.authenticity_data) {
      return;
    }

    let authenticityData = record.authenticity_data;
    if (typeof authenticityData === 'string') {
      try {
        authenticityData = JSON.parse(authenticityData);
      } catch {
        return;
      }
    }

    if (!Array.isArray(authenticityData)) {
      authenticityData = [authenticityData];
    }

    authenticityData.forEach((roll) => {
      const firstAuth = roll.firstAuthenticity || roll.first_authenticity || '';
      const lastAuth = roll.lastAuthenticity || roll.last_authenticity || '';

      if (firstAuth && lastAuth) {
        const firstNum = parseInt(firstAuth, 10);
        const lastNum = parseInt(lastAuth, 10);

        if (!isNaN(firstNum) && !isNaN(lastNum) && lastNum >= firstNum) {
          totalDoneQty += lastNum - firstNum + 1;
        }
      }
    });
  });

  return totalDoneQty;
}

/** Payload for PUT /api/v1/manufacturing/:id when MO is finished (Submit MO). */
function formatManufacturingData(moNumber, skuName, targetQty, doneQty, leaderName, finishedAt) {
  const name = String(skuName || '').trim() || 'Unknown';
  return {
    manufacturing_id: moNumber,
    sku: name,
    sku_name: name,
    target_qty: Number(targetQty) || 0,
    done_qty: doneQty == null || doneQty === '' ? 0 : Number(doneQty),
    status: 'finished',
    manual_finished_qty: 0,
    leader_name: String(leaderName || '').trim(),
    started_at: null,
    finished_at: finishedAt ? convertDBTimestampToJakarta(finishedAt) : null
  };
}

/**
 * Build finished PUT body from completed production_liquid rows + odoo target qty.
 * @param {string} moNumber
 * @param {Array<object>} completedRows
 * @param {number} targetQty
 */
function formatFinishedPayloadFromCompletedRows(moNumber, completedRows, targetQty) {
  const rows = Array.isArray(completedRows) ? completedRows : [];
  const doneQty = calculateDoneQty(rows);
  const finishedSource =
    rows.length > 0 && rows[0].completed_at ? rows[0].completed_at : new Date();
  const leaderName = rows.length > 0 && rows[0].leader_name ? rows[0].leader_name : 'Unknown';
  const skuName = rows.length > 0 && rows[0].sku_name ? rows[0].sku_name : 'Unknown';
  return formatManufacturingData(moNumber, skuName, targetQty, doneQty, leaderName, finishedSource);
}

module.exports = {
  calculateDoneQty,
  formatManufacturingData,
  formatFinishedPayloadFromCompletedRows
};
