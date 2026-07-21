import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  formatPercent,
  formatQtyVarianceStatus
} from '../utils/wmsAccuracy';
import './WmsAccuracyReport.css';
import './WmsProductionCompare.css';

const PAGE_SIZE = 25;

function formatDate(value) {
  if (!value) return '-';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'Asia/Jakarta'
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function formatQty(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('id-ID');
}

function formatUnmatchReason(reason) {
  switch (reason) {
    case 'invalid_barcode':
      return 'Barcode invalid';
    case 'empty_barcode':
      return 'Barcode kosong';
    case 'no_production_ranges':
      return 'Tidak ada range production';
    case 'out_of_range':
    default:
      return 'Di luar range';
  }
}

function isMismatchStatus(status) {
  return status && status !== 'match';
}

function WmsProductionCompare() {
  const navigate = useNavigate();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [report, setReport] = useState(null);
  const [detail, setDetail] = useState(null);
  const [mismatchOnly, setMismatchOnly] = useState(true);
  const [detailTab, setDetailTab] = useState('unmatched');
  const [cartonIssuesOnly, setCartonIssuesOnly] = useState(true);
  const [expandedCartons, setExpandedCartons] = useState({});
  const [unmatchedSearch, setUnmatchedSearch] = useState('');

  const buildFilterParams = useCallback(() => {
    const params = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    if (search.trim()) params.search = search.trim();
    return params;
  }, [dateFrom, dateTo, search]);

  const loadReport = useCallback(async (pageOverride) => {
    const currentPage = pageOverride != null ? pageOverride : page;
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const params = { page: currentPage, limit: PAGE_SIZE, ...buildFilterParams() };
      const response = await axios.get('/api/wms/mo-qty-compare-report', { params });
      if (response.data.success) {
        setReport(response.data);
        setPage(currentPage);
      } else {
        setMessage({ type: 'error', text: response.data.error || 'Gagal memuat laporan' });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Gagal memuat pembanding qty production vs WMS'
      });
    } finally {
      setLoading(false);
    }
  }, [page, buildFilterParams]);

  useEffect(() => {
    loadReport(1);
    // Mount-only initial load; filters applied via Muat Ulang button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalPages = Math.max(1, Math.ceil((report?.total || 0) / PAGE_SIZE));

  const displayRows = useMemo(() => {
    const rows = report?.data || [];
    if (!mismatchOnly) return rows;
    return rows.filter((row) => isMismatchStatus(row.status));
  }, [report, mismatchOnly]);

  const pageMismatchCount = useMemo(
    () => (report?.data || []).filter((row) => isMismatchStatus(row.status)).length,
    [report]
  );

  const openMoExplorer = (moNumber) => {
    navigate(`/wms-explorer?mo=${encodeURIComponent(moNumber)}`);
  };

  const loadDetail = async (moNumber) => {
    setDetailLoading(true);
    setMessage({ type: '', text: '' });
    setDetailTab('unmatched');
    setExpandedCartons({});
    setUnmatchedSearch('');
    try {
      const response = await axios.get('/api/wms/mo-qty-compare-report/detail', {
        params: { mo_number: moNumber }
      });
      if (response.data.success) {
        setDetail(response.data.data);
      } else {
        setMessage({ type: 'error', text: response.data.error || 'Gagal memuat detail' });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Gagal memuat detail pembanding'
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const detailStatus = detail ? formatQtyVarianceStatus(detail.status) : null;
  const sessionCount = (detail?.missing_breakdown_sessions || []).length;
  const rangeCount = (detail?.missing_breakdown_ranges || []).length;
  const allCartons = detail?.carton_breakdown || [];
  const surplusCartonCount = (detail?.surplus_cartons || []).length;
  const unmatchedQrItems = useMemo(
    () => detail?.unmatched_qr_items || [],
    [detail]
  );
  const displayCartons = cartonIssuesOnly
    ? allCartons.filter((c) => c.has_issue)
    : allCartons;

  const filteredUnmatchedQrs = useMemo(() => {
    const term = unmatchedSearch.trim().toLowerCase();
    if (!term) return unmatchedQrItems;
    return unmatchedQrItems.filter((qr) => {
      const hay = [
        qr.qr_barcode,
        qr.carton_barcode,
        qr.stock_transfer_order_id,
        qr.reason
      ].map((v) => String(v || '').toLowerCase()).join(' ');
      return hay.includes(term);
    });
  }, [unmatchedQrItems, unmatchedSearch]);

  const toggleCartonExpand = (cartonId) => {
    setExpandedCartons((prev) => ({
      ...prev,
      [cartonId]: !prev[cartonId]
    }));
  };

  return (
    <div className="wms-report-container wms-qty-compare">
      <div className="wms-report-header">
        <button type="button" onClick={() => navigate('/dashboard')} className="back-button">
          ← Dashboard
        </button>
        <h1>Pembanding Qty Production vs WMS</h1>
        <button
          type="button"
          className="wms-btn wms-btn-secondary"
          onClick={() => navigate('/wms-accuracy-report')}
        >
          Keakuratan QR
        </button>
        <button
          type="button"
          className="wms-btn wms-btn-secondary"
          onClick={() => navigate('/wms-explorer')}
        >
          Explorer
        </button>
      </div>

      {message.text && (
        <div className={`wms-message ${message.type}`}>{message.text}</div>
      )}

      <div className="wms-report-toolbar">
        <div className="field-group">
          <label htmlFor="qty-date-from">Dari</label>
          <input
            id="qty-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="field-group">
          <label htmlFor="qty-date-to">Sampai</label>
          <input
            id="qty-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        <div className="field-group wms-report-search">
          <label htmlFor="qty-mo-search">Cari MO</label>
          <input
            id="qty-mo-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadReport(1)}
            placeholder="PROD/MO/..."
          />
        </div>
        <label className="wms-qty-filter-toggle" htmlFor="mismatch-only">
          <input
            id="mismatch-only"
            type="checkbox"
            checked={mismatchOnly}
            onChange={(e) => setMismatchOnly(e.target.checked)}
          />
          Hanya tidak match
        </label>
        <button
          type="button"
          className="wms-btn wms-btn-primary"
          onClick={() => {
            setDetail(null);
            loadReport(1);
          }}
          disabled={loading || detailLoading}
        >
          {loading ? 'Memuat...' : 'Muat Ulang'}
        </button>
      </div>

      {report && (
        <div className="wms-report-summary">
          <span>MO: <strong>{report.total || 0}</strong></span>
          <span>Prod: <strong>{formatQty(report.overall?.production_qty)}</strong></span>
          <span>Covered: <strong>{formatQty(report.overall?.wms_covered_qty)}</strong></span>
          <span>Missing: <strong>{formatQty(report.overall?.missing_qty)}</strong></span>
          <span>Surplus: <strong>{formatQty(report.overall?.surplus_wms_qty)}</strong></span>
          <span>|var|: <strong>{formatPercent(report.overall?.avg_abs_variance_percent)}</strong></span>
          <span>Uncovered rng: <strong>{formatQty(report.overall?.uncovered_range_count)}</strong></span>
        </div>
      )}

      {report && mismatchOnly && (
        <div className="wms-qty-filter-hint">
          Filter aktif: menampilkan {displayRows.length} tidak match dari {report.data?.length || 0} MO di halaman ini
          ({pageMismatchCount} mismatch / halaman).
        </div>
      )}

      {detail && (
        <div className="wms-qty-detail-panel">
          <div className="wms-qty-detail-header">
            <h2>
              {detail.mo_number}{' '}
              <span className={`wms-compare-badge ${detailStatus.className}`}>
                {detailStatus.label}
              </span>
            </h2>
            <div className="wms-qty-actions">
              <button
                type="button"
                className="wms-btn wms-btn-secondary wms-btn-sm"
                onClick={() => openMoExplorer(detail.mo_number)}
              >
                Explorer
              </button>
              <button
                type="button"
                className="wms-btn wms-btn-secondary wms-btn-sm"
                onClick={() => setDetail(null)}
              >
                Tutup
              </button>
            </div>
          </div>
          <div className="wms-qty-detail-meta">
            <span>{detail.sku_name || '—'}</span>
            <span>Prod <strong>{formatQty(detail.production_qty)}</strong></span>
            <span>WMS <strong>{formatQty(detail.wms_qr_qty)}</strong></span>
            <span>Covered <strong>{formatQty(detail.wms_covered_qty)}</strong></span>
            <span>Missing <strong>{formatQty(detail.missing_qty)}</strong></span>
            <span>Surplus <strong>{formatQty(detail.surplus_wms_qty)}</strong></span>
            <span>Var <strong>{formatPercent(detail.qty_variance_percent)}</strong></span>
          </div>

          <div className="wms-qty-detail-tabs">
            <button
              type="button"
              className={`wms-qty-detail-tab ${detailTab === 'unmatched' ? 'active' : ''}`}
              onClick={() => setDetailTab('unmatched')}
            >
              QR tidak match ({unmatchedQrItems.length})
            </button>
            <button
              type="button"
              className={`wms-qty-detail-tab ${detailTab === 'cartons' ? 'active' : ''}`}
              onClick={() => setDetailTab('cartons')}
            >
              Per carton ({allCartons.length}
              {surplusCartonCount > 0 ? `, ${surplusCartonCount} issue` : ''})
            </button>
            <button
              type="button"
              className={`wms-qty-detail-tab ${detailTab === 'sessions' ? 'active' : ''}`}
              onClick={() => setDetailTab('sessions')}
            >
              Session missing ({sessionCount})
            </button>
            <button
              type="button"
              className={`wms-qty-detail-tab ${detailTab === 'ranges' ? 'active' : ''}`}
              onClick={() => setDetailTab('ranges')}
            >
              Range missing ({rangeCount})
            </button>
          </div>

          {detailTab === 'unmatched' && (
            <div className="wms-qty-detail-section">
              <div className="wms-qty-unmatched-toolbar">
                <input
                  type="text"
                  value={unmatchedSearch}
                  onChange={(e) => setUnmatchedSearch(e.target.value)}
                  placeholder="Cari QR / carton / SFP..."
                  className="wms-qty-unmatched-search"
                />
                <span className="wms-qty-filter-hint" style={{ margin: 0 }}>
                  {filteredUnmatchedQrs.length} / {unmatchedQrItems.length} QR
                </span>
              </div>
              <div className="wms-table-wrap wms-qty-unmatched-scroll">
                <table className="wms-table">
                  <thead>
                    <tr>
                      <th># Carton</th>
                      <th>Carton</th>
                      <th>SFP</th>
                      <th>QR WMS</th>
                      <th>Qty</th>
                      <th>Alasan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUnmatchedQrs.map((qr, idx) => (
                      <tr key={`${qr.carton_id}-${qr.qr_barcode}-${idx}`}>
                        <td>
                          {qr.counting != null
                            ? `${qr.counting}/${qr.total_carton ?? '—'}`
                            : '—'}
                        </td>
                        <td>{qr.carton_barcode || '—'}</td>
                        <td>{qr.stock_transfer_order_id || '—'}</td>
                        <td className="wms-qty-qr-code">{qr.qr_barcode || '—'}</td>
                        <td>{formatQty(qr.qty)}</td>
                        <td>{formatUnmatchReason(qr.reason)}</td>
                      </tr>
                    ))}
                    {filteredUnmatchedQrs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="wms-empty">
                          {unmatchedQrItems.length === 0
                            ? 'Tidak ada QR WMS yang tidak match production_results.'
                            : 'Tidak ada hasil pencarian.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {detailTab === 'cartons' && (
            <div className="wms-qty-detail-section">
              <label className="wms-qty-filter-toggle" htmlFor="carton-issues-only" style={{ marginBottom: 6 }}>
                <input
                  id="carton-issues-only"
                  type="checkbox"
                  checked={cartonIssuesOnly}
                  onChange={(e) => setCartonIssuesOnly(e.target.checked)}
                />
                Hanya carton bermasalah
              </label>
              <div className="wms-table-wrap">
                <table className="wms-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>#</th>
                      <th>Carton</th>
                      <th>SFP</th>
                      <th>Qty</th>
                      <th>QR</th>
                      <th>OK</th>
                      <th>Gagal</th>
                      <th>Covered</th>
                      <th>Surplus</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayCartons.map((carton) => {
                      const expanded = !!expandedCartons[carton.carton_id];
                      const unmatchedList = carton.unmatched_qrs || [];
                      return (
                        <React.Fragment key={carton.carton_id}>
                          <tr>
                            <td>
                              {unmatchedList.length > 0 ? (
                                <button
                                  type="button"
                                  className="wms-btn wms-btn-secondary wms-btn-sm"
                                  onClick={() => toggleCartonExpand(carton.carton_id)}
                                >
                                  {expanded ? '−' : '+'} QR
                                </button>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td>
                              {carton.counting != null
                                ? `${carton.counting}/${carton.total_carton ?? '—'}`
                                : '—'}
                            </td>
                            <td>{carton.carton_barcode || '—'}</td>
                            <td>{carton.stock_transfer_order_id || '—'}</td>
                            <td>{formatQty(carton.carton_qty)}</td>
                            <td>{formatQty(carton.qr_total)}</td>
                            <td>{formatQty(carton.matched_qr)}</td>
                            <td>{formatQty(carton.unmatched_qr)}</td>
                            <td>{formatQty(carton.covered_qty)}</td>
                            <td>{formatQty(carton.surplus_qty)}</td>
                            <td>
                              {carton.qr_total === 0 ? (
                                <span className="wms-compare-badge wms-compare-badge-warn">No QR</span>
                              ) : carton.all_ok ? (
                                <span className="wms-compare-badge wms-compare-badge-ok">OK</span>
                              ) : (
                                <span className="wms-compare-badge wms-compare-badge-fail">Surplus</span>
                              )}
                            </td>
                          </tr>
                          {expanded && (
                            <tr className="wms-qty-carton-expand-row">
                              <td colSpan={11}>
                                <table className="wms-table wms-qty-subtable">
                                  <thead>
                                    <tr>
                                      <th>QR WMS tidak match</th>
                                      <th>Qty</th>
                                      <th>Alasan</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {unmatchedList.map((qr, idx) => (
                                      <tr key={`${carton.carton_id}-u-${idx}`}>
                                        <td className="wms-qty-qr-code">{qr.qr_barcode || '—'}</td>
                                        <td>{formatQty(qr.qty)}</td>
                                        <td>{formatUnmatchReason(qr.reason)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                    {displayCartons.length === 0 && (
                      <tr>
                        <td colSpan={11} className="wms-empty">
                          {cartonIssuesOnly
                            ? 'Tidak ada carton bermasalah.'
                            : 'Tidak ada carton WMS.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {detailTab === 'sessions' && (
            <div className="wms-qty-detail-section">
              <div className="wms-table-wrap">
                <table className="wms-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Tipe</th>
                      <th>PIC</th>
                      <th>Selesai</th>
                      <th>Prod</th>
                      <th>Covered</th>
                      <th>Missing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.missing_breakdown_sessions || []).map((row) => (
                      <tr key={row.production_result_id}>
                        <td>{row.production_result_id}</td>
                        <td>{row.production_type || '—'}</td>
                        <td>{row.pic || '—'}</td>
                        <td>{formatDate(row.completed_at)}</td>
                        <td>{formatQty(row.production_qty)}</td>
                        <td>{formatQty(row.covered_qty)}</td>
                        <td>{formatQty(row.missing_qty)}</td>
                      </tr>
                    ))}
                    {sessionCount === 0 && (
                      <tr>
                        <td colSpan={7} className="wms-empty">Tidak ada session missing.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {detailTab === 'ranges' && (
            <div className="wms-qty-detail-section">
              <div className="wms-table-wrap">
                <table className="wms-table">
                  <thead>
                    <tr>
                      <th>Sess</th>
                      <th>Tipe</th>
                      <th>Roll</th>
                      <th>First–Last</th>
                      <th>Size</th>
                      <th>Cov</th>
                      <th>Miss</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.missing_breakdown_ranges || []).map((range, idx) => (
                      <tr key={`${range.production_result_id}-${range.firstAuthenticity}-${idx}`}>
                        <td>{range.production_result_id || '—'}</td>
                        <td>{range.production_type || '—'}</td>
                        <td>{range.rollNumber || '—'}</td>
                        <td>
                          {range.firstAuthenticity || '—'}–{range.lastAuthenticity || '—'}
                        </td>
                        <td>{formatQty(range.range_size)}</td>
                        <td>{formatQty(range.covered_qty)}</td>
                        <td>{formatQty(range.missing_qty)}</td>
                        <td>
                          {range.fully_uncovered ? (
                            <span className="wms-compare-badge wms-compare-badge-fail">Full</span>
                          ) : (
                            <span className="wms-compare-badge wms-compare-badge-warn">Partial</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {rangeCount === 0 && (
                      <tr>
                        <td colSpan={8} className="wms-empty">Tidak ada range missing.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {report && (
        <>
          <div className="wms-table-wrap">
            <table className="wms-table">
              <thead>
                <tr>
                  <th>MO</th>
                  <th>SKU</th>
                  <th>Prod</th>
                  <th>WMS</th>
                  <th>Covered</th>
                  <th>Miss</th>
                  <th>Surplus</th>
                  <th>Var %</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row) => {
                  const status = formatQtyVarianceStatus(row.status);
                  return (
                    <tr key={row.mo_number}>
                      <td>
                        <button
                          type="button"
                          className="wms-link-btn"
                          onClick={() => openMoExplorer(row.mo_number)}
                        >
                          {row.mo_number}
                        </button>
                      </td>
                      <td title={row.sku_name || ''}>
                        {(row.sku_name || '—').length > 28
                          ? `${(row.sku_name || '').slice(0, 27)}…`
                          : (row.sku_name || '—')}
                      </td>
                      <td>{formatQty(row.production_qty)}</td>
                      <td>{row.has_wms_data ? formatQty(row.wms_qr_qty) : '—'}</td>
                      <td>{row.has_wms_data ? formatQty(row.wms_covered_qty) : '—'}</td>
                      <td>{formatQty(row.missing_qty)}</td>
                      <td>{row.has_wms_data ? formatQty(row.surplus_wms_qty) : '—'}</td>
                      <td>{formatPercent(row.qty_variance_percent)}</td>
                      <td>
                        <span className={`wms-compare-badge ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                      <td>
                        <div className="wms-qty-actions">
                          <button
                            type="button"
                            className="wms-btn wms-btn-secondary wms-btn-sm"
                            onClick={() => loadDetail(row.mo_number)}
                            disabled={detailLoading}
                          >
                            Detail
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {displayRows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="wms-empty">
                      {mismatchOnly
                        ? 'Tidak ada MO tidak match di halaman ini.'
                        : 'Tidak ada MO untuk filter ini.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="wms-pagination">
              <button
                type="button"
                className="wms-btn wms-btn-secondary"
                disabled={page <= 1 || loading}
                onClick={() => loadReport(page - 1)}
              >
                Prev
              </button>
              <span>{page} / {totalPages}</span>
              <button
                type="button"
                className="wms-btn wms-btn-secondary"
                disabled={page >= totalPages || loading}
                onClick={() => loadReport(page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default WmsProductionCompare;
