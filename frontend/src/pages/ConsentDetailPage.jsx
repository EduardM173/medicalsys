import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { HashBox } from '../components/HashBox';
import { getConsent, signConsentWithCertificate } from '../services/api';
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
  const [signature, setSignature] = useState({
    signerType: 'PACIENTE',
    signerName: '',
    signerCi: '',
    tutorRelationship: '',
    certificate: '',
    signature: ''
  });
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
    if (!signature.certificate.trim() || !signature.signature.trim() || !signature.signerName.trim() || !signature.signerCi.trim()) {
      setSignError('Complete los datos del firmante, el certificado X.509 y la firma criptográfica.');
      return;
    }

    setSigning(true);
    setSignError('');

    try {
      const response = await signConsentWithCertificate(consentId, signature);
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
  const updateSignature = (event) => {
    const { name, value } = event.target;
    setSignature((current) => ({ ...current, [name]: value }));
  };

  return (
    <main className="consent-page">
      <header className="consent-header consent-detail-header">
        <div>
          <span className="login-kicker">Consentimiento informado</span>
          <h1>{consent.folio}</h1>
          <p>Documento generado y registrado en MedicalSys</p>
        </div>
        <div className="consent-header-actions">
          <Button onClick={() => navigate('/consentimientos')} type="button" variant="ghost">← Historial</Button>
          <Button onClick={() => navigate('/consentimientos/nuevo')}>+ Nuevo consentimiento</Button>
        </div>
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
                  <dd>{consent.signature?.documentHash || consent.signatureHash ? <HashBox hash={consent.signature?.documentHash || consent.signatureHash} /> : '—'}</dd>
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

          {/* HU-33: se envía la firma PKI sobre el hash del PDF, no un trazo. */}
          {isSignable && (
            <div className="signature-capture">
              <p className="signature-instructions">Use el certificado digital del paciente o tutor. La firma debe corresponder al hash SHA-256 del PDF generado.</p>
              <div className="consent-form-grid">
                <label><span>Firmante *</span><select name="signerType" value={signature.signerType} onChange={updateSignature} disabled={signing}><option value="PACIENTE">Paciente</option><option value="TUTOR">Tutor</option></select></label>
                <label><span>CI del firmante *</span><input name="signerCi" value={signature.signerCi} onChange={updateSignature} disabled={signing} required /></label>
                <label><span>Nombre completo *</span><input name="signerName" value={signature.signerName} onChange={updateSignature} disabled={signing} required /></label>
                {signature.signerType === 'TUTOR' && <label><span>Relación con el paciente *</span><input name="tutorRelationship" value={signature.tutorRelationship} onChange={updateSignature} disabled={signing} required /></label>}
              </div>
              <label className="consent-field"><span>Certificado digital X.509 PEM *</span><textarea name="certificate" value={signature.certificate} onChange={updateSignature} disabled={signing} rows="6" placeholder="-----BEGIN CERTIFICATE-----" required /></label>
              <label className="consent-field"><span>Firma hexadecimal del hash del PDF *</span><textarea name="signature" value={signature.signature} onChange={updateSignature} disabled={signing} rows="3" placeholder="Firma generada por el certificado/proveedor autorizado" required /></label>

              {signError && (
                <p className="notice error-notice consent-notice" role="alert">{signError}</p>
              )}

              <div className="signature-actions">
                <Button
                  disabled={signing}
                  onClick={handleSign}
                  type="button"
                >
                  {signing ? 'Validando firma...' : '✓ Validar y Firmar Documento'}
                </Button>
              </div>
            </div>
          )}

        </section>
      </section>
    </main>
  );
}
