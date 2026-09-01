import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { getConsent } from '../services/api';
import '../styles/consents.css';

function formatDate(value) {
  return new Intl.DateTimeFormat('es-BO', {
    timeZone: 'America/La_Paz',
    dateStyle: 'long',
    timeStyle: 'short'
  }).format(new Date(value));
}

export function ConsentDetailPage() {
  const { consentId } = useParams();
  const navigate = useNavigate();
  const [consent, setConsent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
          <span className={`consent-status status-${consent.status.toLowerCase()}`}>{consent.status}</span>
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

        <p className="consent-signature-state">Este consentimiento aún no contiene firma.</p>
      </section>
    </main>
  );
}
