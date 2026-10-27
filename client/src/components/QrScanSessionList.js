import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../axiosAuth';
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
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

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
    setCreating(true);
    setCreateError('');
    try {
      const res = await axios.post('/api/qr-scan/sessions', { pic: selectedPic });
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
            <button type="button" className="help-button" onClick={openCreateModal}>
              + Tambah sesi
            </button>
          </div>

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
    </div>
  );
}

export default QrScanSessionList;
