import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../context/TenantContext';
import { TenantProvisionModal } from '../components/TenantProvisionModal';

export function DashboardPage() {
  const { user } = useAuth();
  const { currentTenant, organizations, switchTenant, refreshTenant } = useTenant();
  const isSuperAdmin = user?.isSuperAdmin || user?.rol === 'SUPERADMIN';
  const [isProvisionOpen, setIsProvisionOpen] = useState(false);

  return (
    <main className="dashboard-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1100px', margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
        
        {/* Tarjeta de Sesión de Usuario */}
        <section className="dashboard-card" style={{ height: '100%' }}>
          <span className="login-kicker">Sesión Autenticada</span>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '16px', color: 'var(--color-navy, #10294c)' }}>MedicalSys</h1>
          <dl className="user-summary">
            <div>
              <dt>Usuario</dt>
              <dd>{user?.nombres} {user?.apellidos}</dd>
            </div>
            <div>
              <dt>Correo</dt>
              <dd>{user?.email}</dd>
            </div>
            <div>
              <dt>Rol de Plataforma</dt>
              <dd><span className="role-badge">{user?.rol}</span></dd>
            </div>
            {isSuperAdmin && (
              <div>
                <dt>Alcance</dt>
                <dd><span style={{ background: '#fef3c7', color: '#92400e', padding: '3px 8px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600 }}>SuperAdmin Global (Todas las Clínicas)</span></dd>
              </div>
            )}
          </dl>
        </section>

        {/* Ficha Técnica de la Organización / Centro Médico */}
        {currentTenant && (
          <section className="dashboard-card" style={{ height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="login-kicker">Centro Médico / Tenant Activo</span>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '12px',
                background: currentTenant.isExpired ? '#fef2f2' : '#ecfdf5',
                color: currentTenant.isExpired ? '#dc2626' : '#059669',
                border: `1px solid ${currentTenant.isExpired ? '#fca5a5' : '#a7f3d0'}`
              }}>
                {currentTenant.isExpired ? '🔴 Suscripción Vencida' : '🟢 Plan Activo'}
              </span>
            </div>

            <h2 style={{ fontSize: '1.35rem', margin: '0 0 16px', color: 'var(--color-navy, #10294c)' }}>
              {currentTenant.nombre}
            </h2>

            <dl className="user-summary">
              <div>
                <dt>Razón Social</dt>
                <dd><strong>{currentTenant.razonSocial || currentTenant.nombre}</strong></dd>
              </div>
              <div>
                <dt>NIT Institucional</dt>
                <dd><code>{currentTenant.nit || 'Sin registrar'}</code></dd>
              </div>
              <div>
                <dt>Ubicación / Dirección</dt>
                <dd>{currentTenant.direccion || 'Sin registrar'}</dd>
              </div>
              <div>
                <dt>Teléfono de Contacto</dt>
                <dd>{currentTenant.telefono || 'Sin registrar'}</dd>
              </div>
              <div>
                <dt>Correo Oficial</dt>
                <dd>{currentTenant.email || 'Sin registrar'}</dd>
              </div>
              <div>
                <dt>Aislamiento PostgreSQL</dt>
                <dd><code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>Esquema: {currentTenant.schemaName}</code></dd>
              </div>
              <div>
                <dt>Subdominio SaaS</dt>
                <dd>{currentTenant.subdominio}.localhost</dd>
              </div>
              <div>
                <dt>Plan Contratado</dt>
                <dd>{currentTenant.plan} · Vigencia: {currentTenant.fechaSuscripcionFin ? new Date(currentTenant.fechaSuscripcionFin).toLocaleDateString('es-ES') : 'Indefinida'}</dd>
              </div>
            </dl>
          </section>
        )}
      </div>

      {/* Si el usuario es SuperAdmin, mostrar consola de supervisión de todos los tenants */}
      {isSuperAdmin && organizations && organizations.length > 0 && (
        <section className="dashboard-card" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <div>
              <span className="login-kicker">Consola SaaS Maestro</span>
              <h2 style={{ fontSize: '1.25rem', margin: '2px 0 0', color: 'var(--color-navy, #10294c)' }}>
                Catálogo y Datos Institucionales de Clínicas Aprovisionadas
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setIsProvisionOpen(true)}
              style={{
                background: 'var(--color-navy, #10294c)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '9px 18px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              + Aprovisionar Nueva Clínica
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            {organizations.map((org) => {
              const isActiveTenant = org.codigo === currentTenant?.codigo;
              return (
                <div
                  key={org.codigo}
                  style={{
                    padding: '16px',
                    borderRadius: '10px',
                    border: isActiveTenant ? '2px solid var(--color-navy, #10294c)' : '1px solid #e2e8f0',
                    background: isActiveTenant ? '#f8fafc' : '#ffffff',
                    position: 'relative'
                  }}
                >
                  {isActiveTenant && (
                    <span style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      background: 'var(--color-navy, #10294c)',
                      color: '#ffffff',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '10px'
                    }}>
                      EN USO
                    </span>
                  )}
                  <h3 style={{ margin: '0 0 8px', fontSize: '1.05rem', color: '#1e293b' }}>
                    {org.nombre}
                  </h3>
                  <div style={{ fontSize: '0.82rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div><strong>Razón Social:</strong> {org.razonSocial || org.nombre}</div>
                    <div><strong>NIT:</strong> <code>{org.nit || '1023942027'}</code></div>
                    <div><strong>Dirección:</strong> {org.direccion || 'No especificada'}</div>
                    <div><strong>Teléfono:</strong> {org.telefono || 'Sin teléfono'}</div>
                    <div><strong>Contacto:</strong> {org.email || 'Sin correo'}</div>
                    <div><strong>Esquema DB:</strong> <code>{org.schemaName}</code></div>
                    <div><strong>Subdominio:</strong> {org.subdominio}.localhost</div>
                    <div><strong>Plan:</strong> {org.isExpired ? '🔴 Vencido' : '🟢 Activo'} ({org.plan})</div>
                  </div>
                  {!isActiveTenant && (
                    <button
                      type="button"
                      onClick={() => switchTenant(org.codigo)}
                      style={{
                        marginTop: '12px',
                        padding: '6px 12px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        cursor: 'pointer',
                        color: 'var(--color-navy, #10294c)',
                        width: '100%'
                      }}
                    >
                      Alternar a esta Clínica →
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Modal de Aprovisionamiento para SuperAdmin */}
      {isSuperAdmin && (
        <TenantProvisionModal
          isOpen={isProvisionOpen}
          onClose={() => setIsProvisionOpen(false)}
          onSuccess={() => {
            if (refreshTenant) refreshTenant();
          }}
        />
      )}
    </main>
  );
}
