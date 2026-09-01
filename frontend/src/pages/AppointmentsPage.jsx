import React, { useEffect, useState } from 'react';
import { AppointmentForm } from '../components/AppointmentForm';
import { Button } from '../components/Button';
import { ApiError, createAppointment, getAppointments, updateAppointment } from '../services/api';
import '../styles/appointments.css';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function toLocalDateInput(isoDate) {
  const date = new Date(isoDate);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toLocalTimeInput(isoDate) {
  const date = new Date(isoDate);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

const statusLabels = {
  PROGRAMADA: 'Programada',
  CONFIRMADA: 'Confirmada',
  EN_CONSULTA: 'En consulta',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada'
};

// HU-15 / PA-04: transiciones de estado permitidas desde cada estado de la cita.
// Debe reflejar exactamente las transiciones validadas en el backend.
const statusTransitions = {
  PROGRAMADA: ['CONFIRMADA', 'CANCELADA'],
  CONFIRMADA: ['EN_CONSULTA', 'CANCELADA'],
  EN_CONSULTA: ['COMPLETADA', 'CANCELADA'],
  COMPLETADA: [],
  CANCELADA: []
};

const statusActionLabels = {
  CONFIRMADA: 'Confirmar',
  EN_CONSULTA: 'Atender',
  COMPLETADA: 'Completar',
  CANCELADA: 'Cancelar'
};

const terminalStates = ['COMPLETADA', 'CANCELADA'];

function formatTime(isoDate) {
  return new Date(isoDate).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
}

export function AppointmentsPage() {
  const [selectedDate, setSelectedDate] = useState(todayIsoDate());
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showForm, setShowForm] = useState(false);

  // HU-15: id de la cita cuya acción (cambio de estado o reprogramación) está en curso.
  const [busyId, setBusyId] = useState(null);
  // HU-15 / PA-01: id de la cita que actualmente muestra el formulario de reprogramación.
  const [rescheduleId, setRescheduleId] = useState(null);
  const [rescheduleForm, setRescheduleForm] = useState({ fecha: '', horaInicio: '' });

  async function loadAppointments(date) {
    setLoading(true);
    try {
      const response = await getAppointments({ fecha: date });
      setAppointments(response.appointments);
      setError('');
    } catch (requestError) {
      setError(requestError.message || 'No fue posible cargar las citas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAppointments(selectedDate);
  }, [selectedDate]);

  async function saveAppointment(payload) {
    await createAppointment(payload);
    setShowForm(false);
    setNotice('Cita registrada correctamente.');
    await loadAppointments(selectedDate);
  }

  // HU-15 / PA-04 y PA-05: cambia el estado de una cita (incluida la cancelación lógica).
  async function handleStatusChange(appointment, estado) {
    if (estado === 'CANCELADA') {
      const confirmed = window.confirm('¿Confirma que desea cancelar esta cita?');
      if (!confirmed) return;
    }

    setError('');
    setNotice('');
    setBusyId(appointment.id);
    try {
      await updateAppointment(appointment.id, { estado });
      setNotice(
        estado === 'CANCELADA'
          ? 'La cita fue cancelada.'
          : `La cita ahora está en estado "${statusLabels[estado] || estado}".`
      );
      if (rescheduleId === appointment.id) setRescheduleId(null);
      await loadAppointments(selectedDate);
    } catch (requestError) {
      setError(requestError instanceof ApiError
        ? requestError.message
        : 'No fue posible actualizar el estado de la cita.');
    } finally {
      setBusyId(null);
    }
  }

  function openReschedule(appointment) {
    setError('');
    setNotice('');
    setRescheduleId(appointment.id);
    setRescheduleForm({
      fecha: toLocalDateInput(appointment.fechaHoraInicio),
      horaInicio: toLocalTimeInput(appointment.fechaHoraInicio)
    });
  }

  function closeReschedule() {
    setRescheduleId(null);
  }

  // HU-15 / PA-01, PA-02, PA-03: envía la nueva fecha/hora de una cita existente.
  async function submitReschedule(event, appointment) {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusyId(appointment.id);
    try {
      await updateAppointment(appointment.id, rescheduleForm);
      setNotice('La cita fue reprogramada correctamente.');
      setRescheduleId(null);
      await loadAppointments(selectedDate);
    } catch (requestError) {
      // PA-03: si la nueva fecha/hora se solapa con otra cita activa del médico,
      // el backend responde 409 y el mensaje se muestra tal cual al usuario.
      setError(requestError instanceof ApiError
        ? requestError.message
        : 'No fue posible reprogramar la cita.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="appointments-page">
      <header className="appointments-header">
        <div>
          <span className="login-kicker">Agenda</span>
          <h1>Agenda de Citas</h1>
          <p>Programe y consulte las citas médicas registradas.</p>
        </div>
        <Button className="new-appointment-button" onClick={() => { setShowForm(true); setNotice(''); }}>
          + Reservar Cita
        </Button>
      </header>

      <section className="appointment-toolbar" aria-label="Filtro de fecha">
        <label htmlFor="appointment-date-filter">Fecha</label>
        <input
          id="appointment-date-filter"
          onChange={(event) => setSelectedDate(event.target.value)}
          type="date"
          value={selectedDate}
        />
      </section>

      {notice && <p className="notice success-notice">{notice}</p>}
      {error && <p className="notice error-notice" role="alert">{error}</p>}

      {showForm && (
        <AppointmentForm onCancel={() => setShowForm(false)} onSave={saveAppointment} />
      )}

      <section className="appointment-list-card">
        <div className="appointment-list-heading">
          <h2>Citas del {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('es-BO')}</h2>
          <span className="appointment-count">{appointments.length} {appointments.length === 1 ? 'cita' : 'citas'}</span>
        </div>

        {loading ? (
          <p className="appointment-empty">Cargando citas...</p>
        ) : appointments.length === 0 ? (
          <p className="appointment-empty">No hay citas registradas para esta fecha.</p>
        ) : (
          <div className="appointment-list">
            {appointments.map((appointment) => {
              const isBusy = busyId === appointment.id;
              const isTerminal = terminalStates.includes(appointment.estado);
              const nextStates = statusTransitions[appointment.estado] || [];
              const isRescheduling = rescheduleId === appointment.id;

              return (
                <article className="appointment-item" key={appointment.id}>
                  <div className="appointment-row">
                    <div className="appointment-time">
                      <strong>{formatTime(appointment.fechaHoraInicio)}</strong>
                      <span>{formatTime(appointment.fechaHoraFin)}</span>
                    </div>
                    <div className="appointment-info">
                      <strong>{appointment.paciente.nombre}</strong>
                      <span>CI: {appointment.paciente.documentoIdentidad}</span>
                    </div>
                    <div className="appointment-info">
                      <strong>{appointment.medico.nombre}</strong>
                      <span>{appointment.medico.especialidad}</span>
                    </div>
                    <div className="appointment-info">
                      <strong>{appointment.servicio.nombre}</strong>
                      <span>{appointment.motivo}</span>
                    </div>
                    <span className={`appointment-status status-${appointment.estado.toLowerCase()}`}>
                      {statusLabels[appointment.estado] || appointment.estado}
                    </span>
                  </div>

                  {!isTerminal && (
                    <div className="appointment-actions">
                      <span className="appointment-actions-label">Cambiar estado:</span>
                      {nextStates.map((targetState) => (
                        <button
                          className={`appointment-action-button action-${targetState.toLowerCase()}`}
                          disabled={isBusy}
                          key={targetState}
                          onClick={() => handleStatusChange(appointment, targetState)}
                          type="button"
                        >
                          {statusActionLabels[targetState] || targetState}
                        </button>
                      ))}
                      <button
                        className="appointment-action-button action-reschedule"
                        disabled={isBusy}
                        onClick={() => (isRescheduling ? closeReschedule() : openReschedule(appointment))}
                        type="button"
                      >
                        {isRescheduling ? 'Cerrar' : 'Reprogramar'}
                      </button>
                    </div>
                  )}

                  {isRescheduling && (
                    <form
                      className="reschedule-form"
                      onSubmit={(event) => submitReschedule(event, appointment)}
                    >
                      <div className="form-field">
                        <label htmlFor={`reschedule-date-${appointment.id}`}>Nueva fecha</label>
                        <input
                          id={`reschedule-date-${appointment.id}`}
                          min={todayIsoDate()}
                          onChange={(event) => setRescheduleForm((current) => ({ ...current, fecha: event.target.value }))}
                          required
                          type="date"
                          value={rescheduleForm.fecha}
                        />
                      </div>
                      <div className="form-field">
                        <label htmlFor={`reschedule-time-${appointment.id}`}>Nueva hora</label>
                        <input
                          id={`reschedule-time-${appointment.id}`}
                          onChange={(event) => setRescheduleForm((current) => ({ ...current, horaInicio: event.target.value }))}
                          required
                          type="time"
                          value={rescheduleForm.horaInicio}
                        />
                      </div>
                      <div className="reschedule-form-actions">
                        <Button disabled={isBusy} onClick={closeReschedule} type="button" variant="secondary">
                          Cancelar
                        </Button>
                        <Button disabled={isBusy} type="submit">
                          {isBusy ? 'Guardando...' : 'Guardar nueva fecha'}
                        </Button>
                      </div>
                    </form>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
