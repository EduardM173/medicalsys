import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { createRoomReservation, getAvailableRooms } from '../services/api';

export function RoomReservationModal({ isOpen, onClose, selectedRoom, rooms, onReservationCreated }) {
  const [idSala, setIdSala] = useState(selectedRoom?.id || rooms[0]?.id || '');
  const [idCita, setIdCita] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [horaInicio, setHoraInicio] = useState('09:00');
  const [horaFin, setHoraFin] = useState('10:00');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [availableList, setAvailableList] = useState([]);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

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

    if (!idCita.trim()) {
      setError('Debe ingresar el Identificador de la Cita médica.');
      return;
    }
    if (!idSala) {
      setError('Debe seleccionar una sala.');
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
        idCita: idCita.trim(),
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
              <label htmlFor="idCitaInput">ID de Cita Médica *</label>
              <input
                id="idCitaInput"
                type="number"
                min="1"
                required
                placeholder="Ej. 1"
                value={idCita}
                onChange={(e) => setIdCita(e.target.value)}
                className="rooms-input"
              />
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
