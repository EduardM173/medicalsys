import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { getServices } from '../services/api';

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

const TARGET_SEGMENTS = [
  'Público General (Todos los Pacientes)',
  'Miembros del Programa de Fidelización (Bronce, Plata, Oro)',
  'Exclusivo Pacientes VIP (Nivel Oro)',
  'Pacientes Frecuentes (Nivel Plata)',
  'Pacientes Mayores de 45 años o con Riesgo Cardiovascular',
  'Población Pediátrica e Infantil (Chequeo Escolar)',
  'Personalizado'
];

export function CampaignModal({ isOpen, onClose, campaign, onSave }) {
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    tipoPromocion: 'GENERAL',
    descuentoPorcentaje: 0,
    segmentoSeleccionado: TARGET_SEGMENTS[0],
    publicoObjetivoPersonalizado: '',
    fechaInicio: '',
    fechaFin: '',
    estado: 'BORRADOR',
    presupuesto: 0,
    contenidoPublicable: '', imagenUrl: '', edadMin: '', edadMax: '', sexo: '', ubicacion: '',
    condiciones: '', nivel: '', whatsappHabilitado: false, puntosConversion: 0, servicioIds: []
  });
  const [services, setServices] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (campaign) {
      const publico = campaign.publicoObjetivo || '';
      const esPredefinido = TARGET_SEGMENTS.includes(publico);

      setFormData({
        nombre: campaign.nombre || '',
        descripcion: campaign.descripcion || '',
        tipoPromocion: campaign.tipoPromocion || 'GENERAL',
        descuentoPorcentaje: campaign.descuentoPorcentaje || 0,
        segmentoSeleccionado: esPredefinido ? publico : 'Personalizado',
        publicoObjetivoPersonalizado: esPredefinido ? '' : publico,
        fechaInicio: campaign.fechaInicio ? campaign.fechaInicio.slice(0, 10) : '',
        fechaFin: campaign.fechaFin ? campaign.fechaFin.slice(0, 10) : '',
        estado: campaign.estado || 'BORRADOR',
        presupuesto: campaign.presupuesto || 0,
        contenidoPublicable: campaign.contenidoPublicable || campaign.descripcion || '',
        imagenUrl: campaign.imagenUrl || '', edadMin: campaign.segmento?.edadMin ?? '', edadMax: campaign.segmento?.edadMax ?? '',
        sexo: campaign.segmento?.sexo || '', ubicacion: campaign.segmento?.ubicacion || '',
        condiciones: (campaign.segmento?.condiciones || []).join(', '), nivel: campaign.segmento?.nivel || '',
        whatsappHabilitado: Boolean(campaign.whatsappHabilitado), puntosConversion: campaign.puntosConversion || 0,
        servicioIds: (campaign.servicios || []).map((service) => String(service.id))
      });
    } else {
      setFormData({
        nombre: '',
        descripcion: '',
        tipoPromocion: 'GENERAL',
        descuentoPorcentaje: 0,
        segmentoSeleccionado: TARGET_SEGMENTS[0],
        publicoObjetivoPersonalizado: '',
        fechaInicio: '',
        fechaFin: '',
        estado: 'BORRADOR',
        presupuesto: 0,
        contenidoPublicable: '', imagenUrl: '', edadMin: '', edadMax: '', sexo: '', ubicacion: '',
        condiciones: '', nivel: '', whatsappHabilitado: false, puntosConversion: 0, servicioIds: []
      });
    }
    setError('');
  }, [campaign, isOpen]);

  useEffect(() => {
    if (isOpen) getServices().then((response) => setServices(response.services || [])).catch(() => setServices([]));
  }, [isOpen]);

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

    const publicoFinal = formData.segmentoSeleccionado === 'Personalizado'
      ? formData.publicoObjetivoPersonalizado.trim()
      : formData.segmentoSeleccionado;

    setSubmitting(true);
    try {
      await onSave({
        nombre: formData.nombre,
        descripcion: formData.descripcion,
        tipoPromocion: formData.tipoPromocion,
        descuentoPorcentaje: Number(formData.descuentoPorcentaje) || 0,
        publicoObjetivo: publicoFinal,
        presupuesto: Number(formData.presupuesto) || 0,
        estado: formData.estado,
        fechaInicio: formData.fechaInicio ? `${formData.fechaInicio}T00:00:00.000Z` : null,
        fechaFin: formData.fechaFin ? `${formData.fechaFin}T23:59:59.000Z` : null,
        contenidoPublicable: formData.contenidoPublicable,
        imagenUrl: formData.imagenUrl,
        segmento: { edadMin: formData.edadMin, edadMax: formData.edadMax, sexo: formData.sexo, ubicacion: formData.ubicacion, condiciones: formData.condiciones.split(',').map((item) => item.trim()).filter(Boolean), nivel: formData.nivel },
        whatsappHabilitado: formData.whatsappHabilitado,
        puntosConversion: Number(formData.puntosConversion) || 0,
        servicioIds: formData.servicioIds
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
              Defina los parámetros clínicos, beneficio y público segmentado de la campaña
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
              placeholder="Ej. Jornada de Prevención Cardiovascular & Hipertensión"
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label htmlFor="campo-publicable" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>Contenido visible en la zona de anuncios</label>
            <textarea id="campo-publicable" className="ui-input" rows="3" value={formData.contenidoPublicable} onChange={(e) => setFormData({ ...formData, contenidoPublicable: e.target.value })} placeholder="Mensaje breve, claro y accionable para el paciente" />
          </div>
          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label htmlFor="campo-imagen" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>URL de imagen (opcional)</label>
            <input id="campo-imagen" type="url" className="ui-input" value={formData.imagenUrl} onChange={(e) => setFormData({ ...formData, imagenUrl: e.target.value })} placeholder="https://..." />
          </div>

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label htmlFor="campo-descripcion" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
              Descripción / Mensaje para el Paciente
            </label>
            <textarea
              id="campo-descripcion"
              className="ui-input"
              rows="3"
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              placeholder="Detalle los servicios incluidos, indicaciones médicas y cómo reservar..."
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

          {/* Segmentación vinculada a Fidelización */}
          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label htmlFor="campo-segmento" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
              🎯 Público Objetivo (Segmentación / Fidelización)
            </label>
            <select
              id="campo-segmento"
              className="ui-input"
              value={formData.segmentoSeleccionado}
              onChange={(e) => setFormData({ ...formData, segmentoSeleccionado: e.target.value })}
            >
              {TARGET_SEGMENTS.map((seg) => (
                <option key={seg} value={seg}>{seg}</option>
              ))}
            </select>

            {formData.segmentoSeleccionado === 'Personalizado' && (
              <input
                type="text"
                className="ui-input"
                style={{ marginTop: '8px' }}
                value={formData.publicoObjetivoPersonalizado}
                onChange={(e) => setFormData({ ...formData, publicoObjetivoPersonalizado: e.target.value })}
                placeholder="Especifique el criterio o grupo de pacientes..."
                required
              />
            )}
          </div>

          <fieldset style={{ border: '1px solid #dbe5f2', borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
            <legend style={{ fontWeight: 700, fontSize: '.85rem' }}>Segmentación efectiva</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              <input aria-label="Edad mínima" type="number" min="0" className="ui-input" placeholder="Edad mínima" value={formData.edadMin} onChange={(e) => setFormData({ ...formData, edadMin: e.target.value })} />
              <input aria-label="Edad máxima" type="number" min="0" className="ui-input" placeholder="Edad máxima" value={formData.edadMax} onChange={(e) => setFormData({ ...formData, edadMax: e.target.value })} />
              <select aria-label="Sexo" className="ui-input" value={formData.sexo} onChange={(e) => setFormData({ ...formData, sexo: e.target.value })}><option value="">Cualquier sexo</option><option value="FEMENINO">Femenino</option><option value="MASCULINO">Masculino</option><option value="OTRO">Otro</option></select>
              <select aria-label="Nivel de fidelización" className="ui-input" value={formData.nivel} onChange={(e) => setFormData({ ...formData, nivel: e.target.value })}><option value="">Cualquier nivel</option><option value="BRONCE">Bronce</option><option value="PLATA">Plata</option><option value="ORO">Oro</option></select>
              <input aria-label="Ubicación" className="ui-input" placeholder="Ubicación, ej. La Paz" value={formData.ubicacion} onChange={(e) => setFormData({ ...formData, ubicacion: e.target.value })} />
              <input aria-label="Condiciones" className="ui-input" placeholder="Condiciones separadas por coma" value={formData.condiciones} onChange={(e) => setFormData({ ...formData, condiciones: e.target.value })} />
            </div>
          </fieldset>

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '.85rem', marginBottom: '8px' }}>Servicios donde aplica la promoción</label>
            <div style={{ maxHeight: '130px', overflowY: 'auto', border: '1px solid #dbe5f2', borderRadius: '10px', padding: '10px', display: 'grid', gap: '7px' }}>
              {services.length ? services.map((service) => <label key={service.id} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><input type="checkbox" checked={formData.servicioIds.includes(String(service.id))} onChange={(e) => setFormData({ ...formData, servicioIds: e.target.checked ? [...formData.servicioIds, String(service.id)] : formData.servicioIds.filter((id) => id !== String(service.id)) })} /> {service.nombre} · Bs {service.precioBase}</label>) : <span style={{ color: '#64748b' }}>No hay servicios disponibles.</span>}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '9px', fontWeight: 650 }}><input type="checkbox" checked={formData.whatsappHabilitado} onChange={(e) => setFormData({ ...formData, whatsappHabilitado: e.target.checked })} /> Habilitar difusión por WhatsApp</label>
            <div><label htmlFor="campo-puntos" style={{ display: 'block', fontWeight: 600, fontSize: '.85rem', marginBottom: '6px' }}>Puntos por uso</label><input id="campo-puntos" type="number" min="0" step="1" className="ui-input" value={formData.puntosConversion} onChange={(e) => setFormData({ ...formData, puntosConversion: e.target.value })} /></div>
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
