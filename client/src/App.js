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
import WmsExplorer from './components/WmsExplorer';
import WmsAccuracyReport from './components/WmsAccuracyReport';
import WmsProductionCompare from './components/WmsProductionCompare';
import ExternalManufacturingSender from './components/ExternalManufacturingSender';
import ProtectedRoute from './components/ProtectedRoute';
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
              <ProtectedRoute>
                <Dashboard setIsAuthenticated={setIsAuthenticated} />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/production/liquid" 
            element={
              <ProtectedRoute>
                <ProductionLiquid />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/production/device" 
            element={
              <ProtectedRoute>
                <ProductionDevice />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/production/cartridge" 
            element={
              <ProtectedRoute>
                <ProductionCartridge />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Admin />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/report-dashboard" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <ReportDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/production-chart" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <ProductionChart />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/wms-explorer" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <WmsExplorer />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/wms-accuracy-report"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <WmsAccuracyReport />
              </ProtectedRoute>
            }
          />
          <Route
            path="/wms-production-compare"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <WmsProductionCompare />
              </ProtectedRoute>
            }
          />
          <Route
            path="/external-manufacturing-sender"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <ExternalManufacturingSender />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

