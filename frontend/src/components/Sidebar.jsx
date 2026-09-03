import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function Sidebar() {
  const { user, logout } = useAuth();
  const [logoutError, setLogoutError] = useState('');

  async function handleLogout() {
    setLogoutError('');
    try {
      await logout();
    } catch (_error) {
      setLogoutError('No fue posible cerrar sesión.');
    }
  }

  const role = user?.rol;

  return (
    <aside className="app-sidebar">
      <NavLink className="sidebar-brand" to="/dashboard" aria-label="Ir al inicio de MedicalSys">
        <img alt="" src="/favicon.svg" />
        <span>
          <strong>MedicalSys</strong>
          <small>Gestión Médica</small>
        </span>
      </NavLink>

      {['ADMINISTRADOR', 'RECEPCIONISTA', 'MEDICO'].includes(role) && (
        <nav className="sidebar-nav" aria-label="Módulos del sistema">
          <span className="sidebar-section-label">Módulos del sistema</span>

          {role === 'ADMINISTRADOR' && (
            <>
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
              <NavLink
                className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
                to="/admin/horarios-medicos"
              >
                <span className="sidebar-item-icon" aria-hidden="true">H</span>
                <span>
                  <strong>Horarios Médicos</strong>
                  <small>Disponibilidad semanal</small>
                </span>
                <span className="sidebar-arrow" aria-hidden="true">›</span>
              </NavLink>
              <NavLink
                className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
                to="/admin/medicos"
              >
                <span className="sidebar-item-icon" aria-hidden="true">M</span>
                <span>
                  <strong>Gestión de Médicos</strong>
                  <small>Perfiles profesionales</small>
                </span>
                <span className="sidebar-arrow" aria-hidden="true">›</span>
              </NavLink>
            </>
          )}

          {['ADMINISTRADOR', 'RECEPCIONISTA'].includes(role) && (
            <NavLink
              className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
              to="/citas"
            >
              <span className="sidebar-item-icon" aria-hidden="true">C</span>
              <span>
                <strong>Agenda de Citas</strong>
                <small>Programar y consultar citas</small>
              </span>
              <span className="sidebar-arrow" aria-hidden="true">›</span>
            </NavLink>
          )}

          {role === 'MEDICO' && (
            <>
              <NavLink
                className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
                to="/agenda"
              >
                <span className="sidebar-item-icon" aria-hidden="true">A</span>
                <span>
                  <strong>Agenda Médica</strong>
                  <small>Mis citas programadas</small>
                </span>
                <span className="sidebar-arrow" aria-hidden="true">›</span>
              </NavLink>
              <NavLink
                className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
                to="/consentimientos/nuevo"
              >
                <span className="sidebar-item-icon" aria-hidden="true">C</span>
                <span>
                  <strong>Consentimientos</strong>
                  <small>Generar consentimiento</small>
                </span>
                <span className="sidebar-arrow" aria-hidden="true">›</span>
              </NavLink>
            </>
          )}

          <NavLink
            className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
            to="/pacientes"
          >
            <span className="sidebar-item-icon" aria-hidden="true">P</span>
            <span>
              <strong>{role === 'MEDICO' ? 'Historial Clínico' : 'Gestión de Pacientes'}</strong>
              <small>{role === 'MEDICO' ? 'Consulta por paciente' : 'Registro y consulta'}</small>
            </span>
            <span className="sidebar-arrow" aria-hidden="true">›</span>
          </NavLink>

          <NavLink
            className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
            to="/salas"
          >
            <span className="sidebar-item-icon" aria-hidden="true">S</span>
            <span>
              <strong>Salas y Quirófanos</strong>
              <small>Reserva y disponibilidad</small>
            </span>
            <span className="sidebar-arrow" aria-hidden="true">›</span>
          </NavLink>
        </nav>
      )}

      <div className="sidebar-footer">
        {logoutError && <p className="sidebar-error" role="alert">{logoutError}</p>}
        <button className="sidebar-logout" onClick={handleLogout} type="button">
          <span className="sidebar-item-icon" aria-hidden="true">↪</span>
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
