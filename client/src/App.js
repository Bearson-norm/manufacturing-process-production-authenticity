import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ProductionLiquid from './components/ProductionLiquid';
import ProductionDevice from './components/ProductionDevice';
import ProductionCartridge from './components/ProductionCartridge';
import Admin from './components/Admin';
import ReportDashboard from './components/ReportDashboard';
import ProductionChart from './components/ProductionChart';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = React.useState(
    localStorage.getItem('isAuthenticated') === 'true'
  );

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route 
            path="/login" 
            element={
              isAuthenticated ? 
                <Navigate to="/dashboard" /> : 
                <Login setIsAuthenticated={setIsAuthenticated} />
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              isAuthenticated ? 
                <Dashboard setIsAuthenticated={setIsAuthenticated} /> : 
                <Navigate to="/login" />
            } 
          />
          <Route 
            path="/production/liquid" 
            element={
              isAuthenticated ? 
                <ProductionLiquid /> : 
                <Navigate to="/login" />
            } 
          />
          <Route 
            path="/production/device" 
            element={
              isAuthenticated ? 
                <ProductionDevice /> : 
                <Navigate to="/login" />
            } 
          />
          <Route 
            path="/production/cartridge" 
            element={
              isAuthenticated ? 
                <ProductionCartridge /> : 
                <Navigate to="/login" />
            } 
          />
          <Route 
            path="/admin" 
            element={
              isAuthenticated ? 
                <Admin /> : 
                <Navigate to="/login" />
            } 
          />
          <Route 
            path="/report-dashboard" 
            element={
              isAuthenticated ? 
                <ReportDashboard /> : 
                <Navigate to="/login" />
            } 
          />
          <Route 
            path="/production-chart" 
            element={
              isAuthenticated ? 
                <ProductionChart /> : 
                <Navigate to="/login" />
            } 
          />
          <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

