import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Admin.css';

const INTERVAL_PRESETS = [1, 3, 5, 10, 15, 30];

function formatLastSync(value) {
  if (!value) return 'Belum pernah';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
}

function AdminOdooMoSync() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [moCacheSyncEnabled, setMoCacheSyncEnabled] = useState(true);
  const [intervalMinutes, setIntervalMinutes] = useState(3);
  const [intervalMin, setIntervalMin] = useState(1);
  const [intervalMax, setIntervalMax] = useState(60);
  const [moStats, setMoStats] = useState({
    total: 0,
    recent_24h: 0,
    older_than_7_days: 0,
    last_sync: null,
  });

  const loadSettings = async () => {
    const response = await axios.get('/api/admin/config');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Gagal memuat konfigurasi');
    }
    const cfg = response.data.config || {};
    setMoCacheSyncEnabled(cfg.moCacheSyncEnabled !== false);
    setIntervalMinutes(cfg.moCacheSyncIntervalMinutes ?? 3);
    if (cfg.moCacheSyncIntervalMin != null) setIntervalMin(cfg.moCacheSyncIntervalMin);
    if (cfg.moCacheSyncIntervalMax != null) setIntervalMax(cfg.moCacheSyncIntervalMax);
  };

  const fetchMoStats = async () => {
    const response = await axios.get('/api/admin/mo-stats');
    if (response.data.success) {
      const stats = response.data.stats || {};
      setMoStats({
        total: stats.total || 0,
        recent_24h: stats.recent_24h || 0,
        older_than_7_days: stats.older_than_7_days || 0,
        last_sync: stats.last_sync || null,
      });
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setMessage({ type: '', text: '' });
      try {
        await Promise.all([loadSettings(), fetchMoStats()]);
      } catch (error) {
        if (!cancelled) {
          console.error('Error loading Odoo MO sync settings:', error);
          setMessage({
            type: 'error',
            text: error.response?.data?.error || error.message || 'Gagal memuat halaman',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const clampInterval = (value) => {
    const n = parseInt(String(value), 10);
    if (!Number.isFinite(n)) return intervalMin;
    return Math.min(intervalMax, Math.max(intervalMin, n));
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    const minutes = clampInterval(intervalMinutes);
    setIntervalMinutes(minutes);
    try {
      const response = await axios.put('/api/admin/mo-cache-sync', {
        enabled: moCacheSyncEnabled,
        intervalMinutes: minutes,
      });
      if (response.data.success) {
        setMoCacheSyncEnabled(response.data.enabled !== false);
        setIntervalMinutes(response.data.intervalMinutes ?? minutes);
        setMessage({
          type: 'success',
          text: `Pengaturan disimpan. Pull otomatis: ${
            response.data.enabled !== false ? 'aktif' : 'nonaktif'
          }, interval ${response.data.intervalMinutes ?? minutes} menit (worker membaca ulang setelah siklus berikutnya).`,
        });
      } else {
        setMessage({ type: 'error', text: response.data.error || 'Gagal menyimpan' });
      }
    } catch (error) {
      console.error('Error saving mo cache sync:', error);
      setMessage({ type: 'error', text: error.response?.data?.error || 'Gagal menyimpan pengaturan' });
    } finally {
      setSaving(false);
    }
  };

  const handleSyncMoFromOdoo = async () => {
    if (!window.confirm('Tarik data MO dari Odoo sekarang dan tulis ulang ke cache?')) {
      return;
    }
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await axios.post('/api/admin/sync-mo');
      if (response.data.success) {
        setMessage({
          type: 'success',
          text: `Sync MO selesai. ${response.data.totalUpdated || 0} record di-update.`,
        });
        await fetchMoStats();
      } else {
        setMessage({ type: 'error', text: response.data.error || 'Gagal sync MO dari Odoo' });
      }
    } catch (error) {
      console.error('Error syncing MO from Odoo:', error);
      setMessage({ type: 'error', text: error.response?.data?.error || 'Gagal sync MO dari Odoo' });
    } finally {
      setLoading(false);
    }
  };

  const handleCleanupMo = async () => {
    if (
      !window.confirm(
        'Hapus data MO cache lebih dari 7 hari? Tindakan ini tidak dapat dibatalkan.'
      )
    ) {
      return;
    }
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await axios.post('/api/admin/cleanup-mo');
      if (response.data.success) {
        setMessage({
          type: 'success',
          text: `Cleanup selesai. ${response.data.deletedCount} record dihapus.`,
        });
        await fetchMoStats();
      } else {
        setMessage({ type: 'error', text: response.data.error || 'Gagal cleanup' });
      }
    } catch (error) {
      console.error('Error cleaning up MO:', error);
      setMessage({ type: 'error', text: error.response?.data?.error || 'Gagal cleanup' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-container">
      <div className="admin-header">
        <button type="button" className="back-button" onClick={() => navigate('/dashboard')}>
          ← Kembali ke Dashboard
        </button>
        <h1>Sinkronisasi MO Odoo</h1>
      </div>
      <p style={{ color: '#94a3b8', margin: '0 0 20px', maxWidth: '720px' }}>
        Atur penarikan otomatis MO dari Odoo ke cache lokal (odoo_mo_cache) pada worker PM2.
      </p>

      {message.text && (
        <div className={`message ${message.type === 'error' ? 'error' : 'success'}`}>{message.text}</div>
      )}

      <div className="admin-section">
        <h2>Penarikan otomatis</h2>
        <div className="mo-cache-toggle-row">
          <div>
            <label className="mo-cache-toggle" htmlFor="odoo-mo-sync-enabled">
              <input
                id="odoo-mo-sync-enabled"
                type="checkbox"
                checked={moCacheSyncEnabled}
                onChange={(e) => setMoCacheSyncEnabled(e.target.checked)}
                disabled={loading || saving}
              />
              <span className="mo-cache-toggle-slider" aria-hidden="true" />
              <span className="mo-cache-toggle-text">Tarik data MO dari Odoo (otomatis)</span>
            </label>
            <p className="mo-cache-toggle-status">
              Status: <strong>{moCacheSyncEnabled ? 'Aktif' : 'Nonaktif'}</strong>
              {' · '}
              Interval: <strong>{intervalMinutes} menit</strong>
              {' · '}
              Last sync: {formatLastSync(moStats.last_sync)}
            </p>
            <small className="mo-cache-toggle-help">
              Worker dengan ENABLE_SCHEDULER=true menjalankan pull setelah interval di atas (default 3 menit).
              Nonaktif hanya menghentikan pull; cache lama tetap dipakai dropdown produksi. Sync manual tetap
              tersedia. Ubah interval diterapkan worker setelah siklus scheduler berikutnya selesai.
            </small>
          </div>
        </div>

        <div className="form-group" style={{ marginTop: '20px', maxWidth: '320px' }}>
          <label htmlFor="odoo-mo-sync-interval">Interval pull (menit)</label>
          <input
            id="odoo-mo-sync-interval"
            type="number"
            min={intervalMin}
            max={intervalMax}
            value={intervalMinutes}
            onChange={(e) => setIntervalMinutes(clampInterval(e.target.value))}
            disabled={loading || saving}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
            {INTERVAL_PRESETS.filter((m) => m >= intervalMin && m <= intervalMax).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setIntervalMinutes(preset)}
                disabled={loading || saving}
                style={{
                  padding: '6px 12px',
                  fontSize: '13px',
                  borderRadius: '4px',
                  border: preset === intervalMinutes ? '2px solid #3b82f6' : '1px solid #475569',
                  background: preset === intervalMinutes ? '#1e3a5f' : '#1e293b',
                  color: '#e2e8f0',
                  cursor: loading || saving ? 'not-allowed' : 'pointer',
                }}
              >
                {preset} m
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveSettings}
          disabled={loading || saving}
          className="save-button"
          style={{ padding: '10px 20px', fontSize: '14px', fontWeight: '600', marginTop: '16px' }}
        >
          {saving ? 'Menyimpan...' : 'Simpan pengaturan sinkronisasi'}
        </button>
      </div>

      <div className="admin-section">
        <h2>Cache &amp; aksi manual</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total MO di cache</div>
            <div className="stat-value">{moStats.total}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Di-update 24 jam terakhir</div>
            <div className="stat-value">{moStats.recent_24h}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Lebih dari 7 hari</div>
            <div className="stat-value">{moStats.older_than_7_days}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSyncMoFromOdoo}
          disabled={loading || saving}
          className="sync-button"
          style={{ marginTop: '16px' }}
        >
          {loading ? 'Syncing...' : 'Sync MO dari Odoo sekarang'}
        </button>
        <button
          type="button"
          onClick={handleCleanupMo}
          disabled={loading || saving}
          className="cleanup-button"
          style={{ padding: '10px 20px', fontSize: '14px', fontWeight: '600', marginTop: '12px' }}
        >
          {loading ? 'Processing...' : 'Cleanup cache MO (&gt; 7 hari)'}
        </button>
      </div>
    </div>
  );
}

export default AdminOdooMoSync;
