import React from 'react';
import { Navigate } from 'react-router-dom';

function ProtectedRoute({ children, allowedRoles = [] }) {
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
  const userRole = localStorage.getItem('userRole') || 'production';

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  // If allowedRoles is empty, allow all authenticated users
  if (allowedRoles.length === 0) {
    return children;
  }

  // Check if user role is in allowed roles
  if (allowedRoles.includes(userRole)) {
    return children;
  }

  // If role not allowed, redirect to dashboard
  return <Navigate to="/dashboard" />;
}

export default ProtectedRoute;
