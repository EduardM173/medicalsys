import React, { useEffect, useState } from 'react';
import { ApiError, getDoctors, getPatients, getServices } from '../services/api';
import { Button } from './Button';
import { Input } from './Input';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function AppointmentForm({ onCancel, onSave }) {
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [services, setServices] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [form, setForm] = useState({
    pacienteId: '',
    medicoId: '',
    servicioId: '',
    fecha: todayIsoDate(),
    horaInicio: '',
    indicacionesPrevias: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // MED-86: carga pacientes, médicos y servicios disponibles para el formulario.
  useEffect(() => {
    let active = true;

    async function loadOptions() {
      setLoadingOptions(true);
      try {
        const [patientsResponse, doctorsResponse, servicesResponse] = await Promise.all([
          getPatients(),
          getDoctors(),
          getServices()
        ]);
        if (!active) return;
        setPatients(patientsResponse.patients);
        setDoctors(doctorsResponse.doctors);
        setServices(servicesResponse.services);
        setLoadError('');
      } catch (requestError) {
        if (active) {
          setLoadError(requestError instanceof ApiError
            ? requestError.message
            : 'No fue posible cargar los datos del formulario.');
        }
      } finally {
        if (active) setLoadingOptions(false);
      }
    }

    loadOptions();
    return () => { active = false; };
  }, []);

  const selectedService = services.find((service) => String(service.id) === form.servicioId);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!form.pacienteId || !form.medicoId || !form.servicioId || !form.fecha || !form.horaInicio) {
      setError('Complete todos los campos obligatorios.');
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        pacienteId: Number(form.pacienteId),
        medicoId: Number(form.medicoId),
        servicioId: Number(form.servicioId),
        fecha: form.fecha,
        horaInicio: form.horaInicio,
        indicacionesPrevias: form.indicacionesPrevias || undefined
      });
    } catch (requestError) {
      setError(requestError instanceof ApiError
        ? requestError.message
        : 'No fue posible registrar la cita.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" role="presentation">
      <div aria-labelledby="appointment-modal-title" aria-modal="true" className="modal-card" role="dialog">
        <div className="modal-heading">
          <div>
            <h2 id="appointment-modal-title">Reservar Cita Médica</h2>
            <p>Complete los datos para agendar la atención del paciente.</p>
          </div>
          <button aria-label="Cerrar formulario" className="panel-close" disabled={submitting} onClick={onCancel} type="button">×</button>
        </div>

        {loadingOptions ? (
          <p className="appointment-loading">Cargando pacientes, médicos y servicios...</p>
        ) : loadError ? (
          <p className="form-error" role="alert">{loadError}</p>
        ) : (
          <form className="appointment-form" onSubmit={handleSubmit}>
            <div className="appointment-form-grid">
              <div className="form-field">
                <label htmlFor="appointment-patient">Seleccionar Paciente *</label>
                <select
                  id="appointment-patient"
                  onChange={(event) => setField('pacienteId', event.target.value)}
                  required
                  value={form.pacienteId}
                >
                  <option value="">Seleccione un paciente</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.apellidos} {patient.nombres} (CI: {patient.documentoIdentidad}{patient.complemento ? ` ${patient.complemento}` : ''})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="appointment-doctor">Médico Responsable *</label>
                <select
                  id="appointment-doctor"
                  onChange={(event) => setField('medicoId', event.target.value)}
                  required
                  value={form.medicoId}
                >
                  <option value="">Seleccione un médico</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.nombre} ({doctor.especialidad})
                    </option>
                  ))}
                </select>
              </div>

              <Input
                id="appointment-date"
                label="Fecha de la Cita *"
                min={todayIsoDate()}
                onChange={(event) => setField('fecha', event.target.value)}
                required
                type="date"
                value={form.fecha}
              />

              <Input
                id="appointment-time"
                label="Hora de Inicio *"
                onChange={(event) => setField('horaInicio', event.target.value)}
                required
                type="time"
                value={form.horaInicio}
              />

              <div className="form-field">
                <label htmlFor="appointment-service">Tipo de Atención / Procedimiento *</label>
                <select
                  id="appointment-service"
                  onChange={(event) => setField('servicioId', event.target.value)}
                  required
                  value={form.servicioId}
                >
                  <option value="">Seleccione un servicio</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.nombre} ({service.duracionMinutos} min)
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="appointment-duration">Duración Estimada</label>
                <input
                  disabled
                  id="appointment-duration"
                  readOnly
                  value={selectedService ? `${selectedService.duracionMinutos} minutos` : 'Seleccione un tipo de atención'}
                />
              </div>
            </div>

            <div className="form-field appointment-notes">
              <label htmlFor="appointment-notes">Notas e Instrucciones Previas para el Paciente</label>
              <textarea
                id="appointment-notes"
                onChange={(event) => setField('indicacionesPrevias', event.target.value)}
                placeholder="Ej. Asistir en ayunas de 8 horas, traer estudios radiográficos previos..."
                rows={3}
                value={form.indicacionesPrevias}
              />
            </div>

            {error && <p className="form-error" role="alert">{error}</p>}

            <div className="form-actions">
              <Button disabled={submitting} onClick={onCancel} variant="secondary">Cancelar</Button>
              <Button disabled={submitting} type="submit">
                {submitting ? 'Guardando...' : 'Confirmar y Agendar Cita'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
