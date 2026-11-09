'use strict';

/**
 * Normalize one GET /api/v1/manufacturing page.
 * A bare array is a single complete page (legacy). Paginated bodies expose
 * data[] plus links.next and/or meta.last_page.
 * @param {unknown} response
 */
function extractManufacturingListPage(response) {
  if (Array.isArray(response)) {
    return { rows: response, nextUrl: null, lastPage: 1, currentPage: 1 };
  }
  const body = response && typeof response === 'object' ? response : {};
  const rows = Array.isArray(body.data) ? body.data : [];
  const links = body.links && typeof body.links === 'object' ? body.links : {};
  const metaSource = body.meta && typeof body.meta === 'object'
    ? body.meta
    : (body.pagination && typeof body.pagination === 'object' ? body.pagination : {});
  const nextRaw = links.next || body.next || body.next_page_url || null;
  const lastPage = parseInt(metaSource.last_page || metaSource.lastPage || body.last_page, 10);
  const currentPage = parseInt(metaSource.current_page || metaSource.currentPage || body.current_page, 10);
  return {
    rows,
    nextUrl: nextRaw ? String(nextRaw) : null,
    lastPage: Number.isFinite(lastPage) && lastPage > 0 ? lastPage : 1,
    currentPage: Number.isFinite(currentPage) && currentPage > 0 ? currentPage : 1
  };
}

/**
 * Absolute URL of the following page, or null when this page is the last.
 * @param {string} currentUrl
 * @param {{ nextUrl?: string|null, lastPage?: number, currentPage?: number }} pageInfo
 */
function nextManufacturingListUrl(currentUrl, pageInfo) {
  const info = pageInfo || {};
  if (info.nextUrl) {
    try {
      return new URL(String(info.nextUrl), currentUrl).toString();
    } catch {
      return null;
    }
  }
  const lastPage = parseInt(info.lastPage, 10) || 1;
  const currentPage = parseInt(info.currentPage, 10) || 1;
  if (lastPage <= currentPage) {
    return null;
  }
  try {
    const next = new URL(currentUrl);
    next.searchParams.set('page', String(currentPage + 1));
    const built = next.toString();
    return built === currentUrl ? null : built;
  } catch {
    return null;
  }
}

module.exports = {
  extractManufacturingListPage,
  nextManufacturingListUrl
};
