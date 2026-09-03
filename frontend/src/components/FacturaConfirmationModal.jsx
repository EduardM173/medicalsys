import React, { useState } from 'react';
import { TicketFiscal80mm } from './TicketFiscal80mm';

export function FacturaConfirmationModal({ factura, onClose, onNuevaFactura }) {
  const [copiado, setCopiado] = useState(false);

  if (!factura) return null;

  async function handleCopiarCUF() {
    if (!factura?.cuf) return;
    try {
      await navigator.clipboard.writeText(factura.cuf);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch (_err) {
      // Fallback si clipboard API no está disponible
      const textarea = document.createElement('textarea');
      textarea.value = factura.cuf;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    }
  }

  function handleImprimir() {
    window.print();
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-factura-titulo">
      <div className="confirmation-modal">
        {/* Cabecera de Éxito */}
        <div className="modal-header-success">
          <div className="modal-success-icon" aria-hidden="true">✓</div>
          <div className="modal-header-text">
            <h3 id="modal-factura-titulo">¡Factura Emitida y Autorizada Exitosamente!</h3>
            <p>
              Factura N° <strong>{factura.numeroFactura}</strong> registrada ante el SIN con CUF oficial.
            </p>
          </div>
        </div>

        {/* Cuerpo del Modal */}
        <div className="modal-body">
          {/* Tarjeta destacada para el CUF */}
          <div className="modal-cuf-box">
            <div className="modal-cuf-header">
              <span className="modal-cuf-title">Código Único de Facturación (CUF)</span>
              <button
                type="button"
                className={`btn-copy-cuf ${copiado ? 'copied' : ''}`}
                onClick={handleCopiarCUF}
                id="btn-copiar-cuf"
              >
                {copiado ? '✓ ¡Copiado al portapapeles!' : '📋 Copiar CUF'}
              </button>
            </div>
            <div className="modal-cuf-string" id="modal-cuf-display">
              {factura.cuf}
            </div>
          </div>

          {/* Previsualización del Ticket Emitido */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <TicketFiscal80mm
              factura={factura}
              clinica={factura.clinica}
              esBorrador={false}
            />
          </div>
        </div>

        {/* Acciones del Modal */}
        <div className="modal-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
          >
            Cerrar
          </button>

          {onNuevaFactura && (
            <button
              type="button"
              className="btn-secondary"
              onClick={onNuevaFactura}
            >
              + Nueva Emisión
            </button>
          )}

          <button
            type="button"
            className="btn-print"
            onClick={handleImprimir}
            id="btn-imprimir-ticket"
          >
            🖨️ Imprimir Factura / Descargar PDF
          </button>
        </div>
      </div>
    </div>
  );
}
