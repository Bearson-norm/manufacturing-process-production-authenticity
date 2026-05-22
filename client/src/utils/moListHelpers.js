export const DEFAULT_MO_PAGE_SIZE = 10;

export function filterMoListBySearch(list, term) {
  const t = (term || '').toLowerCase();
  return (list || []).filter((mo) => {
    const num = String(mo.mo_number ?? '');
    const sku = String(mo.sku_name ?? '');
    return t === '' || num.toLowerCase().includes(t) || sku.toLowerCase().includes(t);
  });
}

export function matchesMoSearch(moNumber, skuName, term) {
  const t = (term || '').toLowerCase();
  if (t === '') return true;
  const num = String(moNumber ?? '').toLowerCase();
  const sku = String(skuName ?? '').toLowerCase();
  return num.includes(t) || sku.includes(t);
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
