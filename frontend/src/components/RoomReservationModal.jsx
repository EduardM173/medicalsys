import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { createRoomReservation, getAvailableRooms, getPendingAppointments } from '../services/api';

export function RoomReservationModal({ isOpen, onClose, selectedRoom, rooms, onReservationCreated }) {
  const [appointments, setAppointments] = useState([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [idCita, setIdCita] = useState('');
  const [idSala, setIdSala] = useState(selectedRoom?.id || rooms[0]?.id || '');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [horaInicio, setHoraInicio] = useState('09:00');
  const [horaFin, setHoraFin] = useState('10:00');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [availableList, setAvailableList] = useState([]);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  // Cargar citas programadas al abrir el modal
  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    async function loadAppts() {
      setLoadingAppointments(true);
      try {
        const appts = await getPendingAppointments();
        if (active) {
          setAppointments(appts);
          // Si hay citas, preseleccionar la primera cita que no tenga reserva activa
          const unassigned = appts.filter((a) => !a.reserva || a.reserva.estado !== 'ACTIVA');
          if (unassigned.length > 0) {
            selectAppointment(unassigned[0]);
          } else if (appts.length > 0) {
            selectAppointment(appts[0]);
          }
        }
      } catch (_err) {
        // Silenciar error en carga inicial
      } finally {
        if (active) setLoadingAppointments(false);
      }
    }

    loadAppts();
    return () => { active = false; };
  }, [isOpen]);

  function selectAppointment(appt) {
    if (!appt) return;
    setIdCita(appt.id);
    if (appt.fechaHoraInicio && appt.fechaHoraFin) {
      const startDate = new Date(appt.fechaHoraInicio);
      const endDate = new Date(appt.fechaHoraFin);
      setFecha(startDate.toISOString().slice(0, 10));
      setHoraInicio(startDate.toTimeString().slice(0, 5));
      setHoraFin(endDate.toTimeString().slice(0, 5));
    }
  }

  function handleAppointmentChange(e) {
    const val = e.target.value;
    setIdCita(val);
    const selected = appointments.find((a) => a.id === val);
    if (selected) {
      selectAppointment(selected);
    }
  }

  useEffect(() => {
    if (selectedRoom) {
      setIdSala(selectedRoom.id);
    } else if (rooms.length > 0 && !idSala) {
      setIdSala(rooms[0].id);
    }
  }, [selectedRoom, rooms]);

  // Verificar disponibilidad en tiempo real cuando cambian las horas
  useEffect(() => {
    if (!fecha || !horaInicio || !horaFin) return;
    const startIso = `${fecha}T${horaInicio}:00.000Z`;
    const endIso = `${fecha}T${horaFin}:00.000Z`;

    if (new Date(endIso) <= new Date(startIso)) return;

    let active = true;
    async function check() {
      setCheckingAvailability(true);
      try {
        const available = await getAvailableRooms({
          fechaHoraInicio: startIso,
          fechaHoraFin: endIso
        });
        if (active) {
          setAvailableList(available);
        }
      } catch (_err) {
        // Silenciar error en verificación predictiva
      } finally {
        if (active) setCheckingAvailability(false);
      }
    }

    check();
    return () => { active = false; };
  }, [fecha, horaInicio, horaFin]);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!idCita) {
      setError('Debe seleccionar o ingresar una Cita médica válida.');
      return;
    }
    if (!idSala) {
      setError('Debe seleccionar una sala disponible.');
      return;
    }

    const startIso = `${fecha}T${horaInicio}:00.000Z`;
    const endIso = `${fecha}T${horaFin}:00.000Z`;

    if (new Date(endIso) <= new Date(startIso)) {
      setError('La hora de fin debe ser posterior a la hora de inicio.');
      return;
    }

    setLoading(true);
    try {
      await createRoomReservation({
        idCita,
        idSala,
        fechaHoraInicio: startIso,
        fechaHoraFin: endIso
      });
      onReservationCreated();
      onClose();
    } catch (err) {
      setError(err.message || 'No fue posible crear la reserva.');
    } finally {
      setLoading(false);
    }
  }

  const isSelectedRoomAvailable = availableList.some((r) => r.id === idSala);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="modal-header">
          <div>
            <span className="login-kicker">Gestión de Espacios</span>
            <h2>Reservar Sala o Quirófano</h2>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Cerrar">
            &times;
          </button>
        </header>

        {error && <div className="modal-error" role="alert">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="modal-field">
              <label htmlFor="idCitaSelect">
                Cita Médica Programada * {loadingAppointments && <small>(Cargando citas...)</small>}
              </label>

              {appointments.length > 0 ? (
                <select
                  id="idCitaSelect"
                  value={idCita}
                  onChange={handleAppointmentChange}
                  className="rooms-select"
                  required
                >
                  <option value="">-- Seleccionar Cita Médica --</option>
                  {appointments.map((appt) => {
                    const hasRoom = appt.reserva && appt.reserva.estado === 'ACTIVA';
                    return (
                      <option key={appt.id} value={appt.id}>
                        Cita #{appt.id} — {appt.paciente?.nombreCompleto || 'Paciente'} • {appt.medico?.nombreCompleto || 'Médico'} • {appt.servicio?.nombre || 'Consulta'} {hasRoom ? `[Ya en ${appt.reserva.salaNombre}]` : '(Sin sala)'}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <input
                  id="idCitaInput"
                  type="number"
                  min="1"
                  required
                  placeholder="ID numérico de la cita (ej. 1)"
                  value={idCita}
                  onChange={(e) => setIdCita(e.target.value)}
                  className="rooms-input"
                />
              )}
            </div>

            <div className="modal-field">
              <label htmlFor="idSalaSelect">
                Sala / Quirófano * {checkingAvailability && <small>(Verificando...)</small>}
              </label>
              <select
                id="idSalaSelect"
                value={idSala}
                onChange={(e) => setIdSala(e.target.value)}
                className="rooms-select"
                required
              >
                {rooms.map((room) => {
                  const isAvail = availableList.some((r) => r.id === room.id);
                  return (
                    <option key={room.id} value={room.id}>
                      {room.nombre} ({room.tipo}) - {isAvail ? '✓ Disponible' : '⚠ Ocupada/No disponible'}
                    </option>
                  );
                })}
              </select>
              {!checkingAvailability && availableList.length > 0 && !isSelectedRoomAvailable && (
                <small style={{ color: 'var(--color-danger)' }}>
                  ⚠ La sala seleccionada tiene un solapamiento en ese horario.
                </small>
              )}
            </div>

            <div className="modal-field">
              <label htmlFor="fechaInput">Fecha *</label>
              <input
                id="fechaInput"
                type="date"
                required
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="rooms-input"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="modal-field">
                <label htmlFor="horaInicioInput">Hora Inicio *</label>
                <input
                  id="horaInicioInput"
                  type="time"
                  required
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                  className="rooms-input"
                />
              </div>
              <div className="modal-field">
                <label htmlFor="horaFinInput">Hora Fin *</label>
                <input
                  id="horaFinInput"
                  type="time"
                  required
                  value={horaFin}
                  onChange={(e) => setHoraFin(e.target.value)}
                  className="rooms-input"
                />
              </div>
            </div>
          </div>

          <footer className="modal-footer">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Asignando...' : 'Confirmar Reserva'}
            </Button>
          </footer>
        </form>
      </div>
    </div>
  );
}
