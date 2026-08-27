import React from 'react';
import { useAuth } from '../contexts/AuthContext';

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <main className="dashboard-page">
      <section className="dashboard-card">
        <span className="login-kicker">Sesión autenticada</span>
        <h1>MedicalSys</h1>
        <dl className="user-summary">
          <div>
            <dt>Usuario</dt>
            <dd>{user.nombres} {user.apellidos}</dd>
          </div>
          <div>
            <dt>Correo</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Rol</dt>
            <dd><span className="role-badge">{user.rol}</span></dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
