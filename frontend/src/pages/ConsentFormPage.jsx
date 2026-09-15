import { useSecureDraft } from '../hooks/useSecureDraft';
import { useListPagination } from '../components/ListPagination';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { generateConsentFromTemplate, getConsentOptions, getConsentTemplates } from '../services/api';
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
  const paginationKey = useListPagination();
  const navigate = useNavigate();
  const [options, setOptions] = useState(null);
  const [form, setForm, clearDraft] = useSecureDraft(`consent:new`, {
    templateId: '',
    patientId: '',
    appointmentId: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([getConsentOptions(), getConsentTemplates()])
      .then(([response, templatesResponse]) => {
        if (active) {
          setOptions({ ...response, templates: templatesResponse.templates || [] });
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
  }, [paginationKey]);

  const availableAppointments = useMemo(() => {
    if (!options || !form.patientId) return [];
    return options.appointments.filter(
      (appointment) => appointment.patientId === Number(form.patientId)
    );
  }, [form.patientId, options, paginationKey]);

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
      const response = await generateConsentFromTemplate(form.templateId, {
        patientId: form.patientId,
        appointmentId: form.appointmentId || null
      });
      clearDraft();
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
          <p>Seleccione una plantilla aprobada. MedicalSys generará una copia versionada y el PDF antes de la firma.</p>
        </div>

        <div className="consent-form-grid">
          <label>
            <span>Plantilla del procedimiento *</span>
            <select name="templateId" onChange={updateField} required value={form.templateId}>
              <option value="">Seleccione una plantilla</option>
              {options.templates.map((template) => (
                <option key={template.id} value={template.id}>{template.title} · v{template.version}</option>
              ))}
            </select>
            {options.templates.length === 0 && <small className="consent-error">No hay plantillas activas. Registre una antes de generar un consentimiento.</small>}
          </label>
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

        <div className="consent-actions">
          <Button disabled={saving || !form.templateId} type="submit">{saving ? 'Generando PDF...' : 'Generar consentimiento y PDF'}</Button>
        </div>
      </form>
    </main>
  );
}
