export const DEFAULT_MO_PAGE_SIZE = 10;

const LIQUID_SKU_PRODUCTION_EXCLUDE = ['MIXING', 'BRAY', 'BUNDLING'];

export function isExcludedLiquidProductionSku(skuName) {
  const s = String(skuName || '').toUpperCase();
  return LIQUID_SKU_PRODUCTION_EXCLUDE.some((key) => s.includes(key));
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
  return getMoTeamName(mo);
}

export function getMoDisplayTagLabel(productionType = 'liquid') {
  if (productionType === 'cartridge') {
    return 'Note';
  }
  if (productionType === 'device') {
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
