'use strict';

/** SKUs that never appear on either liquid production page. */
const LIQUID_SKU_HARD_EXCLUDE = ['MIXING', 'BRAY'];

function normalizeLiquidSku(skuName) {
  return String(skuName || '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Liquid 15 ml page: "15 ml"/"15ml", "slof", or "bundling". */
function isLiquid15MlSku(skuName) {
  const s = normalizeLiquidSku(skuName);
  if (!s) return false;
  if (s.includes('15 ML') || s.includes('15ML')) return true;
  if (s.includes('SLOF')) return true;
  if (s.includes('BUNDLING')) return true;
  return false;
}

function isLiquidHardExcludedSku(skuName) {
  const s = normalizeLiquidSku(skuName);
  return LIQUID_SKU_HARD_EXCLUDE.some((key) => s.includes(key));
}

/** Liquid 30 ml page: not 15 ml criteria and not MIXING/BRAY. */
function isLiquid30MlSku(skuName) {
  if (isLiquidHardExcludedSku(skuName)) return false;
  return !isLiquid15MlSku(skuName);
}

/**
 * @param {string} skuName
 * @param {'15ml'|'30ml'} variant
 */
function matchesLiquidVariant(skuName, variant) {
  if (variant === '15ml') return isLiquid15MlSku(skuName) && !isLiquidHardExcludedSku(skuName);
  if (variant === '30ml') return isLiquid30MlSku(skuName);
  return false;
}

/**
 * Normalize query variant; default 30ml for legacy callers.
 * @param {unknown} value
 * @returns {'15ml'|'30ml'|null} null if invalid non-empty value
 */
function parseLiquidVariant(value) {
  if (value == null || value === '') return '30ml';
  const v = String(value).toLowerCase().trim();
  if (v === '15ml' || v === '15' || v === 'liquid15' || v === 'liquid_15') return '15ml';
  if (v === '30ml' || v === '30' || v === 'liquid30' || v === 'liquid_30') return '30ml';
  return null;
}

/** External manufacturing: never sync 15 ml / slof / bundling / mixing / bray. */
function isExcludedFromExternalLiquidManufacturing(skuName) {
  if (isLiquidHardExcludedSku(skuName)) return true;
  return isLiquid15MlSku(skuName);
}

module.exports = {
  LIQUID_SKU_HARD_EXCLUDE,
  normalizeLiquidSku,
  isLiquid15MlSku,
  isLiquid30MlSku,
  isLiquidHardExcludedSku,
  matchesLiquidVariant,
  parseLiquidVariant,
  isExcludedFromExternalLiquidManufacturing,
};
