import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { can, modules } from '../security/permissions';
export function Sidebar() {
  const { user, logout } = useAuth();
  const [error, setError] = useState('');
  async function handleLogout() {
    try { await logout(); } catch (_error) { setError('No fue posible cerrar sesión.'); }
  }
  return <aside className="app-sidebar">
    <NavLink className="sidebar-brand" to="/dashboard" aria-label="Ir al inicio de MedicalSys">
      <img alt="" src="/favicon.svg" /><span><strong>MedicalSys</strong><small>Gestión Médica</small></span>
    </NavLink>
    <nav className="sidebar-nav" aria-label="Módulos del sistema">
      <span className="sidebar-section-label">Módulos del sistema</span>
      {modules.filter(([permission]) => can(user, permission)).map(([permission, path, title, description, icon]) =>
        <NavLink key={permission} className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`} to={path}>
          <span className="sidebar-item-icon" aria-hidden="true">{icon}</span>
          <span><strong>{title}</strong><small>{description}</small></span>
          <span className="sidebar-arrow" aria-hidden="true">›</span>
        </NavLink>)}
    </nav>
    <div className="sidebar-footer">{error && <p role="alert" className="sidebar-error">{error}</p>}
      <button className="sidebar-logout" onClick={handleLogout} type="button"><span className="sidebar-item-icon" aria-hidden="true">↪</span>Cerrar sesión</button>
    </div>
  </aside>;
}
