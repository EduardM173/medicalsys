import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { SignatureCanvas } from '../components/SignatureCanvas';
import { getConsent, signConsent } from '../services/api';
import '../styles/consents.css';

function formatDate(value) {
  return new Intl.DateTimeFormat('es-BO', {
    timeZone: 'America/La_Paz',
    dateStyle: 'long',
    timeStyle: 'short'
  }).format(new Date(value));
}

const STATUS_LABELS = {
  GENERADO: 'Generado',
  PENDIENTE_FIRMA: 'Pendiente de firma',
  FIRMADO: 'Firmado',
  ANULADO: 'Anulado'
};

function canSign(status) {
  return status === 'GENERADO' || status === 'PENDIENTE_FIRMA';
}

export function ConsentDetailPage() {
  const { consentId } = useParams();
  const navigate = useNavigate();
  const [consent, setConsent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signatureData, setSignatureData] = useState(null);
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState('');

  useEffect(() => {
    let active = true;
    getConsent(consentId)
      .then((response) => {
        if (active) setConsent(response.consent);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(
          requestError.status === 404
            ? 'Consentimiento informado no encontrado.'
            : requestError.status === 403
              ? 'No tiene permisos para consultar este consentimiento informado.'
              : 'No fue posible cargar el consentimiento informado.'
        );
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [consentId]);

  async function handleSign() {
    if (!signatureData) {
      setSignError('Debe dibujar su firma antes de confirmar.');
      return;
    }

    setSigning(true);
    setSignError('');

    try {
      const response = await signConsent(consentId, signatureData);
      setConsent(response.consent);
    } catch (requestError) {
      setSignError(
        requestError.message || 'No fue posible registrar la firma digital.'
      );
    } finally {
      setSigning(false);
    }
  }

  if (loading) {
    return <main className="consent-page"><p className="consent-state">Cargando consentimiento informado...</p></main>;
  }

  if (!consent) {
    return (
      <main className="consent-page">
        <section className="consent-state consent-error" role="alert">
          <p>{error}</p>
          <Button onClick={() => navigate('/consentimientos/nuevo')}>Volver</Button>
        </section>
      </main>
    );
  }

  const isSigned = consent.status === 'FIRMADO';
  const isAnulado = consent.status === 'ANULADO';
  const isSignable = canSign(consent.status);

  return (
    <main className="consent-page">
      <header className="consent-header consent-detail-header">
        <div>
          <span className="login-kicker">Consentimiento informado</span>
          <h1>{consent.folio}</h1>
          <p>Documento generado y registrado en MedicalSys</p>
        </div>
        <Button onClick={() => navigate('/consentimientos/nuevo')}>+ Nuevo consentimiento</Button>
      </header>

      <section className="consent-detail-card">
        <div className="consent-detail-heading">
          <div><span className="login-kicker">Estado del documento</span><h2>{consent.procedure}</h2></div>
          <span className={`consent-status status-${consent.status.toLowerCase()}`}>{STATUS_LABELS[consent.status] || consent.status}</span>
        </div>

        <dl className="consent-metadata">
          <div><dt>Paciente</dt><dd>{consent.patient.fullName}</dd></div>
          <div><dt>Médico responsable</dt><dd>{consent.doctor.fullName}<small>{consent.doctor.specialty}</small></dd></div>
          <div><dt>Fecha de generación</dt><dd>{formatDate(consent.generatedAt)}</dd></div>
          <div><dt>Cita asociada</dt><dd>{consent.appointment ? `${formatDate(consent.appointment.startTime)} · ${consent.appointment.service}` : 'Sin cita asociada'}</dd></div>
        </dl>

        <section className="consent-content" aria-labelledby="consent-content-title">
          <h2 id="consent-content-title">Contenido del consentimiento</h2>
          <p>{consent.content}</p>
        </section>

        {/* ── Sección de Firma Digital ── */}
        <section className="signature-section" aria-labelledby="signature-section-title">
          <h2 id="signature-section-title">
            <span className="signature-icon" aria-hidden="true">✍</span>
            Firma Digital del Documento
          </h2>

          {/* Estado: FIRMADO — Tarjeta de validación exitosa */}
          {isSigned && (
            <div className="signature-validation" role="status">
              <div className="signature-validation-header">
                <span className="signature-check" aria-hidden="true">✓</span>
                <div>
                  <strong>Documento firmado digitalmente</strong>
                  <p>Este consentimiento ha sido firmado y validado correctamente.</p>
                </div>
              </div>
              <dl className="signature-validation-details">
                <div>
                  <dt>Fecha y hora de firma</dt>
                  <dd>{consent.signedAt ? formatDate(consent.signedAt) : '—'}</dd>
                </div>
                <div>
                  <dt>Huella criptográfica SHA-256</dt>
                  <dd><code className="signature-hash">{consent.signatureHash || '—'}</code></dd>
                </div>
              </dl>
            </div>
          )}

          {/* Estado: ANULADO — Alerta informativa */}
          {isAnulado && (
            <div className="signature-disabled-notice" role="alert">
              <span className="signature-notice-icon" aria-hidden="true">⊘</span>
              <div>
                <strong>Consentimiento anulado</strong>
                <p>Este documento ha sido anulado. No es posible registrar una firma digital.</p>
              </div>
            </div>
          )}

          {/* Estado: GENERADO / PENDIENTE_FIRMA — Área de firma activa */}
          {isSignable && (
            <div className="signature-capture">
              <p className="signature-instructions">Dibuje su firma en el área de abajo utilizando el mouse o el dedo en pantalla táctil.</p>

              <SignatureCanvas
                disabled={signing}
                onSignatureChange={setSignatureData}
              />

              {signError && (
                <p className="notice error-notice consent-notice" role="alert">{signError}</p>
              )}

              <div className="signature-actions">
                <Button
                  disabled={signing || !signatureData}
                  onClick={handleSign}
                  type="button"
                >
                  {signing ? 'Registrando firma...' : '✓ Confirmar y Firmar Documento'}
                </Button>
              </div>
            </div>
          )}

          {/* Estado ya firmado: Canvas deshabilitado visual */}
          {(isSigned || isAnulado) && (
            <div className="signature-capture signature-capture-locked">
              <SignatureCanvas disabled />
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
