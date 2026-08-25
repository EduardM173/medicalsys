import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/Button';
import { ScheduleForm } from '../components/ScheduleForm';
import {
  createSchedule,
  getDoctors,
  getDoctorSchedules,
  updateSchedule
} from '../services/api';
import '../styles/schedules.css';

const weekDays = [
  [1, 'Lunes'],
  [2, 'Martes'],
  [3, 'Miércoles'],
  [4, 'Jueves'],
  [5, 'Viernes'],
  [6, 'Sábado'],
  [7, 'Domingo']
];

export function SchedulesPage() {
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [schedules, setSchedules] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [formMode, setFormMode] = useState(null);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const selectedDoctor = doctors.find((doctor) => String(doctor.id) === selectedDoctorId);
  const schedulesByDay = useMemo(() => weekDays.map(([day, label]) => ({
    day,
    label,
    schedules: schedules.filter((schedule) => schedule.diaSemana === day)
  })), [schedules]);

  async function loadDoctors() {
    try {
      const response = await getDoctors();
      setDoctors(response.doctors);
      setSelectedDoctorId((current) => current || String(response.doctors[0]?.id || ''));
      setError('');
    } catch (requestError) {
      setError(requestError.message || 'No fue posible cargar los médicos.');
    } finally {
      setLoadingDoctors(false);
    }
  }

  async function loadSchedules(doctorId) {
    if (!doctorId) {
      setSchedules([]);
      return;
    }
    setLoadingSchedules(true);
    try {
      const response = await getDoctorSchedules(doctorId);
      setSchedules(response.schedules);
      setError('');
    } catch (requestError) {
      setError(requestError.message || 'No fue posible cargar los horarios.');
    } finally {
      setLoadingSchedules(false);
    }
  }

  useEffect(() => {
    loadDoctors();
  }, []);

  useEffect(() => {
    loadSchedules(selectedDoctorId);
  }, [selectedDoctorId]);

  function changeDoctor(event) {
    setSelectedDoctorId(event.target.value);
    setFormMode(null);
    setEditingSchedule(null);
    setNotice('');
  }

  function openCreateForm() {
    setEditingSchedule(null);
    setFormMode('create');
    setNotice('');
  }

  function openEditForm(schedule) {
    setEditingSchedule(schedule);
    setFormMode('edit');
    setNotice('');
  }

  async function saveSchedule(payload) {
    if (formMode === 'edit') {
      await updateSchedule(editingSchedule.id, payload);
      setNotice('Horario actualizado correctamente.');
    } else {
      await createSchedule(selectedDoctorId, payload);
      setNotice('Horario registrado correctamente.');
    }
    setFormMode(null);
    setEditingSchedule(null);
    await loadSchedules(selectedDoctorId);
  }

  async function toggleSchedule(schedule) {
    setError('');
    setNotice('');
    try {
      await updateSchedule(schedule.id, { activo: !schedule.activo });
      setNotice(schedule.activo ? 'Horario deshabilitado correctamente.' : 'Horario habilitado correctamente.');
      await loadSchedules(selectedDoctorId);
    } catch (requestError) {
      setError(requestError.message || 'No fue posible cambiar el estado del horario.');
    }
  }

  return (
    <main className="schedules-page">
      <header className="schedule-header">
        <div>
          <span className="login-kicker">Administración</span>
          <h1>Configuración de Horarios Médicos</h1>
          <p>Defina los días y horarios disponibles para cada médico.</p>
        </div>
        <Button
          className="new-schedule-button"
          disabled={!selectedDoctorId}
          onClick={openCreateForm}
        >
          + Agregar horario
        </Button>
      </header>

      <section className="doctor-selector-card" aria-label="Selección de médico">
        <div>
          <label htmlFor="doctor-select">Médico</label>
          <p>Seleccione un profesional para administrar su disponibilidad.</p>
        </div>
        <select
          disabled={loadingDoctors || doctors.length === 0}
          id="doctor-select"
          onChange={changeDoctor}
          value={selectedDoctorId}
        >
          {doctors.length === 0 && <option value="">No hay médicos disponibles</option>}
          {doctors.map((doctor) => (
            <option key={doctor.id} value={doctor.id}>
              {doctor.nombre} — {doctor.especialidad}
            </option>
          ))}
        </select>
      </section>

      {notice && <p className="notice success-notice">{notice}</p>}
      {error && <p className="notice error-notice" role="alert">{error}</p>}

      {formMode && selectedDoctor && (
        <section className="schedule-form-panel" aria-label={formMode === 'edit' ? 'Editar horario' : 'Nuevo horario'}>
          <div className="schedule-panel-heading">
            <div>
              <span className="login-kicker">{formMode === 'edit' ? 'Edición' : 'Nueva disponibilidad'}</span>
              <h2>{formMode === 'edit' ? 'Editar horario' : 'Agregar horario'}</h2>
            </div>
            <button aria-label="Cerrar formulario" className="panel-close" onClick={() => setFormMode(null)} type="button">×</button>
          </div>
          <ScheduleForm
            key={editingSchedule?.id || 'new'}
            doctorName={selectedDoctor.nombre}
            initialSchedule={editingSchedule}
            onCancel={() => setFormMode(null)}
            onSave={saveSchedule}
          />
        </section>
      )}

      <section className="weekly-schedule-card">
        <div className="weekly-heading">
          <div>
            <h2>Disponibilidad semanal</h2>
            <p>{selectedDoctor ? `${selectedDoctor.nombre} · ${selectedDoctor.especialidad}` : 'Seleccione un médico'}</p>
          </div>
          <span className="schedule-count">{schedules.length} {schedules.length === 1 ? 'horario' : 'horarios'}</span>
        </div>

        {loadingDoctors || loadingSchedules ? (
          <p className="schedule-empty">Cargando disponibilidad...</p>
        ) : !selectedDoctor ? (
          <p className="schedule-empty">No existen médicos activos para configurar.</p>
        ) : (
          <div className="week-list">
            {schedulesByDay.map(({ day, label, schedules: daySchedules }) => (
              <article className="day-row" key={day}>
                <div className="day-name"><span>{label.slice(0, 3)}</span><strong>{label}</strong></div>
                <div className="day-schedules">
                  {daySchedules.length === 0 ? (
                    <p className="day-empty">Sin disponibilidad configurada</p>
                  ) : daySchedules.map((schedule) => (
                    <div className={`schedule-item${schedule.activo ? '' : ' disabled'}`} key={schedule.id}>
                      <strong>{schedule.horaInicio} – {schedule.horaFin}</strong>
                      <span className={`schedule-status ${schedule.activo ? 'active' : 'inactive'}`}>
                        {schedule.activo ? 'Activo' : 'Deshabilitado'}
                      </span>
                      <div className="schedule-actions">
                        <button className="text-action" onClick={() => openEditForm(schedule)} type="button">Editar</button>
                        <button className="text-action state-action" onClick={() => toggleSchedule(schedule)} type="button">
                          {schedule.activo ? 'Deshabilitar' : 'Habilitar'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
