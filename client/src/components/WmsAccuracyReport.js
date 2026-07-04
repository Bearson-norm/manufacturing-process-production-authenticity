import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  formatPercent,
  formatWmsCompareStatus,
  getAccuracyColorClass
} from '../utils/wmsAccuracy';
import './WmsAccuracyReport.css';

const PAGE_SIZE = 25;
const SYNC_CHUNK_SIZE = 5;

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

function WmsAccuracyReport() {
  const navigate = useNavigate();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [syncingBatch, setSyncingBatch] = useState(false);
  const [syncProgress, setSyncProgress] = useState(null);
  const [syncSummary, setSyncSummary] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [report, setReport] = useState(null);

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

      const response = await axios.get('/api/wms/mo-accuracy-report', { params });
      if (response.data.success) {
        setReport(response.data);
        setPage(currentPage);
      } else {
        setMessage({ type: 'error', text: response.data.error || 'Gagal memuat laporan' });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Gagal memuat laporan keakuratan MO'
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

  const openMoDetail = (moNumber) => {
    navigate(`/wms-explorer?mo=${encodeURIComponent(moNumber)}`);
  };

  const handleBatchSync = async () => {
    setSyncSummary(null);
    setMessage({ type: '', text: '' });

    try {
      const listRes = await axios.get('/api/wms/mo-accuracy-report/mo-list', {
        params: buildFilterParams()
      });

      if (!listRes.data.success) {
        setMessage({ type: 'error', text: listRes.data.error || 'Gagal mengambil daftar MO' });
        return;
      }

      const moNumbers = listRes.data.mo_numbers || [];
      const total = listRes.data.total || moNumbers.length;

      if (total === 0) {
        setMessage({ type: 'error', text: 'Tidak ada MO untuk disync sesuai filter.' });
        return;
      }

      const confirmed = window.confirm(
        `Sync WMS untuk ${total} MO sesuai filter?\n\nProses ini dapat memakan waktu beberapa menit.`
      );
      if (!confirmed) return;

      setSyncingBatch(true);
      setSyncProgress({ current: 0, total: moNumbers.length, mo_number: moNumbers[0] });

      const aggregated = {
        total: moNumbers.length,
        synced_ok: 0,
        synced_warning: 0,
        failed: 0,
        results: []
      };

      for (let i = 0; i < moNumbers.length; i += SYNC_CHUNK_SIZE) {
        const chunk = moNumbers.slice(i, i + SYNC_CHUNK_SIZE);
        setSyncProgress({
          current: Math.min(i + chunk.length, moNumbers.length),
          total: moNumbers.length,
          mo_number: chunk[0]
        });

        try {
          const syncRes = await axios.post('/api/wms/sync-mo-batch', {
            mo_numbers: chunk
          });

          if (syncRes.data.success) {
            aggregated.synced_ok += syncRes.data.synced_ok || 0;
            aggregated.synced_warning += syncRes.data.synced_warning || 0;
            aggregated.failed += syncRes.data.failed || 0;
            aggregated.results.push(...(syncRes.data.results || []));
          } else {
            aggregated.failed += chunk.length;
            chunk.forEach((mo) => {
              aggregated.results.push({
                mo_number: mo,
                success: false,
                error: syncRes.data.error || 'Chunk sync gagal'
              });
            });
          }
        } catch (chunkError) {
          const chunkMsg = chunkError.response?.data?.error ||
            (chunkError.response?.status === 502
              ? 'Gateway timeout — coba persempit filter atau sync ulang'
              : 'Chunk sync gagal');
          aggregated.failed += chunk.length;
          chunk.forEach((mo) => {
            aggregated.results.push({
              mo_number: mo,
              success: false,
              error: chunkMsg
            });
          });
        }
      }

      setSyncSummary(aggregated);
      setMessage({
        type: aggregated.failed > 0 ? 'warning' : 'success',
        text: `Sync selesai: ${aggregated.synced_ok} OK, ${aggregated.synced_warning} warning, ${aggregated.failed} gagal`
      });
      await loadReport(page);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Batch sync gagal'
      });
    } finally {
      setSyncingBatch(false);
      setSyncProgress(null);
    }
  };

  const failedResults = (syncSummary?.results || []).filter((r) => !r.success);
  const failedPreview = failedResults.slice(0, 5);
  const failedRemainder = failedResults.length - failedPreview.length;

  return (
    <div className="wms-report-container">
      <div className="wms-report-header">
        <button type="button" onClick={() => navigate('/dashboard')} className="back-button">
          ← Kembali ke Dashboard
        </button>
        <h1>Laporan Keakuratan QR vs Production</h1>
        <button
          type="button"
          className="wms-btn wms-btn-secondary"
          onClick={() => navigate('/wms-explorer')}
        >
          WMS Explorer
        </button>
      </div>

      {message.text && (
        <div className={`wms-message ${message.type}`}>{message.text}</div>
      )}

      <div className="wms-report-toolbar">
        <div className="field-group">
          <label htmlFor="date-from">Selesai dari</label>
          <input
            id="date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="field-group">
          <label htmlFor="date-to">Selesai sampai</label>
          <input
            id="date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        <div className="field-group wms-report-search">
          <label htmlFor="mo-search">Cari MO</label>
          <input
            id="mo-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadReport(1)}
            placeholder="PROD/MO/..."
          />
        </div>
        <button
          type="button"
          className="wms-btn wms-btn-primary"
          onClick={() => loadReport(1)}
          disabled={loading || syncingBatch}
        >
          {loading ? 'Memuat...' : 'Muat Ulang'}
        </button>
        <button
          type="button"
          className="wms-btn wms-btn-secondary"
          onClick={handleBatchSync}
          disabled={loading || syncingBatch}
        >
          {syncingBatch ? 'Menyinkronkan...' : 'Sync WMS Semua MO'}
        </button>
      </div>

      {syncingBatch && (
        <div className="wms-sync-batch-panel wms-sync-batch-progress">
          Menyinkronkan WMS...
          {syncProgress && (
            <span>
              {' '}
              ({syncProgress.current}/{syncProgress.total} MO
              {syncProgress.mo_number ? ` — ${syncProgress.mo_number}` : ''})
            </span>
          )}
        </div>
      )}

      {syncSummary && !syncingBatch && (
        <div
          className={`wms-sync-batch-panel ${
            syncSummary.failed > 0
              ? 'wms-sync-batch-warn'
              : syncSummary.synced_warning > 0
                ? 'wms-sync-batch-warn'
                : 'wms-sync-batch-ok'
          }`}
        >
          <div>
            Hasil sync: <strong>{syncSummary.synced_ok}</strong> OK
            {' '}| <strong>{syncSummary.synced_warning}</strong> warning (0 carton WMS)
            {' '}| <strong>{syncSummary.failed}</strong> gagal
            {' '}(total {syncSummary.total} MO)
          </div>
          {failedPreview.length > 0 && (
            <ul className="wms-sync-fail-list">
              {failedPreview.map((row) => (
                <li key={row.mo_number}>
                  {row.mo_number}: {row.error}
                </li>
              ))}
              {failedRemainder > 0 && (
                <li>... dan {failedRemainder} MO gagal lainnya</li>
              )}
            </ul>
          )}
        </div>
      )}

      {report && (
        <>
          <div className="wms-report-summary">
            <span>Total MO: <strong>{report.total || 0}</strong></span>
            <span>MO dengan WMS: <strong>{report.overall?.with_wms || 0}</strong></span>
            <span>
              Rata-rata error:{' '}
              <span
                className={`wms-accuracy-pill ${getAccuracyColorClass(report.overall?.avg_error_rate_percent)}`}
              >
                {formatPercent(report.overall?.avg_error_rate_percent)}
              </span>
              {(report.overall?.total_qr || 0) > 0 && (
                <span className="wms-accuracy-subtext" style={{ marginLeft: '8px' }}>
                  ({report.overall?.failed_qr || 0}/{report.overall?.total_qr} QR gagal)
                </span>
              )}
            </span>
          </div>

          <div className="wms-table-wrap">
            <table className="wms-table">
              <thead>
                <tr>
                  <th>MO Number</th>
                  <th>Selesai terakhir</th>
                  <th>Session</th>
                  <th>SKU</th>
                  <th>Status WMS</th>
                  <th>Carton</th>
                  <th>Qty WMS</th>
                  <th>Error %</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {(report.data || []).map((row) => {
                  const compareStatus = formatWmsCompareStatus(row.wms_status);
                  return (
                    <tr key={row.mo_number}>
                      <td>
                        <button
                          type="button"
                          className="wms-link-btn"
                          onClick={() => openMoDetail(row.mo_number)}
                        >
                          {row.mo_number}
                        </button>
                      </td>
                      <td>{formatDate(row.last_completed_at)}</td>
                      <td>{row.session_count || 0}</td>
                      <td>{row.sku_name || '-'}</td>
                      <td>
                        <span className={`wms-compare-badge ${compareStatus.className}`}>
                          {compareStatus.label}
                        </span>
                      </td>
                      <td>{row.has_wms_data ? row.wms_carton_count : '—'}</td>
                      <td>{row.total_wms_qty > 0 ? row.total_wms_qty : '—'}</td>
                      <td>
                        {row.error_rate_percent != null ? (
                          <span
                            className={`wms-accuracy-pill ${getAccuracyColorClass(row.error_rate_percent)}`}
                          >
                            {formatPercent(row.error_rate_percent)}
                          </span>
                        ) : (
                          <span className="wms-accuracy-pill wms-accuracy-neutral">—</span>
                        )}
                        {row.verify_message && (
                          <div className="wms-accuracy-subtext">{row.verify_message}</div>
                        )}
                        {!row.verify_message && (row.total_qr || 0) > 0 && (
                          <div className="wms-accuracy-subtext">
                            {row.failed_qr}/{row.total_qr} QR gagal
                          </div>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="wms-btn wms-btn-secondary wms-btn-sm"
                          onClick={() => openMoDetail(row.mo_number)}
                        >
                          Detail
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {(report.data || []).length === 0 && (
                  <tr>
                    <td colSpan={9} className="wms-empty">Tidak ada MO untuk filter ini.</td>
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
                Sebelumnya
              </button>
              <span>Halaman {page} / {totalPages}</span>
              <button
                type="button"
                className="wms-btn wms-btn-secondary"
                disabled={page >= totalPages || loading}
                onClick={() => loadReport(page + 1)}
              >
                Berikutnya
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default WmsAccuracyReport;
