import React from 'react';
import { useTenant } from '../context/TenantContext';

export function TenantRenewalSuccessModal() {
  const { currentTenant, renewalVoucher, setRenewalVoucher, refreshTenant } = useTenant();

  if (!renewalVoucher || !currentTenant) return null;

  const handleClose = async () => {
    setRenewalVoucher(null);
    if (refreshTenant) {
      await refreshTenant();
    }
  };

  const formattedDate = renewalVoucher.nuevaFechaFin
    ? new Date(renewalVoucher.nuevaFechaFin).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      })
    : 'Actualizada';

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="success-sub-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(16, 41, 76, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px'
      }}
    >
      <div
        className="modal-card"
        style={{
          maxWidth: '520px',
          width: '100%',
          background: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.08)',
          overflow: 'hidden'
        }}
      >
        <header
          style={{
            background: '#ecfdf5',
            borderBottom: '1px solid #a7f3d0',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: '#059669',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.4rem'
            }}
          >
            ✓
          </div>
          <div>
            <h2
              id="success-sub-title"
              style={{
                margin: 0,
                fontSize: '1.25rem',
                color: '#065f46',
                fontWeight: 700
              }}
            >
              ¡Suscripción Renovada con Éxito!
            </h2>
            <p style={{ margin: '2px 0 0', color: '#047857', fontSize: '0.86rem' }}>
              Transacción conciliada y registrada en MedicalSys SaaS.
            </p>
          </div>
        </header>

        <div style={{ padding: '24px' }}>
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '20px'
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', fontSize: '0.88rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                <span style={{ color: '#64748b' }}>Centro Médico:</span>
                <strong style={{ color: '#1e293b' }}>{currentTenant.nombre}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                <span style={{ color: '#64748b' }}>Razón Social & NIT:</span>
                <span style={{ color: '#334155', textAlign: 'right' }}>
                  {currentTenant.razonSocial || currentTenant.nombre}
                  {currentTenant.nit && ` (NIT: ${currentTenant.nit})`}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                <span style={{ color: '#64748b' }}>Período Extendido:</span>
                <span style={{ fontWeight: 700, color: '#059669' }}>
                  +{renewalVoucher.mesesRenovados || 1} mes(es)
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                <span style={{ color: '#64748b' }}>Nueva Vigencia:</span>
                <strong style={{ color: '#0f766e', fontSize: '0.94rem' }}>
                  {formattedDate}
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                <span style={{ color: '#64748b' }}>N° de Comprobante / Voucher:</span>
                <code style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontSize: '0.82rem', color: '#1e293b' }}>
                  {renewalVoucher.voucherId || renewalVoucher.referenciaPago || 'CONFIRMADO-BNB'}
                </code>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#64748b' }}>Estado del Servicio:</span>
                <span
                  style={{
                    background: '#ecfdf5',
                    color: '#065f46',
                    border: '1px solid #a7f3d0',
                    borderRadius: '12px',
                    padding: '2px 8px',
                    fontSize: '0.78rem',
                    fontWeight: 700
                  }}
                >
                  🟢 HABILITADO / AL DÍA
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--color-navy, #10294c)',
              color: '#ffffff',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.2s ease'
            }}
          >
            Entendido, Continuar al Sistema
          </button>
        </div>
      </div>
    </div>
  );
}
