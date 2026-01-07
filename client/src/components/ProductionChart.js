import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import './ProductionChart.css';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

function ProductionChart() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState('day'); // day, week, month
  const [productionType, setProductionType] = useState('all');
  const [selectedLeader, setSelectedLeader] = useState('all');
  const [chartType, setChartType] = useState('bar'); // bar, line
  const [metric, setMetric] = useState('input_count'); // input_count, production_qty, net_production
  const [statisticsData, setStatisticsData] = useState([]);
  const [leadersList, setLeadersList] = useState([]);

  useEffect(() => {
    fetchLeaders();
    fetchStatistics();
  }, [period, productionType]);

  const fetchLeaders = async () => {
    try {
      const response = await axios.get('/api/statistics/leaders');
      if (response.data.success) {
        setLeadersList(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching leaders:', error);
    }
  };

  const fetchStatistics = async () => {
    setLoading(true);
    try {
      const params = {
        period,
        productionType: productionType === 'all' ? undefined : productionType
      };

      const response = await axios.get('/api/statistics/production-by-leader', { params });
      if (response.data.success) {
        setStatisticsData(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
      alert('Error mengambil data statistik');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchStatistics();
  };

  // Process data for chart
  const processChartData = () => {
    let filteredData = statisticsData;

    // Filter by selected leader
    if (selectedLeader !== 'all') {
      filteredData = filteredData.filter(d => d.leader_name === selectedLeader);
    }

    // Group by period and leader
    const periodMap = new Map();
    filteredData.forEach(item => {
      const key = item.period;
      if (!periodMap.has(key)) {
        periodMap.set(key, {});
      }
      const periodData = periodMap.get(key);
      
      const leaderKey = `${item.leader_name}_${item.production_type}`;
      if (!periodData[leaderKey]) {
        periodData[leaderKey] = {
          leader_name: item.leader_name,
          production_type: item.production_type,
          input_count: 0,
          production_qty: 0,
          net_production: 0
        };
      }
      periodData[leaderKey].input_count += item.input_count || 0;
      periodData[leaderKey].production_qty += item.production_qty || 0;
      periodData[leaderKey].net_production += item.net_production || 0;
    });

    // Sort periods
    const sortedPeriods = Array.from(periodMap.keys()).sort();

    // Get unique leader-production combinations
    const leaderProductionSet = new Set();
    filteredData.forEach(item => {
      leaderProductionSet.add(`${item.leader_name}_${item.production_type}`);
    });

    // Define colors for production types
    const colorMap = {
      liquid: { bg: 'rgba(59, 130, 246, 0.6)', border: 'rgba(59, 130, 246, 1)' },
      device: { bg: 'rgba(139, 92, 246, 0.6)', border: 'rgba(139, 92, 246, 1)' },
      cartridge: { bg: 'rgba(245, 158, 11, 0.6)', border: 'rgba(245, 158, 11, 1)' }
    };

    // Create datasets for each leader-production combination
    const datasets = [];
    leaderProductionSet.forEach(leaderProd => {
      const [leaderName, prodType] = leaderProd.split('_');
      const data = sortedPeriods.map(period => {
        const periodData = periodMap.get(period);
        return periodData[leaderProd]?.[metric] || 0;
      });

      const colors = colorMap[prodType];
      datasets.push({
        label: `${leaderName} (${prodType})`,
        data: data,
        backgroundColor: colors.bg,
        borderColor: colors.border,
        borderWidth: 2,
        tension: 0.4
      });
    });

    // Format period labels
    const labels = sortedPeriods.map(periodValue => {
      if (period === 'month') {
        const [year, month] = periodValue.split('-');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[parseInt(month) - 1]} ${year}`;
      } else if (period === 'week') {
        return `Week ${periodValue}`;
      }
      return periodValue;
    });

    return {
      labels,
      datasets
    };
  };

  const chartData = processChartData();

  // Get metric label
  const getMetricLabel = () => {
    switch(metric) {
      case 'input_count': return 'Jumlah Input';
      case 'production_qty': return 'Hasil Produksi (Gross)';
      case 'net_production': return 'Hasil Produksi (Net)';
      default: return 'Jumlah';
    }
  };

  const getMetricUnit = () => {
    switch(metric) {
      case 'input_count': return 'input';
      case 'production_qty': return 'pcs';
      case 'net_production': return 'pcs';
      default: return 'unit';
    }
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#e2e8f0',
          font: {
            size: 12
          },
          padding: 15
        }
      },
      title: {
        display: true,
        text: `${getMetricLabel()} - ${period === 'day' ? 'Harian' : period === 'week' ? 'Mingguan' : 'Bulanan'}`,
        color: '#e2e8f0',
        font: {
          size: 18,
          weight: 'bold'
        },
        padding: 20
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: '#e2e8f0',
        bodyColor: '#cbd5e1',
        borderColor: '#334155',
        borderWidth: 1,
        padding: 12,
        displayColors: true,
        callbacks: {
          label: function(context) {
            return `${context.dataset.label}: ${context.parsed.y.toLocaleString()} ${getMetricUnit()}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: '#94a3b8',
          stepSize: metric === 'input_count' ? 1 : undefined,
          callback: function(value) {
            return value.toLocaleString();
          }
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.1)'
        },
        title: {
          display: true,
          text: getMetricLabel(),
          color: '#e2e8f0',
          font: {
            size: 14,
            weight: 'bold'
          }
        }
      },
      x: {
        ticks: {
          color: '#94a3b8',
          maxRotation: 45,
          minRotation: 45
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.1)'
        },
        title: {
          display: true,
          text: 'Periode',
          color: '#e2e8f0',
          font: {
            size: 14,
            weight: 'bold'
          }
        }
      }
    }
  };

  // Calculate summary statistics
  const calculateSummary = () => {
    let filteredData = statisticsData;
    if (selectedLeader !== 'all') {
      filteredData = filteredData.filter(d => d.leader_name === selectedLeader);
    }

    const summary = {
      totalInputs: 0,
      totalSessions: 0,
      totalProduction: 0,
      totalNetProduction: 0,
      totalBuffer: 0,
      totalReject: 0,
      byType: {
        liquid: 0,
        device: 0,
        cartridge: 0
      },
      byTypeProduction: {
        liquid: 0,
        device: 0,
        cartridge: 0
      },
      topLeader: null,
      topLeaderCount: 0
    };

    const leaderCounts = {};

    filteredData.forEach(item => {
      summary.totalInputs += item.input_count || 0;
      summary.totalSessions += item.session_count || 0;
      summary.totalProduction += item.production_qty || 0;
      summary.totalNetProduction += item.net_production || 0;
      summary.totalBuffer += item.buffer_count || 0;
      summary.totalReject += item.reject_count || 0;
      
      summary.byType[item.production_type] += item.input_count || 0;
      summary.byTypeProduction[item.production_type] += item.net_production || 0;

      if (!leaderCounts[item.leader_name]) {
        leaderCounts[item.leader_name] = 0;
      }
      // Count by selected metric for top leader
      leaderCounts[item.leader_name] += item[metric] || 0;
    });

    // Find top leader
    Object.entries(leaderCounts).forEach(([leader, count]) => {
      if (count > summary.topLeaderCount) {
        summary.topLeader = leader;
        summary.topLeaderCount = count;
      }
    });

    return summary;
  };

  const summary = calculateSummary();

  return (
    <div className="chart-container">
      <div className="chart-header">
        <button onClick={() => navigate('/dashboard')} className="back-button">
          ← Kembali ke Dashboard
        </button>
        <h1>📊 Grafik Statistik Produksi</h1>
      </div>

      {/* Filters */}
      <div className="chart-filters">
        <div className="filter-row">
          <div className="filter-group">
            <label>Periode:</label>
            <select value={period} onChange={(e) => setPeriod(e.target.value)} className="filter-select">
              <option value="day">Harian (7 Hari Terakhir)</option>
              <option value="week">Mingguan (8 Minggu Terakhir)</option>
              <option value="month">Bulanan (12 Bulan Terakhir)</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Jenis Produksi:</label>
            <select value={productionType} onChange={(e) => setProductionType(e.target.value)} className="filter-select">
              <option value="all">Semua Jenis</option>
              <option value="liquid">Liquid</option>
              <option value="device">Device</option>
              <option value="cartridge">Cartridge</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Leader:</label>
            <select value={selectedLeader} onChange={(e) => setSelectedLeader(e.target.value)} className="filter-select">
              <option value="all">Semua Leader</option>
              {leadersList.map(leader => (
                <option key={leader} value={leader}>{leader}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Metrik:</label>
            <select value={metric} onChange={(e) => setMetric(e.target.value)} className="filter-select">
              <option value="input_count">Jumlah Input</option>
              <option value="production_qty">Hasil Produksi (Gross)</option>
              <option value="net_production">Hasil Produksi (Net)</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Tipe Chart:</label>
            <select value={chartType} onChange={(e) => setChartType(e.target.value)} className="filter-select">
              <option value="bar">Bar Chart</option>
              <option value="line">Line Chart</option>
            </select>
          </div>

          <button onClick={handleRefresh} className="refresh-button" disabled={loading}>
            {loading ? '⏳ Loading...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card">
          <div className="card-icon">📝</div>
          <div className="card-content">
            <div className="card-value">{summary.totalInputs.toLocaleString()}</div>
            <div className="card-label">Total Input</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="card-icon">🎯</div>
          <div className="card-content">
            <div className="card-value">{summary.totalSessions.toLocaleString()}</div>
            <div className="card-label">Total Sesi</div>
          </div>
        </div>
        <div className="summary-card production">
          <div className="card-icon">📦</div>
          <div className="card-content">
            <div className="card-value">{summary.totalNetProduction.toLocaleString()}</div>
            <div className="card-label">Total Hasil Produksi (Net)</div>
          </div>
        </div>
        <div className="summary-card liquid">
          <div className="card-icon">💧</div>
          <div className="card-content">
            <div className="card-value">{summary.byTypeProduction.liquid.toLocaleString()}</div>
            <div className="card-label">Produksi Liquid (pcs)</div>
          </div>
        </div>
        <div className="summary-card device">
          <div className="card-icon">📱</div>
          <div className="card-content">
            <div className="card-value">{summary.byTypeProduction.device.toLocaleString()}</div>
            <div className="card-label">Produksi Device (pcs)</div>
          </div>
        </div>
        <div className="summary-card cartridge">
          <div className="card-icon">🔋</div>
          <div className="card-content">
            <div className="card-value">{summary.byTypeProduction.cartridge.toLocaleString()}</div>
            <div className="card-label">Produksi Cartridge (pcs)</div>
          </div>
        </div>
        {summary.topLeader && (
          <div className="summary-card top-leader">
            <div className="card-icon">🏆</div>
            <div className="card-content">
              <div className="card-value">{summary.topLeader}</div>
              <div className="card-label">Top Leader ({summary.topLeaderCount.toLocaleString()} {getMetricUnit()})</div>
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="chart-content">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Memuat data statistik...</p>
          </div>
        ) : statisticsData.length === 0 ? (
          <div className="empty-state">
            <p>📊 Tidak ada data statistik untuk periode ini</p>
          </div>
        ) : (
          <div className="chart-wrapper">
            {chartType === 'bar' ? (
              <Bar data={chartData} options={chartOptions} />
            ) : (
              <Line data={chartData} options={chartOptions} />
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="chart-info">
        <p>
          <strong>📌 Catatan:</strong> Grafik menampilkan statistik produksi berdasarkan metrik yang dipilih:
        </p>
        <ul style={{ marginTop: '8px', marginBottom: 0, paddingLeft: '24px', lineHeight: '1.8' }}>
          <li><strong>Jumlah Input:</strong> Berapa kali leader melakukan input manufacturing process</li>
          <li><strong>Hasil Produksi (Gross):</strong> Total produksi berdasarkan authenticity (Last - First)</li>
          <li><strong>Hasil Produksi (Net):</strong> Hasil produksi aktual (Gross - Reject + Buffer)</li>
        </ul>
        <p style={{ marginTop: '8px', marginBottom: 0 }}>
          Setiap jenis produksi (Liquid, Device, Cartridge) ditampilkan dalam warna berbeda untuk memudahkan analisis.
        </p>
      </div>
    </div>
  );
}

export default ProductionChart;

