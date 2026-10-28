import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../axiosAuth';
import { formatQrScanDateTime } from '../utils/qrScanFormat';
import './Dashboard.css';
import './Production.css';
import './QrScanSessionList.css';

function QrScanSessionList() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [picOptions, setPicOptions] = useState([]);
  const [selectedPic, setSelectedPic] = useState('');
  const [picSearchQuery, setPicSearchQuery] = useState('');
  const [shiftNumber, setShiftNumber] = useState('1');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  const filteredPics = useMemo(() => {
    const q = picSearchQuery.trim().toLowerCase();
    if (!q) return picOptions;
    return picOptions.filter((name) => name.toLowerCase().includes(q));
  }, [picOptions, picSearchQuery]);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get('/api/qr-scan/sessions');
      setSessions(res.data?.sessions || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal memuat daftar sesi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const openCreateModal = async () => {
    setCreateError('');
    setSelectedPic('');
    setShiftNumber('1');
    setPicSearchQuery('');
    setShowModal(true);
    try {
      const res = await axios.get('/api/pic/list');
      const rows = res.data?.data || [];
      setPicOptions(rows.map((r) => r.name).filter(Boolean));
    } catch (err) {
      setCreateError(err.response?.data?.error || 'Gagal memuat daftar PIC');
    }
  };

  const closeModal = () => {
    if (creating) return;
    setShowModal(false);
    setPicSearchQuery('');
  };

  const selectPic = (name) => {
    setSelectedPic(name);
    setPicSearchQuery('');
    setCreateError('');
  };

  const handleCreateSession = async () => {
    if (!selectedPic) {
      setCreateError('Pilih PIC terlebih dahulu');
      return;
    }
    const shift = String(shiftNumber || '').trim();
    if (!shift) {
      setCreateError('Nomor shift wajib diisi');
      return;
    }
    if (!/^[A-Za-z0-9._\-/+]+$/.test(shift)) {
      setCreateError('Nomor shift: huruf, angka, atau . _ - / + saja');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const res = await axios.post('/api/qr-scan/sessions', {
        pic: selectedPic,
        shift_number: shift,
      });
      const sessionNumber = res.data?.session_number;
      setShowModal(false);
      setPicSearchQuery('');
      if (sessionNumber) {
        navigate(`/input-qr-code/${sessionNumber}`);
      } else {
        await loadSessions();
      }
    } catch (err) {
      const code = err.response?.data?.code;
      const msg = err.response?.data?.error || 'Gagal membuat sesi';
      setCreateError(code === 'PIC_NOT_FOUND' ? 'PIC tidak dikenali atau tidak aktif' : msg);
    } finally {
      setCreating(false);
    }
  };

  const handlePicSearchKeyDown = (e) => {
    if (e.key === 'Enter' && filteredPics.length === 1) {
      e.preventDefault();
      selectPic(filteredPics[0]);
    }
  };

  const downloadBlobResponse = async (url, fallbackName) => {
    const response = await axios.get(url, { responseType: 'blob', timeout: 0 });
    const contentType = response.headers['content-type'] || '';
    if (contentType.includes('application/json')) {
      const text = await response.data.text();
      const parsed = JSON.parse(text);
      throw new Error(parsed.error || 'Gagal mengunduh file');
    }
    const disposition = response.headers['content-disposition'] || '';
    const filenameMatch = disposition.match(/filename="([^"]+)"/);
    const filename = filenameMatch?.[1] || fallbackName;
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
  };

  const handleDownloadTemplate = async () => {
    setImportError('');
    try {
      await downloadBlobResponse('/api/qr-scan/import/template', 'qr-scan-import-template.xlsx');
    } catch (err) {
      setImportError(err.message || 'Gagal mengunduh template');
    }
  };

  const handleImportClick = () => {
    if (importing) return;
    setImportError('');
    fileInputRef.current?.click();
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    setImportError('');
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post('/api/qr-scan/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(res.data);
      await loadSessions();
    } catch (err) {
      setImportError(err.response?.data?.error || err.message || 'Import gagal');
    } finally {
      setImporting(false);
    }
  };

  const closeImportResult = () => setImportResult(null);

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Input QR Code — Cartridge</h1>
        <button type="button" className="logout-button" onClick={() => navigate('/dashboard')}>
          Dashboard
        </button>
      </div>

      <div className="dashboard-body">
        <div className="dashboard-content" style={{ width: '100%' }}>
          <div className="dashboard-section-header">
            <h2>Sesi scan</h2>
            <div className="qr-scan-list-actions">
              <button
                type="button"
                className="qr-scan-btn-secondary"
                onClick={handleDownloadTemplate}
                disabled={importing}
              >
                Unduh template
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="qr-scan-file-input"
                onChange={handleImportFile}
                aria-hidden="true"
                tabIndex={-1}
              />
              <button
                type="button"
                className="qr-scan-btn-secondary"
                onClick={handleImportClick}
                disabled={importing}
              >
                {importing ? 'Mengimpor…' : 'Import Excel'}
              </button>
              <button type="button" className="help-button" onClick={openCreateModal}>
                + Tambah sesi
              </button>
            </div>
          </div>

          {importError && (
            <p className="mo-status-message mo-status-message--error">{importError}</p>
          )}

          {loading && <p className="mo-status-message">Memuat sesi…</p>}
          {!loading && error && (
            <p className="mo-status-message mo-status-message--error">{error}</p>
          )}

          {!loading && !error && (
            <div className="qr-scan-sessions-grid">
              {sessions.length === 0 && (
                <p className="mo-status-message">Belum ada sesi. Klik Tambah sesi untuk memulai.</p>
              )}
              {sessions.map((s) => {
                const finished = s.status === 'finished';
                return (
                  <div
                    key={s.session_number}
                    className={`qr-scan-session-card${finished ? ' qr-scan-session-card--finished' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/input-qr-code/${s.session_number}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/input-qr-code/${s.session_number}`);
                      }
                    }}
                  >
                    <div className="qr-scan-session-card__top">
                      <span className="qr-scan-session-card__icon" aria-hidden="true">📷</span>
                      <div className="qr-scan-session-card__title-row">
                        <h3>Sesi #{s.session_number}</h3>
                        <span
                          className={`qr-scan-session-card__badge qr-scan-session-card__badge--${
                            finished ? 'finished' : 'ongoing'
                          }`}
                        >
                          {finished ? 'Finished' : 'Ongoing'}
                        </span>
                      </div>
                    </div>
                    <dl className="qr-scan-session-card__meta">
                      <div>
                        <dt>PIC</dt>
                        <dd>{s.pic}</dd>
                      </div>
                      <div>
                        <dt>Shift</dt>
                        <dd>{s.shift_number ?? '—'}</dd>
                      </div>
                      <div>
                        <dt>Mulai</dt>
                        <dd>{formatQrScanDateTime(s.created_at)}</dd>
                      </div>
                      {finished && (
                        <div>
                          <dt>Selesai</dt>
                          <dd>{formatQrScanDateTime(s.finished_at)}</dd>
                        </div>
                      )}
                      <div>
                        <dt>Qty</dt>
                        <dd className="qr-scan-session-card__qty">{s.qty ?? 0}</dd>
                      </div>
                    </dl>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={closeModal}
        >
          <div
            className="modal-content"
            role="dialog"
            aria-labelledby="qr-scan-create-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="qr-scan-create-title">Tambah sesi baru</h2>
            <p className="qr-scan-modal-intro">
              Cari nama PIC di bawah, lalu klik untuk memilih.
            </p>

            <div className="form-group">
              <label htmlFor="qr-scan-shift">Nomor shift</label>
              <input
                id="qr-scan-shift"
                type="text"
                className="qr-scan-pic-search"
                value={shiftNumber}
                onChange={(e) =>
                  setShiftNumber(e.target.value.replace(/[^A-Za-z0-9._\-/+]/g, ''))
                }
                disabled={creating}
                placeholder="Contoh: 1 atau Shift-A"
              />
            </div>

            <div className="form-group qr-scan-pic-picker">
              <label htmlFor="qr-scan-pic-search">Cari PIC</label>
              <input
                id="qr-scan-pic-search"
                type="search"
                className="qr-scan-pic-search"
                placeholder="Ketik nama PIC…"
                value={picSearchQuery}
                onChange={(e) => setPicSearchQuery(e.target.value)}
                onKeyDown={handlePicSearchKeyDown}
                disabled={creating}
                autoComplete="off"
                autoFocus
              />
              {selectedPic && (
                <p className="qr-scan-pic-selected">Terpilih: {selectedPic}</p>
              )}
              <ul className="qr-scan-pic-list" role="listbox" aria-label="Daftar PIC">
                {filteredPics.length === 0 && (
                  <li className="qr-scan-pic-list__empty">Tidak ada PIC yang cocok.</li>
                )}
                {filteredPics.map((name) => {
                  const isSelected = name === selectedPic;
                  return (
                    <li
                      key={name}
                      role="option"
                      aria-selected={isSelected}
                      className={`qr-scan-pic-option${isSelected ? ' qr-scan-pic-option--selected' : ''}`}
                      onClick={() => selectPic(name)}
                    >
                      {name}
                    </li>
                  );
                })}
              </ul>
            </div>

            {createError && (
              <p className="mo-status-message mo-status-message--error">{createError}</p>
            )}
            <div className="qr-scan-modal-actions">
              <button
                type="button"
                className="qr-scan-btn-secondary"
                onClick={closeModal}
                disabled={creating}
              >
                Batal
              </button>
              <button
                type="button"
                className="help-button"
                onClick={handleCreateSession}
                disabled={creating || !selectedPic}
              >
                {creating ? 'Membuat…' : 'Buat sesi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {importResult && (
        <div className="modal-overlay" role="presentation" onClick={closeImportResult}>
          <div
            className="modal-content qr-scan-import-result"
            role="dialog"
            aria-labelledby="qr-scan-import-result-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="qr-scan-import-result-title">Hasil import Excel</h2>
            <p>
              Sesi #{importResult.session_number} — PIC {importResult.pic}, shift{' '}
              {importResult.shift_number}
            </p>
            <p>
              <strong>{importResult.inserted ?? 0}</strong> barcode tersimpan.
              {(importResult.skipped?.length ?? 0) > 0 && (
                <> {importResult.skipped.length} dilewati.</>
              )}
              {(importResult.errors?.length ?? 0) > 0 && (
                <> {importResult.errors.length} error validasi.</>
              )}
            </p>
            {importResult.skipped?.length > 0 && (
              <ul className="qr-scan-import-list">
                {importResult.skipped.slice(0, 8).map((row) => (
                  <li key={`${row.barcode}-${row.code}`}>
                    {row.barcode}: {row.code}
                  </li>
                ))}
                {importResult.skipped.length > 8 && <li>…dan lainnya</li>}
              </ul>
            )}
            {importResult.errors?.length > 0 && (
              <ul className="qr-scan-import-list qr-scan-import-list--errors">
                {importResult.errors.slice(0, 8).map((row) => (
                  <li key={`${row.row}-${row.code}`}>
                    Baris {row.row}: {row.code}
                  </li>
                ))}
              </ul>
            )}
            <div className="qr-scan-modal-actions">
              <button type="button" className="qr-scan-btn-secondary" onClick={closeImportResult}>
                Tutup
              </button>
              <button
                type="button"
                className="help-button"
                onClick={() => {
                  closeImportResult();
                  navigate(`/input-qr-code/${importResult.session_number}`);
                }}
              >
                Buka sesi #{importResult.session_number}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default QrScanSessionList;
