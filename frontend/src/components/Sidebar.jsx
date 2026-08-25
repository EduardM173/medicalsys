import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function Sidebar() {
  const { user } = useAuth();

  return (
    <aside className="app-sidebar">
      <NavLink className="sidebar-brand" to="/dashboard" aria-label="Ir al inicio de MedicalSys">
        <img alt="" src="/favicon.svg" />
        <span>
          <strong>MedicalSys</strong>
          <small>Gestión Médica</small>
        </span>
      </NavLink>

      {user.rol === 'ADMINISTRADOR' && (
        <nav className="sidebar-nav" aria-label="Módulos del sistema">
          <span className="sidebar-section-label">Módulos del sistema</span>
          <NavLink
            className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
            to="/admin/usuarios"
          >
            <span className="sidebar-item-icon" aria-hidden="true">U</span>
            <span>
              <strong>Gestión de Usuarios</strong>
              <small>Usuarios, roles y estados</small>
            </span>
            <span className="sidebar-arrow" aria-hidden="true">›</span>
          </NavLink>
        </nav>
      )}
    </aside>
  );
}
