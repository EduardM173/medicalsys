import React from 'react';
import { Button } from './Button';

const BANNER_MAP = {
  DESCUENTO_CONSULTA: '🩺 Consulta Médica Preventiva',
  PAQUETE_PREVENTIVO: '🔬 Chequeo Clínico Integral',
  JORNADA_GRATUITA: '🦷 Jornada de Salud Comunitaria',
  GENERAL: '🏥 Campaña Institucional de Salud'
};

export function CampaignPreviewModal({ isOpen, onClose, campaign }) {
  if (!isOpen || !campaign) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="preview-modal-title">
      <div className="modal-card" style={{ maxWidth: '480px', padding: 0, overflow: 'hidden' }}>
        <header className="modal-header" style={{ padding: '16px 20px', background: '#0f172a', color: '#ffffff' }}>
          <div>
            <h2 id="preview-modal-title" style={{ margin: 0, fontSize: '1.1rem', color: '#ffffff' }}>
              Vista Previa de Comunicación
            </h2>
            <p style={{ margin: '2px 0 0', color: '#94a3b8', fontSize: '0.78rem' }}>
              Así visualizarán los pacientes esta promoción en WhatsApp y canales digitales
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} style={{ color: '#94a3b8' }} aria-label="Cerrar">✕</button>
        </header>

        {/* Mockup de Celular / WhatsApp */}
        <div style={{ background: '#e5ddd5', padding: '24px 16px', display: 'flex', justifyContent: 'center' }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            maxWidth: '340px',
            width: '100%',
            overflow: 'hidden',
            border: '1px solid #cbd5e1'
          }}>
            {/* Banner superior de la campaña */}
            <div style={{
              background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
              color: '#ffffff',
              padding: '20px 16px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '6px' }}>
                {BANNER_MAP[campaign.tipoPromocion] ? BANNER_MAP[campaign.tipoPromocion].split(' ')[0] : '🏥'}
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.9 }}>
                {BANNER_MAP[campaign.tipoPromocion] || 'MedicalSys Promociones'}
              </span>
              <h3 style={{ margin: '6px 0 0', fontSize: '1.1rem', fontWeight: 800, lineHeight: 1.2 }}>
                {campaign.nombre}
              </h3>
            </div>

            {/* Contenido del Mensaje */}
            <div style={{ padding: '16px', fontSize: '0.85rem', color: '#1e293b' }}>
              {campaign.descuentoPorcentaje > 0 && (
                <div style={{
                  display: 'inline-block',
                  background: '#ecfdf5',
                  color: '#047857',
                  border: '1px solid #a7f3d0',
                  padding: '4px 10px',
                  borderRadius: '9999px',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  marginBottom: '10px'
                }}>
                  🎉 {campaign.descuentoPorcentaje}% DE DESCUENTO
                </div>
              )}

              <p style={{ margin: '0 0 12px', lineHeight: 1.5, color: '#334155' }}>
                {campaign.descripcion || 'Aproveche nuestra campaña médica con aranceles preferenciales para usted y su familia.'}
              </p>

              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '10px',
                fontSize: '0.78rem',
                color: '#475569',
                marginBottom: '14px'
              }}>
                <div>👥 <strong>Dirigido a:</strong> {campaign.publicoObjetivo || 'Todos los pacientes'}</div>
                {campaign.fechaFin && (
                  <div style={{ marginTop: '4px' }}>
                    ⏰ <strong>Válido hasta:</strong> {new Date(campaign.fechaFin).toLocaleDateString('es-BO')}
                  </div>
                )}
              </div>

              {/* Botones de acción del paciente */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <a
                  href="/citas"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    background: '#2563eb',
                    color: '#ffffff',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    textDecoration: 'none',
                    fontSize: '0.82rem'
                  }}
                >
                  👉 1. Agendar Cita con Beneficio
                </a>
                <a
                  href="/pacientes"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    background: '#f1f5f9',
                    color: '#475569',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    fontSize: '0.8rem'
                  }}
                >
                  ℹ️ Más Información en Clínica
                </a>
              </div>
            </div>
          </div>
        </div>

        <footer style={{ padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', background: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
          <Button variant="secondary" onClick={onClose}>
            Cerrar Vista Previa
          </Button>
        </footer>
      </div>
    </div>
  );
}
