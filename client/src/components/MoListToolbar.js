import React from 'react';

function MoListToolbar({
  searchTerm,
  onSearchChange,
  page,
  onPageChange,
  totalItems,
  totalPages,
  itemLabel = 'MO',
  searchPlaceholder = 'Cari MO Number atau SKU Name...'
}) {
  const showPagination = totalPages > 1;

  return (
    <div className="mo-list-toolbar">
      <div className="mo-list-search">
        <input
          type="search"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="mo-list-search-input"
        />
        {searchTerm && (
          <button
            type="button"
            className="mo-list-search-clear"
            onClick={() => onSearchChange('')}
            title="Hapus pencarian"
          >
            ×
          </button>
        )}
      </div>
      <div className="mo-list-toolbar-meta">
        <span className="mo-list-count">
          {totalItems} {itemLabel}{totalItems !== 1 ? '' : ''}
          {searchTerm ? ' ditemukan' : ''}
        </span>
        {showPagination && (
          <div className="mo-list-pagination">
            <button
              type="button"
              className="mo-list-page-btn"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              ← Sebelumnya
            </button>
            <span className="mo-list-page-info">
              Halaman {page} / {totalPages}
            </span>
            <button
              type="button"
              className="mo-list-page-btn"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Selanjutnya →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default MoListToolbar;
