export const DEFAULT_MO_PAGE_SIZE = 10;

const LIQUID_SKU_HARD_EXCLUDE = ['MIXING', 'BRAY'];

function normalizeLiquidSku(skuName) {
  return String(skuName || '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Liquid 15 ml: "15 ml"/"15ml", "slof", or "bundling". */
export function isLiquid15MlSku(skuName) {
  const s = normalizeLiquidSku(skuName);
  if (!s) return false;
  if (s.includes('15 ML') || s.includes('15ML')) return true;
  if (s.includes('SLOF')) return true;
  if (s.includes('BUNDLING')) return true;
  return false;
}

export function isLiquidHardExcludedSku(skuName) {
  const s = normalizeLiquidSku(skuName);
  return LIQUID_SKU_HARD_EXCLUDE.some((key) => s.includes(key));
}

/** Liquid 30 ml: not 15 ml criteria and not MIXING/BRAY. */
export function isLiquid30MlSku(skuName) {
  if (isLiquidHardExcludedSku(skuName)) return false;
  return !isLiquid15MlSku(skuName);
}

/**
 * @param {string} skuName
 * @param {'15ml'|'30ml'} variant
 */
export function matchesLiquidVariant(skuName, variant) {
  if (variant === '15ml') return isLiquid15MlSku(skuName) && !isLiquidHardExcludedSku(skuName);
  if (variant === '30ml') return isLiquid30MlSku(skuName);
  return false;
}

/** @deprecated Prefer matchesLiquidVariant — kept for callers that mean "not on 30ml page". */
export function isExcludedLiquidProductionSku(skuName) {
  return isLiquidHardExcludedSku(skuName) || isLiquid15MlSku(skuName);
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
export function resolveSkuProductionPage(skuName) {
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
export function shouldUseSkuPageFallback(note, teamName) {
  if (!isNoteEmptyForSkuFallback(note)) return false;
  return !teamNameBlocksSkuFallback(teamName);
}

export function isSkuFallbackLiquidMo(mo) {
  if (!shouldUseSkuPageFallback(mo?.note, mo?.team_name)) return false;
  const page = resolveSkuProductionPage(mo?.sku_name);
  return page === 'liquid15' || page === 'liquid30';
}

export function isSkuFallbackDeviceMo(mo) {
  if (!shouldUseSkuPageFallback(mo?.note, mo?.team_name)) return false;
  return resolveSkuProductionPage(mo?.sku_name) === 'device';
}

export function isSkuFallbackCartridgeMo(mo) {
  if (!shouldUseSkuPageFallback(mo?.note, mo?.team_name)) return false;
  return resolveSkuProductionPage(mo?.sku_name) === 'cartridge';
}

export function getMoTeamName(mo) {
  return String(mo?.team_name ?? '').trim();
}

export function getMoNote(mo) {
  return String(mo?.note ?? '').trim();
}

function stripMoNoteText(note) {
  return String(note ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchesCartridgeNote(note) {
  const text = stripMoNoteText(note).toUpperCase();
  if (!text) {
    return false;
  }

  const cartridgeWords = [
    'CARTRIDGE',
    'CARTIRDGE',
    'CARTRDIGE',
    'CARTRIGE',
    'CARTDIGE',
  ];
  const hasCartridgeWord = cartridgeWords.some((word) => text.includes(word));

  const hasTeamCartridge =
    (text.includes('TEAM') || text.includes('TIM')) &&
    (hasCartridgeWord || text.includes(' DEVICE CT'));

  const hasCtShift =
    text.includes(' DEVICE CT - SHIFT ') ||
    (text.includes(' CT - SHIFT ') && (text.includes('TEAM') || text.includes('TIM')));

  return hasTeamCartridge || hasCtShift || hasCartridgeWord;
}

export function matchesDeviceNote(note) {
  const text = stripMoNoteText(note).toUpperCase();
  if (!text) {
    return false;
  }

  if (text.includes(' DEVICE CT')) {
    return false;
  }

  const cartridgeWords = ['CARTRIDGE', 'CARTIRDGE', 'CARTRDIGE', 'CARTRIGE', 'CARTDIGE'];
  if (cartridgeWords.some((word) => text.includes(word))) {
    return false;
  }

  const hasTeamTim = text.includes('TEAM') || text.includes('TIM');
  if (!hasTeamTim || !text.includes(' DEVICE ') || !text.includes(' SHIFT ')) {
    return false;
  }

  return true;
}

export function matchesLiquidNote(note) {
  const text = stripMoNoteText(note).toUpperCase();
  if (!text) {
    return false;
  }

  if (text.includes(' DEVICE CT') || text.includes(' DEVICE ')) {
    return false;
  }

  const cartridgeWords = ['CARTRIDGE', 'CARTIRDGE', 'CARTRDIGE', 'CARTRIGE', 'CARTDIGE'];
  if (cartridgeWords.some((word) => text.includes(word))) {
    return false;
  }

  const hasTeamTim = text.includes('TEAM') || text.includes('TIM');
  if (!hasTeamTim || !text.includes(' LIQUID ') || !text.includes(' SHIFT ')) {
    return false;
  }

  return true;
}

export function matchesLiquidTeamName(teamName) {
  const team = String(teamName || '').trim().toUpperCase();
  if (!team) {
    return false;
  }
  if (team.startsWith('LIQ')) {
    return true;
  }
  return /^G[0-9]+([\s-].*)?$/.test(team);
}

export function getMoDisplayTag(mo, productionType = 'liquid') {
  if (productionType === 'cartridge') {
    return getMoNote(mo);
  }
  if (productionType === 'device') {
    const team = getMoTeamName(mo);
    if (team) {
      return team;
    }
    if (matchesDeviceNote(mo?.note)) {
      return getMoNote(mo);
    }
    return '';
  }
  const team = getMoTeamName(mo);
  const note = matchesLiquidNote(mo?.note) ? getMoNote(mo) : '';
  if (team && note && team.toUpperCase() !== stripMoNoteText(note).toUpperCase()) {
    return `${team} · ${note}`;
  }
  return team || note || '';
}

export function getMoDisplayTagLabel(productionType = 'liquid') {
  if (productionType === 'cartridge') {
    return 'Note';
  }
  if (productionType === 'device' || productionType === 'liquid') {
    return 'Team / Note';
  }
  return 'Team';
}

export function formatMoSearchLabel(mo, productionType = 'liquid') {
  if (!mo) return '';
  const tag = getMoDisplayTag(mo, productionType);
  const base = `${mo.mo_number} - ${mo.sku_name || 'N/A'}`;
  return tag ? `${base} · ${tag}` : base;
}

export function filterMoListBySearch(list, term, productionType = 'liquid') {
  const t = (term || '').toLowerCase();
  return (list || []).filter((mo) => {
    const num = String(mo.mo_number ?? '');
    const sku = String(mo.sku_name ?? '');
    const tag = getMoDisplayTag(mo, productionType).toLowerCase();
    return (
      t === '' ||
      num.toLowerCase().includes(t) ||
      sku.toLowerCase().includes(t) ||
      tag.includes(t)
    );
  });
}

export function matchesMoSearch(moNumber, skuName, term, teamName = '') {
  const t = (term || '').toLowerCase();
  if (t === '') return true;
  const num = String(moNumber ?? '').toLowerCase();
  const sku = String(skuName ?? '').toLowerCase();
  const team = String(teamName ?? '').toLowerCase();
  return num.includes(t) || sku.includes(t) || team.includes(t);
}

export function paginateList(items, page, pageSize = DEFAULT_MO_PAGE_SIZE) {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    totalItems,
    totalPages,
    safePage
  };
}

export function buildPaginatedSavedMoKeys(savedData, searchTerm, page, pageSize = DEFAULT_MO_PAGE_SIZE) {
  const allKeys = [];

  (savedData || []).forEach((session) => {
    const grouped = {};
    (session.inputs || []).forEach((input) => {
      if (!grouped[input.mo_number]) grouped[input.mo_number] = [];
      grouped[input.mo_number].push(input);
    });

    Object.entries(grouped).forEach(([moNumber, inputs]) => {
      const sku = inputs[0]?.sku_name || '';
      if (matchesMoSearch(moNumber, sku, searchTerm)) {
        allKeys.push({ sessionId: session.session_id, moNumber });
      }
    });
  });

  const { items, totalItems, totalPages, safePage } = paginateList(allKeys, page, pageSize);
  const pageKeySet = new Set(items.map((k) => `${k.sessionId}::${k.moNumber}`));

  return { pageKeySet, totalItems, totalPages, safePage };
}
