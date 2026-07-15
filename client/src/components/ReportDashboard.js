import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './ReportDashboard.css';

// Helper function untuk format tanggal dengan zona waktu Indonesia (WIB)
const formatDateIndonesia = (dateString) => {
  if (!dateString) return '';

  try {
    let date;

    if (dateString.includes('T') && (dateString.includes('Z') || dateString.includes('+') || dateString.includes('-'))) {
      date = new Date(dateString);
    } else {
      const sqliteDate = dateString.replace(' ', 'T');
      if (!sqliteDate.includes('Z') && !sqliteDate.includes('+') && !sqliteDate.includes('-', 10)) {
        date = new Date(sqliteDate + 'Z');
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

const calculateNetProduction = (authenticityCount, bufferCount, rejectCount) => {
  return authenticityCount - rejectCount + bufferCount;
};

const countAuthenticityNumbers = (rows) => {
  if (!Array.isArray(rows)) return 0;
  let count = 0;
  rows.forEach(row => {
    if (Array.isArray(row.authenticity_numbers)) {
      count += row.authenticity_numbers.filter(
        n => n !== undefined && n !== null && String(n).trim() !== ''
      ).length;
    }
  });
  return count;
};

const collectSessionBufferReject = (inputs, sessionId) => {
  const bufferMap = new Map();
  const rejectMap = new Map();

  inputs.forEach(input => {
    (input.buffers || []).forEach(buffer => {
      if (buffer.session_id === sessionId && !bufferMap.has(buffer.id)) {
        bufferMap.set(buffer.id, buffer);
      }
    });
    (input.rejects || []).forEach(reject => {
      if (reject.session_id === sessionId && !rejectMap.has(reject.id)) {
        rejectMap.set(reject.id, reject);
      }
    });
  });

  return {
    buffers: [...bufferMap.values()],
    rejects: [...rejectMap.values()]
  };
};

const buildSkuBreakdown = (session) => {
  const skuMap = new Map();

  const ensureSku = (skuName) => {
    if (!skuMap.has(skuName)) {
      skuMap.set(skuName, {
        sku_name: skuName,
        authenticity: 0,
        buffer: 0,
        reject: 0,
        netProduction: 0
      });
    }
    return skuMap.get(skuName);
  };

  session.inputs.forEach(input => {
    const sku = ensureSku(input.sku_name || 'Unknown');
    sku.authenticity += calculateTotalAuthenticity(input.authenticity_data);
  });

  session.buffers.forEach(buffer => {
    const sku = ensureSku(buffer.sku_name || 'Unknown');
    if (Array.isArray(buffer.authenticity_numbers)) {
      sku.buffer += buffer.authenticity_numbers.filter(
        n => n !== undefined && n !== null && String(n).trim() !== ''
      ).length;
    }
  });

  session.rejects.forEach(reject => {
    const sku = ensureSku(reject.sku_name || 'Unknown');
    if (Array.isArray(reject.authenticity_numbers)) {
      sku.reject += reject.authenticity_numbers.filter(
        n => n !== undefined && n !== null && String(n).trim() !== ''
      ).length;
    }
  });

  return [...skuMap.values()]
    .map(sku => ({
      ...sku,
      netProduction: calculateNetProduction(sku.authenticity, sku.buffer, sku.reject)
    }))
    .sort((a, b) => a.sku_name.localeCompare(b.sku_name));
};

const groupBySession = (data) => {
  if (!Array.isArray(data)) {
    console.warn('groupBySession: data is not an array, returning empty array', data);
    return [];
  }

  const grouped = {};

  data.forEach(item => {
    const key = `${item.production_type}::${item.session_id}`;
    if (!grouped[key]) {
      grouped[key] = {
        session_id: item.session_id,
        leader_name: item.leader_name,
        shift_number: item.shift_number,
        created_at: item.created_at,
        production_type: item.production_type,
        inputs: []
      };
    }
    grouped[key].inputs.push(item);
  });

  return Object.values(grouped)
    .map(session => {
      const { buffers, rejects } = collectSessionBufferReject(session.inputs, session.session_id);
      const totalAuthenticity = session.inputs.reduce(
        (sum, input) => sum + calculateTotalAuthenticity(input.authenticity_data),
        0
      );
      const totalBuffer = countAuthenticityNumbers(buffers);
      const totalReject = countAuthenticityNumbers(rejects);
      const netProduction = calculateNetProduction(totalAuthenticity, totalBuffer, totalReject);

      const enriched = {
        ...session,
        buffers,
        rejects,
        totalAuthenticity,
        totalBuffer,
        totalReject,
        netProduction
      };

      return {
        ...enriched,
        skuBreakdown: buildSkuBreakdown(enriched)
      };
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
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
      const data = response.data?.data || response.data || [];
      setReportData(Array.isArray(data) ? data : []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching report data:', error);
      if (!silent) {
        alert('Error mengambil data laporan');
        setReportData([]);
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

  const sessionData = groupBySession(reportData);

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
          {sessionData.length === 0 ? (
            <div className="no-data">Tidak ada data laporan</div>
          ) : (
            <div className="report-list">
              {sessionData.map((session) => (
                <div key={`${session.production_type}::${session.session_id}`} className="report-card session-report-card">
                  <div className="report-card-header session-card-header">
                    <div className="session-info">
                      <h2>Session: {session.leader_name} - Shift {session.shift_number}</h2>
                      <span className={`type-badge ${session.production_type}`}>
                        {session.production_type}
                      </span>
                      <span className="session-date-badge">
                        {formatDateIndonesia(session.created_at)}
                      </span>
                    </div>
                    <div className="session-summary">
                      <div className="summary-item">
                        <span className="summary-label">Total Authenticity:</span>
                        <span className="summary-value authenticity">{session.totalAuthenticity}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">Total Buffer:</span>
                        <span className="summary-value buffer">{session.totalBuffer}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">Total Reject:</span>
                        <span className="summary-value reject">{session.totalReject}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">Produk Dihasilkan:</span>
                        <span className="summary-value net">{session.netProduction}</span>
                      </div>
                    </div>
                  </div>

                  {session.skuBreakdown.length > 0 && (
                    <div className="sku-breakdown">
                      <h3 className="sku-breakdown-title">Breakdown per SKU</h3>
                      <div className="sku-breakdown-table-wrapper">
                        <table className="sku-breakdown-table">
                          <thead>
                            <tr>
                              <th>SKU</th>
                              <th>Authenticity</th>
                              <th>Buffer</th>
                              <th>Reject</th>
                              <th>Produk Dihasilkan</th>
                            </tr>
                          </thead>
                          <tbody>
                            {session.skuBreakdown.map((sku) => (
                              <tr key={sku.sku_name} className="sku-breakdown-row">
                                <td className="sku-name-cell">{sku.sku_name}</td>
                                <td className="sku-value authenticity">{sku.authenticity}</td>
                                <td className="sku-value buffer">{sku.buffer}</td>
                                <td className="sku-value reject">{sku.reject}</td>
                                <td className="sku-value net">{sku.netProduction}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="session-body">
                    <h3 className="section-title">Daftar Input</h3>
                    <div className="session-inputs">
                      {session.inputs.map((input, inputIdx) => {
                        const authCount = calculateTotalAuthenticity(input.authenticity_data);
                        return (
                          <div key={input.id || inputIdx} className="input-item">
                            <div className="input-info">
                              <span><strong>MO:</strong> {input.mo_number}</span>
                              <span><strong>SKU:</strong> {input.sku_name}</span>
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

                    {session.buffers.length > 0 && (
                      <div className="report-buffer-card">
                        <div className="report-buffer-card-header">
                          <strong>Buffer Authenticity</strong>
                          <span className="report-card-count">{session.totalBuffer} item</span>
                        </div>
                        <div className="report-buffer-card-body">
                          {session.buffers.map((buffer) => (
                            <div key={buffer.id} className="report-buffer-item">
                              <div className="report-buffer-info">
                                <span><strong>PIC:</strong> {buffer.pic}</span>
                                <span><strong>MO:</strong> {buffer.mo_number}</span>
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

                    {session.rejects.length > 0 && (
                      <div className="report-reject-card">
                        <div className="report-reject-card-header">
                          <strong>Reject Authenticity</strong>
                          <span className="report-card-count">{session.totalReject} item</span>
                        </div>
                        <div className="report-reject-card-body">
                          {session.rejects.map((reject) => (
                            <div key={reject.id} className="report-reject-item">
                              <div className="report-reject-info">
                                <span><strong>PIC:</strong> {reject.pic}</span>
                                <span><strong>MO:</strong> {reject.mo_number}</span>
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
