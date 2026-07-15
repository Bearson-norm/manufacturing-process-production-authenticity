import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './ReportDashboard.css';

// Helper function untuk format tanggal dengan zona waktu Indonesia (WIB)
const formatDateIndonesia = (dateString) => {
  if (!dateString) return '';
  
  try {
    let date;
    
    // Jika dateString sudah dalam format ISO dengan timezone, gunakan langsung
    if (dateString.includes('T') && (dateString.includes('Z') || dateString.includes('+') || dateString.includes('-'))) {
      date = new Date(dateString);
    } else {
      // Jika format SQLite (YYYY-MM-DD HH:MM:SS) tanpa timezone
      const sqliteDate = dateString.replace(' ', 'T');
      if (!sqliteDate.includes('Z') && !sqliteDate.includes('+') && !sqliteDate.includes('-', 10)) {
        date = new Date(sqliteDate + 'Z'); // Asumsikan UTC
      } else {
        date = new Date(sqliteDate);
      }
    }
    
    if (isNaN(date.getTime())) {
      return '';
    }
    
    const formatter = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(date);
    const day = parts.find(p => p.type === 'day').value;
    const month = parts.find(p => p.type === 'month').value;
    const year = parts.find(p => p.type === 'year').value;
    const hour = parts.find(p => p.type === 'hour').value;
    const minute = parts.find(p => p.type === 'minute').value;
    const second = parts.find(p => p.type === 'second').value;
    
    return `${day}/${month}/${year}, ${hour}.${minute}.${second}`;
  } catch (error) {
    console.error('Error formatting date:', error, dateString);
    return '';
  }
};

function ReportDashboard() {
  const navigate = useNavigate();
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('all');
  const [dateFilter, setDateFilter] = useState({
    startDate: '',
    endDate: ''
  });
  const [searchMo, setSearchMo] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  // Filter yang terakhir di-apply, dipakai ulang oleh polling
  const appliedParamsRef = useRef({});

  useEffect(() => {
    fetchReportData();

    const pollInterval = setInterval(() => {
      loadReportData(appliedParamsRef.current, { silent: true });
    }, 30000);
    return () => clearInterval(pollInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadReportData = async (params = {}, { silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const response = await axios.get('/api/reports/manufacturing', { params });
      // API returns { success: true, total: ..., data: [...] }
      // Extract the data array from response
      const data = response.data?.data || response.data || [];
      // Ensure it's an array
      setReportData(Array.isArray(data) ? data : []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching report data:', error);
      if (!silent) {
        alert('Error mengambil data laporan');
        setReportData([]); // Set to empty array on error
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const fetchReportData = async () => {
    appliedParamsRef.current = {};
    await loadReportData({});
  };

  const handleApplyFilter = async () => {
    const params = {};
    if (selectedType !== 'all') params.type = selectedType;
    if (dateFilter.startDate) params.startDate = dateFilter.startDate;
    if (dateFilter.endDate) params.endDate = dateFilter.endDate;
    if (searchMo) params.moNumber = searchMo;

    appliedParamsRef.current = params;
    await loadReportData(params);
  };

  const handleResetFilter = () => {
    setSelectedType('all');
    setDateFilter({ startDate: '', endDate: '' });
    setSearchMo('');
    fetchReportData();
  };

  const calculateTotalAuthenticity = (authenticityData) => {
    if (!authenticityData || !Array.isArray(authenticityData)) return 0;
    
    let total = 0;
    authenticityData.forEach(row => {
      if (row.firstAuthenticity && row.lastAuthenticity) {
        const firstMatch = String(row.firstAuthenticity).trim().match(/\d+/);
        const lastMatch = String(row.lastAuthenticity).trim().match(/\d+/);
        if (firstMatch && lastMatch) {
          const first = parseInt(firstMatch[0], 10);
          const last = parseInt(lastMatch[0], 10);
          if (last >= first) {
            total += (last - first + 1);
          }
        }
      }
    });
    return total;
  };

  // Produk Dihasilkan = (Last - First + 1) - Reject + Buffer
  const calculateNetProduction = (authenticityCount, bufferCount, rejectCount) => {
    return authenticityCount - rejectCount + bufferCount;
  };

  const groupByMo = (data) => {
    const grouped = {};
    
    // Ensure data is an array
    if (!Array.isArray(data)) {
      console.warn('groupByMo: data is not an array, returning empty array', data);
      return [];
    }
    
    data.forEach(item => {
      const key = `${item.production_type}::${item.mo_number}`;
      if (!grouped[key]) {
        grouped[key] = {
          mo_number: item.mo_number,
          sku_name: item.sku_name,
          production_type: item.production_type,
          sessions: [],
          buffers: item.buffers || [],
          rejects: item.rejects || [],
          totalAuthenticity: 0,
          totalBuffer: parseInt(item.buffer_count, 10) || 0,
          totalReject: parseInt(item.reject_count, 10) || 0
        };
      }
      
      // Group by session
      let session = grouped[key].sessions.find(s => s.session_id === item.session_id);
      if (!session) {
        session = {
          session_id: item.session_id,
          leader_name: item.leader_name,
          shift_number: item.shift_number,
          created_at: item.created_at,
          inputs: []
        };
        grouped[key].sessions.push(session);
      }
      
      session.inputs.push(item);
      
      // Calculate totals
      const authCount = calculateTotalAuthenticity(item.authenticity_data);
      grouped[key].totalAuthenticity += authCount;
    });
    
    return Object.values(grouped);
  };

  const filteredData = groupByMo(reportData);

  return (
    <div className="report-dashboard-container">
      <div className="report-header">
        <button onClick={() => navigate('/dashboard')} className="back-button">
          ← Kembali ke Dashboard
        </button>
        <div className="header-content">
          <h1>Laporan Hasil Proses Manufacturing</h1>
          <div className="formula-info">
            <p><strong>Rumus Perhitungan:</strong></p>
            <p>Produk Dihasilkan = (Last Authenticity - First Authenticity + 1) - Reject + Buffer</p>
          </div>
          {lastUpdated && (
            <p className="last-updated-info" style={{ fontSize: '0.85rem', opacity: 0.75, marginTop: '4px' }}>
              Terakhir diperbarui {lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </p>
          )}
        </div>
      </div>

      <div className="report-filters">
        <div className="filter-group">
          <label>Tipe Produksi:</label>
          <select 
            value={selectedType} 
            onChange={(e) => setSelectedType(e.target.value)}
            className="filter-select"
          >
            <option value="all">Semua</option>
            <option value="liquid">Liquid</option>
            <option value="device">Device</option>
            <option value="cartridge">Cartridge</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Tanggal Mulai:</label>
          <input
            type="date"
            value={dateFilter.startDate}
            onChange={(e) => setDateFilter({ ...dateFilter, startDate: e.target.value })}
            className="filter-input"
          />
        </div>

        <div className="filter-group">
          <label>Tanggal Selesai:</label>
          <input
            type="date"
            value={dateFilter.endDate}
            onChange={(e) => setDateFilter({ ...dateFilter, endDate: e.target.value })}
            className="filter-input"
          />
        </div>

        <div className="filter-group">
          <label>Cari MO Number:</label>
          <input
            type="text"
            value={searchMo}
            onChange={(e) => setSearchMo(e.target.value)}
            placeholder="Masukkan MO Number"
            className="filter-input"
          />
        </div>

        <div className="filter-buttons">
          <button onClick={handleApplyFilter} className="apply-filter-button">
            Terapkan Filter
          </button>
          <button onClick={handleResetFilter} className="reset-filter-button">
            Reset Filter
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-spinner">Loading...</div>
      ) : (
        <div className="report-content">
          {filteredData.length === 0 ? (
            <div className="no-data">Tidak ada data laporan</div>
          ) : (
            <div className="report-list">
              {filteredData.map((moGroup, idx) => (
                <div key={idx} className="report-card">
                  <div className="report-card-header">
                    <div className="mo-info">
                      <h2>{moGroup.mo_number}</h2>
                      <span className="sku-badge">{moGroup.sku_name}</span>
                      <span className={`type-badge ${moGroup.production_type}`}>
                        {moGroup.production_type}
                      </span>
                    </div>
                    <div className="mo-summary">
                      <div className="summary-item">
                        <span className="summary-label">Total Authenticity:</span>
                        <span className="summary-value authenticity">{moGroup.totalAuthenticity}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">Total Buffer:</span>
                        <span className="summary-value buffer">{moGroup.totalBuffer}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">Total Reject:</span>
                        <span className="summary-value reject">{moGroup.totalReject}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">Produk Dihasilkan:</span>
                        <span className="summary-value net">
                          {calculateNetProduction(moGroup.totalAuthenticity, moGroup.totalBuffer, moGroup.totalReject)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="sessions-container">
                    {moGroup.sessions.map((session, sessionIdx) => (
                      <div key={sessionIdx} className="session-card">
                        <div className="session-header">
                          <div>
                            <strong>Session:</strong> {session.leader_name} - Shift {session.shift_number}
                          </div>
                          <div className="session-date">
                            {formatDateIndonesia(session.created_at)}
                          </div>
                        </div>
                        
                        <div className="session-inputs">
                          {session.inputs.map((input, inputIdx) => {
                            const authCount = calculateTotalAuthenticity(input.authenticity_data);
                            return (
                              <div key={inputIdx} className="input-item">
                                <div className="input-info">
                                  <span><strong>PIC:</strong> {input.pic}</span>
                                  <span><strong>Authenticity:</strong> {authCount}</span>
                                </div>
                                {input.authenticity_data && Array.isArray(input.authenticity_data) && (
                                  <div className="authenticity-details">
                                    {input.authenticity_data.map((auth, authIdx) => (
                                      <div key={authIdx} className="auth-row">
                                        <span>First: {auth.firstAuthenticity}</span>
                                        <span>Last: {auth.lastAuthenticity}</span>
                                        <span>Roll: {auth.rollNumber}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {moGroup.buffers && moGroup.buffers.length > 0 && (
                      <div className="report-buffer-card">
                        <div className="report-buffer-card-header">
                          <strong>Buffer Authenticity</strong>
                          <span className="report-card-count">{moGroup.totalBuffer} item</span>
                        </div>
                        <div className="report-buffer-card-body">
                          {moGroup.buffers.map((buffer) => (
                            <div key={buffer.id} className="report-buffer-item">
                              <div className="report-buffer-info">
                                <span><strong>PIC:</strong> {buffer.pic}</span>
                                <span><strong>SKU:</strong> {buffer.sku_name}</span>
                                {buffer.vendor_name ? (
                                  <span><strong>Vendor:</strong> {buffer.vendor_name}</span>
                                ) : null}
                              </div>
                              <div className="report-buffer-numbers">
                                {(buffer.authenticity_numbers || []).map((num, numIdx) => (
                                  <span key={numIdx} className="report-buffer-number">{num}</span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {moGroup.rejects && moGroup.rejects.length > 0 && (
                      <div className="report-reject-card">
                        <div className="report-reject-card-header">
                          <strong>Reject Authenticity</strong>
                          <span className="report-card-count">{moGroup.totalReject} item</span>
                        </div>
                        <div className="report-reject-card-body">
                          {moGroup.rejects.map((reject) => (
                            <div key={reject.id} className="report-reject-item">
                              <div className="report-reject-info">
                                <span><strong>PIC:</strong> {reject.pic}</span>
                                <span><strong>SKU:</strong> {reject.sku_name}</span>
                                {reject.vendor_name ? (
                                  <span><strong>Vendor:</strong> {reject.vendor_name}</span>
                                ) : null}
                              </div>
                              <div className="report-reject-numbers">
                                {(reject.authenticity_numbers || []).map((num, numIdx) => (
                                  <span key={numIdx} className="report-reject-number">{num}</span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ReportDashboard;

