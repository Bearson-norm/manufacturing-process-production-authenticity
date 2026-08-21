import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../axiosAuth';
import './Dashboard.css';

const ADMIN_MENU_ITEMS = [
  { path: '/admin', icon: '⚙️', label: 'Admin Configuration' },
  { path: '/report-dashboard', icon: '📊', label: 'Laporan Manufacturing' },
  { path: '/production-chart', icon: '📈', label: 'Grafik Statistik Produksi Pabrik' },
  { path: '/wms-explorer', icon: '🔍', label: 'WMS vs Production Explorer' },
  { path: '/wms-accuracy-report', icon: '📋', label: 'Laporan Keakuratan QR WMS' },
  { path: '/wms-production-compare', icon: '⚖️', label: 'Pembanding Qty Production vs WMS' },
  { path: '/external-manufacturing-sender', icon: '📡', label: 'External Manufacturing Sender' },
];

const MO_STATUS_TYPES = [
  { key: 'liquid_15', label: 'Production Liquid 15 ml', icon: '💧', path: '/production/liquid-15ml' },
  { key: 'liquid_30', label: 'Production Liquid 30 ml', icon: '💧', path: '/production/liquid-30ml' },
  { key: 'device', label: 'Production Device', icon: '📱', path: '/production/device' },
  { key: 'cartridge', label: 'Production Cartridge', icon: '🔋', path: '/production/cartridge' },
];

function formatInputTime(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return String(value);
  }
}

function Dashboard({ setIsAuthenticated }) {
  const navigate = useNavigate();
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [moStatus, setMoStatus] = useState({
    liquid_15: null,
    liquid_30: null,
    liquid: null,
    device: null,
    cartridge: null,
  });
  const [moStatusLoading, setMoStatusLoading] = useState(true);
  const [moStatusError, setMoStatusError] = useState('');
  const userRole = localStorage.getItem('userRole') || 'production';
  const isAdmin = userRole === 'admin';

  useEffect(() => {
    let cancelled = false;

    const loadMoStatus = async () => {
      setMoStatusLoading(true);
      setMoStatusError('');
      try {
        const response = await axios.get('/api/production/active-mo-status');
        if (!cancelled) {
          setMoStatus(
            response.data || {
              liquid_15: null,
              liquid_30: null,
              liquid: null,
              device: null,
              cartridge: null,
            }
          );
        }
      } catch (err) {
        if (!cancelled) {
          setMoStatusError(err.response?.data?.error || 'Gagal memuat status MO aktif');
        }
      } finally {
        if (!cancelled) {
          setMoStatusLoading(false);
        }
      }
    };

    loadMoStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userRole');
    setIsAuthenticated(false);
    navigate('/login');
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Manufacturing Process Dashboard</h1>
        <button onClick={handleLogout} className="logout-button">
          Logout
        </button>
      </div>

      <div className={`dashboard-body${isAdmin ? ' dashboard-body--with-nav' : ''}`}>
        {isAdmin && (
          <aside className="dashboard-nav">
            <h2 className="dashboard-nav-title">Menu Lainnya</h2>
            <nav className="dashboard-nav-list">
              {ADMIN_MENU_ITEMS.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  className="dashboard-nav-item"
                  onClick={() => navigate(item.path)}
                >
                  <span className="dashboard-nav-icon" aria-hidden="true">{item.icon}</span>
                  <span className="dashboard-nav-label">{item.label}</span>
                </button>
              ))}
            </nav>
          </aside>
        )}

        <div className="dashboard-content">
          <div className="dashboard-section-header">
            <h2>Select Production Type</h2>
            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              className="help-button"
            >
              <span aria-hidden="true">ℹ️</span>
              Petunjuk Pengisian Authenticity
            </button>
          </div>
          <div className="production-cards">
            <div className="production-card" onClick={() => navigate('/production/liquid-15ml')}>
              <div className="card-icon">💧</div>
              <h3>Production Liquid 15 ml</h3>
              <p>15 ml / slof / bundling</p>
            </div>
            <div className="production-card" onClick={() => navigate('/production/liquid-30ml')}>
              <div className="card-icon">💧</div>
              <h3>Production Liquid 30 ml</h3>
              <p>Liquid selain 15 ml</p>
            </div>
            <div className="production-card" onClick={() => navigate('/production/device')}>
              <div className="card-icon">📱</div>
              <h3>Production Device</h3>
              <p>Manage device production processes</p>
            </div>
            <div className="production-card" onClick={() => navigate('/production/cartridge')}>
              <div className="card-icon">🔋</div>
              <h3>Production Cartridge</h3>
              <p>Manage cartridge production processes</p>
            </div>
          </div>

          <section className="mo-status-section">
            <h2>Status MO Sedang Berjalan</h2>
            {moStatusLoading && (
              <p className="mo-status-message">Memuat status MO…</p>
            )}
            {!moStatusLoading && moStatusError && (
              <p className="mo-status-message mo-status-message--error">{moStatusError}</p>
            )}
            {!moStatusLoading && !moStatusError && (
              <div className="mo-status-grid">
                {MO_STATUS_TYPES.map((type) => {
                  const active = moStatus[type.key];
                  return (
                    <div
                      key={type.key}
                      className={`mo-status-card${active ? ' mo-status-card--active' : ''}`}
                      onClick={() => navigate(type.path)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(type.path);
                        }
                      }}
                    >
                      <div className="mo-status-card-header">
                        <span className="mo-status-icon" aria-hidden="true">{type.icon}</span>
                        <h3>{type.label}</h3>
                      </div>
                      {active ? (
                        <dl className="mo-status-details">
                          <div>
                            <dt>MO</dt>
                            <dd>{active.mo_number || '—'}</dd>
                          </div>
                          <div>
                            <dt>SKU</dt>
                            <dd>{active.sku_name || '—'}</dd>
                          </div>
                          <div>
                            <dt>Leader</dt>
                            <dd>{active.leader_name || '—'}</dd>
                          </div>
                          <div>
                            <dt>Shift</dt>
                            <dd>{active.shift_number || '—'}</dd>
                          </div>
                          <div>
                            <dt>PIC</dt>
                            <dd>{active.pic || '—'}</dd>
                          </div>
                          <div>
                            <dt>Input</dt>
                            <dd>{formatInputTime(active.created_at)}</dd>
                          </div>
                        </dl>
                      ) : (
                        <p className="mo-status-empty">Tidak ada MO aktif</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Help Modal */}
      {showHelpModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '30px',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}>
            <h2 style={{ 
              marginTop: 0, 
              color: '#2c3e50',
              borderBottom: '2px solid #3498db',
              paddingBottom: '10px'
            }}>
              📋 Petunjuk Pengisian Authenticity
            </h2>
            
            <div style={{ 
              padding: '15px', 
              background: '#e8f5e9', 
              borderLeft: '4px solid #4CAF50', 
              borderRadius: '4px',
              marginBottom: '20px'
            }}>
              <p style={{ margin: 0, color: '#2e7d32', fontSize: '14px', fontWeight: 'bold' }}>
                Panduan ini berlaku untuk semua jenis produksi: Liquid, Device, dan Cartridge
              </p>
            </div>

            <div style={{ marginBottom: '25px' }}>
              <h3 style={{ color: '#2980b9', marginBottom: '10px' }}>
                🎯 Langkah-Langkah Pengisian:
              </h3>
              <ol style={{ lineHeight: '1.8', color: '#34495e' }}>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Pilih jenis produksi</strong> yang ingin dikelola (Liquid, Device, atau Cartridge)
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Isi form informasi dasar</strong>:
                  <ul style={{ marginTop: '5px' }}>
                    <li>Nama Leader</li>
                    <li>Shift Number</li>
                    <li>PIC</li>
                    <li>MO Number</li>
                    <li>SKU Name (akan otomatis terisi dari sistem)</li>
                  </ul>
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Input data Authenticity</strong> per roll dengan format:
                  <ul style={{ marginTop: '5px' }}>
                    <li>First Authenticity (awal)</li>
                    <li>Last Authenticity (akhir)</li>
                    <li>Roll Number</li>
                  </ul>
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Klik tombol "Validate"</strong> pada setiap baris untuk memvalidasi data
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Tambah baris baru</strong> jika ada penambahan roll lagi
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Klik "Confirm Input"</strong> setelah semua data tervalidasi
                </li>
              </ol>
            </div>

            <div style={{ 
              padding: '15px', 
              background: '#fff3cd', 
              borderLeft: '4px solid #ffc107', 
              borderRadius: '4px',
              marginBottom: '20px'
            }}>
              <h4 style={{ marginTop: 0, color: '#856404' }}>⚠️ Penting untuk Diperhatikan:</h4>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#856404' }}>
                <li style={{ marginBottom: '5px' }}>
                  Pastikan semua baris sudah di-<strong>validate</strong> sebelum confirm
                </li>
                <li style={{ marginBottom: '5px' }}>
                  Nomor authenticity harus berurutan dan tidak ada yang terlewat
                </li>
                <li style={{ marginBottom: '5px' }}>
                  Periksa kembali data sebelum melakukan confirm
                </li>
                <li style={{ marginBottom: '5px' }}>
                  Data yang sudah dikonfirmasi akan masuk ke sistem dan siap untuk diproses
                </li>
              </ul>
            </div>

            <div style={{ 
              padding: '15px', 
              background: '#e3f2fd', 
              borderLeft: '4px solid #2196F3', 
              borderRadius: '4px',
              marginBottom: '20px'
            }}>
              <h4 style={{ marginTop: 0, color: '#0d47a1' }}>💡 Tips:</h4>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#0d47a1' }}>
                <li style={{ marginBottom: '5px' }}>
                  Gunakan tombol "Add Row" untuk menambah baris data baru
                </li>
                <li style={{ marginBottom: '5px' }}>
                  Tombol "Delete" dapat digunakan untuk menghapus baris yang salah
                </li>
                <li style={{ marginBottom: '5px' }}>
                  Status validasi akan ditampilkan dengan warna (hijau = valid, merah = error)
                </li>
                <li style={{ marginBottom: '5px' }}>
                  Anda dapat melihat history dan laporan di menu "Laporan Manufacturing"
                </li>
              </ul>
            </div>

            <div className="modal-buttons" style={{ marginTop: '20px' }}>
              <button 
                onClick={() => setShowHelpModal(false)} 
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
