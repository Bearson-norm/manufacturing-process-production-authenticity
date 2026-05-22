import React, { useEffect, useMemo } from 'react';
import {
  filterMoListBySearch,
  paginateList,
  DEFAULT_MO_PAGE_SIZE
} from '../utils/moListHelpers';

function MoPickerField({
  moList,
  searchTerm,
  onSearchChange,
  selectedMoNumber,
  onSelect,
  page,
  onPageChange,
  pageSize = DEFAULT_MO_PAGE_SIZE,
  searchPlaceholder = 'Ketik untuk mencari MO atau SKU...'
}) {
  const filtered = useMemo(
    () => filterMoListBySearch(moList, searchTerm),
    [moList, searchTerm]
  );

  const { items: paginated, totalItems, totalPages, safePage } = useMemo(
    () => paginateList(filtered, page, pageSize),
    [filtered, page, pageSize]
  );

  useEffect(() => {
    if (safePage !== page) {
      onPageChange(safePage);
    }
  }, [safePage, page, onPageChange]);

  return (
    <div className="mo-picker-field">
      <input
        type="search"
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={searchPlaceholder}
        className="mo-list-search-input"
      />
      <div className="mo-picker-list">
        {paginated.length === 0 ? (
          <div className="mo-picker-empty">Tidak ada MO ditemukan</div>
        ) : (
          paginated.map((mo) => (
            <button
              key={mo.mo_number}
              type="button"
              className={`mo-picker-item${selectedMoNumber === mo.mo_number ? ' selected' : ''}`}
              onClick={() => onSelect(mo)}
            >
              <span className="mo-picker-number">{mo.mo_number}</span>
              <span className="mo-picker-sku">{mo.sku_name || 'N/A'}</span>
              {mo.quantity != null && (
                <span className="mo-picker-qty">
                  {mo.quantity} {mo.uom || ''}
                </span>
              )}
            </button>
          ))
        )}
      </div>
      {totalItems > 0 && (
        <div className="mo-picker-footer">
          <span className="mo-list-count">{totalItems} MO{searchTerm ? ' ditemukan' : ''}</span>
          {totalPages > 1 && (
            <div className="mo-list-pagination">
              <button
                type="button"
                className="mo-list-page-btn"
                disabled={safePage <= 1}
                onClick={() => onPageChange(safePage - 1)}
              >
                ←
              </button>
              <span className="mo-list-page-info">
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                className="mo-list-page-btn"
                disabled={safePage >= totalPages}
                onClick={() => onPageChange(safePage + 1)}
              >
                →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MoPickerField;
