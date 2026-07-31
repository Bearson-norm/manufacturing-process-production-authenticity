import React, { useState, useEffect, useCallback } from 'react';
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

const PRODUCTION_SECTIONS = [
  {
    type: 'liquid',
    title: 'Liquid',
    icon: '💧',
    color: { bg: 'rgba(59, 130, 246, 0.6)', border: 'rgba(59, 130, 246, 1)' }
  },
  {
    type: 'device',
    title: 'Device',
    icon: '📱',
    color: { bg: 'rgba(139, 92, 246, 0.6)', border: 'rgba(139, 92, 246, 1)' }
  },
  {
    type: 'cartridge',
    title: 'Cartridge',
    icon: '🔋',
    color: { bg: 'rgba(245, 158, 11, 0.6)', border: 'rgba(245, 158, 11, 1)' }
  }
];

const PERIOD_LABELS = {
  week: 'Mingguan',
  four_weeks: 'Per 4 Minggu',
  month: 'Bulanan',
  three_months: 'Per 3 Bulan'
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatPeriodLabel(periodValue, period) {
  if (period === 'month') {
    const [year, month] = String(periodValue).split('-');
    const idx = parseInt(month, 10) - 1;
    if (!Number.isNaN(idx) && MONTH_NAMES[idx]) {
      return `${MONTH_NAMES[idx]} ${year}`;
    }
  }
  if (period === 'three_months') {
    return String(periodValue); // e.g. 2026-Q1
  }
  if (period === 'week' || period === 'four_weeks') {
    return periodValue;
  }
  return periodValue;
}

function getMetricLabel(metric) {
  switch (metric) {
    case 'input_count':
      return 'Jumlah Input';
    case 'production_qty':
      return 'Hasil Produksi (Gross)';
    case 'net_production':
      return 'Hasil Produksi (Net)';
    default:
      return 'Jumlah';
  }
}

function getMetricUnit(metric) {
  switch (metric) {
    case 'input_count':
      return 'input';
    case 'production_qty':
    case 'net_production':
      return 'pcs';
    default:
      return 'unit';
  }
}

function filterByLeader(data, selectedLeader) {
  if (selectedLeader === 'all') return data;
  return data.filter((d) => d.leader_name === selectedLeader);
}

function calculateSummary(typeData, metric) {
  const summary = {
    totalInputs: 0,
    totalSessions: 0,
    totalNetProduction: 0,
    topLeader: null,
    topLeaderCount: 0
  };

  const leaderCounts = {};

  typeData.forEach((item) => {
    summary.totalInputs += item.input_count || 0;
    summary.totalSessions += item.session_count || 0;
    summary.totalNetProduction += item.net_production || 0;

    if (!leaderCounts[item.leader_name]) {
      leaderCounts[item.leader_name] = 0;
    }
    leaderCounts[item.leader_name] += item[metric] || 0;
  });

  Object.entries(leaderCounts).forEach(([leader, count]) => {
    if (count > summary.topLeaderCount) {
      summary.topLeader = leader;
      summary.topLeaderCount = count;
    }
  });

  return summary;
}

function processChartData(typeData, metric, period, sectionColor) {
  const periodMap = new Map();
  const leaderSet = new Set();

  typeData.forEach((item) => {
    const key = item.period;
    if (!periodMap.has(key)) {
      periodMap.set(key, {});
    }
    const periodData = periodMap.get(key);
    const leaderKey = item.leader_name;

    if (!periodData[leaderKey]) {
      periodData[leaderKey] = {
        input_count: 0,
        production_qty: 0,
        net_production: 0
      };
    }
    periodData[leaderKey].input_count += item.input_count || 0;
    periodData[leaderKey].production_qty += item.production_qty || 0;
    periodData[leaderKey].net_production += item.net_production || 0;
    leaderSet.add(leaderKey);
  });

  const sortedPeriods = Array.from(periodMap.keys()).sort();
  const leaders = Array.from(leaderSet).sort();

  // Distinct hues per leader within the section's base color family
  const datasets = leaders.map((leaderName, index) => {
    const data = sortedPeriods.map((periodKey) => {
      return periodMap.get(periodKey)?.[leaderName]?.[metric] || 0;
    });

    const alpha = 0.45 + (index % 5) * 0.08;
    return {
      label: leaderName,
      data,
      backgroundColor: sectionColor.bg.replace(/[\d.]+\)$/, `${alpha})`),
      borderColor: sectionColor.border,
      borderWidth: 2,
      tension: 0.4
    };
  });

  return {
    labels: sortedPeriods.map((p) => formatPeriodLabel(p, period)),
    datasets
  };
}

function buildChartOptions(metric, period, sectionTitle) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#e2e8f0',
          font: { size: 12 },
          padding: 15
        }
      },
      title: {
        display: true,
        text: `${getMetricLabel(metric)} — ${sectionTitle} (${PERIOD_LABELS[period] || period})`,
        color: '#e2e8f0',
        font: { size: 16, weight: 'bold' },
        padding: 16
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
          label(context) {
            return `${context.dataset.label}: ${context.parsed.y.toLocaleString()} ${getMetricUnit(metric)}`;
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
          callback(value) {
            return value.toLocaleString();
          }
        },
        grid: { color: 'rgba(148, 163, 184, 0.1)' },
        title: {
          display: true,
          text: getMetricLabel(metric),
          color: '#e2e8f0',
          font: { size: 13, weight: 'bold' }
        }
      },
      x: {
        ticks: {
          color: '#94a3b8',
          maxRotation: 45,
          minRotation: 45
        },
        grid: { color: 'rgba(148, 163, 184, 0.1)' },
        title: {
          display: true,
          text: 'Periode',
          color: '#e2e8f0',
          font: { size: 13, weight: 'bold' }
        }
      }
    }
  };
}

function TypeSection({
  section,
  typeData,
  loading,
  selectedLeader,
  metric,
  period,
  chartType
}) {
  const filtered = filterByLeader(typeData, selectedLeader);
  const summary = calculateSummary(filtered, metric);
  const chartData = processChartData(filtered, metric, period, section.color);
  const chartOptions = buildChartOptions(metric, period, section.title);

  return (
    <section className={`type-section type-section--${section.type}`}>
      <div className="type-section-header">
        <span className="type-section-icon" aria-hidden="true">
          {section.icon}
        </span>
        <h2>Produksi {section.title}</h2>
      </div>

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
        <div className={`summary-card production ${section.type}`}>
          <div className="card-icon">📦</div>
          <div className="card-content">
            <div className="card-value">{summary.totalNetProduction.toLocaleString()}</div>
            <div className="card-label">Hasil Produksi (Net)</div>
          </div>
        </div>
        {summary.topLeader && (
          <div className="summary-card top-leader">
            <div className="card-icon">🏆</div>
            <div className="card-content">
              <div className="card-value card-value--leader">{summary.topLeader}</div>
              <div className="card-label">
                Top Leader ({summary.topLeaderCount.toLocaleString()} {getMetricUnit(metric)})
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="chart-content">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Memuat data statistik...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <p>Tidak ada data {section.title} untuk periode ini</p>
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
    </section>
  );
}

function ProductionChart() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState('week');
  const [selectedLeader, setSelectedLeader] = useState('all');
  const [chartType, setChartType] = useState('bar');
  const [metric, setMetric] = useState('input_count');
  const [statisticsData, setStatisticsData] = useState([]);
  const [leadersList, setLeadersList] = useState([]);

  const fetchLeaders = useCallback(async () => {
    try {
      const response = await axios.get('/api/statistics/leaders');
      if (response.data.success) {
        setLeadersList(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching leaders:', error);
    }
  }, []);

  const fetchStatistics = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/statistics/production-by-leader', {
        params: { period }
      });
      if (response.data.success) {
        setStatisticsData(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
      alert('Error mengambil data statistik');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchLeaders();
    fetchStatistics();
  }, [fetchLeaders, fetchStatistics]);

  const dataByType = {
    liquid: statisticsData.filter((d) => d.production_type === 'liquid'),
    device: statisticsData.filter((d) => d.production_type === 'device'),
    cartridge: statisticsData.filter((d) => d.production_type === 'cartridge')
  };

  return (
    <div className="chart-container">
      <div className="chart-header">
        <button onClick={() => navigate('/dashboard')} className="back-button">
          ← Kembali ke Dashboard
        </button>
        <h1>Grafik Statistik Produksi</h1>
      </div>

      <div className="chart-filters">
        <div className="filter-row">
          <div className="filter-group">
            <label>Periode:</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="filter-select"
            >
              <option value="week">Mingguan (8 Minggu Terakhir)</option>
              <option value="four_weeks">Per 4 Minggu (6 Periode)</option>
              <option value="month">Bulanan (12 Bulan Terakhir)</option>
              <option value="three_months">Per 3 Bulan (8 Kuartal)</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Leader:</label>
            <select
              value={selectedLeader}
              onChange={(e) => setSelectedLeader(e.target.value)}
              className="filter-select"
            >
              <option value="all">Semua Leader</option>
              {leadersList.map((leader) => (
                <option key={leader} value={leader}>
                  {leader}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Metrik:</label>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              className="filter-select"
            >
              <option value="input_count">Jumlah Input</option>
              <option value="production_qty">Hasil Produksi (Gross)</option>
              <option value="net_production">Hasil Produksi (Net)</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Tipe Chart:</label>
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value)}
              className="filter-select"
            >
              <option value="bar">Bar Chart</option>
              <option value="line">Line Chart</option>
            </select>
          </div>

          <button onClick={fetchStatistics} className="refresh-button" disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {PRODUCTION_SECTIONS.map((section) => (
        <TypeSection
          key={section.type}
          section={section}
          typeData={dataByType[section.type]}
          loading={loading}
          selectedLeader={selectedLeader}
          metric={metric}
          period={period}
          chartType={chartType}
        />
      ))}

      <div className="chart-info">
        <p>
          <strong>Catatan:</strong> Halaman ini menampilkan statistik terpisah per jenis produksi
          (Liquid, Device, Cartridge) dengan filter periode global.
        </p>
        <ul>
          <li>
            <strong>Mingguan:</strong> agregasi per minggu (Senin–Minggu), 8 minggu terakhir
          </li>
          <li>
            <strong>Per 4 Minggu:</strong> agregasi setiap 4 minggu, 6 periode terakhir
          </li>
          <li>
            <strong>Bulanan:</strong> agregasi per bulan kalender, 12 bulan terakhir
          </li>
          <li>
            <strong>Per 3 Bulan:</strong> agregasi per kuartal (Q1–Q4), 8 kuartal terakhir
          </li>
          <li>
            <strong>Jumlah Input:</strong> berapa kali leader melakukan input manufacturing process
          </li>
          <li>
            <strong>Hasil Produksi (Gross):</strong> total dari authenticity (Last − First + 1)
          </li>
          <li>
            <strong>Hasil Produksi (Net):</strong> (Last − First + 1) − Reject + Buffer
          </li>
        </ul>
      </div>
    </div>
  );
}

export default ProductionChart;
