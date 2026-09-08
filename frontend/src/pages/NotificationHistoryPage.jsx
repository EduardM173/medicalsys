import React, { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { PageContext } from '../components/PageContext';
import { ApiError, getAppointments, getNotificationHistory, getPatients } from '../services/api';
import '../styles/notification-history.css';

const typeLabels = {
  CONFIRMACION_CITA: 'Confirmación de cita',
  RECORDATORIO_CITA: 'Recordatorio de cita'
};
const statusLabels = {
  PENDIENTE: 'Pendiente',
  ENVIADA: 'Enviada',
  ENTREGADA: 'Entregada',
  LEIDA: 'Leída',
  FALLIDA: 'Fallida'
};

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/La_Paz'
  }).format(new Date(value));
}

function displayDate(notification) {
  if (notification.fechaEnvio) return { value: notification.fechaEnvio, label: 'Enviada' };
  if (notification.fechaProgramada) return { value: notification.fechaProgramada, label: 'Programada' };
  return { value: notification.fechaCreacion, label: 'Registrada' };
}

function historyError(error) {
  if (error instanceof ApiError && error.status === 403) return 'No tiene permisos para consultar el historial de notificaciones.';
  if (error instanceof ApiError && error.status === 404) return error.message || 'Paciente no encontrado.';
  if (error instanceof ApiError && error.status === 400) return error.message;
  return 'No fue posible cargar el historial de notificaciones.';
}

export function NotificationHistoryPage() {
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [filters, setFilters] = useState({ patientId: '', appointmentId: '' });
  const [result, setResult] = useState(null);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getPatients()
      .then((response) => { if (active) setPatients(response.patients); })
      .catch(() => { if (active) setError('No fue posible cargar el historial de notificaciones.'); })
      .finally(() => { if (active) setLoadingPatients(false); });
    return () => { active = false; };
  }, []);

  async function changePatient(event) {
    const patientId = event.target.value;
    setFilters({ patientId, appointmentId: '' });
    setAppointments([]);
    setResult(null);
    setError('');
    if (!patientId) return;
    setLoadingAppointments(true);
    try {
      const response = await getAppointments({ pacienteId: patientId });
      setAppointments(response.appointments);
    } catch {
      setError('No fue posible cargar las citas del paciente.');
    } finally {
      setLoadingAppointments(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (!filters.patientId) return;
    setLoadingHistory(true);
    setError('');
    try {
      setResult(await getNotificationHistory(filters));
    } catch (requestError) {
      setResult(null);
      setError(historyError(requestError));
    } finally {
      setLoadingHistory(false);
    }
  }

  const notifications = result?.notifications || [];
  return (
    <main className="notification-history-page">
      <PageContext
        breadcrumbs={[{ label: 'Inicio', to: '/dashboard' }, { label: 'Historial de notificaciones' }]}
        title="Historial de notificaciones"
        subtitle="Confirmaciones y recordatorios enviados a pacientes"
      />

      <form className="ui-card notification-history-filters" onSubmit={submit}>
        <label>Paciente *
          <select aria-label="Paciente" disabled={loadingPatients} required value={filters.patientId} onChange={changePatient}>
            <option value="">{loadingPatients ? 'Cargando pacientes...' : 'Seleccione un paciente'}</option>
            {patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.apellidos} {patient.nombres} · CI {patient.documentoIdentidad}</option>)}
          </select>
        </label>
        <label>Cita (opcional)
          <select aria-label="Cita opcional" disabled={!filters.patientId || loadingAppointments} value={filters.appointmentId} onChange={(event) => setFilters({ ...filters, appointmentId: event.target.value })}>
            <option value="">{loadingAppointments ? 'Cargando citas...' : 'Todas las citas'}</option>
            {appointments.map((appointment) => <option key={appointment.id} value={appointment.id}>{formatDate(appointment.fechaHoraInicio)} · {appointment.servicio.nombre}</option>)}
          </select>
        </label>
        <Button disabled={!filters.patientId || loadingHistory || loadingAppointments} type="submit">
          {loadingHistory ? 'Consultando...' : 'Consultar historial'}
        </Button>
      </form>

      {error && <p className="notice error-notice notification-history-notice" role="alert">{error}</p>}

      {!filters.patientId ? (
        <section className="ui-card notification-history-empty">Seleccione un paciente para consultar su historial.</section>
      ) : loadingHistory ? (
        <section className="ui-card notification-history-empty">Cargando historial de notificaciones...</section>
      ) : result ? (
        <>
          <section className="ui-card notification-patient-summary">
            <div><span>Paciente</span><strong>{result.patient.fullName}</strong></div>
            <div><span>Documento</span><strong>{result.patient.document}</strong></div>
            <div><span>Registros</span><strong>{notifications.length}</strong></div>
          </section>
          <section className="ui-card notification-history-card">
            <div className="notification-history-heading"><div><h2>Historial</h2><p>Ordenado desde el registro más reciente.</p></div><span>{notifications.length}</span></div>
            {notifications.length === 0 ? (
              <p className="notification-history-empty-inline">{filters.appointmentId ? 'No hay notificaciones registradas para esta cita.' : 'No hay notificaciones registradas para este paciente.'}</p>
            ) : (
              <div className="notification-history-table-wrap"><table className="notification-history-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Cita</th><th>Canal / destino</th><th>Resultado</th><th>Mensaje</th></tr></thead><tbody>
                {notifications.map((notification) => {
                  const date = displayDate(notification);
                  return <tr key={notification.id}>
                    <td><strong>{formatDate(date.value)}</strong><small>{date.label}</small></td>
                    <td><span className={`notification-type type-${notification.tipo.toLowerCase()}`}>{typeLabels[notification.tipo] || notification.tipo}</span></td>
                    <td>{notification.cita ? <><strong>#{notification.cita.id}</strong><small>{formatDate(notification.cita.fechaHoraInicio)}</small></> : '—'}</td>
                    <td><strong>{notification.canal}</strong><small>{notification.telefonoDestino}</small></td>
                    <td><span className={`notification-result result-${notification.estado.toLowerCase()}`}>{statusLabels[notification.estado] || notification.estado}</span></td>
                    <td className="notification-message">{notification.mensaje}</td>
                  </tr>;
                })}
              </tbody></table></div>
            )}
          </section>
        </>
      ) : (
        <section className="ui-card notification-history-empty">Seleccione los filtros y consulte el historial.</section>
      )}
    </main>
  );
}
