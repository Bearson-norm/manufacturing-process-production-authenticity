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
  const [apiKey, setApiKey] = useState('');
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [generatedApiKey, setGeneratedApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [moStats, setMoStats] = useState({ total: 0, last7Days: 0, deleted: 0 });
  const [syncStats, setSyncStats] = useState({ synced: 0, total: 0 });
  const [picList, setPicList] = useState([]);
  const [newPicName, setNewPicName] = useState('');
  const [editingPic, setEditingPic] = useState(null);
  const [picMessage, setPicMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchConfig();
    fetchMoStats();
    fetchPicList();
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
        setApiKey(response.data.config.apiKey || '');
        setApiKeyConfigured(response.data.config.apiKeyConfigured || false);
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

  const fetchPicList = async () => {
    try {
      const response = await axios.get('/api/pic/all');
      if (response.data.success) {
        setPicList(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching PIC list:', error);
    }
  };

  const handleAddPic = async () => {
    if (!newPicName.trim()) {
      setPicMessage({ type: 'error', text: 'Nama PIC tidak boleh kosong' });
      return;
    }

    try {
      const response = await axios.post('/api/pic/add', { name: newPicName.trim() });
      if (response.data.success) {
        setPicMessage({ type: 'success', text: 'PIC berhasil ditambahkan' });
        setNewPicName('');
        fetchPicList();
      } else {
        setPicMessage({ type: 'error', text: response.data.error || 'Gagal menambahkan PIC' });
      }
    } catch (error) {
      setPicMessage({ type: 'error', text: error.response?.data?.error || 'Gagal menambahkan PIC' });
    }
  };

  const handleUpdatePic = async (id, name, is_active) => {
    try {
      const response = await axios.put(`/api/pic/update/${id}`, { name, is_active });
      if (response.data.success) {
        setPicMessage({ type: 'success', text: 'PIC berhasil diupdate' });
        setEditingPic(null);
        fetchPicList();
      } else {
        setPicMessage({ type: 'error', text: response.data.error || 'Gagal mengupdate PIC' });
      }
    } catch (error) {
      setPicMessage({ type: 'error', text: error.response?.data?.error || 'Gagal mengupdate PIC' });
    }
  };

  const handleDeletePic = async (id) => {
    if (!window.confirm('Apakah Anda yakin ingin menonaktifkan PIC ini?')) {
      return;
    }

    try {
      const response = await axios.delete(`/api/pic/delete/${id}`);
      if (response.data.success) {
        setPicMessage({ type: 'success', text: 'PIC berhasil dinonaktifkan' });
        fetchPicList();
      } else {
        setPicMessage({ type: 'error', text: response.data.error || 'Gagal menonaktifkan PIC' });
      }
    } catch (error) {
      setPicMessage({ type: 'error', text: error.response?.data?.error || 'Gagal menonaktifkan PIC' });
    }
  };

  const handleTogglePicStatus = async (id, currentStatus) => {
    const pic = picList.find(p => p.id === id);
    if (!pic) return;
    
    const newStatus = currentStatus === 1 ? 0 : 1;
    await handleUpdatePic(id, pic.name, newStatus);
  };

  const handleGenerateApiKey = async () => {
    if (!window.confirm('Generate new API key? This will replace the existing API key if one exists. Make sure to save the new key securely!')) {
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await axios.post('/api/admin/generate-api-key');
      if (response.data.success) {
        setGeneratedApiKey(response.data.apiKey);
        setShowApiKey(true);
        setApiKeyConfigured(true);
        setMessage({ type: 'success', text: 'API key generated successfully! Please save it securely - it will not be shown again.' });
        // Refresh config to get masked key
        fetchConfig();
      } else {
        setMessage({ type: 'error', text: response.data.error || 'Failed to generate API key' });
      }
    } catch (error) {
      console.error('Error generating API key:', error);
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to generate API key' });
    } finally {
      setLoading(false);
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
        externalApiUrlCompleted: externalApiUrlCompleted.trim() || 'https://foom-dash.vercel.app/API',
        apiKey: apiKey.trim() || undefined
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
          
          {/* API Key Configuration */}
          <div className="form-group" style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #334155' }}>
            <label style={{ fontSize: '16px', fontWeight: '600', color: '#e2e8f0', marginBottom: '12px' }}>
              API Key Authentication
            </label>
            <div style={{ 
              background: '#1e293b', 
              padding: '16px', 
              borderRadius: '6px', 
              border: '1px solid #334155',
              marginBottom: '12px'
            }}>
              {apiKeyConfigured ? (
                <div>
                  <p style={{ color: '#94a3b8', marginBottom: '12px', fontSize: '14px' }}>
                    ✅ API Key sudah dikonfigurasi
                  </p>
                  <div style={{ 
                    background: '#0f172a', 
                    padding: '12px', 
                    borderRadius: '4px', 
                    border: '1px solid #334155',
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    color: '#60a5fa',
                    wordBreak: 'break-all',
                    marginBottom: '12px'
                  }}>
                    {apiKey || 'Not configured'}
                  </div>
                  <small style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '12px' }}>
                    API key ini digunakan untuk autentikasi pada endpoint external API. 
                    Gunakan header <code style={{ background: '#0f172a', padding: '2px 6px', borderRadius: '3px', color: '#60a5fa' }}>X-API-Key</code> saat memanggil API.
                  </small>
                </div>
              ) : (
                <div>
                  <p style={{ color: '#fbbf24', marginBottom: '12px', fontSize: '14px' }}>
                    ⚠️ API Key belum dikonfigurasi. External API endpoints saat ini dapat diakses tanpa autentikasi.
                  </p>
                  <small style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '12px' }}>
                    Generate API key untuk mengamankan endpoint external API. Setelah di-generate, semua request ke external API harus menyertakan API key.
                  </small>
                </div>
              )}
              
              {showApiKey && generatedApiKey && (
                <div style={{ 
                  background: '#065f46', 
                  padding: '16px', 
                  borderRadius: '6px', 
                  border: '2px solid #10b981',
                  marginBottom: '12px'
                }}>
                  <p style={{ color: '#10b981', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>
                    ⚠️ IMPORTANT: Save this API key now!
                  </p>
                  <div style={{ 
                    background: '#0f172a', 
                    padding: '12px', 
                    borderRadius: '4px', 
                    border: '1px solid #10b981',
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    color: '#34d399',
                    wordBreak: 'break-all',
                    marginBottom: '12px',
                    fontWeight: '600'
                  }}>
                    {generatedApiKey}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedApiKey);
                      setMessage({ type: 'success', text: 'API key copied to clipboard!' });
                    }}
                    style={{ 
                      padding: '8px 16px', 
                      fontSize: '13px', 
                      fontWeight: '600',
                      background: '#10b981',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      marginRight: '8px'
                    }}
                  >
                    Copy to Clipboard
                  </button>
                  <button
                    onClick={() => {
                      setShowApiKey(false);
                      setGeneratedApiKey('');
                    }}
                    style={{ 
                      padding: '8px 16px', 
                      fontSize: '13px', 
                      fontWeight: '600',
                      background: '#334155',
                      color: '#e2e8f0',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Hide
                  </button>
                </div>
              )}
              
              <button
                onClick={handleGenerateApiKey}
                disabled={loading}
                style={{ 
                  padding: '10px 20px', 
                  fontSize: '14px', 
                  fontWeight: '600',
                  background: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1
                }}
              >
                {loading ? 'Generating...' : apiKeyConfigured ? 'Regenerate API Key' : 'Generate API Key'}
              </button>
            </div>
          </div>
          
          <button
            onClick={handleSaveConfig}
            disabled={loading}
            className="save-button"
            style={{ padding: '10px 20px', fontSize: '14px', fontWeight: '600', marginTop: '16px' }}
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

        {/* PIC Management Section */}
        <div className="config-section" style={{ marginTop: '24px' }}>
          <h2>📋 PIC (Person in Charge) Management</h2>
          <p className="section-description">
            Kelola daftar PIC yang dapat dipilih pada form Input Authenticity. PIC yang aktif akan muncul di dropdown.
          </p>

          {picMessage.text && (
            <div className={`message ${picMessage.type}`} style={{ marginBottom: '16px' }}>
              {picMessage.text}
            </div>
          )}

          {/* Add New PIC */}
          <div className="pic-add-section" style={{ marginBottom: '24px', padding: '16px', background: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
            <h3 style={{ color: '#e2e8f0', fontSize: '16px', marginBottom: '12px' }}>Tambah PIC Baru</h3>
            <div style={{ display: 'flex', gap: '12px' }}>
              <input
                type="text"
                value={newPicName}
                onChange={(e) => setNewPicName(e.target.value)}
                placeholder="Masukkan nama PIC"
                onKeyPress={(e) => e.key === 'Enter' && handleAddPic()}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  background: '#0f172a',
                  border: '1px solid #374151',
                  borderRadius: '6px',
                  color: '#e2e8f0',
                  fontSize: '14px'
                }}
              />
              <button 
                onClick={handleAddPic}
                style={{
                  padding: '10px 24px',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Tambah
              </button>
            </div>
          </div>

          {/* PIC List */}
          <div className="pic-list-section">
            <h3 style={{ color: '#e2e8f0', fontSize: '16px', marginBottom: '12px' }}>Daftar PIC ({picList.length})</h3>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {picList.length === 0 ? (
                <p style={{ color: '#94a3b8', textAlign: 'center', padding: '24px' }}>Tidak ada PIC</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#1e293b', zIndex: 1 }}>
                    <tr style={{ borderBottom: '2px solid #334155' }}>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#e2e8f0', fontWeight: '600', fontSize: '14px' }}>No</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#e2e8f0', fontWeight: '600', fontSize: '14px' }}>Nama PIC</th>
                      <th style={{ padding: '12px', textAlign: 'center', color: '#e2e8f0', fontWeight: '600', fontSize: '14px' }}>Status</th>
                      <th style={{ padding: '12px', textAlign: 'center', color: '#e2e8f0', fontWeight: '600', fontSize: '14px' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {picList.map((pic, index) => (
                      <tr key={pic.id} style={{ borderBottom: '1px solid #334155' }}>
                        <td style={{ padding: '12px', color: '#cbd5e1', fontSize: '14px' }}>{index + 1}</td>
                        <td style={{ padding: '12px', color: '#e2e8f0', fontSize: '14px' }}>
                          {editingPic === pic.id ? (
                            <input
                              type="text"
                              defaultValue={pic.name}
                              onBlur={(e) => {
                                if (e.target.value.trim() && e.target.value !== pic.name) {
                                  handleUpdatePic(pic.id, e.target.value.trim(), pic.is_active);
                                } else {
                                  setEditingPic(null);
                                }
                              }}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  if (e.target.value.trim() && e.target.value !== pic.name) {
                                    handleUpdatePic(pic.id, e.target.value.trim(), pic.is_active);
                                  } else {
                                    setEditingPic(null);
                                  }
                                }
                              }}
                              autoFocus
                              style={{
                                padding: '6px 10px',
                                background: '#0f172a',
                                border: '1px solid #3b82f6',
                                borderRadius: '4px',
                                color: '#e2e8f0',
                                fontSize: '14px',
                                width: '100%'
                              }}
                            />
                          ) : (
                            pic.name
                          )}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '600',
                            background: pic.is_active === 1 ? '#10b98180' : '#6b728080',
                            color: pic.is_active === 1 ? '#10b981' : '#9ca3af',
                            border: `1px solid ${pic.is_active === 1 ? '#10b981' : '#6b7280'}`
                          }}>
                            {pic.is_active === 1 ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            {editingPic !== pic.id && (
                              <button
                                onClick={() => setEditingPic(pic.id)}
                                style={{
                                  padding: '6px 12px',
                                  background: '#3b82f6',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  cursor: 'pointer'
                                }}
                              >
                                Edit
                              </button>
                            )}
                            <button
                              onClick={() => handleTogglePicStatus(pic.id, pic.is_active)}
                              style={{
                                padding: '6px 12px',
                                background: pic.is_active === 1 ? '#ef4444' : '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '12px',
                                cursor: 'pointer'
                              }}
                            >
                              {pic.is_active === 1 ? 'Nonaktifkan' : 'Aktifkan'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div style={{ marginTop: '16px', padding: '12px', background: '#1e293b', borderRadius: '6px', border: '1px solid #334155' }}>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, lineHeight: '1.6' }}>
              <strong style={{ color: '#e2e8f0' }}>📌 Catatan:</strong> PIC yang dinonaktifkan tidak akan muncul di dropdown form Input Authenticity, tetapi data lama yang sudah menggunakan PIC tersebut tetap akan tersimpan.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Admin;

