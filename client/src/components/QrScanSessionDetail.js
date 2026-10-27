import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from '../axiosAuth';
import {
  hasScannerLineTerminator,
  isScannerSubmitKey,
  stripScannerLineEndings,
} from '../utils/scannerInput';
import { formatQrScanDateTime } from '../utils/qrScanFormat';
import './QrScanSessionList.css';
import './QrScanSessionDetail.css';

const PAGE_SIZE = 50;

function QrScanSessionDetail() {
  const { sessionNumber } = useParams();
  const navigate = useNavigate();
  const scanInputRef = useRef(null);
  const scanQueueRef = useRef([]);
  const scanWorkerActiveRef = useRef(false);
  const terminatorSubmitAtRef = useRef(0);

  const [session, setSession] = useState(null);
  const [items, setItems] = useState([]);
  const [itemsTotal, setItemsTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scanValue, setScanValue] = useState('');
  const [scanMessage, setScanMessage] = useState('');
  const [scanError, setScanError] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const isFinished = session?.status === 'finished';
  const canScan = session && !isFinished;

  const applySessionPayload = useCallback((res, nextOffset) => {
    setSession({
      session_number: res.data.session_number,
      pic: res.data.pic,
      shift_number: res.data.shift_number,
      status: res.data.status,
      qty: res.data.qty,
      created_at: res.data.created_at,
      finished_at: res.data.finished_at,
    });
    setItems(res.data.items || []);
    setItemsTotal(res.data.items_total ?? res.data.qty ?? 0);
    setOffset(nextOffset);
  }, []);

  const loadSession = useCallback(async (nextOffset = 0, { silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const res = await axios.get(`/api/qr-scan/sessions/${sessionNumber}`, {
        params: { limit: PAGE_SIZE, offset: nextOffset },
      });
      applySessionPayload(res, nextOffset);
    } catch (err) {
      const code = err.response?.data?.code;
      if (err.response?.status === 404 || code === 'SESSION_NOT_FOUND') {
        setError('Sesi tidak ditemukan');
      } else if (!silent) {
        setError(err.response?.data?.error || 'Gagal memuat sesi');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [sessionNumber, applySessionPayload]);

  useEffect(() => {
    loadSession(0);
  }, [loadSession]);

  useEffect(() => {
    if (canScan && scanInputRef.current && !loading) {
      scanInputRef.current.focus();
    }
  }, [canScan, loading]);

  const drainScanQueue = useCallback(async () => {
    if (scanWorkerActiveRef.current || !canScan) return;
    scanWorkerActiveRef.current = true;
    setScanError('');

    try {
      while (scanQueueRef.current.length > 0 && canScan) {
        const raw = scanQueueRef.current.shift();
        const clientScanId = crypto.randomUUID();
        try {
          const res = await axios.post(`/api/qr-scan/sessions/${sessionNumber}/scans`, {
            barcode: raw,
            client_scan_id: clientScanId,
          });
          setScanValue('');
          if (res.data?.idempotent) {
            setScanMessage('Scan sudah tercatat (idempotent)');
          } else {
            setScanMessage(`Tersimpan — total qty ${res.data?.qty ?? ''}`);
          }
          loadSession(0, { silent: true });
        } catch (err) {
          const code = err.response?.data?.code;
          const existing = err.response?.data?.existing_session_number;
          if (code === 'BARCODE_ALREADY_USED') {
            setScanError(
              existing
                ? `Barcode sudah dipakai (sesi #${existing})`
                : 'Barcode sudah terdaftar di sistem Input QR Cartridge'
            );
          } else if (code === 'SESSION_FINISHED') {
            setScanError('Sesi sudah selesai');
            scanQueueRef.current.length = 0;
            loadSession(offset, { silent: true });
            break;
          } else {
            setScanError(err.response?.data?.error || 'Gagal menyimpan scan');
          }
          setScanValue('');
        }
      }
    } finally {
      scanWorkerActiveRef.current = false;
      if (scanQueueRef.current.length > 0 && canScan) {
        drainScanQueue();
      }
      if (scanInputRef.current) {
        scanInputRef.current.focus();
      }
    }
  }, [canScan, loadSession, offset, sessionNumber]);

  const enqueueScan = useCallback(
    (barcodeOverride) => {
      if (!canScan) return;
      const raw = stripScannerLineEndings(
        barcodeOverride !== undefined ? barcodeOverride : scanValue
      );
      if (!raw) return;
      scanQueueRef.current.push(raw);
      drainScanQueue();
    },
    [canScan, scanValue, drainScanQueue]
  );

  const handleScanChange = (e) => {
    const next = e.target.value;
    if (hasScannerLineTerminator(next)) {
      const cleaned = stripScannerLineEndings(next);
      setScanValue('');
      if (cleaned) {
        terminatorSubmitAtRef.current = Date.now();
        enqueueScan(cleaned);
      }
      return;
    }
    setScanValue(next);
  };

  const handleScanKeyDown = (e) => {
    if (!isScannerSubmitKey(e)) return;
    e.preventDefault();
    if (Date.now() - terminatorSubmitAtRef.current < 120) {
      return;
    }
    const cleaned = stripScannerLineEndings(e.currentTarget.value);
    setScanValue('');
    enqueueScan(cleaned);
  };

  const handleFinish = async () => {
    if (!session || isFinished) return;
    const qty = session.qty ?? 0;
    const confirmMsg =
      qty === 0
        ? 'Qty masih 0. Tetap selesaikan sesi ini?'
        : 'Selesaikan sesi? Setelah finished, scan tidak bisa ditambah.';
    if (!window.confirm(confirmMsg)) return;

    setFinishing(true);
    setScanError('');
    try {
      await axios.patch(`/api/qr-scan/sessions/${sessionNumber}/finish`);
      await loadSession(offset);
      setScanMessage('Sesi diselesaikan');
    } catch (err) {
      setScanError(err.response?.data?.error || 'Gagal menyelesaikan sesi');
    } finally {
      setFinishing(false);
    }
  };

  const loadMore = () => {
    const next = offset + PAGE_SIZE;
    if (next >= itemsTotal) return;
    loadSession(next);
  };

  const loadNewer = () => {
    if (offset === 0) return;
    loadSession(Math.max(0, offset - PAGE_SIZE));
  };

  const handleExportExcel = async () => {
    if (!sessionNumber || exporting) return;
    setExporting(true);
    setScanError('');
    try {
      const response = await axios.get(`/api/qr-scan/sessions/${sessionNumber}/export`, {
        responseType: 'blob',
        timeout: 0,
      });
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('application/json')) {
        const text = await response.data.text();
        const parsed = JSON.parse(text);
        setScanError(parsed.error || 'Gagal mengekspor Excel');
        return;
      }
      const disposition = response.headers['content-disposition'] || '';
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] || `qr-scan-sesi-${sessionNumber}.xlsx`;
      const blobUrl = URL.createObjectURL(
        new Blob([response.data], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
      );
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
      setScanMessage('Excel berhasil diunduh');
    } catch (err) {
      setScanError(err.response?.data?.error || 'Gagal mengekspor Excel');
    } finally {
      setExporting(false);
    }
  };

  if (loading && !session) {
    return (
      <div className="qr-scan-detail-page">
        <p className="qr-scan-detail-loading">Memuat sesi…</p>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="qr-scan-detail-page">
        <div className="qr-scan-detail-shell">
          <p className="qr-scan-detail-error">{error}</p>
          <button type="button" className="qr-scan-detail-back" onClick={() => navigate('/input-qr-code')}>
            ← Daftar sesi
          </button>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const rangeStart = itemsTotal === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + items.length, itemsTotal);

  return (
    <div className="qr-scan-detail-page">
      <div className="qr-scan-detail-shell">
        <header className="qr-scan-detail-topbar">
          <div className="qr-scan-detail-topbar__left">
            <button
              type="button"
              className="qr-scan-detail-back"
              onClick={() => navigate('/input-qr-code')}
            >
              ← Daftar sesi
            </button>
            <div className="qr-scan-detail-title-block">
              <h1>Input QR — Sesi #{session.session_number}</h1>
              <p>
                {isFinished
                  ? `Selesai ${formatQrScanDateTime(session.finished_at)}`
                  : `Dimulai ${formatQrScanDateTime(session.created_at)}`}
              </p>
            </div>
          </div>
          <div className="qr-scan-detail-topbar__right">
            <button
              type="button"
              className="qr-scan-detail-export-btn"
              onClick={handleExportExcel}
              disabled={exporting || loading}
            >
              <span className="qr-scan-detail-export-btn__icon" aria-hidden="true">
                ↓
              </span>
              {exporting ? 'Mengekspor…' : 'Export Excel'}
            </button>
            <span
              className={`qr-scan-session-card__badge qr-scan-session-card__badge--${
                isFinished ? 'finished' : 'ongoing'
              }`}
            >
              {isFinished ? 'Finished' : 'Ongoing'}
            </span>
          </div>
        </header>

        <div className="qr-scan-detail-layout">
          <aside className="qr-scan-detail-panel">
            <h2>Ringkasan</h2>
            <dl className="qr-scan-detail-stats">
              <div className="qr-scan-detail-stat">
                <dt>PIC</dt>
                <dd>{session.pic}</dd>
              </div>
              <div className="qr-scan-detail-stat">
                <dt>Shift</dt>
                <dd>{session.shift_number ?? '—'}</dd>
              </div>
              <div className="qr-scan-detail-stat">
                <dt>Qty</dt>
                <dd className="qr-scan-detail-stat__qty">{session.qty ?? 0}</dd>
              </div>
            </dl>

            <h2>Scan</h2>
            {canScan ? (
              <div className="qr-scan-detail-scan">
                <label htmlFor="qr-scan-input">Barcode</label>
                <div className="qr-scan-detail-scan-input-wrap">
                  <span className="qr-scan-detail-scan-icon" aria-hidden="true">📷</span>
                  <input
                    id="qr-scan-input"
                    ref={scanInputRef}
                    type="text"
                    className="qr-scan-detail-scan-input"
                    value={scanValue}
                    onChange={handleScanChange}
                    onKeyDown={handleScanKeyDown}
                    placeholder="Scan atau ketik, lalu Enter"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <p className="qr-scan-detail-scan-hint">Setiap scan = 1 unit. Duplikat ditolak secara global.</p>
              </div>
            ) : (
              <div className="qr-scan-detail-readonly">
                Sesi finished — tidak bisa menambah scan.
              </div>
            )}

            {scanMessage && (
              <div className="qr-scan-detail-alert qr-scan-detail-alert--success" role="status">
                {scanMessage}
              </div>
            )}
            {scanError && (
              <div className="qr-scan-detail-alert qr-scan-detail-alert--error" role="alert">
                {scanError}
              </div>
            )}

            {!isFinished && (
              <div className="qr-scan-detail-actions">
                <button
                  type="button"
                  className="qr-scan-detail-finish-btn"
                  onClick={handleFinish}
                  disabled={finishing}
                >
                  {finishing ? 'Menyelesaikan…' : 'Selesai (Finished)'}
                </button>
              </div>
            )}
          </aside>

          <main className="qr-scan-detail-main">
            <div className="qr-scan-detail-main-header">
              <h2>Daftar barcode</h2>
              <span>{itemsTotal} total</span>
            </div>

            <div className="qr-scan-detail-table-wrap">
              {items.length === 0 ? (
                <p className="qr-scan-detail-empty">
                  {canScan ? 'Belum ada scan. Arahkan scanner ke kolom di kiri.' : 'Tidak ada barcode tercatat.'}
                </p>
              ) : (
                <table className="qr-scan-detail-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Barcode</th>
                      <th>Waktu scan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => {
                      const barcode = typeof item === 'string' ? item : item.barcode;
                      const scannedAt = typeof item === 'object' ? item.scanned_at : null;
                      return (
                      <tr key={`${offset}-${index}-${barcode}`}>
                        <td className="qr-scan-detail-table__index">
                          {itemsTotal - offset - index}
                        </td>
                        <td className="qr-scan-detail-table__barcode">{barcode}</td>
                        <td className="qr-scan-detail-table__time">
                          {formatQrScanDateTime(scannedAt)}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {itemsTotal > PAGE_SIZE && (
              <div className="qr-scan-detail-pagination">
                <div className="qr-scan-detail-pagination__buttons">
                  <button
                    type="button"
                    className="qr-scan-detail-page-btn"
                    onClick={loadNewer}
                    disabled={offset === 0}
                  >
                    ← Lebih baru
                  </button>
                  <button
                    type="button"
                    className="qr-scan-detail-page-btn"
                    onClick={loadMore}
                    disabled={offset + PAGE_SIZE >= itemsTotal}
                  >
                    Lebih lama →
                  </button>
                </div>
                <span className="qr-scan-detail-pagination__info">
                  {rangeStart}–{rangeEnd} dari {itemsTotal}
                </span>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

export default QrScanSessionDetail;
