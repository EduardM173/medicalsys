import React, { useState } from 'react';
import { ApiError } from '../services/api';
import { Button } from './Button';
import { Input } from './Input';

export function DoctorForm({ availableUsers = [], initialDoctor = null, onCancel, onSave }) {
  const editing = Boolean(initialDoctor);
  const [form, setForm] = useState({
    usuarioId: editing ? initialDoctor.usuarioId : (availableUsers[0]?.id || ''),
    matriculaProfesional: initialDoctor?.matriculaProfesional || '',
    especialidad: initialDoctor?.especialidad || '',
    activo: initialDoctor?.activo ?? true
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = editing
        ? {
            matriculaProfesional: form.matriculaProfesional,
            especialidad: form.especialidad,
            activo: form.activo
          }
        : {
            usuarioId: Number(form.usuarioId),
            matriculaProfesional: form.matriculaProfesional,
            especialidad: form.especialidad
          };
      await onSave(payload);
    } catch (requestError) {
      setError(requestError instanceof ApiError
        ? requestError.message
        : 'No fue posible completar la operación.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="doctor-form" onSubmit={handleSubmit}>
      {editing ? (
        <div className="doctor-user-summary">
          <div><span>Usuario médico</span><strong>{initialDoctor.nombreCompleto}</strong></div>
          <div><span>Correo</span><strong>{initialDoctor.usuario.email}</strong></div>
        </div>
      ) : (
        <div className="form-field">
          <label htmlFor="doctor-user">Usuario médico *</label>
          <select
            disabled={availableUsers.length === 0}
            id="doctor-user"
            onChange={(event) => setField('usuarioId', event.target.value)}
            required
            value={form.usuarioId}
          >
            {availableUsers.length === 0 && <option value="">No hay usuarios MEDICO disponibles</option>}
            {availableUsers.map((user) => (
              <option key={user.id} value={user.id}>{user.nombres} {user.apellidos} — {user.email}</option>
            ))}
          </select>
        </div>
      )}

      <div className="doctor-form-grid">
        <Input
          id="doctor-license"
          label="Matrícula profesional *"
          onChange={(event) => setField('matriculaProfesional', event.target.value)}
          required
          value={form.matriculaProfesional}
        />
        <Input
          id="doctor-specialty"
          label="Especialidad *"
          onChange={(event) => setField('especialidad', event.target.value)}
          required
          value={form.especialidad}
        />
        {editing && (
          <div className="form-field">
            <label htmlFor="doctor-status">Estado *</label>
            <select id="doctor-status" onChange={(event) => setField('activo', event.target.value === 'true')} value={String(form.activo)}>
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </div>
        )}
      </div>

      {!editing && availableUsers.length === 0 && (
        <p className="form-help">Cree primero un usuario con rol MEDICO desde Gestión de Usuarios.</p>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="form-actions">
        <Button disabled={submitting} onClick={onCancel} variant="secondary">Cancelar</Button>
        <Button disabled={submitting || (!editing && availableUsers.length === 0)} type="submit">
          {submitting ? 'Guardando...' : editing ? 'Guardar cambios' : 'Registrar médico'}
        </Button>
      </div>
    </form>
  );
}
