import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { can } from '../security/permissions';
export function AuthorizedRoute({ permission }) {
  const { user } = useAuth();
  return can(user, permission) ? <Outlet /> : <Navigate replace to="/dashboard" />;
}
