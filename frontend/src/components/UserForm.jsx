import React, { useState } from 'react';
import { ApiError } from '../services/api';
import { Button } from './Button';
import { Input } from './Input';

const roles = [
  ['ADMINISTRADOR', 'Administrador'],
  ['MEDICO', 'Médico'],
  ['RECEPCIONISTA', 'Recepcionista'],
  ['PACIENTE', 'Paciente']
];

const statuses = [
  ['ACTIVO', 'Activo'],
  ['INACTIVO', 'Inactivo'],
  ['SUSPENDIDO', 'Suspendido']
];

export function UserForm({ initialUser = null, onCancel, onSave }) {
  const editing = Boolean(initialUser);
  const [form, setForm] = useState({
    nombres: initialUser?.nombres || '',
    apellidos: initialUser?.apellidos || '',
    email: initialUser?.email || '',
    telefono: initialUser?.telefono || '',
    password: '',
    rol: initialUser?.rol || 'RECEPCIONISTA',
    estado: initialUser?.estado || 'ACTIVO'
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
            nombres: form.nombres,
            apellidos: form.apellidos,
            telefono: form.telefono,
            rol: form.rol,
            estado: form.estado
          }
        : form;
      await onSave(payload);
    } catch (requestError) {
      setError(requestError instanceof ApiError
        ? requestError.message
        : 'No fue posible guardar el usuario.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="user-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <Input
          id="user-nombres"
          label="Nombres *"
          onChange={(event) => setField('nombres', event.target.value)}
          required
          value={form.nombres}
        />
        <Input
          id="user-apellidos"
          label="Apellidos *"
          onChange={(event) => setField('apellidos', event.target.value)}
          required
          value={form.apellidos}
        />
        {!editing && (
          <Input
            autoComplete="email"
            id="user-email"
            label="Correo electrónico *"
            onChange={(event) => setField('email', event.target.value)}
            required
            type="email"
            value={form.email}
          />
        )}
        <Input
          id="user-telefono"
          label="Teléfono"
          onChange={(event) => setField('telefono', event.target.value)}
          value={form.telefono}
        />
        {!editing && (
          <Input
            autoComplete="new-password"
            id="user-password"
            label="Contraseña *"
            onChange={(event) => setField('password', event.target.value)}
            required
            type="password"
            value={form.password}
          />
        )}
        <div className="form-field">
          <label htmlFor="user-role">Rol *</label>
          <select id="user-role" onChange={(event) => setField('rol', event.target.value)} value={form.rol}>
            {roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        {editing && (
          <div className="form-field">
            <label htmlFor="user-status">Estado *</label>
            <select id="user-status" onChange={(event) => setField('estado', event.target.value)} value={form.estado}>
              {statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        )}
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="form-actions">
        <Button disabled={submitting} onClick={onCancel} variant="secondary">Cancelar</Button>
        <Button disabled={submitting} type="submit">
          {submitting ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear usuario'}
        </Button>
      </div>
    </form>
  );
}
