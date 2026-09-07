import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { getConsents } from '../services/api';
import '../styles/consents.css';

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-BO', {
    timeZone: 'America/La_Paz',
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

const STATUS_LABELS = {
  GENERADO: 'Generado',
  PENDIENTE_FIRMA: 'Pendiente de firma',
  FIRMADO: 'Firmado',
  ANULADO: 'Anulado'
};

function isPending(status) {
  return status === 'GENERADO' || status === 'PENDIENTE_FIRMA';
}

function statusClass(status) {
  const label = STATUS_LABELS[status] ? status.toLowerCase() : 'generado';
  return `consent-status ch-status-${label.replace('_', '-')}`;
}

function patientDocument(patient) {
  const complement = patient.complement ? ` ${patient.complement}` : '';
  return patient.documentNumber ? `CI ${patient.documentNumber}${complement}` : '—';
}

export function ConsentHistoryPage() {
  const navigate = useNavigate();
  const [consents, setConsents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getConsents()
      .then((response) => {
        if (active) setConsents(response.consents);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(
          requestError.status === 403
            ? 'No tiene permisos para consultar el historial de consentimientos.'
            : 'No fue posible cargar el historial de consentimientos.'
        );
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <main className="consent-page consent-history-page">
      <header className="consent-header consent-detail-header">
        <div>
          <span className="login-kicker">Gestión documental</span>
          <h1>Historial de Consentimientos Informados</h1>
          <p>Consulte los consentimientos generados, su estado de firma y la huella criptográfica.</p>
        </div>
        <Button onClick={() => navigate('/consentimientos/nuevo')}>+ Nuevo consentimiento</Button>
      </header>

      {loading ? (
        <section className="consent-state">Cargando historial de consentimientos...</section>
      ) : error && consents.length === 0 ? (
        <section className="consent-state consent-error" role="alert"><p>{error}</p></section>
      ) : consents.length === 0 && !error ? (
        <section className="consent-state">
          <p>Todavía no se generaron consentimientos informados.</p>
          <Button onClick={() => navigate('/consentimientos/nuevo')}>Generar el primero</Button>
        </section>
      ) : (
        <section className="consent-history-card">
          {error && <p className="notice error-notice consent-notice" role="alert">{error}</p>}
          <div className="consent-history-table-wrap">
            <table className="consent-history-table">
              <thead>
                <tr>
                  <th>Paciente y CI</th>
                  <th>Procedimiento Médico</th>
                  <th>Generación</th>
                  <th>Firma</th>
                  <th>Estado</th>
                  <th>Huella SHA-256</th>
                  <th><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {consents.map((consent) => (
                  <tr key={consent.id}>
                    <td>
                      <strong>{consent.patient.fullName}</strong>
                      <small>{patientDocument(consent.patient)}</small>
                    </td>
                    <td>
                      <strong>{consent.procedure}</strong>
                      <small>{consent.folio}</small>
                    </td>
                    <td>{formatDate(consent.generatedAt)}</td>
                    <td>{formatDate(consent.signedAt)}</td>
                    <td><span className={statusClass(consent.status)}>{STATUS_LABELS[consent.status] || consent.status}</span></td>
                    <td>
                      {consent.signatureHash ? (
                        <code className="consent-history-hash" title={consent.signatureHash}>{consent.signatureHash}</code>
                      ) : (
                        <small className="consent-history-hash-empty">Pendiente de firma</small>
                      )}
                    </td>
                    <td>
                      <Button
                        onClick={() => navigate(`/consentimientos/${consent.id}`)}
                        type="button"
                        variant={isPending(consent.status) ? 'secondary' : 'teal'}
                      >
                        {isPending(consent.status) ? 'Ver / Firmar' : 'Ver Documento Firmado'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}