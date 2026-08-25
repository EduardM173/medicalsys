import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <main className="route-loading">Comprobando sesión...</main>;
  }

  if (!user) {
    return <Navigate replace to="/login" />;
  }

  return <Outlet />;
}
