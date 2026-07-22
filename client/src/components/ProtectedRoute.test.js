import React from 'react';
import { Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';

describe('ProtectedRoute', () => {
  it('is a function component', () => {
    expect(typeof ProtectedRoute).toBe('function');
  });

  it('redirects when unauthenticated', () => {
    window.localStorage.clear();
    const element = ProtectedRoute({ children: <div>secret</div>, allowedRoles: [] });
    expect(element.type).toBe(Navigate);
    expect(element.props.to).toBe('/login');
  });
});
