import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useTenant } from '../context/TenantContext';
import {
  generateTenantRenewalQr,
  confirmTenantPayment,
  generateBnbRenewalQr,
  checkBnbQrStatus
} from '../services/api';

export function TenantSubscriptionModal() {
  const { currentTenant, isSubscriptionModalOpen, setIsSubscriptionModalOpen, refreshTenant, setRenewalVoucher } = useTenant();
  const [meses, setMeses] = useState(1);
  const [gatewayMode, setGatewayMode] = useState('bnb'); // 'bnb' (en vivo) o 'simulado'
  const [montoDemo1Bs, setMontoDemo1Bs] = useState(true);
  const [qrData, setQrData] = useState(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [error, setError] = useState('');
  const [pollingStatus, setPollingStatus] = useState('');
  const pollTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  if (!isSubscriptionModalOpen || !currentTenant) return null;

  const handleClose = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setIsSubscriptionModalOpen(false);
    setQrData(null);
    setError('');
    setPollingStatus('');
  };

  const startBnbPolling = (qrId) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    setPollingStatus('Esperando que escanees y confirmes desde tu app bancaria...');

    pollTimerRef.current = setInterval(async () => {
      try {
        const check = await checkBnbQrStatus(qrId);
        if (check.isPaid) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          handleClose();
          setRenewalVoucher({
            mesesRenovados: check.mesesRenovados || meses,
            nuevaFechaFin: check.nuevaFechaFin,
            voucherId: check.voucherId
          });
        }
      } catch (err) {
        // Silencioso ante reintentos de red
      }
    }, 3500);
  };

  const handleGenerateQr = async (e) => {
    e?.preventDefault();
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    try {
      setLoadingQr(true);
      setError('');
      setPaymentSuccess(null);
      setPollingStatus('');

      if (gatewayMode === 'bnb') {
        const montoFinal = montoDemo1Bs ? 1 : undefined;
        const res = await generateBnbRenewalQr({
          tenantCode: currentTenant.codigo,
          meses,
          monto: montoFinal
        });
        setQrData({ ...res, isBnb: true });
        startBnbPolling(res.qrId);
      } else {
        const res = await generateTenantRenewalQr({
          tenantCode: currentTenant.codigo,
          meses
        });
        setQrData({ ...res, isBnb: false });
      }
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
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      handleClose();
      setRenewalVoucher(res);
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

              {/* Selector de Pasarela */}
              <div style={{ marginBottom: '16px', background: '#f1f5f9', padding: '12px', borderRadius: '8px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px', color: '#334155' }}>
                  Método de Cobro QR:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="gatewayMode"
                      value="bnb"
                      checked={gatewayMode === 'bnb'}
                      onChange={() => setGatewayMode('bnb')}
                    />
                    <span>🟢 <strong>QR Simple BNB (Pasarela Bancaria en Línea)</strong></span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="gatewayMode"
                      value="simulado"
                      checked={gatewayMode === 'simulado'}
                      onChange={() => setGatewayMode('simulado')}
                    />
                    <span>🟡 Transferencia QR Estándar (Interoperable)</span>
                  </label>
                </div>

                {gatewayMode === 'bnb' && (
                  <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1', fontSize: '0.82rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#0f766e' }}>
                      <input
                        type="checkbox"
                        checked={montoDemo1Bs}
                        onChange={(e) => setMontoDemo1Bs(e.target.checked)}
                      />
                      <span>Habilitar tarifa reducida de validación: <strong>1.00 BOB</strong></span>
                    </label>
                  </div>
                )}
              </div>

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
                  {loadingQr ? 'Generando en Banco...' : (gatewayMode === 'bnb' ? '🚀 Generar QR Real en BNB' : '💳 Generar Código QR')}
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
                {qrData.isBnb && qrData.codigoQrBase64 ? (
                  <img
                    src={`data:image/png;base64,${qrData.codigoQrBase64}`}
                    alt="QR Banco Nacional de Bolivia"
                    style={{ width: '210px', height: '210px', display: 'block', borderRadius: '8px' }}
                  />
                ) : (
                  <QRCodeSVG value={qrData.codigoQr || ''} size={180} level="M" />
                )}
              </div>

              <div style={{ marginTop: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-navy, #10294c)' }}>
                  {Number(qrData.monto).toFixed(2)} {qrData.moneda || 'BOB'}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '2px' }}>
                  {qrData.isBnb ? (
                    <>
                      <span>Banco: <strong>{qrData.banco || 'Banco Nacional de Bolivia'}</strong></span><br />
                      <span>ID QR Banco: <code>{qrData.qrId}</code></span>
                    </>
                  ) : (
                    <span>Referencia: <code>{qrData.referenciaPago}</code></span>
                  )}
                </div>

                {pollingStatus ? (
                  <div style={{
                    margin: '12px auto',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    color: '#1e40af',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    maxWidth: '420px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}>
                    <span style={{ display: 'inline-block', animation: 'spin 1.5s linear infinite' }}>🔄</span>
                    {pollingStatus}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '8px auto 16px', maxWidth: '380px' }}>
                    Escanee desde cualquier app bancaria de Bolivia (BCP, Banco Unión, BNB, etc.) habilitada para Simple QR.
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
                    setQrData(null);
                  }}
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
                  ← Cambiar Parámetros
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
                  {submittingPayment ? 'Procesando...' : '✅ Simular Acreditación Inmediata'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
