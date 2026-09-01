import React, { useEffect, useState } from 'react';
import { AppointmentForm } from '../components/AppointmentForm';
import { Button } from '../components/Button';
import { createAppointment, getAppointments } from '../services/api';
import '../styles/appointments.css';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

const statusLabels = {
  PROGRAMADA: 'Programada',
  CONFIRMADA: 'Confirmada',
  EN_CONSULTA: 'En consulta',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada'
};

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
            {appointments.map((appointment) => (
              <article className="appointment-item" key={appointment.id}>
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
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
