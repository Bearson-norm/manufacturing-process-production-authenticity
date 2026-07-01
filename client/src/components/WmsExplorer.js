import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import './WmsExplorer.css';

const PAGE_SIZE = 10;

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

function normalizeAuthData(authenticityData) {
  if (!authenticityData) return [];
  if (Array.isArray(authenticityData)) return authenticityData;
  if (typeof authenticityData === 'string') {
    try {
      const parsed = JSON.parse(authenticityData);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [];
    }
  }
  if (typeof authenticityData === 'object') return [authenticityData];
  return [];
}

function WmsExplorer() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [moInput, setMoInput] = useState(searchParams.get('mo') || '');
  const [activeMo, setActiveMo] = useState(searchParams.get('mo') || '');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [compare, setCompare] = useState(null);
  const [wmsCartons, setWmsCartons] = useState([]);
  const [wmsSummary, setWmsSummary] = useState(null);
  const [wmsTotal, setWmsTotal] = useState(0);
  const [wmsPage, setWmsPage] = useState(1);

  const [productionRows, setProductionRows] = useState([]);
  const [prodPage, setProdPage] = useState(1);

  const [expandedWms, setExpandedWms] = useState({});
  const [expandedProd, setExpandedProd] = useState({});

  const [authInput, setAuthInput] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [highlightProdIds, setHighlightProdIds] = useState(new Set());
  const [highlightRangeKeys, setHighlightRangeKeys] = useState(new Set());

  const [bulkVerifyLoading, setBulkVerifyLoading] = useState(false);
  const [bulkVerifyResult, setBulkVerifyResult] = useState(null);
  const [expandedBulkCartons, setExpandedBulkCartons] = useState({});
  const [showFailedCartonsOnly, setShowFailedCartonsOnly] = useState(false);
  const [showFailedQrOnly, setShowFailedQrOnly] = useState(false);

  const loadData = useCallback(async (moNumber, pageOverride) => {
    if (!moNumber) return;

    const page = pageOverride != null ? pageOverride : wmsPage;

    setLoading(true);
    setMessage({ type: '', text: '' });
    setVerifyResult(null);
    setBulkVerifyResult(null);
    setExpandedBulkCartons({});
    setHighlightProdIds(new Set());
    setHighlightRangeKeys(new Set());

    try {
      const [cartonsRes, compareRes, prodRes] = await Promise.all([
        axios.get('/api/wms/cartons', {
          params: { mo_number: moNumber, page, limit: PAGE_SIZE }
        }),
        axios.get('/api/wms/compare', { params: { mo_number: moNumber } }),
        axios.get('/api/reports/manufacturing', { params: { moNumber: moNumber } })
      ]);

      if (cartonsRes.data.success) {
        setWmsCartons(cartonsRes.data.data || []);
        setWmsSummary(cartonsRes.data.summary || null);
        setWmsTotal(cartonsRes.data.total || 0);
      } else {
        setWmsCartons([]);
        setWmsSummary(null);
        setWmsTotal(0);
      }

      if (compareRes.data.success) {
        setCompare(compareRes.data);
      } else {
        setCompare(null);
      }

      const prodData = prodRes.data?.success ? (prodRes.data.data || []) : [];
      setProductionRows(Array.isArray(prodData) ? prodData : []);
    } catch (error) {
      console.error('Load WMS explorer data:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Gagal memuat data'
      });
    } finally {
      setLoading(false);
    }
  }, [wmsPage]);

  useEffect(() => {
    if (activeMo) {
      loadData(activeMo);
    }
  }, [activeMo, wmsPage, loadData]);

  const handleSearch = async () => {
    const mo = moInput.trim();
    if (!mo) {
      setMessage({ type: 'error', text: 'Masukkan nomor MO terlebih dahulu' });
      return;
    }
    setActiveMo(mo);
    setWmsPage(1);
    setProdPage(1);
    setSearchParams({ mo });
    await loadData(mo, 1);
  };

  const handleSync = async () => {
    const mo = activeMo || moInput.trim();
    if (!mo) {
      setMessage({ type: 'error', text: 'Masukkan nomor MO terlebih dahulu' });
      return;
    }

    setSyncing(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await axios.post('/api/wms/sync-mo', { mo_number: mo });
      if (response.data.success) {
        const fetched = response.data.fetched_from_wms ?? response.data.cartons_upserted ?? 0;
        if (fetched === 0 && response.data.warning) {
          setMessage({ type: 'warning', text: response.data.warning });
        } else {
          setMessage({
            type: 'success',
            text: `Sync berhasil: ${response.data.cartons_upserted} carton, ${response.data.qr_upserted} QR`
          });
        }
        if (!activeMo) {
          setActiveMo(mo);
          setSearchParams({ mo });
        }
        setWmsPage(1);
        await loadData(mo, 1);
      } else {
        setMessage({ type: 'error', text: response.data.error || 'Sync gagal' });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Sync gagal — periksa token WMS di Admin'
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleVerify = async () => {
    if (!activeMo) {
      setMessage({ type: 'error', text: 'Cari MO terlebih dahulu' });
      return;
    }
    const num = authInput.replace(/\D/g, '');
    if (!num) {
      setMessage({ type: 'error', text: 'Masukkan nomor authenticity yang valid' });
      return;
    }

    setVerifyLoading(true);
    setVerifyResult(null);
    setHighlightProdIds(new Set());
    setHighlightRangeKeys(new Set());

    try {
      const response = await axios.post('/api/wms/verify-authenticity', {
        mo_number: activeMo,
        authenticity_number: num
      });

      if (response.data.success) {
        setVerifyResult(response.data);
        const prodIds = new Set();
        const rangeKeys = new Set();
        (response.data.matched_ranges || []).forEach((r) => {
          if (r.production_result_id) prodIds.add(r.production_result_id);
          rangeKeys.add(`${r.production_result_id}-${r.firstAuthenticity}-${r.lastAuthenticity}`);
        });
        setHighlightProdIds(prodIds);
        setHighlightRangeKeys(rangeKeys);

        const matchedSessionIds = new Set(
          (response.data.matched_ranges || []).map((r) => r.production_result_id)
        );
        if (matchedSessionIds.size > 0) {
          const idx = productionRows.findIndex((row) => matchedSessionIds.has(row.id));
          if (idx >= 0) {
            setProdPage(Math.floor(idx / PAGE_SIZE) + 1);
          }
        }
      }
    } catch (error) {
      setVerifyResult({
        in_range: false,
        error: error.response?.data?.error || 'Verifikasi gagal'
      });
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleBulkVerify = async () => {
    if (!activeMo) {
      setMessage({ type: 'error', text: 'Cari MO terlebih dahulu' });
      return;
    }

    setBulkVerifyLoading(true);
    setBulkVerifyResult(null);
    setExpandedBulkCartons({});

    try {
      const response = await axios.post('/api/wms/verify-all-qr', { mo_number: activeMo });
      if (response.data.success) {
        setBulkVerifyResult(response.data);
      } else {
        setMessage({ type: 'error', text: response.data.error || 'Verifikasi bulk gagal' });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Verifikasi bulk gagal'
      });
    } finally {
      setBulkVerifyLoading(false);
    }
  };

  const formatMatchedRange = (ranges) => {
    if (!ranges || ranges.length === 0) return '-';
    const r = ranges[0];
    return `Roll ${r.rollNumber || '-'} | ${r.firstAuthenticity} – ${r.lastAuthenticity}`;
  };

  const formatMatchedMeta = (ranges) => {
    if (!ranges || ranges.length === 0) return '-';
    const r = ranges[0];
    return `${r.pic || '-'} / ${r.production_type || '-'}`;
  };

  const bulkCartons = (bulkVerifyResult?.cartons || []).filter((carton) => {
    if (!showFailedCartonsOnly) return true;
    return carton.unmatched > 0 || (carton.qr_total === 0 && !carton.all_ok);
  });

  const prodTotal = productionRows.length;
  const prodPageRows = productionRows.slice((prodPage - 1) * PAGE_SIZE, prodPage * PAGE_SIZE);
  const wmsTotalPages = Math.max(1, Math.ceil(wmsTotal / PAGE_SIZE));
  const prodTotalPages = Math.max(1, Math.ceil(prodTotal / PAGE_SIZE));

  const matchStatus = compare?.match_status || 'local_only';
  const badgeClass = `wms-badge wms-badge-${matchStatus}`;

  const localSkuSummary = compare?.local?.sku_names?.join(', ') ||
    productionRows.map((r) => r.sku_name).filter(Boolean)[0] || '-';

  const localTypeSummary = compare?.local?.by_type?.map(
    (t) => `${t.production_type}: ${t.total_quantity}`
  ).join(' | ') || '-';

  return (
    <div className="wms-explorer-container">
      <div className="wms-explorer-header">
        <button type="button" onClick={() => navigate('/dashboard')} className="back-button">
          ← Kembali ke Dashboard
        </button>
        <h1>WMS vs Production Explorer</h1>
      </div>

      {message.text && (
        <div className={`wms-message ${message.type}`}>{message.text}</div>
      )}

      <div className="wms-toolbar">
        <div className="field-group">
          <label htmlFor="mo-input">MO Number</label>
          <input
            id="mo-input"
            type="text"
            value={moInput}
            onChange={(e) => setMoInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="PROD/MO/37796"
          />
        </div>
        <div className="wms-toolbar-actions">
          <button type="button" className="wms-btn wms-btn-primary" onClick={handleSearch} disabled={loading}>
            Cari
          </button>
          <button type="button" className="wms-btn wms-btn-secondary" onClick={handleSync} disabled={syncing || loading}>
            {syncing ? 'Syncing...' : 'Sync dari WMS'}
          </button>
        </div>
      </div>

      {activeMo && compare && (
        <div className="wms-summary-bar">
          <span className={badgeClass}>{matchStatus.replace('_', ' ')}</span>
          <span>MO: <strong>{activeMo}</strong></span>
          <span>WMS: <strong>{compare.wms?.carton_count || 0}</strong> carton</span>
          <span>Production: <strong>{compare.local?.session_count || 0}</strong> session</span>
          {compare.summary?.sku_match != null && (
            <span>SKU match: <strong>{compare.summary.sku_match ? 'Ya' : 'Tidak'}</strong></span>
          )}
        </div>
      )}

      <div className="wms-split-view">
        {/* WMS Panel */}
        <div className="wms-panel">
          <div className="wms-panel-header">
            <h2>Panel WMS — Repacking Carton</h2>
            <div className="wms-panel-meta">
              {activeMo ? (
                <>
                  <div>MO: <strong>{activeMo}</strong></div>
                  <div>SKU: <strong>{wmsSummary?.sku || '-'}</strong></div>
                  <div>Product: <strong>{wmsSummary?.description || '-'}</strong></div>
                  <div>Carton: <strong>{wmsSummary?.carton_count || 0}</strong> | Total Qty: <strong>{wmsSummary?.total_qty || 0}</strong></div>
                </>
              ) : (
                <div>Cari MO untuk menampilkan data WMS</div>
              )}
            </div>
          </div>
          <div className="wms-panel-body">
            {loading ? (
              <div className="wms-loading">Memuat data WMS...</div>
            ) : !activeMo ? (
              <div className="wms-empty">Masukkan MO dan klik Cari</div>
            ) : wmsCartons.length === 0 ? (
              <div className="wms-empty">Belum ada data WMS — klik Sync dari WMS</div>
            ) : (
              <div className="wms-table-wrap">
                <table className="wms-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Created</th>
                      <th>Prod Date</th>
                      <th>SFP</th>
                      <th>Barcode</th>
                      <th>Count</th>
                      <th>Qty</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wmsCartons.map((row) => (
                      <React.Fragment key={row.id}>
                        <tr>
                          <td>
                            <button
                              type="button"
                              className="wms-expand-btn"
                              onClick={() => setExpandedWms((prev) => ({ ...prev, [row.id]: !prev[row.id] }))}
                            >
                              {expandedWms[row.id] ? '−' : '+'} QR
                            </button>
                          </td>
                          <td>{formatDate(row.created_time)}</td>
                          <td>{formatDate(row.production_date)}</td>
                          <td>{row.stock_transfer_order_id || '-'}</td>
                          <td>{row.barcode || '-'}</td>
                          <td>{row.counting ?? '-'} / {row.total_carton ?? '-'}</td>
                          <td>{row.qty ?? '-'}</td>
                          <td>{row.status === 1 ? 'Active' : row.status ?? '-'}</td>
                        </tr>
                        {expandedWms[row.id] && (
                          <tr>
                            <td colSpan={8}>
                              <table className="wms-subtable">
                                <thead>
                                  <tr>
                                    <th>QR Barcode</th>
                                    <th>Qty</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(row.qr_list || []).map((qr) => (
                                    <tr key={qr.id || qr.prieds_qr_id || qr.barcode}>
                                      <td>{qr.barcode}</td>
                                      <td>{qr.qty ?? 1}</td>
                                    </tr>
                                  ))}
                                  {(row.qr_list || []).length === 0 && (
                                    <tr><td colSpan={2}>Tidak ada QR</td></tr>
                                  )}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {activeMo && wmsTotal > 0 && (
            <div className="wms-pagination">
              <span>{(wmsPage - 1) * PAGE_SIZE + 1}–{Math.min(wmsPage * PAGE_SIZE, wmsTotal)} dari {wmsTotal}</span>
              <div>
                <button type="button" className="wms-btn wms-btn-secondary" disabled={wmsPage <= 1} onClick={() => setWmsPage((p) => p - 1)}>Prev</button>
                {' '}
                <button type="button" className="wms-btn wms-btn-secondary" disabled={wmsPage >= wmsTotalPages} onClick={() => setWmsPage((p) => p + 1)}>Next</button>
              </div>
            </div>
          )}
        </div>

        {/* Production Panel */}
        <div className="wms-panel">
          <div className="wms-panel-header">
            <h2>Panel Production — production_results</h2>
            <div className="wms-panel-meta">
              {activeMo ? (
                <>
                  <div>MO: <strong>{activeMo}</strong></div>
                  <div>SKU: <strong>{localSkuSummary}</strong></div>
                  <div>By type: <strong>{localTypeSummary}</strong></div>
                  <div>Sessions: <strong>{prodTotal}</strong></div>
                </>
              ) : (
                <div>Cari MO untuk menampilkan data production</div>
              )}
            </div>
          </div>
          <div className="wms-panel-body">
            {loading ? (
              <div className="wms-loading">Memuat data production...</div>
            ) : !activeMo ? (
              <div className="wms-empty">Masukkan MO dan klik Cari</div>
            ) : productionRows.length === 0 ? (
              <div className="wms-empty">MO tidak ditemukan di production_results</div>
            ) : (
              <div className="wms-table-wrap">
                <table className="wms-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Type</th>
                      <th>PIC</th>
                      <th>SKU</th>
                      <th>Qty</th>
                      <th>Status</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prodPageRows.map((row) => {
                      const isHighlighted = highlightProdIds.has(row.id);
                      return (
                        <React.Fragment key={row.id}>
                          <tr className={isHighlighted ? 'highlight-row' : ''}>
                            <td>
                              <button
                                type="button"
                                className="wms-expand-btn"
                                onClick={() => setExpandedProd((prev) => ({ ...prev, [row.id]: !prev[row.id] }))}
                              >
                                {expandedProd[row.id] ? '−' : '+'} Auth
                              </button>
                            </td>
                            <td>{row.production_type}</td>
                            <td>{row.pic || '-'}</td>
                            <td>{row.sku_name || '-'}</td>
                            <td>{row.quantity ?? '-'}</td>
                            <td>{row.status || '-'}</td>
                            <td>{formatDate(row.created_at)}</td>
                          </tr>
                          {expandedProd[row.id] && (
                            <tr>
                              <td colSpan={7}>
                                <table className="wms-subtable">
                                  <thead>
                                    <tr>
                                      <th>Roll</th>
                                      <th>First</th>
                                      <th>Last</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {normalizeAuthData(row.authenticity_data).map((auth, idx) => {
                                      const rangeKey = `${row.id}-${auth.firstAuthenticity}-${auth.lastAuthenticity}`;
                                      const rangeHighlight = highlightRangeKeys.has(rangeKey);
                                      return (
                                        <tr key={rangeKey || idx} className={rangeHighlight ? 'highlight-row' : ''}>
                                          <td>{auth.rollNumber || '-'}</td>
                                          <td>{auth.firstAuthenticity || '-'}</td>
                                          <td>{auth.lastAuthenticity || '-'}</td>
                                        </tr>
                                      );
                                    })}
                                    {normalizeAuthData(row.authenticity_data).length === 0 && (
                                      <tr><td colSpan={3}>Tidak ada authenticity data</td></tr>
                                    )}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {activeMo && prodTotal > 0 && (
            <div className="wms-pagination">
              <span>{(prodPage - 1) * PAGE_SIZE + 1}–{Math.min(prodPage * PAGE_SIZE, prodTotal)} dari {prodTotal}</span>
              <div>
                <button type="button" className="wms-btn wms-btn-secondary" disabled={prodPage <= 1} onClick={() => setProdPage((p) => p - 1)}>Prev</button>
                {' '}
                <button type="button" className="wms-btn wms-btn-secondary" disabled={prodPage >= prodTotalPages} onClick={() => setProdPage((p) => p + 1)}>Next</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="wms-verify-section">
        <h2>Verifikasi Authenticity (production_results)</h2>
        <div className="wms-verify-form">
          <div className="field-group" style={{ flex: 1, minWidth: '240px' }}>
            <label htmlFor="auth-input">Nomor Authenticity</label>
            <input
              id="auth-input"
              type="text"
              value={authInput}
              onChange={(e) => setAuthInput(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
              placeholder="01030898365"
              disabled={!activeMo}
            />
          </div>
          <button
            type="button"
            className="wms-btn wms-btn-primary"
            onClick={handleVerify}
            disabled={verifyLoading || !activeMo}
          >
            {verifyLoading ? 'Memverifikasi...' : 'Verifikasi'}
          </button>
        </div>

        {verifyResult && !verifyResult.error && (
          <div className={`wms-verify-result ${verifyResult.in_range ? 'wms-verify-success' : 'wms-verify-error'}`}>
            {verifyResult.in_range ? (
              <>
                <div>✓ Nomor <strong>{verifyResult.authenticity_number}</strong> dalam range production_results</div>
                {(verifyResult.matched_ranges || []).map((r, i) => (
                  <div key={i}>
                    Roll {r.rollNumber || '-'} | {r.firstAuthenticity} – {r.lastAuthenticity}
                    {' '}| SKU: {r.sku_name || '-'} | PIC: {r.pic || '-'} | Type: {r.production_type}
                  </div>
                ))}
              </>
            ) : (
              <>
                <div>✗ Nomor <strong>{verifyResult.authenticity_number}</strong> di luar semua range untuk MO {activeMo}</div>
                {(verifyResult.all_ranges || []).length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    Range yang tersedia:
                    {(verifyResult.all_ranges || []).map((r, i) => (
                      <div key={i}>
                        {r.firstAuthenticity} – {r.lastAuthenticity} (Roll {r.rollNumber || '-'}, {r.production_type})
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {verifyResult?.error && (
          <div className="wms-verify-result wms-verify-error">{verifyResult.error}</div>
        )}
      </div>

      <div className="wms-bulk-verify-section">
        <h2>Verifikasi Semua QR Carton</h2>
        <p className="wms-bulk-desc">
          Periksa setiap QR barcode di semua carton WMS terhadap range authenticity di production_results.
        </p>
        <div className="wms-verify-form">
          <button
            type="button"
            className="wms-btn wms-btn-primary"
            onClick={handleBulkVerify}
            disabled={bulkVerifyLoading || !activeMo}
          >
            {bulkVerifyLoading ? 'Memverifikasi...' : 'Verifikasi Semua QR'}
          </button>
          {bulkVerifyResult && (
            <>
              <label className="wms-bulk-toggle">
                <input
                  type="checkbox"
                  checked={showFailedCartonsOnly}
                  onChange={(e) => setShowFailedCartonsOnly(e.target.checked)}
                />
                Hanya carton ada QR gagal
              </label>
              <label className="wms-bulk-toggle">
                <input
                  type="checkbox"
                  checked={showFailedQrOnly}
                  onChange={(e) => setShowFailedQrOnly(e.target.checked)}
                />
                Saat expand, hanya QR gagal
              </label>
            </>
          )}
        </div>

        {bulkVerifyResult && (
          <>
            <div
              className={`wms-verify-result ${
                bulkVerifyResult.summary?.all_ok ? 'wms-verify-success' : 'wms-verify-error'
              }`}
            >
              <div>
                Carton: <strong>{bulkVerifyResult.summary?.total_cartons || 0}</strong>
                {' '}| QR: <strong>{bulkVerifyResult.summary?.total_qr || 0}</strong>
                {' '}| OK: <strong>{bulkVerifyResult.summary?.matched || 0}</strong>
                {' '}| Gagal: <strong>{bulkVerifyResult.summary?.unmatched || 0}</strong>
              </div>
              {bulkVerifyResult.summary?.message && (
                <div style={{ marginTop: '8px' }}>{bulkVerifyResult.summary.message}</div>
              )}
              {!bulkVerifyResult.summary?.message &&
                bulkVerifyResult.summary?.all_ok &&
                bulkVerifyResult.summary?.total_qr > 0 && (
                  <div style={{ marginTop: '8px' }}>Semua QR dalam range production_results.</div>
                )}
            </div>

            {bulkCartons.length > 0 ? (
              <div className="wms-table-wrap wms-bulk-carton-list">
                <table className="wms-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Carton Barcode</th>
                      <th>SFP</th>
                      <th>Count</th>
                      <th>QR OK</th>
                      <th>QR Gagal</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkCartons.map((carton) => {
                      const qrItems = (carton.qr_items || []).filter((qr) => {
                        if (!showFailedQrOnly) return true;
                        return !qr.in_range;
                      });

                      return (
                        <React.Fragment key={carton.carton_id}>
                          <tr className={carton.all_ok ? 'wms-bulk-carton-ok' : 'wms-bulk-carton-fail'}>
                            <td>
                              <button
                                type="button"
                                className="wms-expand-btn"
                                onClick={() =>
                                  setExpandedBulkCartons((prev) => ({
                                    ...prev,
                                    [carton.carton_id]: !prev[carton.carton_id]
                                  }))
                                }
                              >
                                {expandedBulkCartons[carton.carton_id] ? '−' : '+'} QR
                              </button>
                            </td>
                            <td>{carton.barcode || '-'}</td>
                            <td>{carton.stock_transfer_order_id || '-'}</td>
                            <td>{carton.counting ?? '-'} / {carton.total_carton ?? '-'}</td>
                            <td>{carton.matched}</td>
                            <td>{carton.unmatched}</td>
                            <td>
                              {carton.qr_total === 0 ? (
                                <span className="wms-qr-status-fail">Tidak ada QR</span>
                              ) : carton.all_ok ? (
                                <span className="wms-qr-status-ok">Semua OK</span>
                              ) : (
                                <span className="wms-qr-status-fail">Ada gagal</span>
                              )}
                            </td>
                          </tr>
                          {expandedBulkCartons[carton.carton_id] && (
                            <tr>
                              <td colSpan={7}>
                                <table className="wms-subtable">
                                  <thead>
                                    <tr>
                                      <th>QR Barcode</th>
                                      <th>Qty</th>
                                      <th>Status</th>
                                      <th>Range cocok</th>
                                      <th>PIC / Type</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {qrItems.map((qr) => (
                                      <tr
                                        key={`${carton.carton_id}-${qr.prieds_qr_id || qr.barcode}`}
                                        className={qr.in_range ? 'wms-bulk-carton-ok' : 'wms-bulk-carton-fail'}
                                      >
                                        <td>{qr.barcode || '-'}</td>
                                        <td>{qr.qty ?? 1}</td>
                                        <td>
                                          {qr.in_range ? (
                                            <span className="wms-qr-status-ok">Dalam range</span>
                                          ) : (
                                            <span className="wms-qr-status-fail">
                                              {qr.reason === 'invalid_barcode'
                                                ? 'Barcode invalid'
                                                : qr.reason === 'no_production_ranges'
                                                  ? 'Tidak ada range'
                                                  : 'Di luar range'}
                                            </span>
                                          )}
                                        </td>
                                        <td>{formatMatchedRange(qr.matched_ranges)}</td>
                                        <td>{formatMatchedMeta(qr.matched_ranges)}</td>
                                      </tr>
                                    ))}
                                    {qrItems.length === 0 && (
                                      <tr>
                                        <td colSpan={5}>
                                          {showFailedQrOnly
                                            ? 'Tidak ada QR gagal di carton ini'
                                            : 'Tidak ada QR'}
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : bulkVerifyResult.summary?.total_cartons === 0 ? (
              <div className="wms-empty">Belum ada data WMS — sync dari WMS terlebih dahulu.</div>
            ) : (
              <div className="wms-empty">Tidak ada carton yang cocok dengan filter.</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default WmsExplorer;
