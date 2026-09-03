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

const passwordRequirements = [
  { id: 'length', label: 'Al menos 12 caracteres', test: (value) => value.length >= 12 },
  { id: 'lowercase', label: 'Una letra minúscula', test: (value) => /[a-z]/.test(value) },
  { id: 'uppercase', label: 'Una letra mayúscula', test: (value) => /[A-Z]/.test(value) },
  { id: 'number', label: 'Un número', test: (value) => /\d/.test(value) },
  { id: 'symbol', label: 'Un símbolo', test: (value) => /[^A-Za-z0-9]/.test(value) },
  { id: 'spaces', label: 'Sin espacios', test: (value) => !/\s/.test(value) }
];

function getPasswordStrength(password, completedRequirements) {
  if (!password) return { label: 'Sin contraseña', level: 0 };
  if (completedRequirements <= 2) return { label: 'Débil', level: 1 };
  if (completedRequirements <= 4) return { label: 'Media', level: 2 };
  if (password.length < 16) return { label: 'Fuerte', level: 3 };
  return { label: 'Muy fuerte', level: 4 };
}

export function UserForm({ initialUser = null, onCancel, onSave }) {
  const editing = Boolean(initialUser);
  const [form, setForm] = useState({
    nombres: initialUser?.nombres || '',
    apellidos: initialUser?.apellidos || '',
    email: initialUser?.email || '',
    telefono: initialUser?.telefono || '',
    password: '',
    passwordConfirmation: '',
    rol: initialUser?.rol || 'RECEPCIONISTA',
    estado: initialUser?.estado || 'ACTIVO'
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);

  const completedRequirements = passwordRequirements
    .filter((requirement) => requirement.test(form.password))
    .length;
  const passwordStrength = getPasswordStrength(form.password, completedRequirements);
  const passwordIsValid = completedRequirements === passwordRequirements.length;
  const passwordsMatch = form.passwordConfirmation === form.password;

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!editing && !passwordIsValid) {
      setError('La contraseña no cumple todos los requisitos de seguridad.');
      return;
    }
    if (!editing && !passwordsMatch) {
      setError('Las contraseñas no coinciden.');
      return;
    }
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
          <div className="password-setup">
            <div className="form-field password-input-field">
              <label htmlFor="user-password">Contraseña *</label>
              <input
                autoComplete="new-password"
                id="user-password"
                maxLength="128"
                onChange={(event) => setField('password', event.target.value)}
                required
                type={showPassword ? 'text' : 'password'}
                value={form.password}
              />
              <button
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="user-password-toggle"
                onClick={() => setShowPassword((visible) => !visible)}
                type="button"
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <div aria-live="polite" className="password-strength">
              <div className="password-strength-heading">
                <span>Seguridad de la contraseña</span>
                <strong>{passwordStrength.label}</strong>
              </div>
              <div aria-label={`Fortaleza: ${passwordStrength.label}`} className="password-strength-bar" role="progressbar" aria-valuemax="4" aria-valuemin="0" aria-valuenow={passwordStrength.level}>
                <span className={`password-strength-fill strength-${passwordStrength.level}`} />
              </div>
              <ul className="password-requirements">
                {passwordRequirements.map((requirement) => {
                  const completed = requirement.test(form.password);
                  return <li className={completed ? 'completed' : ''} key={requirement.id}>{completed ? '✓' : '○'} {requirement.label}</li>;
                })}
              </ul>
            </div>
            <div className="form-field password-input-field">
              <label htmlFor="user-password-confirmation">Confirmar contraseña *</label>
              <input
                autoComplete="new-password"
                id="user-password-confirmation"
                maxLength="128"
                onChange={(event) => setField('passwordConfirmation', event.target.value)}
                required
                type={showPasswordConfirmation ? 'text' : 'password'}
                value={form.passwordConfirmation}
              />
              <button
                aria-label={showPasswordConfirmation ? 'Ocultar confirmación de contraseña' : 'Mostrar confirmación de contraseña'}
                className="user-password-toggle"
                onClick={() => setShowPasswordConfirmation((visible) => !visible)}
                type="button"
              >
                {showPasswordConfirmation ? 'Ocultar' : 'Mostrar'}
              </button>
              {form.passwordConfirmation && !passwordsMatch && <small className="password-match-error">Las contraseñas no coinciden.</small>}
              {form.passwordConfirmation && passwordsMatch && <small className="password-match-success">Las contraseñas coinciden.</small>}
            </div>
          </div>
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
