import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

function Dashboard({ setIsAuthenticated }) {
  const navigate = useNavigate();

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
        <h2>Select Production Type</h2>
        <div className="production-cards">
          <div className="production-card" onClick={() => navigate('/admin')}>
            <div className="card-icon">⚙️</div>
            <h3>Admin Configuration</h3>
            <p>Configure Odoo API and manage data</p>
          </div>
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
      </div>
    </div>
  );
}

export default Dashboard;

