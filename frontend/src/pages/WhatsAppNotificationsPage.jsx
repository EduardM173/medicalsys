import { useListPagination } from '../components/ListPagination';
import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '../components/Button';
import {
  ApiError,
  getConfirmationCandidates,
  getReminderCandidates,
  getWhatsAppNotificationFailures,
  retryWhatsAppNotificationFailure,
  runAppointmentReminders,
  sendAppointmentConfirmation,
  sendAppointmentReminder
} from '../services/api';
import '../styles/whatsapp-notifications.css';

const statusLabels = {
  PROGRAMADA: 'Programada',
  CONFIRMADA: 'Confirmada',
  PENDIENTE_REPROGRAMACION: 'Pendiente de reprogramación',
  EN_CONSULTA: 'En consulta',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada'
};

function formatDateTime(isoDate) {
  return new Intl.DateTimeFormat('es-BO', {
    timeZone: 'America/La_Paz',
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(isoDate));
}

function requestErrorMessage(requestError, fallback) {
  return requestError instanceof ApiError ? requestError.message : fallback;
}

// HU-35: las acciones manuales solo priorizan trabajos en la outbox; el
// worker persistente realiza el envío y el panel expone sus fallos finales.
export function WhatsAppNotificationsPage() {
  const paginationKey = useListPagination();
  const [activeTab, setActiveTab] = useState('confirmations');

  return (
    <main className="whatsapp-page">
      <header className="whatsapp-header">
        <div>
          <span className="login-kicker">WhatsApp Business</span>
          <h1>Notificaciones de Citas por WhatsApp</h1>
          <p>Las confirmaciones y recordatorios se programan automáticamente y se envían desde una cola persistente.</p>
        </div>
      </header>

      <nav className="whatsapp-tabs" aria-label="Tipo de notificación">
        <button
          className={`whatsapp-tab${activeTab === 'confirmations' ? ' active' : ''}`}
          onClick={() => setActiveTab('confirmations')}
          type="button"
        >
          Confirmación de Cita
        </button>
        <button
          className={`whatsapp-tab${activeTab === 'reminders' ? ' active' : ''}`}
          onClick={() => setActiveTab('reminders')}
          type="button"
        >
          Recordatorio de Cita
        </button>
        <button
          className={`whatsapp-tab${activeTab === 'failures' ? ' active' : ''}`}
          onClick={() => setActiveTab('failures')}
          type="button"
        >
          Fallos y reintentos
        </button>
      </nav>

      {activeTab === 'confirmations' && <ConfirmationsPanel />}
      {activeTab === 'reminders' && <RemindersPanel />}
      {activeTab === 'failures' && <FailuresPanel />}
    </main>
  );
}

// ==========================================
// HU-24: Confirmación de cita por WhatsApp
// ==========================================

function ConfirmationsPanel() {
  const paginationKey = useListPagination();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [resultsByCita, setResultsByCita] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getConfirmationCandidates();
      setAppointments(response.appointments);
      setError('');
    } catch (requestError) {
      setError(requestErrorMessage(requestError, 'No fue posible cargar las citas disponibles para confirmación.'));
    } finally {
      setLoading(false);
    }
  }, [paginationKey]);

  useEffect(() => {
    load();
  }, [load, paginationKey]);

  async function handleSend(appointment) {
    setBusyId(appointment.id);
    setResultsByCita((current) => ({ ...current, [appointment.id]: null }));
    try {
      const response = await sendAppointmentConfirmation(appointment.id);
      setResultsByCita((current) => ({ ...current, [appointment.id]: response.notification }));
    } catch (requestError) {
      setResultsByCita((current) => ({
        ...current,
        [appointment.id]: { estado: 'FALLIDA', proveedorReferencia: requestErrorMessage(requestError, 'No fue posible enviar la confirmación.') }
      }));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="whatsapp-panel">
      <div className="whatsapp-panel-heading">
        <div>
          <h2>Citas pendientes de confirmar</h2>
          <p>Se listan las citas activas y futuras del sistema. El mensaje incluye paciente, médico, fecha y hora reales de la cita.</p>
        </div>
        <span className="whatsapp-count">{appointments.length} {appointments.length === 1 ? 'cita' : 'citas'}</span>
      </div>

      {error && <p className="notice error-notice" role="alert">{error}</p>}

      {loading ? (
        <p className="whatsapp-empty">Cargando citas...</p>
      ) : appointments.length === 0 ? (
        <p className="whatsapp-empty">No hay citas activas y futuras para confirmar.</p>
      ) : (
        <div className="whatsapp-table-wrapper">
          <table className="whatsapp-table">
            <thead>
              <tr>
                <th>Fecha y hora</th>
                <th>Paciente</th>
                <th>Teléfono</th>
                <th>Médico</th>
                <th>Estado</th>
                <th>Resultado del envío</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {appointments.map((appointment) => {
                const result = resultsByCita[appointment.id];
                const hasPhone = Boolean(appointment.paciente.telefono);
                return (
                  <tr key={appointment.id}>
                    <td>{formatDateTime(appointment.fechaHoraInicio)}</td>
                    <td>{appointment.paciente.nombre}</td>
                    <td>{hasPhone ? appointment.paciente.telefono : <span className="whatsapp-warning">Sin teléfono</span>}</td>
                    <td>{appointment.medico.nombre}</td>
                    <td>
                      <span className={`whatsapp-status status-${appointment.estado.toLowerCase()}`}>
                        {statusLabels[appointment.estado] || appointment.estado}
                      </span>
                    </td>
                    <td><SendResult result={result} /></td>
                    <td>
                      <Button
                        className="whatsapp-send-button"
                        disabled={busyId === appointment.id || !hasPhone}
                        onClick={() => handleSend(appointment)}
                      >
                        {busyId === appointment.id ? 'Programando...' : 'Programar ahora'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ==========================================
// HU-25: Recordatorio de cita por WhatsApp
// ==========================================

function RemindersPanel() {
  const paginationKey = useListPagination();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [resultsByCita, setResultsByCita] = useState({});
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkSummary, setBulkSummary] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getReminderCandidates();
      setAppointments(response.appointments);
      setSelectedIds(new Set());
      setError('');
    } catch (requestError) {
      setError(requestErrorMessage(requestError, 'No fue posible cargar las citas próximas para recordatorio.'));
    } finally {
      setLoading(false);
    }
  }, [paginationKey]);

  useEffect(() => {
    load();
  }, [load, paginationKey]);

  function toggleSelected(id) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSendOne(appointment) {
    setBusyId(appointment.id);
    setResultsByCita((current) => ({ ...current, [appointment.id]: null }));
    try {
      const response = await sendAppointmentReminder(appointment.id);
      setResultsByCita((current) => ({ ...current, [appointment.id]: response.notification }));
    } catch (requestError) {
      setResultsByCita((current) => ({
        ...current,
        [appointment.id]: { estado: 'FALLIDA', proveedorReferencia: requestErrorMessage(requestError, 'No fue posible enviar el recordatorio.') }
      }));
    } finally {
      setBusyId(null);
    }
  }

  // MED-230: acción de ejecución manual sobre las citas seleccionadas
  // (equivalente al "flujo de ejecución" de recordatorios del MVP).
  async function handleRunSelected() {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    setBulkSummary(null);
    try {
      const summary = await runAppointmentReminders([...selectedIds]);
      setBulkSummary(summary);
      const updates = {};
      summary.resultados.forEach((resultado) => {
        updates[resultado.citaId] = resultado;
      });
      setResultsByCita((current) => ({ ...current, ...updates }));
      setSelectedIds(new Set());
    } catch (requestError) {
      setError(requestErrorMessage(requestError, 'No fue posible ejecutar el envío de recordatorios seleccionados.'));
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <section className="whatsapp-panel">
      <div className="whatsapp-panel-heading">
        <div>
          <h2>Citas próximas (72 horas)</h2>
          <p>Seleccione una o varias citas y envíe el recordatorio, o hágalo individualmente. Las citas canceladas o completadas no aparecen en esta lista.</p>
        </div>
        <span className="whatsapp-count">{appointments.length} {appointments.length === 1 ? 'cita' : 'citas'}</span>
      </div>

      <div className="whatsapp-bulk-actions">
        <Button disabled={selectedIds.size === 0 || bulkBusy} onClick={handleRunSelected}>
          {bulkBusy ? 'Programando recordatorios...' : `Programar recordatorios seleccionados (${selectedIds.size})`}
        </Button>
        {bulkSummary && (
          <span className="whatsapp-bulk-summary">
            {bulkSummary.enviados} programados · {bulkSummary.duplicados} ya enviados antes · {bulkSummary.fallidos} fallidos
          </span>
        )}
      </div>

      {error && <p className="notice error-notice" role="alert">{error}</p>}

      {loading ? (
        <p className="whatsapp-empty">Cargando citas...</p>
      ) : appointments.length === 0 ? (
        <p className="whatsapp-empty">No hay citas próximas en las siguientes 72 horas.</p>
      ) : (
        <div className="whatsapp-table-wrapper">
          <table className="whatsapp-table">
            <thead>
              <tr>
                <th aria-label="Seleccionar" />
                <th>Fecha y hora</th>
                <th>Paciente</th>
                <th>Teléfono</th>
                <th>Médico</th>
                <th>Resultado del envío</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {appointments.map((appointment) => {
                const result = resultsByCita[appointment.id];
                const hasPhone = Boolean(appointment.paciente.telefono);
                return (
                  <tr key={appointment.id}>
                    <td>
                      <input
                        aria-label={`Seleccionar cita de ${appointment.paciente.nombre}`}
                        checked={selectedIds.has(appointment.id)}
                        disabled={busyId === appointment.id}
                        onChange={() => toggleSelected(appointment.id)}
                        type="checkbox"
                      />
                    </td>
                    <td>{formatDateTime(appointment.fechaHoraInicio)}</td>
                    <td>{appointment.paciente.nombre}</td>
                    <td>{hasPhone ? appointment.paciente.telefono : <span className="whatsapp-warning">Sin teléfono</span>}</td>
                    <td>{appointment.medico.nombre}</td>
                    <td>
                      <SendResult result={result} />
                      {!result && appointment.recordatorioYaEnviado && (
                        <span className="whatsapp-duplicate-tag">Ya se envió un recordatorio</span>
                      )}
                    </td>
                    <td>
                      <Button
                        className="whatsapp-send-button"
                        disabled={busyId === appointment.id || bulkBusy || !hasPhone}
                        onClick={() => handleSendOne(appointment)}
                        variant="secondary"
                      >
                        {busyId === appointment.id ? 'Programando...' : 'Programar ahora'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SendResult({ result }) {
  const paginationKey = useListPagination();
  if (!result) return <span className="whatsapp-result-pending">—</span>;

  if (result.duplicado) {
    return <span className="whatsapp-result whatsapp-result-duplicate">Ya se había enviado</span>;
  }

  if (result.estado === 'PENDIENTE') {
    return <span className="whatsapp-result whatsapp-result-pending">Programado para envío</span>;
  }

  if (result.estado === 'ENVIADA' || result.estado === 'ENTREGADA' || result.estado === 'LEIDA') {
    return <span className="whatsapp-result whatsapp-result-success">Enviado correctamente</span>;
  }

  return (
    <span className="whatsapp-result whatsapp-result-error">
      Error: {result.proveedorReferencia || result.error || 'No fue posible enviar el mensaje.'}
    </span>
  );
}

function FailuresPanel() {
  const paginationKey = useListPagination();
  const [failures, setFailures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryingId, setRetryingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getWhatsAppNotificationFailures();
      setFailures(response.failures);
      setError('');
    } catch (requestError) {
      setError(requestErrorMessage(requestError, 'No fue posible cargar los fallos de WhatsApp.'));
    } finally {
      setLoading(false);
    }
  }, [paginationKey]);

  useEffect(() => { load(); }, [load, paginationKey]);

  async function handleRetry(failure) {
    setRetryingId(failure.queueId);
    try {
      await retryWhatsAppNotificationFailure(failure.queueId);
      setFailures((current) => current.filter((item) => item.queueId !== failure.queueId));
    } catch (requestError) {
      setError(requestErrorMessage(requestError, 'No fue posible programar el reintento.'));
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <section className="whatsapp-panel">
      <div className="whatsapp-panel-heading">
        <div>
          <h2>Alertas de envío</h2>
          <p>Estos mensajes agotaron sus reintentos automáticos. Puede programar un nuevo intento sin crear un mensaje duplicado.</p>
        </div>
        <span className="whatsapp-count">{failures.length} {failures.length === 1 ? 'fallo' : 'fallos'}</span>
      </div>

      {error && <p className="notice error-notice" role="alert">{error}</p>}
      {loading ? (
        <p className="whatsapp-empty">Cargando alertas...</p>
      ) : failures.length === 0 ? (
        <p className="whatsapp-empty">No hay notificaciones fallidas.</p>
      ) : (
        <div className="whatsapp-table-wrapper">
          <table className="whatsapp-table">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Tipo</th>
                <th>Cita</th>
                <th>Intentos</th>
                <th>Error</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {failures.map((failure) => (
                <tr key={failure.queueId}>
                  <td>{failure.paciente.nombre}</td>
                  <td>{failure.tipo === 'CONFIRMACION_CITA' ? 'Confirmación' : 'Recordatorio'}</td>
                  <td>{formatDateTime(failure.cita.fechaHoraInicio)}</td>
                  <td>{failure.intentos}/{failure.maxIntentos}</td>
                  <td>{failure.ultimoError || 'Sin detalle disponible'}</td>
                  <td>
                    <Button
                      className="whatsapp-send-button"
                      disabled={retryingId === failure.queueId}
                      onClick={() => handleRetry(failure)}
                      variant="secondary"
                    >
                      {retryingId === failure.queueId ? 'Programando...' : 'Reintentar'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
