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

const CARTRIDGE_SKU_WORDS = [
  'CARTRIDGE',
  'CARTIRDGE',
  'CARTRDIGE',
  'CARTRIGE',
  'CARTDIGE',
  'CARTDIDGE',
];

function skuHasCartridgeWord(normalizedSku) {
  return CARTRIDGE_SKU_WORDS.some((word) => normalizedSku.includes(word));
}

function skuHasPodToken(normalizedSku) {
  return /(^|[^A-Z0-9])POD([^A-Z0-9]|$)/.test(normalizedSku);
}

function skuHasCtToken(normalizedSku) {
  return /(^|[^A-Z0-9])CT([^A-Z0-9]|$)/.test(normalizedSku);
}

/**
 * Classify a SKU onto a production page when note is empty and team_name does not match.
 * Order: MIXING (none) → POD+CARTRIDGE (cartridge) → POD only (device) →
 * CARTRIDGE or token CT (cartridge) → bundling/15ml/slof (liquid15) → BRAY (none) → liquid30.
 *
 * @param {unknown} skuName
 * @returns {'cartridge'|'device'|'liquid15'|'liquid30'|null}
 */
function resolveSkuProductionPage(skuName) {
  const s = normalizeLiquidSku(skuName);
  if (!s) return null;
  if (s.includes('MIXING')) return null;

  const hasCartridge = skuHasCartridgeWord(s);
  const hasPod = skuHasPodToken(s);
  const hasCt = skuHasCtToken(s);

  if (hasPod && hasCartridge) return 'cartridge';
  if (hasPod && !hasCartridge && !hasCt) return 'device';
  if (hasCartridge || hasCt) return 'cartridge';
  if (isLiquid15MlSku(s)) return 'liquid15';
  if (s.includes('BRAY')) return null;
  return 'liquid30';
}

function isNoteEmptyForSkuFallback(note) {
  return !String(note || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function teamNameBlocksSkuFallback(teamName) {
  const team = String(teamName || '').trim().toUpperCase();
  if (!team) return false;
  if (team.startsWith('LIQ') || team.startsWith('DEV')) return true;
  return /^G[0-9]+([\s-].*)?$/.test(team);
}

/**
 * SKU page routing applies only when Odoo note is empty (after HTML strip)
 * and team_name is not LIQ… / G1/G2/… / DEV….
 *
 * @param {unknown} note
 * @param {unknown} teamName
 * @returns {boolean}
 */
function shouldUseSkuPageFallback(note, teamName) {
  if (!isNoteEmptyForSkuFallback(note)) return false;
  return !teamNameBlocksSkuFallback(teamName);
}

module.exports = {
  LIQUID_SKU_HARD_EXCLUDE,
  CARTRIDGE_SKU_WORDS,
  normalizeLiquidSku,
  isLiquid15MlSku,
  isLiquid30MlSku,
  isLiquidHardExcludedSku,
  matchesLiquidVariant,
  parseLiquidVariant,
  isExcludedFromExternalLiquidManufacturing,
  resolveSkuProductionPage,
  shouldUseSkuPageFallback,
};
