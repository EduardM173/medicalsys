import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useTenant } from '../context/TenantContext';
import { generateTenantRenewalQr, confirmTenantPayment } from '../services/api';

export function TenantSubscriptionModal() {
  const { currentTenant, isSubscriptionModalOpen, setIsSubscriptionModalOpen, refreshTenant } = useTenant();
  const [meses, setMeses] = useState(1);
  const [qrData, setQrData] = useState(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(null);
  const [error, setError] = useState('');

  if (!isSubscriptionModalOpen || !currentTenant) return null;

  const handleClose = () => {
    setIsSubscriptionModalOpen(false);
    setQrData(null);
    setPaymentSuccess(null);
    setError('');
  };

  const handleGenerateQr = async (e) => {
    e?.preventDefault();
    try {
      setLoadingQr(true);
      setError('');
      setPaymentSuccess(null);
      const res = await generateTenantRenewalQr({
        tenantCode: currentTenant.codigo,
        meses
      });
      setQrData(res);
    } catch (err) {
      setError(err.message || 'No fue posible generar el código QR de pago.');
    } finally {
      setLoadingQr(false);
    }
  };

  const handleConfirmSimulatedPayment = async () => {
    if (!qrData?.referenciaPago) return;
    try {
      setSubmittingPayment(true);
      setError('');
      const res = await confirmTenantPayment({
        referenciaPago: qrData.referenciaPago
      });
      setPaymentSuccess(res);
      setQrData(null);
      await refreshTenant();
    } catch (err) {
      setError(err.message || 'Error al confirmar el pago.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const isExpired = currentTenant.isExpired;
  const expirationDate = currentTenant.fechaSuscripcionFin
    ? new Date(currentTenant.fechaSuscripcionFin).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      })
    : 'No establecida';

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="tenant-sub-title">
      <div className="modal-card" style={{ maxWidth: '580px', width: '100%' }}>
        <header className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
          <div>
            <h2 id="tenant-sub-title" style={{ margin: 0, fontSize: '1.25rem', color: 'var(--color-navy, #10294c)' }}>
              Suscripción SaaS · {currentTenant.nombre}
            </h2>
            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.85rem' }}>
              Aislamiento de Infraestructura: <code>{currentTenant.schemaName}</code>
            </p>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={handleClose}
            style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </header>

        <div style={{ padding: '20px' }}>
          {error && (
            <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #f87171', borderRadius: '8px', color: '#b91c1c', marginBottom: '16px', fontSize: '0.9rem' }}>
              ⚠️ {error}
            </div>
          )}

          {paymentSuccess && (
            <div style={{ padding: '16px', background: '#ecfdf5', border: '1px solid #34d399', borderRadius: '8px', color: '#065f46', marginBottom: '16px' }}>
              <strong style={{ display: 'block', fontSize: '1rem', marginBottom: '4px' }}>
                🎉 ¡Pago Confirmado y Suscripción Renovada!
              </strong>
              <p style={{ margin: 0, fontSize: '0.88rem' }}>
                Se han extendido {paymentSuccess.mesesRenovados} mes(es). Nueva fecha de vigencia:{' '}
                <strong>{new Date(paymentSuccess.nuevaFechaFin).toLocaleDateString('es-ES')}</strong>.
              </p>
            </div>
          )}

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.9rem', color: '#475569' }}>Estado de Suscripción:</span>
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: '16px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  background: isExpired ? '#fef2f2' : '#ecfdf5',
                  color: isExpired ? '#dc2626' : '#059669',
                  border: `1px solid ${isExpired ? '#fca5a5' : '#a7f3d0'}`
                }}
              >
                {isExpired ? '🔴 VENCIDA / SUSPENDIDA' : '🟢 ACTIVA (AL DÍA)'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: '#475569', marginBottom: '4px' }}>
              <span>Plan Contratado:</span>
              <strong>{currentTenant.plan || 'Plan Clínica Estándar'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: '#475569' }}>
              <span>Vencimiento:</span>
              <strong>{expirationDate}</strong>
            </div>
          </div>

          {!qrData ? (
            <form onSubmit={handleGenerateQr}>
              <h3 style={{ fontSize: '1rem', margin: '0 0 12px', color: '#1e293b' }}>
                Renovar o Extender Suscripción
              </h3>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, marginBottom: '6px', color: '#334155' }}>
                  Período a renovar:
                </label>
                <select
                  value={meses}
                  onChange={(e) => setMeses(Number(e.target.value))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                >
                  <option value={1}>1 Mes — 350.00 BOB</option>
                  <option value={3}>3 Meses (Descuento 5%) — 997.50 BOB</option>
                  <option value={6}>6 Meses (Descuento 10%) — 1,890.00 BOB</option>
                  <option value={12}>1 Año (Descuento 15%) — 3,570.00 BOB</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleClose}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    color: '#475569',
                    cursor: 'pointer'
                  }}
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={loadingQr}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--color-navy, #10294c)',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {loadingQr ? 'Generando QR...' : '💳 Generar Código QR de Cobro'}
                </button>
              </div>
            </form>
          ) : (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div
                style={{
                  background: '#ffffff',
                  padding: '16px',
                  display: 'inline-block',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                }}
              >
                <QRCodeSVG value={qrData.codigoQr} size={180} level="M" />
              </div>

              <div style={{ marginTop: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-navy, #10294c)' }}>
                  {qrData.monto.toFixed(2)} {qrData.moneda}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '2px' }}>
                  Referencia: <code>{qrData.referenciaPago}</code>
                </div>
                <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '8px auto 16px', maxWidth: '380px' }}>
                  Escanee desde cualquier app bancaria de Bolivia (BCP, Banco Unión, BNB, etc.) habilitada para Simple QR.
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setQrData(null)}
                  disabled={submittingPayment}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    color: '#475569',
                    cursor: 'pointer'
                  }}
                >
                  ← Cambiar Plan
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSimulatedPayment}
                  disabled={submittingPayment}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#059669',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {submittingPayment ? 'Procesando...' : '✅ Simular Pago Exitoso (Docente / Demo)'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
