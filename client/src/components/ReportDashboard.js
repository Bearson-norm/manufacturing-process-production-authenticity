import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/reports/manufacturing');
      setReportData(response.data);
    } catch (error) {
      console.error('Error fetching report data:', error);
      alert('Error mengambil data laporan');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilter = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedType !== 'all') params.type = selectedType;
      if (dateFilter.startDate) params.startDate = dateFilter.startDate;
      if (dateFilter.endDate) params.endDate = dateFilter.endDate;
      if (searchMo) params.moNumber = searchMo;

      const response = await axios.get('/api/reports/manufacturing', { params });
      setReportData(response.data);
    } catch (error) {
      console.error('Error filtering report data:', error);
      alert('Error mengambil data laporan dengan filter');
    } finally {
      setLoading(false);
    }
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
        const first = parseInt(row.firstAuthenticity) || 0;
        const last = parseInt(row.lastAuthenticity) || 0;
        // Calculate difference: last - first
        total += (last - first);
      }
    });
    return total;
  };

  // Calculate net production: (last - first) - rejects + buffers
  const calculateNetProduction = (authenticityCount, bufferCount, rejectCount) => {
    return authenticityCount - rejectCount + bufferCount;
  };

  const groupByMo = (data) => {
    const grouped = {};
    
    data.forEach(item => {
      const key = `${item.mo_number}`;
      if (!grouped[key]) {
        grouped[key] = {
          mo_number: item.mo_number,
          sku_name: item.sku_name,
          production_type: item.production_type,
          sessions: [],
          totalAuthenticity: 0,
          totalBuffer: 0,
          totalReject: 0
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
          inputs: [],
          buffers: [],
          rejects: []
        };
        grouped[key].sessions.push(session);
      }
      
      session.inputs.push(item);
      
      // Calculate totals
      const authCount = calculateTotalAuthenticity(item.authenticity_data);
      grouped[key].totalAuthenticity += authCount;
      
      if (item.buffer_count) {
        grouped[key].totalBuffer += parseInt(item.buffer_count) || 0;
      }
      if (item.reject_count) {
        grouped[key].totalReject += parseInt(item.reject_count) || 0;
      }
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
            <p>Produk Dihasilkan = (Last Authenticity - First Authenticity) - Reject + Buffer</p>
          </div>
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

