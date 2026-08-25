import React, { useState } from 'react';
import { ApiError } from '../services/api';
import { Button } from './Button';
import { Input } from './Input';

const weekDays = [
  [1, 'Lunes'],
  [2, 'Martes'],
  [3, 'Miércoles'],
  [4, 'Jueves'],
  [5, 'Viernes'],
  [6, 'Sábado'],
  [7, 'Domingo']
];

export function ScheduleForm({ initialSchedule = null, doctorName, onCancel, onSave }) {
  const editing = Boolean(initialSchedule);
  const [form, setForm] = useState({
    diaSemana: initialSchedule?.diaSemana || 1,
    horaInicio: initialSchedule?.horaInicio || '08:00',
    horaFin: initialSchedule?.horaFin || '12:00',
    activo: initialSchedule?.activo ?? true
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (form.horaFin <= form.horaInicio) {
      setError('La hora de fin debe ser posterior a la hora de inicio.');
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        diaSemana: Number(form.diaSemana),
        horaInicio: form.horaInicio,
        horaFin: form.horaFin,
        ...(editing ? { activo: form.activo } : {})
      });
    } catch (requestError) {
      setError(requestError instanceof ApiError
        ? requestError.message
        : 'No fue posible guardar el horario.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="schedule-form" onSubmit={handleSubmit}>
      <p className="selected-doctor"><span>Médico</span><strong>{doctorName}</strong></p>
      <div className="schedule-form-grid">
        <div className="form-field">
          <label htmlFor="schedule-day">Día de la semana *</label>
          <select
            id="schedule-day"
            onChange={(event) => setField('diaSemana', event.target.value)}
            value={form.diaSemana}
          >
            {weekDays.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <Input
          id="schedule-start"
          label="Hora de inicio *"
          onChange={(event) => setField('horaInicio', event.target.value)}
          required
          type="time"
          value={form.horaInicio}
        />
        <Input
          id="schedule-end"
          label="Hora de fin *"
          onChange={(event) => setField('horaFin', event.target.value)}
          required
          type="time"
          value={form.horaFin}
        />
        {editing && (
          <div className="form-field">
            <label htmlFor="schedule-active">Estado *</label>
            <select
              id="schedule-active"
              onChange={(event) => setField('activo', event.target.value === 'true')}
              value={String(form.activo)}
            >
              <option value="true">Activo</option>
              <option value="false">Deshabilitado</option>
            </select>
          </div>
        )}
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="form-actions">
        <Button disabled={submitting} onClick={onCancel} variant="secondary">Cancelar</Button>
        <Button disabled={submitting} type="submit">
          {submitting ? 'Guardando...' : editing ? 'Guardar cambios' : 'Guardar horario'}
        </Button>
      </div>
    </form>
  );
}
