import React, { useState, useEffect } from 'react';
import { Button } from './Button';

const LOYALTY_TIERS = [
  { value: 'ESTANDAR', label: 'Bronce (Estándar)' },
  { value: 'FRECUENTE', label: 'Plata (Frecuente)' },
  { value: 'PREMIUM', label: 'Oro (Premium)' }
];

const LOYALTY_STATUSES = [
  { value: 'ACTIVO', label: 'Activo' },
  { value: 'INACTIVO', label: 'Inactivo' },
  { value: 'SUSPENDIDO', label: 'Suspendido / Pausa Temporal' }
];

export function LoyaltyModal({ isOpen, onClose, patient, onSave }) {
  const [formData, setFormData] = useState({
    nivel: 'ESTANDAR',
    estado: 'ACTIVO',
    puntos: 0,
    notas: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isEnrolled = Boolean(patient?.fidelizacion);

  useEffect(() => {
    if (patient?.fidelizacion) {
      setFormData({
        nivel: patient.fidelizacion.nivel || 'ESTANDAR',
        estado: patient.fidelizacion.estado || 'ACTIVO',
        puntos: patient.fidelizacion.puntosAcumulados || 0,
        notas: patient.fidelizacion.notas || ''
      });
    } else {
      setFormData({
        nivel: 'ESTANDAR',
        estado: 'ACTIVO',
        puntos: 0,
        notas: ''
      });
    }
    setError('');
  }, [patient, isOpen]);

  if (!isOpen || !patient) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await onSave({
        patientId: patient.id,
        nivel: formData.nivel,
        estado: formData.estado,
        puntosAcumulados: Number(formData.puntos) || 0,
        puntos: Number(formData.puntos) || 0,
        notas: formData.notas
      });
      onClose();
    } catch (err) {
      setError(err.message || 'No fue posible actualizar el estado de fidelización.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="loyalty-modal-title">
      <div className="modal-card" style={{ maxWidth: '520px' }}>
        <header className="modal-header">
          <div>
            <h2 id="loyalty-modal-title" style={{ margin: 0, fontSize: '1.25rem' }}>
              {isEnrolled ? 'Gestionar Membresía de Fidelización' : 'Afiliar Paciente al Programa'}
            </h2>
            <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted, #64748b)', fontSize: '0.85rem' }}>
              Paciente: <strong>{patient.nombres} {patient.apellidos}</strong> (CI: {patient.documentoIdentidad})
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar modal">✕</button>
        </header>

        {error && <div className="notice error-notice" style={{ margin: '16px' }} role="alert">{error}</div>}

        <form onSubmit={handleSubmit} style={{ padding: '16px' }}>
          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label htmlFor="campo-loyalty-nivel" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
              Categoría / Nivel de Fidelización
            </label>
            <select
              id="campo-loyalty-nivel"
              className="ui-input"
              value={formData.nivel}
              onChange={(e) => setFormData({ ...formData, nivel: e.target.value })}
            >
              {LOYALTY_TIERS.map((tier) => (
                <option key={tier.value} value={tier.value}>{tier.label}</option>
              ))}
            </select>
          </div>

          {isEnrolled && (
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label htmlFor="campo-loyalty-estado" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                Estado de la Membresía
              </label>
              <select
                id="campo-loyalty-estado"
                className="ui-input"
                value={formData.estado}
                onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
              >
                {LOYALTY_STATUSES.map((st) => (
                  <option key={st.value} value={st.value}>{st.label}</option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label htmlFor="campo-loyalty-puntos" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
              Puntos / Visitas de Salud Acumuladas
            </label>
            <input
              id="campo-loyalty-puntos"
              type="number"
              min="0"
              className="ui-input"
              value={formData.puntos}
              onChange={(e) => setFormData({ ...formData, puntos: e.target.value })}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '18px' }}>
            <label htmlFor="campo-loyalty-notas" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
              Notas / Observaciones del Programa
            </label>
            <textarea
              id="campo-loyalty-notas"
              className="ui-input"
              rows="3"
              value={formData.notas}
              onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
              placeholder="Ej. Paciente derivado por control preventivo. Solicita beneficios en laboratorio..."
            />
          </div>

          <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', borderTop: '1px solid var(--color-border, #e2e8f0)' }}>
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Guardando...' : isEnrolled ? 'Guardar Cambios' : 'Completar Afiliación'}
            </Button>
          </footer>
        </form>
      </div>
    </div>
  );
}
