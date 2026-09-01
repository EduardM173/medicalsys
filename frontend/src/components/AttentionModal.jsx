import React, { useEffect, useMemo, useState } from 'react';
import { Button } from './Button';
import { createAttention, getAttentionOptions } from '../services/api';

const CIE10_SUGGESTIONS = [
  { code: 'J00', description: 'Rinofaringitis aguda (resfriado común)' },
  { code: 'J20.9', description: 'Bronquitis aguda, no especificada' },
  { code: 'I10', description: 'Hipertensión esencial (primaria)' },
  { code: 'E11.9', description: 'Diabetes mellitus tipo 2 sin complicaciones' },
  { code: 'K29.7', description: 'Gastritis, no especificada' },
  { code: 'M54.5', description: 'Lumbago no especificado' },
  { code: 'A09', description: 'Gastroenteritis y colitis infecciosa' },
  { code: 'R51', description: 'Cefalea' },
  { code: 'J02.9', description: 'Faringitis aguda, no especificada' },
  { code: 'N39.0', description: 'Infección de vías urinarias, sitio no especificado' }
];

export function AttentionModal({
  patientId,
  appointmentId,
  initialData = {},
  onCancel,
  onSave
}) {
  const [options, setOptions] = useState(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    patientId: patientId ? String(patientId) : initialData.patientId ? String(initialData.patientId) : '',
    doctorId: initialData.doctorId ? String(initialData.doctorId) : '',
    appointmentId: appointmentId ? String(appointmentId) : initialData.appointmentId ? String(initialData.appointmentId) : '',
    motivoConsulta: initialData.motivoConsulta || '',
    anamnesis: initialData.anamnesis || '',
    diagnosticoCodigo: initialData.diagnosticoCodigo || '',
    diagnosticoDescripcion: initialData.diagnosticoDescripcion || '',
    tratamiento: initialData.tratamiento || '',
    observaciones: initialData.observaciones || '',
    presionSistolica: initialData.presionSistolica || '',
    presionDiastolica: initialData.presionDiastolica || '',
    frecuenciaCardiaca: initialData.frecuenciaCardiaca || '',
    temperatura: initialData.temperatura || '',
    saturacionOxigeno: initialData.saturacionOxigeno || '',
    pesoKg: initialData.pesoKg || '',
    tallaCm: initialData.tallaCm || ''
  });

  useEffect(() => {
    let active = true;
    getAttentionOptions()
      .then((data) => {
        if (!active) return;
        setOptions(data);
        if (data.currentDoctor && !form.doctorId) {
          setForm((prev) => ({ ...prev, doctorId: String(data.currentDoctor.id) }));
        }
      })
      .catch(() => {
        if (active) setError('No fue posible cargar las opciones de atención.');
      })
      .finally(() => {
        if (active) setLoadingOptions(false);
      });
    return () => { active = false; };
  }, []);

  const filteredAppointments = useMemo(() => {
    if (!options?.appointments || !form.patientId) return [];
    return options.appointments.filter(
      (cita) => cita.pacienteId === Number(form.patientId)
    );
  }, [options, form.patientId]);

  // Cálculo automático del IMC
  const calculatedImc = useMemo(() => {
    const p = parseFloat(form.pesoKg);
    const t = parseFloat(form.tallaCm);
    if (!p || !t || t <= 0) return null;
    const tM = t / 100;
    const imc = p / (tM * tM);
    let category = '';
    let color = '';
    if (imc < 18.5) {
      category = 'Bajo peso';
      color = 'var(--color-info)';
    } else if (imc < 25) {
      category = 'Normal';
      color = 'var(--color-success)';
    } else if (imc < 30) {
      category = 'Sobrepeso';
      color = 'var(--color-warning)';
    } else {
      category = 'Obesidad';
      color = 'var(--color-danger)';
    }
    return { value: imc.toFixed(1), category, color };
  }, [form.pesoKg, form.tallaCm]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'patientId' ? { appointmentId: '' } : {})
    }));
  }

  function handleSelectCie10(item) {
    setForm((prev) => ({
      ...prev,
      diagnosticoCodigo: item.code,
      diagnosticoDescripcion: item.description
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.patientId) {
      setError('Debe seleccionar un paciente.');
      return;
    }
    if (!form.motivoConsulta.trim()) {
      setError('El motivo de consulta es obligatorio.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        patientId: form.patientId,
        doctorId: form.doctorId || undefined,
        appointmentId: form.appointmentId || undefined,
        motivoConsulta: form.motivoConsulta,
        anamnesis: form.anamnesis || undefined,
        diagnosticoCodigo: form.diagnosticoCodigo || undefined,
        diagnosticoDescripcion: form.diagnosticoDescripcion || undefined,
        tratamiento: form.tratamiento || undefined,
        observaciones: form.observaciones || undefined,
        presionSistolica: form.presionSistolica ? parseInt(form.presionSistolica, 10) : undefined,
        presionDiastolica: form.presionDiastolica ? parseInt(form.presionDiastolica, 10) : undefined,
        frecuenciaCardiaca: form.frecuenciaCardiaca ? parseInt(form.frecuenciaCardiaca, 10) : undefined,
        temperatura: form.temperatura ? parseFloat(form.temperatura) : undefined,
        saturacionOxigeno: form.saturacionOxigeno ? parseInt(form.saturacionOxigeno, 10) : undefined,
        pesoKg: form.pesoKg ? parseFloat(form.pesoKg) : undefined,
        tallaCm: form.tallaCm ? parseFloat(form.tallaCm) : undefined
      };

      const response = await createAttention(payload);
      if (onSave) {
        onSave(response.attention);
      }
    } catch (requestError) {
      setError(requestError.message || 'No fue posible registrar la atención médica.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="attention-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="attention-modal-title">
      <div className="attention-modal-container">
        <header className="attention-modal-header">
          <div>
            <span className="login-kicker">Historial Clínico</span>
            <h2 id="attention-modal-title">Registrar Atención Médica</h2>
            <p>Complete el registro de la consulta, diagnóstico y signos vitales.</p>
          </div>
          <button
            aria-label="Cerrar modal"
            className="panel-close"
            onClick={onCancel}
            type="button"
          >
            ×
          </button>
        </header>

        {error && <p className="notice error-notice" role="alert">{error}</p>}

        <form className="attention-form" onSubmit={handleSubmit}>
          {/* SECCIÓN 1: VINCULACIÓN */}
          <fieldset className="attention-fieldset">
            <legend>1. Vinculación y Datos Generales</legend>
            <div className="attention-grid-2">
              <label className="form-field">
                <span>Paciente *</span>
                {loadingOptions ? (
                  <input disabled value="Cargando pacientes..." type="text" />
                ) : (
                  <select
                    disabled={Boolean(patientId)}
                    name="patientId"
                    onChange={handleChange}
                    required
                    value={form.patientId}
                  >
                    <option value="">Seleccione un paciente</option>
                    {options?.patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombres} {p.apellidos} (CI: {p.documentoIdentidad})
                      </option>
                    ))}
                  </select>
                )}
              </label>

              <label className="form-field">
                <span>Cita asociada (opcional)</span>
                <select
                  disabled={!form.patientId || Boolean(appointmentId)}
                  name="appointmentId"
                  onChange={handleChange}
                  value={form.appointmentId}
                >
                  <option value="">Sin cita asociada</option>
                  {filteredAppointments.map((cita) => (
                    <option key={cita.id} value={cita.id}>
                      {new Date(cita.fechaHoraInicio).toLocaleDateString('es-BO')} · {cita.servicioNombre} ({cita.estado})
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>

          {/* SECCIÓN 2: SIGNOS VITALES */}
          <fieldset className="attention-fieldset">
            <legend>2. Signos Vitales (Somatometría)</legend>
            <div className="vital-signs-grid">
              <label className="vital-field">
                <span>P. Sistólica (mmHg)</span>
                <input
                  max="300"
                  min="40"
                  name="presionSistolica"
                  onChange={handleChange}
                  placeholder="ej. 120"
                  type="number"
                  value={form.presionSistolica}
                />
              </label>

              <label className="vital-field">
                <span>P. Diastólica (mmHg)</span>
                <input
                  max="200"
                  min="30"
                  name="presionDiastolica"
                  onChange={handleChange}
                  placeholder="ej. 80"
                  type="number"
                  value={form.presionDiastolica}
                />
              </label>

              <label className="vital-field">
                <span>Frec. Cardíaca (bpm)</span>
                <input
                  max="250"
                  min="20"
                  name="frecuenciaCardiaca"
                  onChange={handleChange}
                  placeholder="ej. 75"
                  type="number"
                  value={form.frecuenciaCardiaca}
                />
              </label>

              <label className="vital-field">
                <span>Temperatura (°C)</span>
                <input
                  max="45"
                  min="30"
                  name="temperatura"
                  onChange={handleChange}
                  placeholder="ej. 36.5"
                  step="0.1"
                  type="number"
                  value={form.temperatura}
                />
              </label>

              <label className="vital-field">
                <span>SpO2 (%)</span>
                <input
                  max="100"
                  min="50"
                  name="saturacionOxigeno"
                  onChange={handleChange}
                  placeholder="ej. 98"
                  type="number"
                  value={form.saturacionOxigeno}
                />
              </label>

              <label className="vital-field">
                <span>Peso (kg)</span>
                <input
                  max="500"
                  min="1"
                  name="pesoKg"
                  onChange={handleChange}
                  placeholder="ej. 70.5"
                  step="0.1"
                  type="number"
                  value={form.pesoKg}
                />
              </label>

              <label className="vital-field">
                <span>Talla (cm)</span>
                <input
                  max="260"
                  min="20"
                  name="tallaCm"
                  onChange={handleChange}
                  placeholder="ej. 172"
                  step="0.5"
                  type="number"
                  value={form.tallaCm}
                />
              </label>

              {calculatedImc && (
                <div className="vital-imc-badge" style={{ borderColor: calculatedImc.color }}>
                  <span>IMC Estimado</span>
                  <strong>{calculatedImc.value} kg/m²</strong>
                  <small style={{ color: calculatedImc.color }}>{calculatedImc.category}</small>
                </div>
              )}
            </div>
          </fieldset>

          {/* SECCIÓN 3: MOTIVO, ANAMNESIS Y DIAGNÓSTICO */}
          <fieldset className="attention-fieldset">
            <legend>3. Anamnesis y Diagnóstico</legend>
            <div className="attention-fields-stack">
              <label className="form-field">
                <span>Motivo de Consulta *</span>
                <input
                  name="motivoConsulta"
                  onChange={handleChange}
                  placeholder="Describa el motivo principal de la consulta..."
                  required
                  type="text"
                  value={form.motivoConsulta}
                />
              </label>

              <label className="form-field">
                <span>Anamnesis / Enfermedad Actual</span>
                <textarea
                  name="anamnesis"
                  onChange={handleChange}
                  placeholder="Detalle los antecedentes de la enfermedad actual, síntomas y evolución..."
                  rows="3"
                  value={form.anamnesis}
                />
              </label>

              <div className="diagnosis-row">
                <label className="form-field diagnosis-code">
                  <span>CIE-10 (Código)</span>
                  <input
                    maxLength="30"
                    name="diagnosticoCodigo"
                    onChange={handleChange}
                    placeholder="ej. J00"
                    type="text"
                    value={form.diagnosticoCodigo}
                  />
                </label>

                <label className="form-field diagnosis-desc">
                  <span>Descripción del Diagnóstico</span>
                  <input
                    name="diagnosticoDescripcion"
                    onChange={handleChange}
                    placeholder="ej. Rinofaringitis aguda"
                    type="text"
                    value={form.diagnosticoDescripcion}
                  />
                </label>
              </div>

              {/* Sugerencias rápidas CIE-10 */}
              <div className="cie10-quick-tags">
                <span>Sugerencias CIE-10:</span>
                <div className="cie10-tags-scroll">
                  {CIE10_SUGGESTIONS.map((sug) => (
                    <button
                      key={sug.code}
                      className="cie10-tag"
                      onClick={() => handleSelectCie10(sug)}
                      type="button"
                    >
                      <strong>{sug.code}</strong> {sug.description}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </fieldset>

          {/* SECCIÓN 4: TRATAMIENTO Y OBSERVACIONES */}
          <fieldset className="attention-fieldset">
            <legend>4. Tratamiento y Observaciones</legend>
            <div className="attention-grid-2">
              <label className="form-field">
                <span>Tratamiento e Indicaciones Médicas</span>
                <textarea
                  name="tratamiento"
                  onChange={handleChange}
                  placeholder="Medicamentos, dosis, pautas terapéuticas e indicaciones..."
                  rows="3"
                  value={form.tratamiento}
                />
              </label>

              <label className="form-field">
                <span>Observaciones Clínicas / Recomendaciones</span>
                <textarea
                  name="observaciones"
                  onChange={handleChange}
                  placeholder="Próximas revisiones, notas adicionales o estudios solicitados..."
                  rows="3"
                  value={form.observaciones}
                />
              </label>
            </div>
          </fieldset>

          <footer className="attention-modal-footer">
            <Button
              className="btn-cancel"
              disabled={saving}
              onClick={onCancel}
              type="button"
              variant="secondary"
            >
              Cancelar
            </Button>
            <Button disabled={saving} type="submit">
              {saving ? 'Guardando Atención...' : '✓ Guardar Atención Médica'}
            </Button>
          </footer>
        </form>
      </div>
    </div>
  );
}
