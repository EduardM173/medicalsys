import React, { useState } from 'react';
import { ApiError } from '../services/api';
import { Button } from './Button';
import { Input } from './Input';

export function PatientForm({ initialPatient = null, onCancel, onSave }) {
  const editing = Boolean(initialPatient);
  const [form, setForm] = useState({
    documentoIdentidad: initialPatient?.documentoIdentidad || '',
    complemento: initialPatient?.complemento || '',
    nombres: initialPatient?.nombres || '',
    apellidos: initialPatient?.apellidos || '',
    fechaNacimiento: initialPatient?.fechaNacimiento || '',
    telefono: initialPatient?.telefono || '',
    email: initialPatient?.email || '',
    sexo: initialPatient?.sexo || '',
    grupoSanguineo: initialPatient?.grupoSanguineo || '',
    direccion: initialPatient?.direccion || '',
    contactoEmergencia: initialPatient?.contactoEmergencia || '',
    telefonoEmergencia: initialPatient?.telefonoEmergencia || ''
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
      await onSave(form);
    } catch (requestError) {
      setError(requestError instanceof ApiError
        ? requestError.message
        : 'No fue posible completar la operación.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="patient-form" onSubmit={handleSubmit}>
      <div className="patient-form-grid">
        <Input id="patient-document" label="Documento de identidad *" onChange={(event) => setField('documentoIdentidad', event.target.value)} required value={form.documentoIdentidad} />
        <Input id="patient-complement" label="Complemento" onChange={(event) => setField('complemento', event.target.value)} value={form.complemento} />
        <Input id="patient-first-name" label="Nombres *" onChange={(event) => setField('nombres', event.target.value)} required value={form.nombres} />
        <Input id="patient-last-name" label="Apellidos *" onChange={(event) => setField('apellidos', event.target.value)} required value={form.apellidos} />
        <Input id="patient-birth-date" label="Fecha de nacimiento *" max={new Date().toISOString().slice(0, 10)} onChange={(event) => setField('fechaNacimiento', event.target.value)} required type="date" value={form.fechaNacimiento} />
        <Input id="patient-phone" label="Teléfono *" onChange={(event) => setField('telefono', event.target.value)} required type="tel" value={form.telefono} />
        <Input id="patient-email" label="Correo electrónico" onChange={(event) => setField('email', event.target.value)} type="email" value={form.email} />
        <div className="form-field">
          <label htmlFor="patient-sex">Sexo</label>
          <select id="patient-sex" onChange={(event) => setField('sexo', event.target.value)} value={form.sexo}>
            <option value="">No especificado</option>
            <option value="FEMENINO">Femenino</option>
            <option value="MASCULINO">Masculino</option>
            <option value="OTRO">Otro</option>
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="patient-blood-type">Grupo sanguíneo</label>
          <select id="patient-blood-type" onChange={(event) => setField('grupoSanguineo', event.target.value)} value={form.grupoSanguineo}>
            <option value="">No especificado</option>
            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
        <Input id="patient-address" label="Dirección" onChange={(event) => setField('direccion', event.target.value)} value={form.direccion} />
        <Input id="patient-emergency-contact" label="Contacto de emergencia" onChange={(event) => setField('contactoEmergencia', event.target.value)} value={form.contactoEmergencia} />
        <Input id="patient-emergency-phone" label="Teléfono de emergencia" onChange={(event) => setField('telefonoEmergencia', event.target.value)} type="tel" value={form.telefonoEmergencia} />
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="form-actions">
        <Button disabled={submitting} onClick={onCancel} variant="secondary">Cancelar</Button>
        <Button disabled={submitting} type="submit">
          {submitting ? 'Guardando...' : editing ? 'Guardar cambios' : 'Registrar paciente'}
        </Button>
      </div>
    </form>
  );
}
