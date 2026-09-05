const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveSkuProductionPage,
  shouldUseSkuPageFallback,
} = require('../utils/liquid-sku.helpers');
const { buildCachedMoListQuery } = require('../utils/odoo-mo.helpers');

describe('resolveSkuProductionPage', () => {
  it('routes empty-note liquid SKUs to 30 ml', () => {
    assert.equal(resolveSkuProductionPage('TROPICAL LYCHEE'), 'liquid30');
    assert.equal(resolveSkuProductionPage('FRESH COLA (30ML)'), 'liquid30');
  });

  it('routes bundling / 15 ml / slof to liquid15', () => {
    assert.equal(resolveSkuProductionPage('TROPICAL LYCHEE 15 ML'), 'liquid15');
    assert.equal(resolveSkuProductionPage('COLA BUNDLING'), 'liquid15');
    assert.equal(resolveSkuProductionPage('SALT SLOF'), 'liquid15');
  });

  it('routes POD+CARTRIDGE and CARTRIDGE/CT to cartridge', () => {
    assert.equal(resolveSkuProductionPage('FOOM POD CARTRIDGE'), 'cartridge');
    assert.equal(resolveSkuProductionPage('SALT CARTRIDGE 30ML'), 'cartridge');
    assert.equal(resolveSkuProductionPage('DEVICE CT KIT'), 'cartridge');
    assert.equal(resolveSkuProductionPage('FOOM CARTIRDGE'), 'cartridge');
  });

  it('routes POD-only to device and excludes MIXING from all pages', () => {
    assert.equal(resolveSkuProductionPage('FOOM POD BLACK'), 'device');
    assert.equal(resolveSkuProductionPage('MIXING TROPICAL LYCHEE'), null);
    assert.equal(resolveSkuProductionPage('MIXING POD CARTRIDGE'), null);
    assert.equal(resolveSkuProductionPage('BRAY BASE'), null);
  });

  it('does not treat CT inside other words as a CT token', () => {
    assert.equal(resolveSkuProductionPage('VICTORY COLA'), 'liquid30');
  });
});

describe('shouldUseSkuPageFallback', () => {
  it('applies only when note is empty and team is not LIQ/G#/DEV', () => {
    assert.equal(shouldUseSkuPageFallback('', ''), true);
    assert.equal(shouldUseSkuPageFallback('<p><br></p>', ''), true);
    assert.equal(shouldUseSkuPageFallback('', 'G1'), false);
    assert.equal(shouldUseSkuPageFallback('', 'LIQ-A'), false);
    assert.equal(shouldUseSkuPageFallback('', 'DEV-1'), false);
    assert.equal(shouldUseSkuPageFallback('TEAM LIQUID - SHIFT 1', ''), false);
  });
});

describe('buildCachedMoListQuery SKU fallback', () => {
  it('includes SKU fallback OR for liquid, device, and cartridge', () => {
    const liquid = buildCachedMoListQuery('liquid');
    assert.match(liquid.query, /sku_name ~\* '\\yPOD\\y'/);
    assert.match(liquid.filterDescription, /empty-note SKU fallback/);

    const device = buildCachedMoListQuery('device');
    assert.match(device.query, /\\yPOD\\y/);
    assert.match(device.filterDescription, /POD only/);

    const cartridge = buildCachedMoListQuery('cartridge');
    assert.match(cartridge.query, /\\yCT\\y/);
    assert.match(cartridge.filterDescription, /CARTRIDGE\/CT/);
  });
});
