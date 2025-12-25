import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Admin.css';

function Admin() {
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState('');
  const [odooBaseUrl, setOdooBaseUrl] = useState('');
  const [externalApiUrl, setExternalApiUrl] = useState('');
  const [externalApiUrlActive, setExternalApiUrlActive] = useState('');
  const [externalApiUrlCompleted, setExternalApiUrlCompleted] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [moStats, setMoStats] = useState({ total: 0, last7Days: 0, deleted: 0 });
  const [syncStats, setSyncStats] = useState({ synced: 0, total: 0 });

  useEffect(() => {
    fetchConfig();
    fetchMoStats();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await axios.get('/api/admin/config');
      if (response.data.success) {
        setSessionId(response.data.config.sessionId || '');
        setOdooBaseUrl(response.data.config.odooBaseUrl || '');
        setExternalApiUrl(response.data.config.externalApiUrl || 'https://foom-dash.vercel.app/API');
        setExternalApiUrlActive(response.data.config.externalApiUrlActive || response.data.config.externalApiUrl || 'https://foom-dash.vercel.app/API');
        setExternalApiUrlCompleted(response.data.config.externalApiUrlCompleted || response.data.config.externalApiUrl || 'https://foom-dash.vercel.app/API');
      }
    } catch (error) {
      console.error('Error fetching config:', error);
      setMessage({ type: 'error', text: 'Failed to load configuration' });
    }
  };

  const fetchMoStats = async () => {
    try {
      const response = await axios.get('/api/admin/mo-stats');
      if (response.data.success) {
        setMoStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error fetching MO stats:', error);
    }
  };

  const handleSaveConfig = async () => {
    if (!sessionId || sessionId.length < 20) {
      setMessage({ type: 'error', text: 'Session ID must be at least 20 characters' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await axios.put('/api/admin/config', {
        sessionId: sessionId.trim(),
        odooBaseUrl: odooBaseUrl.trim() || 'https://foomx.odoo.com',
        externalApiUrl: externalApiUrl.trim() || 'https://foom-dash.vercel.app/API',
        externalApiUrlActive: externalApiUrlActive.trim() || 'https://foom-dash.vercel.app/API',
        externalApiUrlCompleted: externalApiUrlCompleted.trim() || 'https://foom-dash.vercel.app/API'
      });

      if (response.data.success) {
        setMessage({ type: 'success', text: 'Configuration saved successfully!' });
        // Test the connection
        await testConnection();
      } else {
        setMessage({ type: 'error', text: response.data.error || 'Failed to save configuration' });
      }
    } catch (error) {
      console.error('Error saving config:', error);
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to save configuration' });
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    try {
      const response = await axios.get('/api/admin/test-connection');
      if (response.data.success) {
        setMessage({ type: 'success', text: 'Configuration saved and connection test successful!' });
      } else {
        setMessage({ type: 'warning', text: 'Configuration saved but connection test failed: ' + (response.data.error || 'Unknown error') });
      }
    } catch (error) {
      setMessage({ type: 'warning', text: 'Configuration saved but connection test failed' });
    }
  };

  const handleCleanupMo = async () => {
    if (!window.confirm('Are you sure you want to delete MO data older than 7 days? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await axios.post('/api/admin/cleanup-mo');
      if (response.data.success) {
        setMessage({ type: 'success', text: `Cleanup completed! Deleted ${response.data.deletedCount} MO records older than 7 days.` });
        await fetchMoStats();
      } else {
        setMessage({ type: 'error', text: response.data.error || 'Failed to cleanup MO data' });
      }
    } catch (error) {
      console.error('Error cleaning up MO:', error);
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to cleanup MO data' });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncData = async () => {
    if (!window.confirm('Sync all production data to the unified table? This will copy data from liquid, device, and cartridge tables.')) {
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await axios.post('/api/admin/sync-production-data');
      if (response.data.success) {
        setSyncStats({
          synced: response.data.syncedCount || 0,
          total: response.data.totalCount || 0
        });
        setMessage({ type: 'success', text: `Sync completed! Synced ${response.data.syncedCount} records.` });
      } else {
        setMessage({ type: 'error', text: response.data.error || 'Failed to sync data' });
      }
    } catch (error) {
      console.error('Error syncing data:', error);
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to sync data' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-container">
      <div className="admin-header">
        <button onClick={() => navigate('/dashboard')} className="back-button">
          ← Back to Dashboard
        </button>
        <h1>Admin Configuration</h1>
        <button onClick={() => {
          localStorage.removeItem('isAuthenticated');
          navigate('/login');
        }} className="logout-button">
          Logout
        </button>
      </div>

      <div className="admin-content">
        {message.text && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        {/* Odoo Configuration Section */}
        <div className="admin-section">
          <h2>Odoo API Configuration</h2>
          <div className="form-group">
            <label>Session ID *</label>
            <input
              type="text"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              placeholder="Enter Odoo Session ID (min 20 characters)"
              style={{ width: '100%', padding: '8px', fontSize: '14px' }}
            />
            <small style={{ color: '#94a3b8', fontSize: '12px' }}>
              Session ID from Odoo authentication. Must be at least 20 characters.
            </small>
          </div>
          <div className="form-group">
            <label>Odoo Base URL</label>
            <input
              type="text"
              value={odooBaseUrl}
              onChange={(e) => setOdooBaseUrl(e.target.value)}
              placeholder="https://foomx.odoo.com"
              style={{ width: '100%', padding: '8px', fontSize: '14px' }}
            />
            <small style={{ color: '#94a3b8', fontSize: '12px' }}>
              Default: https://foomx.odoo.com
            </small>
          </div>
          <div className="form-group">
            <label>External API URL (Fallback/General)</label>
            <input
              type="text"
              value={externalApiUrl}
              onChange={(e) => setExternalApiUrl(e.target.value)}
              placeholder="https://foom-dash.vercel.app/API"
              style={{ width: '100%', padding: '8px', fontSize: '14px' }}
            />
            <small style={{ color: '#94a3b8', fontSize: '12px' }}>
              URL fallback untuk API eksternal (digunakan jika URL spesifik tidak dikonfigurasi). Default: https://foom-dash.vercel.app/API
            </small>
          </div>
          <div className="form-group">
            <label>External API URL - Active Status</label>
            <input
              type="text"
              value={externalApiUrlActive}
              onChange={(e) => setExternalApiUrlActive(e.target.value)}
              placeholder="https://foom-dash.vercel.app/API"
              style={{ width: '100%', padding: '8px', fontSize: '14px' }}
            />
            <small style={{ color: '#94a3b8', fontSize: '12px' }}>
              URL untuk mengirim data saat Input Authenticity Label Process (status: active). Default: https://foom-dash.vercel.app/API
            </small>
          </div>
          <div className="form-group">
            <label>External API URL - Completed Status</label>
            <input
              type="text"
              value={externalApiUrlCompleted}
              onChange={(e) => setExternalApiUrlCompleted(e.target.value)}
              placeholder="https://foom-dash.vercel.app/API"
              style={{ width: '100%', padding: '8px', fontSize: '14px' }}
            />
            <small style={{ color: '#94a3b8', fontSize: '12px' }}>
              URL untuk mengirim data saat MO disubmit (status: completed). Default: https://foom-dash.vercel.app/API
            </small>
          </div>
          <button
            onClick={handleSaveConfig}
            disabled={loading}
            className="save-button"
            style={{ padding: '10px 20px', fontSize: '14px', fontWeight: '600' }}
          >
            {loading ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>

        {/* MO Data Management Section */}
        <div className="admin-section">
          <h2>MO Data Management</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Total MO Records</div>
              <div className="stat-value">{moStats.total}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Last 7 Days</div>
              <div className="stat-value">{moStats.last7Days}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Deleted (Older than 7 days)</div>
              <div className="stat-value">{moStats.deleted}</div>
            </div>
          </div>
          <button
            onClick={handleCleanupMo}
            disabled={loading}
            className="cleanup-button"
            style={{ padding: '10px 20px', fontSize: '14px', fontWeight: '600', marginTop: '16px' }}
          >
            {loading ? 'Processing...' : 'Cleanup MO Data (Delete older than 7 days)'}
          </button>
          <small style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginTop: '8px' }}>
            This will query MO numbers from the last 7 days and delete any records older than that.
          </small>
        </div>

        {/* Data Sync Section */}
        <div className="admin-section">
          <h2>Production Data Sync</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Synced Records</div>
              <div className="stat-value">{syncStats.synced}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Records</div>
              <div className="stat-value">{syncStats.total}</div>
            </div>
          </div>
          <button
            onClick={handleSyncData}
            disabled={loading}
            className="sync-button"
            style={{ padding: '10px 20px', fontSize: '14px', fontWeight: '600', marginTop: '16px' }}
          >
            {loading ? 'Syncing...' : 'Sync Production Data'}
          </button>
          <small style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginTop: '8px' }}>
            Sync all data from Production Liquid, Device, and Cartridge tables to the unified production_results table.
          </small>
        </div>

        {/* External API Integration Documentation */}
        <div className="admin-section">
          <h2>External API Integration Documentation</h2>
          <div style={{ 
            background: '#0f172a', 
            padding: '24px', 
            borderRadius: '8px', 
            border: '1px solid #334155',
            marginTop: '16px'
          }}>
            <h3 style={{ marginTop: '0', color: '#60a5fa', fontSize: '18px', fontWeight: '600', marginBottom: '20px' }}>Integrasi API Eksternal untuk Produksi Liquid</h3>
            
            <div style={{ marginTop: '24px', paddingBottom: '24px', borderBottom: '1px solid #334155' }}>
              <h4 style={{ color: '#34d399', marginBottom: '12px', fontSize: '16px', fontWeight: '600' }}>1. Pengiriman Data MO List (Scheduler)</h4>
              <p style={{ marginBottom: '12px', lineHeight: '1.6', color: '#cbd5e1' }}>
                Sistem secara otomatis mengirimkan daftar MO (Manufacturing Order) produksi liquid ke API eksternal setiap 6 jam melalui scheduler.
              </p>
              <p style={{ marginBottom: '8px', lineHeight: '1.6', color: '#cbd5e1' }}>
                <strong style={{ color: '#e2e8f0' }}>Data yang dikirim:</strong>
              </p>
              <ul style={{ marginLeft: '24px', marginBottom: '12px', lineHeight: '1.8', color: '#cbd5e1' }}>
                <li>MO number (string)</li>
                <li>SKU name (string)</li>
                <li>Target qty (integer)</li>
              </ul>
              <p style={{ marginBottom: '10px', lineHeight: '1.6', color: '#cbd5e1' }}>
                <strong style={{ color: '#e2e8f0' }}>Format pengiriman:</strong> Array dengan key <code style={{ background: '#1e293b', padding: '2px 8px', borderRadius: '4px', color: '#60a5fa', border: '1px solid #334155' }}>mo_list</code>
              </p>
              <div style={{ 
                background: '#1e293b', 
                padding: '16px', 
                borderRadius: '6px', 
                border: '1px solid #334155',
                marginTop: '12px',
                fontFamily: 'monospace',
                fontSize: '13px',
                color: '#a5b4fc',
                overflowX: 'auto'
              }}>
                {`{
  "mo_list": [
    {
      "mo": "MO001",
      "sku": "SKU001",
      "target_qty": 100
    }
  ]
}`}
              </div>
            </div>

             <div style={{ marginTop: '24px', paddingBottom: '24px', borderBottom: '1px solid #334155' }}>
               <h4 style={{ color: '#34d399', marginBottom: '12px', fontSize: '16px', fontWeight: '600' }}>2. Pengiriman Data Input Authenticity Label Process</h4>
               <p style={{ marginBottom: '12px', lineHeight: '1.6', color: '#cbd5e1' }}>
                 Setiap kali melakukan Input Authenticity Label Process pada produksi liquid, sistem akan mengirimkan data ke API eksternal dengan status <strong style={{ color: '#34d399' }}>"active"</strong> menggunakan <strong style={{ color: '#60a5fa' }}>External API URL - Active Status</strong>.
               </p>
               <p style={{ marginBottom: '8px', lineHeight: '1.6', color: '#cbd5e1' }}>
                 <strong style={{ color: '#e2e8f0' }}>Format data yang dikirim:</strong>
               </p>
               <div style={{ 
                 background: '#1e293b', 
                 padding: '16px', 
                 borderRadius: '6px', 
                 border: '1px solid #334155',
                 marginTop: '12px',
                 fontFamily: 'monospace',
                 fontSize: '13px',
                 color: '#a5b4fc',
                 overflowX: 'auto'
               }}>
                 {`{
   "status": "active"
 }`}
               </div>
             </div>

             <div style={{ marginTop: '24px', paddingBottom: '24px', borderBottom: '1px solid #334155' }}>
               <h4 style={{ color: '#34d399', marginBottom: '12px', fontSize: '16px', fontWeight: '600' }}>3. Pengiriman Status Completed</h4>
               <p style={{ marginBottom: '12px', lineHeight: '1.6', color: '#cbd5e1' }}>
                 Ketika MO number disubmit (semua input untuk MO tersebut sudah completed), sistem akan mengirimkan data dengan status <strong style={{ color: '#34d399' }}>"completed"</strong> menggunakan <strong style={{ color: '#60a5fa' }}>External API URL - Completed Status</strong>.
               </p>
               <p style={{ marginBottom: '8px', lineHeight: '1.6', color: '#cbd5e1' }}>
                 <strong style={{ color: '#e2e8f0' }}>Format data yang dikirim:</strong>
               </p>
               <div style={{ 
                 background: '#1e293b', 
                 padding: '16px', 
                 borderRadius: '6px', 
                 border: '1px solid #334155',
                 marginTop: '12px',
                 fontFamily: 'monospace',
                 fontSize: '13px',
                 color: '#a5b4fc',
                 overflowX: 'auto'
               }}>
                 {`{
   "status": "completed"
 }`}
               </div>
             </div>

            <div style={{ marginTop: '24px', paddingBottom: '24px', borderBottom: '1px solid #334155' }}>
              <h4 style={{ color: '#34d399', marginBottom: '12px', fontSize: '16px', fontWeight: '600' }}>4. Endpoint untuk Mengecek Status MO</h4>
              <p style={{ marginBottom: '12px', lineHeight: '1.6', color: '#cbd5e1' }}>
                Endpoint ini digunakan untuk mengecek status MO (active atau completed) berdasarkan data yang ada di database.
              </p>
              <p style={{ marginBottom: '8px', lineHeight: '1.6', color: '#cbd5e1' }}>
                <strong style={{ color: '#e2e8f0' }}>Endpoint:</strong>
              </p>
              <div style={{ 
                background: '#1e293b', 
                padding: '16px', 
                borderRadius: '6px', 
                border: '1px solid #334155',
                marginTop: '12px',
                marginBottom: '12px',
                fontFamily: 'monospace',
                fontSize: '13px',
                color: '#a5b4fc',
                overflowX: 'auto'
              }}>
                {`GET /api/external/manufacturing-data/status?mo_number=PROD/MO/28246&completed_at=all`}
              </div>
              <p style={{ marginBottom: '8px', lineHeight: '1.6', color: '#cbd5e1' }}>
                <strong style={{ color: '#e2e8f0' }}>Parameter:</strong>
              </p>
              <ul style={{ marginLeft: '24px', marginBottom: '12px', lineHeight: '1.8', color: '#cbd5e1' }}>
                <li><strong style={{ color: '#e2e8f0' }}>mo_number</strong> (required): Nomor MO yang ingin dicek statusnya</li>
                <li><strong style={{ color: '#e2e8f0' }}>completed_at</strong> (optional): Filter berdasarkan tanggal completed (atau "all" untuk semua)</li>
              </ul>
              <p style={{ marginBottom: '8px', lineHeight: '1.6', color: '#cbd5e1' }}>
                <strong style={{ color: '#e2e8f0' }}>Response jika ada input dengan status "active":</strong>
              </p>
              <div style={{ 
                background: '#1e293b', 
                padding: '16px', 
                borderRadius: '6px', 
                border: '1px solid #334155',
                marginTop: '12px',
                marginBottom: '12px',
                fontFamily: 'monospace',
                fontSize: '13px',
                color: '#a5b4fc',
                overflowX: 'auto'
              }}>
                {`{
  "status": "active"
}`}
              </div>
              <p style={{ marginBottom: '8px', lineHeight: '1.6', color: '#cbd5e1' }}>
                <strong style={{ color: '#e2e8f0' }}>Response jika semua input sudah "completed":</strong>
              </p>
              <div style={{ 
                background: '#1e293b', 
                padding: '16px', 
                borderRadius: '6px', 
                border: '1px solid #334155',
                marginTop: '12px',
                marginBottom: '12px',
                fontFamily: 'monospace',
                fontSize: '13px',
                color: '#a5b4fc',
                overflowX: 'auto'
              }}>
                {`{
  "status": "completed"
}`}
              </div>
              <p style={{ marginBottom: '8px', lineHeight: '1.6', color: '#cbd5e1' }}>
                <strong style={{ color: '#e2e8f0' }}>Response jika MO number tidak ditemukan:</strong>
              </p>
              <div style={{ 
                background: '#1e293b', 
                padding: '16px', 
                borderRadius: '6px', 
                border: '1px solid #334155',
                marginTop: '12px',
                fontFamily: 'monospace',
                fontSize: '13px',
                color: '#f87171',
                overflowX: 'auto'
              }}>
                {`{
  "success": false,
  "error": "MO number not found",
  "status": null
}`}
              </div>
              <p style={{ marginBottom: '8px', marginTop: '12px', lineHeight: '1.6', color: '#cbd5e1' }}>
                <strong style={{ color: '#e2e8f0' }}>Contoh penggunaan dengan curl:</strong>
              </p>
              <div style={{ 
                background: '#1e293b', 
                padding: '16px', 
                borderRadius: '6px', 
                border: '1px solid #334155',
                marginTop: '12px',
                fontFamily: 'monospace',
                fontSize: '13px',
                color: '#a5b4fc',
                overflowX: 'auto'
              }}>
                {`curl.exe -X GET "http://localhost:3000/api/external/manufacturing-data/status?mo_number=PROD/MO/28246&completed_at=all"`}
              </div>
              <p style={{ marginBottom: '0', marginTop: '12px', lineHeight: '1.6', color: '#cbd5e1' }}>
                <strong style={{ color: '#e2e8f0' }}>Logika:</strong> Endpoint ini mengecek semua tabel production (liquid, device, cartridge) untuk menentukan status MO. Jika ada input dengan status "active", maka status MO adalah "active". Jika semua input sudah "completed" (tidak ada yang "active"), maka status MO adalah "completed".
              </p>
            </div>

            <div style={{ marginTop: '24px' }}>
              <h4 style={{ color: '#f87171', marginBottom: '12px', fontSize: '16px', fontWeight: '600' }}>Catatan Penting:</h4>
              <ul style={{ marginLeft: '24px', lineHeight: '1.8', color: '#cbd5e1' }}>
                <li style={{ marginBottom: '8px' }}>Pengiriman data dilakukan secara asinkron (tidak menghambat proses utama)</li>
                <li style={{ marginBottom: '8px' }}>Jika pengiriman gagal, error akan dicatat di log server tetapi tidak akan mengganggu proses produksi</li>
                <li style={{ marginBottom: '8px' }}>URL API eksternal dapat dikonfigurasi di bagian "Odoo API Configuration" di atas dengan 2 URL terpisah:
                  <ul style={{ marginLeft: '20px', marginTop: '8px' }}>
                    <li style={{ marginBottom: '4px' }}><strong style={{ color: '#e2e8f0' }}>External API URL - Active Status:</strong> Untuk pengiriman saat Input Authenticity Label Process</li>
                    <li><strong style={{ color: '#e2e8f0' }}>External API URL - Completed Status:</strong> Untuk pengiriman saat MO disubmit</li>
                  </ul>
                </li>
                <li style={{ marginBottom: '8px' }}>Jika URL spesifik tidak dikonfigurasi, sistem akan menggunakan <strong style={{ color: '#e2e8f0' }}>External API URL (Fallback/General)</strong> sebagai fallback</li>
                <li style={{ marginBottom: '8px' }}>Default URL: <code style={{ background: '#1e293b', padding: '2px 8px', borderRadius: '4px', color: '#60a5fa', border: '1px solid #334155' }}>https://foom-dash.vercel.app/API</code></li>
                <li>Scheduler untuk pengiriman MO list berjalan setiap 6 jam (10 menit setelah update MO data) dan menggunakan URL fallback</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Admin;

