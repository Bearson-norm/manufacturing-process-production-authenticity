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
  const [message, setMessage] = useState({ type: '', text: '' });
  const [report, setReport] = useState(null);

  const loadReport = useCallback(async (pageOverride) => {
    const currentPage = pageOverride != null ? pageOverride : page;
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const params = { page: currentPage, limit: PAGE_SIZE };
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (search.trim()) params.search = search.trim();

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
  }, [dateFrom, dateTo, page, search]);

  useEffect(() => {
    loadReport(1);
  }, []);

  const totalPages = Math.max(1, Math.ceil((report?.total || 0) / PAGE_SIZE));

  const openMoDetail = (moNumber) => {
    navigate(`/wms-explorer?mo=${encodeURIComponent(moNumber)}`);
  };

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
          disabled={loading}
        >
          {loading ? 'Memuat...' : 'Muat Ulang'}
        </button>
      </div>

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
