import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { createConsent, getConsentOptions } from '../services/api';
import '../styles/consents.css';

function formatAppointment(appointment) {
  const date = new Intl.DateTimeFormat('es-BO', {
    timeZone: 'America/La_Paz',
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(appointment.startTime));
  return `${date} · ${appointment.service} · ${appointment.status}`;
}

export function ConsentFormPage() {
  const navigate = useNavigate();
  const [options, setOptions] = useState(null);
  const [form, setForm] = useState({
    patientId: '',
    appointmentId: '',
    procedure: '',
    content: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getConsentOptions()
      .then((response) => {
        if (active) {
          setOptions(response);
          setError('');
        }
      })
      .catch((requestError) => {
        if (!active) return;
        setError(
          requestError.status === 403
            ? 'No tiene permisos para generar consentimientos informados.'
            : 'No fue posible cargar el formulario de consentimiento.'
        );
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const availableAppointments = useMemo(() => {
    if (!options || !form.patientId) return [];
    return options.appointments.filter(
      (appointment) => appointment.patientId === Number(form.patientId)
    );
  }, [form.patientId, options]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === 'patientId' ? { appointmentId: '' } : {})
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await createConsent({
        patientId: form.patientId,
        appointmentId: form.appointmentId || null,
        procedure: form.procedure,
        content: form.content
      });
      navigate(`/consentimientos/${response.consent.id}`);
    } catch (requestError) {
      const knownMessages = [
        'Paciente no encontrado.',
        'Cita no encontrada.',
        'La cita no corresponde al paciente seleccionado.',
        'La cita no corresponde al médico autenticado.'
      ];
      setError(
        knownMessages.includes(requestError.message)
          ? requestError.message
          : requestError.status === 403
            ? 'No tiene permisos para generar consentimientos informados.'
            : requestError.status === 400
              ? requestError.message
              : 'No fue posible generar el consentimiento informado.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="consent-page"><p className="consent-state">Cargando formulario...</p></main>;
  }

  if (!options) {
    return <main className="consent-page"><p className="consent-state consent-error" role="alert">{error}</p></main>;
  }

  return (
    <main className="consent-page">
      <header className="consent-header">
        <div>
          <span className="login-kicker">Gestión documental</span>
          <h1>Generar Consentimiento Informado</h1>
          <p>Registre las condiciones del procedimiento que se realizará al paciente</p>
        </div>
      </header>

      <section className="consent-doctor-card" aria-label="Médico responsable">
        <span className="consent-avatar" aria-hidden="true">{options.doctor.fullName.charAt(0)}</span>
        <div><small>Médico responsable</small><strong>{options.doctor.fullName}</strong><span>{options.doctor.specialty}</span></div>
      </section>

      {error && <p className="notice error-notice consent-notice" role="alert">{error}</p>}

      <form className="consent-form-card" onSubmit={handleSubmit}>
        <div className="consent-form-heading">
          <span className="login-kicker">Nuevo documento</span>
          <h2>Datos del consentimiento</h2>
          <p>Los campos marcados con * son obligatorios. El contenido debe ser ingresado por el profesional.</p>
        </div>

        <div className="consent-form-grid">
          <label>
            <span>Paciente *</span>
            <select name="patientId" onChange={updateField} required value={form.patientId}>
              <option value="">Seleccione un paciente</option>
              {options.patients.map((patient) => (
                <option key={patient.id} value={patient.id}>{patient.fullName}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Cita asociada (opcional)</span>
            <select disabled={!form.patientId} name="appointmentId" onChange={updateField} value={form.appointmentId}>
              <option value="">Sin cita asociada</option>
              {availableAppointments.map((appointment) => (
                <option key={appointment.id} value={appointment.id}>{formatAppointment(appointment)}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="consent-field">
          <span>Procedimiento *</span>
          <input maxLength="255" name="procedure" onChange={updateField} placeholder="Nombre del procedimiento" required type="text" value={form.procedure} />
        </label>

        <label className="consent-field">
          <span>Contenido del consentimiento *</span>
          <textarea name="content" onChange={updateField} placeholder="Ingrese el contenido informado que corresponde al procedimiento..." required rows="12" value={form.content} />
        </label>

        <p className="consent-form-note">El consentimiento se guardará en estado GENERADO. La firma corresponde a otra etapa del proceso.</p>
        <div className="consent-actions">
          <Button disabled={saving} type="submit">{saving ? 'Generando...' : 'Generar consentimiento'}</Button>
        </div>
      </form>
    </main>
  );
}
