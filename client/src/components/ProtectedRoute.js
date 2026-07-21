import React from 'react';
import { Navigate } from 'react-router-dom';

function ProtectedRoute({ children, allowedRoles = [] }) {
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
  const hasToken = !!localStorage.getItem('authToken');
  const userRole = localStorage.getItem('userRole') || 'production';

  if (!isAuthenticated || !hasToken) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length === 0) {
    return children;
  }

  if (allowedRoles.includes(userRole)) {
    return children;
  }

  return <Navigate to="/dashboard" replace />;
}

export default ProtectedRoute;
