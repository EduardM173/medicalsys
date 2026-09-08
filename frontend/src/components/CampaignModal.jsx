import React, { useState, useEffect } from 'react';
import { Button } from './Button';

const PROMO_TYPES = [
  { value: 'GENERAL', label: 'Campaña General / Preventiva' },
  { value: 'DESCUENTO_CONSULTA', label: 'Descuento en Consulta Médica' },
  { value: 'PAQUETE_PREVENTIVO', label: 'Paquete Chequeo Preventivo' },
  { value: 'JORNADA_GRATUITA', label: 'Jornada Gratuita / Pro-bono' }
];

const CAMPAIGN_STATUSES = [
  { value: 'BORRADOR', label: 'Borrador' },
  { value: 'PROGRAMADA', label: 'Programada' },
  { value: 'ACTIVA', label: 'Activa' },
  { value: 'FINALIZADA', label: 'Finalizada' },
  { value: 'CANCELADA', label: 'Cancelada' }
];

export function CampaignModal({ isOpen, onClose, campaign, onSave }) {
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    tipoPromocion: 'GENERAL',
    descuentoPorcentaje: 0,
    publicoObjetivo: '',
    fechaInicio: '',
    fechaFin: '',
    estado: 'BORRADOR',
    presupuesto: 0
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (campaign) {
      setFormData({
        nombre: campaign.nombre || '',
        descripcion: campaign.descripcion || '',
        tipoPromocion: campaign.tipoPromocion || 'GENERAL',
        descuentoPorcentaje: campaign.descuentoPorcentaje || 0,
        publicoObjetivo: campaign.publicoObjetivo || '',
        fechaInicio: campaign.fechaInicio ? campaign.fechaInicio.slice(0, 10) : '',
        fechaFin: campaign.fechaFin ? campaign.fechaFin.slice(0, 10) : '',
        estado: campaign.estado || 'BORRADOR',
        presupuesto: campaign.presupuesto || 0
      });
    } else {
      setFormData({
        nombre: '',
        descripcion: '',
        tipoPromocion: 'GENERAL',
        descuentoPorcentaje: 0,
        publicoObjetivo: '',
        fechaInicio: '',
        fechaFin: '',
        estado: 'BORRADOR',
        presupuesto: 0
      });
    }
    setError('');
  }, [campaign, isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!formData.nombre.trim()) {
      setError('El nombre de la campaña es obligatorio.');
      return;
    }

    if (formData.fechaInicio && formData.fechaFin && formData.fechaFin < formData.fechaInicio) {
      setError('La fecha de fin no puede ser anterior a la fecha de inicio.');
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        ...formData,
        descuentoPorcentaje: Number(formData.descuentoPorcentaje) || 0,
        presupuesto: Number(formData.presupuesto) || 0,
        fechaInicio: formData.fechaInicio ? `${formData.fechaInicio}T00:00:00.000Z` : null,
        fechaFin: formData.fechaFin ? `${formData.fechaFin}T23:59:59.000Z` : null
      });
      onClose();
    } catch (err) {
      setError(err.message || 'No fue posible guardar la campaña.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="campaign-modal-title">
      <div className="modal-card modal-lg" style={{ maxWidth: '640px' }}>
        <header className="modal-header">
          <div>
            <h2 id="campaign-modal-title" style={{ margin: 0, fontSize: '1.25rem' }}>
              {campaign ? 'Editar Campaña de Salud' : 'Nueva Campaña y Promoción de Salud'}
            </h2>
            <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted, #64748b)', fontSize: '0.85rem' }}>
              Defina los parámetros, beneficio y público de la campaña
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar modal">✕</button>
        </header>

        {error && <div className="notice error-notice" style={{ margin: '16px' }} role="alert">{error}</div>}

        <form onSubmit={handleSubmit} style={{ padding: '16px' }}>
          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label htmlFor="campo-nombre" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
              Nombre de la Campaña *
            </label>
            <input
              id="campo-nombre"
              type="text"
              className="ui-input"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              placeholder="Ej. Jornada de Detección de Diabetes y Riesgo Cardiovascular"
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label htmlFor="campo-descripcion" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
              Descripción / Objetivo Clínico
            </label>
            <textarea
              id="campo-descripcion"
              className="ui-input"
              rows="3"
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              placeholder="Detalle el objetivo, médicos participantes y servicios incluidos..."
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div className="form-group">
              <label htmlFor="campo-tipo" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                Tipo de Promoción
              </label>
              <select
                id="campo-tipo"
                className="ui-input"
                value={formData.tipoPromocion}
                onChange={(e) => setFormData({ ...formData, tipoPromocion: e.target.value })}
              >
                {PROMO_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="campo-descuento" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                Descuento / Beneficio (%)
              </label>
              <input
                id="campo-descuento"
                type="number"
                min="0"
                max="100"
                step="0.5"
                className="ui-input"
                value={formData.descuentoPorcentaje}
                onChange={(e) => setFormData({ ...formData, descuentoPorcentaje: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label htmlFor="campo-publico" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
              Público Objetivo / Criterio de Segmentación
            </label>
            <input
              id="campo-publico"
              type="text"
              className="ui-input"
              value={formData.publicoObjetivo}
              onChange={(e) => setFormData({ ...formData, publicoObjetivo: e.target.value })}
              placeholder="Ej. Pacientes mayores de 45 años, hipertensos o con diabetes"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div className="form-group">
              <label htmlFor="campo-fecha-inicio" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                Fecha de Inicio
              </label>
              <input
                id="campo-fecha-inicio"
                type="date"
                className="ui-input"
                value={formData.fechaInicio}
                onChange={(e) => setFormData({ ...formData, fechaInicio: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label htmlFor="campo-fecha-fin" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                Fecha de Finalización
              </label>
              <input
                id="campo-fecha-fin"
                type="date"
                className="ui-input"
                value={formData.fechaFin}
                onChange={(e) => setFormData({ ...formData, fechaFin: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
            <div className="form-group">
              <label htmlFor="campo-estado" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                Estado de la Campaña
              </label>
              <select
                id="campo-estado"
                className="ui-input"
                value={formData.estado}
                onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
              >
                {CAMPAIGN_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="campo-presupuesto" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                Presupuesto Asignado (BOB)
              </label>
              <input
                id="campo-presupuesto"
                type="number"
                min="0"
                step="50"
                className="ui-input"
                value={formData.presupuesto}
                onChange={(e) => setFormData({ ...formData, presupuesto: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>

          <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', borderTop: '1px solid var(--color-border, #e2e8f0)' }}>
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Guardando...' : campaign ? 'Actualizar Campaña' : 'Crear Campaña'}
            </Button>
          </footer>
        </form>
      </div>
    </div>
  );
}
