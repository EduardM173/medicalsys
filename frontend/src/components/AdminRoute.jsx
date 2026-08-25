import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function AdminRoute() {
  const { user } = useAuth();

  if (user?.rol !== 'ADMINISTRADOR') {
    return <Navigate replace to="/dashboard" />;
  }

  return <Outlet />;
}
