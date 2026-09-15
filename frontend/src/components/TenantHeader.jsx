import React from 'react';
import { useTenant } from '../context/TenantContext';
import { useAuth } from '../contexts/AuthContext';

export function TenantHeader() {
  const { currentTenant, organizations, switchTenant, setIsSubscriptionModalOpen } = useTenant();
  const { user } = useAuth();

  if (!currentTenant) return null;

  const isExpired = currentTenant.isExpired;
  const isSuperAdmin = user?.isSuperAdmin || user?.rol === 'SUPERADMIN';
  // El estado de suscripción y sus cobros son administrativos; no deben
  // distraer ni exponerse a usuarios clínicos, recepción, pacientes u OSI.
  const canManageSubscription = isSuperAdmin || user?.rol === 'ADMINISTRADOR';

  return (
    <header
      className="tenant-header"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 24px',
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        gap: '16px',
        flexWrap: 'wrap'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: 'var(--color-navy, #10294c)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.2rem'
          }}
        >
          🏥
        </div>
        <div>
          <strong style={{ fontSize: '0.98rem', color: 'var(--color-navy, #10294c)' }}>
            {currentTenant.nombre}
          </strong>
          <small style={{ color: '#64748b', fontSize: '0.78rem' }}>
            Centro médico seleccionado
          </small>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        {isSuperAdmin && organizations && organizations.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor="tenant-switcher-select" style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
              SaaS Admin · Cambiar Clínica:
            </label>
            <select
              id="tenant-switcher-select"
              value={currentTenant.codigo}
              onChange={(e) => switchTenant(e.target.value)}
              style={{
                fontSize: '0.82rem',
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                color: '#1e293b',
                cursor: 'pointer',
                minHeight: '32px'
              }}
            >
              {organizations.map((org) => (
                <option key={org.codigo} value={org.codigo}>
                  {org.nombre} ({org.codigo})
                </option>
              ))}
            </select>
          </div>
        )}

        {canManageSubscription && <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '0.8rem',
            fontWeight: 600,
            background: isExpired ? '#fef2f2' : '#ecfdf5',
            color: isExpired ? '#dc2626' : '#059669',
            border: `1px solid ${isExpired ? '#fca5a5' : '#a7f3d0'}`
          }}
        >
          <span>{isExpired ? '🔴' : '🟢'}</span>
          <span>{isExpired ? 'Suscripción Vencida' : 'Plan Activo'}</span>
        </div>}

        {canManageSubscription && <button
          type="button"
          onClick={() => setIsSubscriptionModalOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid var(--color-navy, #10294c)',
            background: isExpired ? '#dc2626' : 'transparent',
            color: isExpired ? '#ffffff' : 'var(--color-navy, #10294c)',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          💳 {isExpired ? 'Renovar Ahora (QR)' : 'Gestionar Plan / QR'}
        </button>}
      </div>
    </header>
  );
}
