import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { AttentionModal } from '../components/AttentionModal';
import { useAuth } from '../contexts/AuthContext';
import { getMedicalHistory } from '../services/api';
import '../styles/medical-history.css';

function calculateAge(birthDate) {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(`${birthDate}T00:00:00`);
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthday = today.getMonth() < birth.getMonth()
    || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

function formatDate(value, includeTime = false) {
  if (!value) return 'No registrado';
  const date = !includeTime && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  return new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'long',
    ...(includeTime ? { timeStyle: 'short' } : {})
  }).format(date);
}

function displayValue(value) {
  return value?.trim() || 'No registrado';
}

function documentLabel(patient) {
  return `${patient.documentoIdentidad}${patient.complemento ? ` ${patient.complemento}` : ''}`;
}

function diagnosisLabel(attention) {
  const parts = [attention.diagnosticoCodigo, attention.diagnosticoDescripcion].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'No registrado';
}

export function MedicalHistoryPage() {
  const { patientId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isDoctor = user?.rol === 'MEDICO' || user?.rol === 'ADMINISTRADOR';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showAttentionModal, setShowAttentionModal] = useState(false);

  async function loadHistory() {
    setLoading(true);
    try {
      const response = await getMedicalHistory(patientId);
      setData(response);
      setError('');
    } catch (requestError) {
      if (requestError.status === 403) {
        setError('No tiene permisos para consultar información clínica.');
      } else if (requestError.status === 404) {
        setError('Paciente no encontrado.');
      } else {
        setError('No fue posible cargar el historial clínico.');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, [patientId]);

  function handleAttentionSaved(savedAttention) {
    setShowAttentionModal(false);
    setNotice('Atención médica registrada exitosamente en el historial.');
    // Actualización reactiva inmediata
    setData((current) => {
      if (!current) return current;
      const historyExists = current.history;
      const newHistory = historyExists || {
        id: savedAttention.idHistoria || 1,
        pacienteId: Number(patientId),
        fechaApertura: new Date().toISOString().slice(0, 10),
        antecedentes: null,
        alergias: null,
        condicionesCronicas: null,
        observacionesGenerales: null
      };

      return {
        ...current,
        history: newHistory,
        attentions: [savedAttention, ...(current.attentions || [])]
      };
    });
  }

  if (loading && !data) {
    return <main className="medical-history-page"><p className="history-state">Cargando historial clínico...</p></main>;
  }

  if (error && !data) {
    return (
      <main className="medical-history-page">
        <section className="history-state history-error" role="alert">
          <p>{error}</p>
          <Button onClick={() => navigate('/pacientes')}>Volver al directorio</Button>
        </section>
      </main>
    );
  }

  const { patient, history, attentions } = data || {};
  const age = patient ? calculateAge(patient.fechaNacimiento) : null;

  return (
    <main className="medical-history-page">
      <header className="history-header">
        <div>
          <span className="login-kicker">Historial Médico Digital</span>
          <h1>Historial Clínico</h1>
          <p>Consulta de antecedentes, signos vitales y atenciones anteriores</p>
        </div>
        <div className="history-header-actions">
          {isDoctor && (
            <Button
              className="btn-new-attention"
              onClick={() => { setShowAttentionModal(true); setNotice(''); }}
            >
              + Registrar Atención Médica
            </Button>
          )}
          <Button className="history-back" onClick={() => navigate(`/pacientes/${patientId}/documentos`)}>
            Documentos clínicos
          </Button>
          <Button className="history-back" onClick={() => navigate('/pacientes')}>
            ← Volver
          </Button>
        </div>
      </header>

      {notice && <p className="notice success-notice" role="status">{notice}</p>}
      {error && <p className="notice error-notice" role="alert">{error}</p>}

      {patient && (
        <section className="history-patient-card" aria-label="Información del paciente">
          <div className="history-avatar" aria-hidden="true">
            {patient.nombres.charAt(0)}{patient.apellidos.charAt(0)}
          </div>
          <div className="history-patient-name">
            <span>Paciente</span>
            <h2>{patient.nombres} {patient.apellidos}</h2>
            <p>CI {documentLabel(patient)}</p>
          </div>
          <dl className="history-patient-details">
            <div><dt>Fecha de nacimiento</dt><dd>{formatDate(patient.fechaNacimiento)}</dd></div>
            <div><dt>Edad</dt><dd>{age === null ? 'No registrado' : `${age} años`}</dd></div>
            <div><dt>Teléfono</dt><dd>{patient.telefono || 'No registrado'}</dd></div>
            <div><dt>Grupo sanguíneo</dt><dd>{patient.grupoSanguineo || 'No registrado'}</dd></div>
          </dl>
        </section>
      )}

      {!history ? (
        <section className="history-state">
          <h2>Sin historial clínico</h2>
          <p>El paciente todavía no tiene historial clínico registrado.</p>
          {isDoctor && (
            <Button
              style={{ marginTop: '16px' }}
              onClick={() => { setShowAttentionModal(true); setNotice(''); }}
            >
              + Registrar Primera Atención Médica
            </Button>
          )}
        </section>
      ) : (
        <>
          <section className="clinical-summary" aria-labelledby="clinical-summary-title">
            <div className="history-section-heading">
              <div>
                <span className="login-kicker">Resumen clínico</span>
                <h2 id="clinical-summary-title">Información registrada</h2>
              </div>
              <span className="history-opened">Apertura: {formatDate(history.fechaApertura)}</span>
            </div>
            <div className="clinical-summary-grid">
              <article><span className="summary-icon allergy">!</span><h3>Alergias</h3><p>{displayValue(history.alergias)}</p></article>
              <article><span className="summary-icon chronic">+</span><h3>Condiciones crónicas</h3><p>{displayValue(history.condicionesCronicas)}</p></article>
              <article><span className="summary-icon background">A</span><h3>Antecedentes</h3><p>{displayValue(history.antecedentes)}</p></article>
              <article><span className="summary-icon notes">N</span><h3>Observaciones</h3><p>{displayValue(history.observacionesGenerales)}</p></article>
            </div>
          </section>

          <section className="attention-section" aria-labelledby="attention-title">
            <div className="history-section-heading">
              <div>
                <span className="login-kicker">Línea de tiempo</span>
                <h2 id="attention-title">Atenciones médicas registradas</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span className="attention-count">{attentions?.length || 0} {attentions?.length === 1 ? 'atención' : 'atenciones'}</span>
                {isDoctor && (
                  <Button
                    className="btn-new-attention-inline"
                    onClick={() => { setShowAttentionModal(true); setNotice(''); }}
                  >
                    + Nueva Atención
                  </Button>
                )}
              </div>
            </div>

            {(!attentions || attentions.length === 0) ? (
              <p className="attention-empty">No existen atenciones médicas registradas.</p>
            ) : (
              <div className="attention-timeline">
                {attentions.map((attention) => {
                  const hasVitals = attention.presionArterial || attention.presionSistolica
                    || attention.frecuenciaCardiaca || attention.temperatura
                    || attention.saturacionOxigeno || attention.pesoKg || attention.tallaCm;

                  return (
                    <article className="attention-card" key={attention.id}>
                      <span className="timeline-dot" aria-hidden="true" />
                      <div className="attention-meta">
                        <time dateTime={attention.fechaAtencion}>{formatDate(attention.fechaAtencion, true)}</time>
                        {attention.medico && (
                          <span>{attention.medico.nombreCompleto} · {attention.medico.especialidad}</span>
                        )}
                      </div>

                      <h3>{attention.motivoConsulta}</h3>

                      {/* Signos Vitales Badge Grid */}
                      {hasVitals && (
                        <div className="attention-vitals-bar" aria-label="Signos vitales registrados">
                          {attention.presionArterial && (
                            <span className="vital-tag" title="Presión Arterial">
                              🩸 <strong>PA:</strong> {attention.presionArterial} mmHg
                            </span>
                          )}
                          {attention.frecuenciaCardiaca && (
                            <span className="vital-tag" title="Frecuencia Cardíaca">
                              ❤️ <strong>FC:</strong> {attention.frecuenciaCardiaca} bpm
                            </span>
                          )}
                          {attention.temperatura && (
                            <span className="vital-tag" title="Temperatura Corporal">
                              🌡️ <strong>Temp:</strong> {attention.temperatura} °C
                            </span>
                          )}
                          {attention.saturacionOxigeno && (
                            <span className="vital-tag" title="Saturación de Oxígeno">
                              🫁 <strong>SpO2:</strong> {attention.saturacionOxigeno}%
                            </span>
                          )}
                          {attention.pesoKg && (
                            <span className="vital-tag" title="Peso Corporal">
                              ⚖️ <strong>Peso:</strong> {attention.pesoKg} kg
                            </span>
                          )}
                          {attention.tallaCm && (
                            <span className="vital-tag" title="Talla / Altura">
                              📏 <strong>Talla:</strong> {attention.tallaCm} cm
                            </span>
                          )}
                          {attention.imc && (
                            <span className="vital-tag vital-imc-tag" title="Índice de Masa Corporal">
                              📊 <strong>IMC:</strong> {attention.imc}
                            </span>
                          )}
                        </div>
                      )}

                      <dl className="attention-details">
                        <div><dt>Diagnóstico</dt><dd>{diagnosisLabel(attention)}</dd></div>
                        <div><dt>Anamnesis</dt><dd>{displayValue(attention.anamnesis)}</dd></div>
                        <div><dt>Tratamiento</dt><dd>{displayValue(attention.tratamiento)}</dd></div>
                        <div><dt>Observaciones</dt><dd>{displayValue(attention.observaciones)}</dd></div>
                      </dl>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {showAttentionModal && (
        <AttentionModal
          patientId={patientId}
          onCancel={() => setShowAttentionModal(false)}
          onSave={handleAttentionSaved}
        />
      )}
    </main>
  );
}
