import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

function Dashboard({ setIsAuthenticated }) {
  const navigate = useNavigate();
  const [showHelpModal, setShowHelpModal] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
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
      <div className="dashboard-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0 }}>Select Production Type</h2>
          <button 
            onClick={() => setShowHelpModal(true)}
            style={{
              padding: '10px 20px',
              background: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span style={{ fontSize: '18px' }}>ℹ️</span>
            Petunjuk Pengisian Authenticity
          </button>
        </div>
        <div className="production-cards">
          <div className="production-card" onClick={() => navigate('/production/liquid')}>
            <div className="card-icon">💧</div>
            <h3>Production Liquid</h3>
            <p>Manage liquid production processes</p>
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

        <h2 style={{ marginTop: '48px' }}>Menu Lainnya</h2>
        <div className="production-cards">
          <div className="production-card" onClick={() => navigate('/admin')}>
            <div className="card-icon">⚙️</div>
            <h3>Admin Configuration</h3>
            <p>Configure Odoo API and manage data</p>
          </div>
          <div className="production-card" onClick={() => navigate('/report-dashboard')}>
            <div className="card-icon">📊</div>
            <h3>Laporan Manufacturing</h3>
            <p>Lihat laporan hasil proses manufacturing berdasarkan MO yang selesai</p>
          </div>
          <div className="production-card" onClick={() => navigate('/production-chart')}>
            <div className="card-icon">📈</div>
            <h3>Grafik Statistik Produksi Pabrik</h3>
            <p>Analisis performa produksi per leader dengan grafik interaktif</p>
          </div>
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

