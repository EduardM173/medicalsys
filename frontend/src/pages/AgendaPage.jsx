import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getMyAgenda } from '../services/api';
import '../styles/agenda.css';

const statusLabels = {
  PROGRAMADA: 'Programada',
  CONFIRMADA: 'Confirmada',
  EN_CONSULTA: 'En consulta',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada'
};

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === value;
}

function getToday() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/La_Paz',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(new Date());
}

function formatDate(value) {
  if (!isValidDate(value)) return 'Seleccione una fecha válida';
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('es-BO', { dateStyle: 'full' })
    .format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function formatTime(value) {
  return new Intl.DateTimeFormat('es-BO', {
    timeZone: 'America/La_Paz',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(value));
}

function changeDate(value, days) {
  const safeValue = isValidDate(value) ? value : getToday();
  const [year, month, day] = safeValue.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

export function AgendaPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(() => {
    const queryDate = searchParams.get('date');
    return isValidDate(queryDate) ? queryDate : getToday();
  });
  const [agenda, setAgenda] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadAgenda() {
      if (!isValidDate(selectedDate)) {
        setAgenda(null);
        setError('La fecha seleccionada no es válida.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const response = await getMyAgenda(selectedDate);
        if (active) setAgenda(response);
      } catch (requestError) {
        if (!active) return;
        setAgenda(null);
        if (requestError.status === 400) {
          setError('La fecha seleccionada no es válida.');
        } else if (requestError.status === 403) {
          setError('No tiene permisos para consultar esta agenda.');
        } else {
          setError('No fue posible cargar la agenda médica.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadAgenda();
    return () => { active = false; };
  }, [selectedDate]);

  const activeCount = useMemo(
    () => agenda?.appointments.filter((appointment) => appointment.status !== 'CANCELADA').length || 0,
    [agenda]
  );

  function selectDate(value) {
    setSelectedDate(value);
    if (isValidDate(value)) {
      setSearchParams({ date: value }, { replace: true });
    }
  }

  return (
    <main className="agenda-page">
      <header className="agenda-header">
        <div>
          <span className="login-kicker">Agenda personal</span>
          <h1>Agenda Médica</h1>
          <p>Consulta de citas programadas</p>
        </div>
        {agenda?.doctor && (
          <div className="agenda-doctor" aria-label="Médico autenticado">
            <span className="agenda-doctor-avatar" aria-hidden="true">
              {agenda.doctor.name.split(' ').slice(0, 2).map((word) => word.charAt(0)).join('')}
            </span>
            <span><strong>{agenda.doctor.name}</strong><small>{agenda.doctor.specialty}</small></span>
          </div>
        )}
      </header>

      <section className="agenda-date-card" aria-label="Seleccionar fecha de agenda">
        <button aria-label="Día anterior" onClick={() => selectDate(changeDate(selectedDate, -1))} type="button">‹</button>
        <label htmlFor="agenda-date">
          <span>Fecha consultada</span>
          <input
            id="agenda-date"
            onChange={(event) => selectDate(event.target.value)}
            type="date"
            value={selectedDate}
          />
        </label>
        <button aria-label="Día siguiente" onClick={() => selectDate(changeDate(selectedDate, 1))} type="button">›</button>
        <div className="agenda-date-summary">
          <strong>{formatDate(selectedDate)}</strong>
          <small>{loading ? 'Consultando...' : `${activeCount} ${activeCount === 1 ? 'cita activa' : 'citas activas'}`}</small>
        </div>
      </section>

      {error && <p className="notice error-notice agenda-notice" role="alert">{error}</p>}

      <section className="agenda-list-card" aria-labelledby="agenda-list-title">
        <div className="agenda-section-heading">
          <div>
            <span className="login-kicker">Agenda del día</span>
            <h2 id="agenda-list-title">Citas programadas</h2>
          </div>
          {agenda && <span className="agenda-total">{agenda.appointments.length} en total</span>}
        </div>

        {loading ? (
          <p className="agenda-empty">Cargando agenda médica...</p>
        ) : agenda?.appointments.length === 0 ? (
          <p className="agenda-empty">No hay citas programadas para esta fecha.</p>
        ) : agenda ? (
          <div className="agenda-list">
            {agenda.appointments.map((appointment) => {
              const cancelled = appointment.status === 'CANCELADA';
              return (
                <article className={`agenda-appointment${cancelled ? ' cancelled' : ''}`} key={appointment.id}>
                  <time dateTime={appointment.startTime}>{formatTime(appointment.startTime)}</time>
                  <div className="agenda-appointment-main">
                    <strong>{appointment.patient.fullName}</strong>
                    <span>{appointment.service.name}</span>
                    {appointment.reason && <small>{appointment.reason}</small>}
                  </div>
                  <div className="agenda-appointment-end">
                    <span>Hasta {formatTime(appointment.endTime)}</span>
                    <span className={`agenda-status status-${appointment.status.toLowerCase()}`}>
                      {statusLabels[appointment.status] || appointment.status}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </main>
  );
}
