const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { buildCachedMoListQuery } = require('../utils/odoo-mo.helpers');

// GET /api/odoo/mo-list
// Get MO list from cache (odoo_mo_cache) filtered by production type
// liquid/device: team_name prefix (LIQ/DEV); cartridge: note TEAM/TIM cartridge + CT
router.get('/mo-list', async (req, res) => {
  try {
    const productionType = req.query.productionType || req.query.production_type;

    if (!productionType) {
      return res.status(400).json({
        success: false,
        error: 'productionType is required (liquid, device, or cartridge)',
      });
    }

    const typeLower = productionType.toLowerCase();
    if (!['liquid', 'device', 'cartridge'].includes(typeLower)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid productionType. Must be: liquid, device, or cartridge',
      });
    }

    const { query, params, filterDescription } = buildCachedMoListQuery(typeLower);
    console.log(`🔍 [MO List] Querying cache for ${productionType} (${filterDescription})`);

    db.all(query, params, (err, rows) => {
      if (err) {
        console.error('Error fetching MO list from cache:', err);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch MO list from cache: ' + err.message,
        });
      }

      const moList = (rows || []).map((row) => ({
        mo_number: row.mo_number,
        sku_name: row.sku_name || 'N/A',
        quantity: row.quantity || 0,
        uom: row.uom || '',
        note: row.note || '',
        team_name: row.team_name || '',
        create_date: row.create_date,
      }));

      res.json({
        success: true,
        count: moList.length,
        data: moList,
        source: 'cache',
        productionType: typeLower,
        filter: filterDescription,
      });
    });
  } catch (error) {
    console.error('Error in /api/odoo/mo-list:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

module.exports = router;
