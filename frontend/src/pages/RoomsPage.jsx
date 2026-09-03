import React, { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { RoomReservationModal } from '../components/RoomReservationModal';
import { cancelRoomReservation, getRoomReservations, getRooms } from '../services/api';
import '../styles/rooms.css';

function formatDate(isoString) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
}

export function RoomsPage() {
  const [activeTab, setActiveTab] = useState('rooms'); // 'rooms' | 'reservations'
  const [rooms, setRooms] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [selectedType, setSelectedType] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRoomForBooking, setSelectedRoomForBooking] = useState(null);

  async function loadData() {
    setLoading(true);
    try {
      const [roomsData, reservationsData] = await Promise.all([
        getRooms(),
        getRoomReservations()
      ]);
      setRooms(roomsData);
      setReservations(reservationsData);
      setError('');
    } catch (err) {
      setError(err.message || 'No fue posible cargar los datos de salas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCancelReservation(reservationId) {
    if (!window.confirm('¿Está seguro de que desea cancelar esta reserva de sala?')) return;
    try {
      await cancelRoomReservation(reservationId);
      setSuccessMessage('Reserva cancelada exitosamente.');
      loadData();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      setError(err.message || 'No fue posible cancelar la reserva.');
    }
  }

  function handleOpenBooking(room = null) {
    setSelectedRoomForBooking(room);
    setIsModalOpen(true);
  }

  function handleReservationCreated() {
    setSuccessMessage('¡Reserva de sala asignada correctamente!');
    loadData();
    setTimeout(() => setSuccessMessage(''), 4000);
  }

  const filteredRooms = selectedType === 'all'
    ? rooms
    : rooms.filter((r) => r.tipo === selectedType.toUpperCase());

  return (
    <main className="rooms-page">
      <header className="rooms-header">
        <div>
          <span className="login-kicker">Gestión de Infraestructura</span>
          <h1>Salas, Quirófanos y Consultorios</h1>
          <p>Disponibilidad y asignación de espacios físicos a citas médicas (HU-17)</p>
        </div>
        <div className="rooms-actions">
          <Button onClick={() => handleOpenBooking(null)}>+ Nueva Reserva</Button>
        </div>
      </header>

      {successMessage && (
        <div className="history-state" style={{ background: 'var(--color-success-soft)', color: 'var(--color-success)', padding: '12px 20px', borderRadius: '8px', marginBottom: '20px' }}>
          {successMessage}
        </div>
      )}

      {error && (
        <div className="modal-error" style={{ marginBottom: '20px' }}>
          {error}
        </div>
      )}

      <section className="rooms-controls">
        <div className="rooms-tabs">
          <button
            type="button"
            className={`rooms-tab-btn ${activeTab === 'rooms' ? 'active' : ''}`}
            onClick={() => setActiveTab('rooms')}
          >
            🏢 Directorio de Salas ({rooms.length})
          </button>
          <button
            type="button"
            className={`rooms-tab-btn ${activeTab === 'reservations' ? 'active' : ''}`}
            onClick={() => setActiveTab('reservations')}
          >
            📅 Reservas Activas ({reservations.filter((r) => r.estado === 'ACTIVA').length})
          </button>
        </div>

        {activeTab === 'rooms' && (
          <div className="rooms-filters">
            <label htmlFor="filterType" style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-text-secondary)' }}>
              Tipo:
            </label>
            <select
              id="filterType"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="rooms-select"
            >
              <option value="all">Todos los tipos</option>
              <option value="consultorio">Consultorios</option>
              <option value="quirofano">Quirófanos</option>
              <option value="sala">Salas de Procedimientos</option>
            </select>
          </div>
        )}
      </section>

      {loading ? (
        <p className="history-state">Cargando salas e infraestructura...</p>
      ) : activeTab === 'rooms' ? (
        <section className="rooms-grid">
          {filteredRooms.length === 0 ? (
            <p className="attention-empty" style={{ gridColumn: '1 / -1' }}>
              No se encontraron salas registradas con el criterio seleccionado.
            </p>
          ) : (
            filteredRooms.map((room) => {
              const activeRes = reservations.find(
                (res) => res.idSala === room.id && res.estado === 'ACTIVA'
              );
              return (
                <article className="room-card" key={room.id}>
                  <div>
                    <div className="room-card-header">
                      <span className={`room-type-badge ${room.tipo.toLowerCase()}`}>
                        {room.tipo}
                      </span>
                      <span className={`room-status-dot ${room.estado.toLowerCase()}`}>
                        {room.estado}
                      </span>
                    </div>

                    <div className="room-info" style={{ marginTop: '14px' }}>
                      <h3>{room.nombre}</h3>
                      <p>📍 {room.ubicacion || 'Ubicación central'}</p>
                    </div>
                  </div>

                  <div className="room-card-footer">
                    {activeRes ? (
                      <small style={{ color: 'var(--color-text-secondary)' }}>
                        Ocupada hasta {formatDate(activeRes.fechaHoraFin).split(' ')[1]}
                      </small>
                    ) : (
                      <small style={{ color: 'var(--color-success)' }}>
                        ✓ Libre para reservar
                      </small>
                    )}

                    <Button
                      variant="secondary"
                      onClick={() => handleOpenBooking(room)}
                      disabled={room.estado !== 'DISPONIBLE'}
                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                    >
                      Reservar
                    </Button>
                  </div>
                </article>
              );
            })
          )}
        </section>
      ) : (
        <section className="reservations-card">
          <div className="history-section-heading">
            <div>
              <span className="login-kicker">Control de Espacios</span>
              <h2>Historial de Asignaciones y Reservas</h2>
            </div>
          </div>

          {reservations.length === 0 ? (
            <p className="attention-empty">No existen reservas registradas actualmente.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="reservations-table">
                <thead>
                  <tr>
                    <th>Sala / Espacio</th>
                    <th>Tipo</th>
                    <th>Cita / Paciente</th>
                    <th>Médico</th>
                    <th>Horario Inicio</th>
                    <th>Horario Fin</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.map((res) => (
                    <tr key={res.id}>
                      <td><strong>{res.sala?.nombre || `Sala #${res.idSala}`}</strong></td>
                      <td>
                        <span className={`room-type-badge ${(res.sala?.tipo || 'SALA').toLowerCase()}`}>
                          {res.sala?.tipo || 'SALA'}
                        </span>
                      </td>
                      <td>
                        {res.cita?.paciente ? (
                          <div>
                            <div>{res.cita.paciente.nombreCompleto}</div>
                            <small style={{ color: 'var(--color-text-secondary)' }}>CI: {res.cita.paciente.ci}</small>
                          </div>
                        ) : (
                          `Cita #${res.idCita}`
                        )}
                      </td>
                      <td>{res.cita?.medico?.nombreCompleto || '-'}</td>
                      <td>{formatDate(res.fechaHoraInicio)}</td>
                      <td>{formatDate(res.fechaHoraFin)}</td>
                      <td>
                        <span className={`reservation-status-tag ${res.estado.toLowerCase()}`}>
                          {res.estado}
                        </span>
                      </td>
                      <td>
                        {res.estado === 'ACTIVA' && (
                          <Button
                            variant="danger"
                            onClick={() => handleCancelReservation(res.id)}
                            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                          >
                            Cancelar
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <RoomReservationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedRoom={selectedRoomForBooking}
        rooms={rooms}
        onReservationCreated={handleReservationCreated}
      />
    </main>
  );
}
