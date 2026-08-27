import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function AuthorizedRoute({ allowedRoles }) {
  const { user } = useAuth();

  if (!allowedRoles.includes(user?.rol)) {
    return <Navigate replace to="/dashboard" />;
  }

  return <Outlet />;
}

export function AdminRoute() {
  return <AuthorizedRoute allowedRoles={['ADMINISTRADOR']} />;
}
