import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { numeroALetras } from '../utils/numeroALetras';

/**
 * Componente de Ticket Fiscal Computarizado (80mm) (MED-190, MED-193)
 * Simulación de alta fidelidad para ticketera térmica e impresión.
 */
export function TicketFiscal80mm({ factura, clinica, esBorrador = false, className = '' }) {
  const clinicaData = clinica || factura?.clinica || {
    nombreComercial: 'MedicalSys - Clínica Especializada',
    razonSocial: 'MedicalSys Salud Integral S.R.L.',
    nit: '1028472021',
    direccion: 'Av. Arce #2435, Edificio Los Pinos, PB',
    telefono: '+591 2 2441234',
    ciudad: 'La Paz',
    pais: 'Bolivia'
  };

  const total = Number(factura?.total || 0);
  const subtotal = Number(factura?.subtotal || total);
  const cuf = factura?.cuf || (esBorrador ? 'PREVISUALIZACIÓN-EN-BORRADOR-SIN-AUTORIZAR-EL-CUF-SE-GENERARÁ-AL-EMITIR' : '');
  const numeroFactura = factura?.numeroFactura || 'FAC-BORRADOR';
  const fechaStr = factura?.fechaEmision
    ? new Date(factura.fechaEmision).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'medium' })
    : new Date().toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'medium' });

  // Si no hay qrPayload oficial (borrador), generamos la URL estándar con datos preliminares
  const qrValue = factura?.qrPayload || (
    `https://siat.impuestos.gob.bo/consulta/QR?nit=${clinicaData.nit}&cuf=${cuf}&numero=${numeroFactura}&t=${total.toFixed(2)}`
  );

  return (
    <div className={`ticket-preview-container ticket-printable ${className}`}>
      {/* Badge de estado visual */}
      <div className={`ticket-status-pill ${esBorrador ? 'borrador' : 'emitida'}`}>
        {esBorrador ? '⚡ Previsualización en Tiempo Real (Borrador)' : '✓ Factura Emitida y Autorizada por el SIN'}
      </div>

      {/* Cabecera de la Clínica */}
      <header className="ticket-header">
        <h3 className="ticket-clinic-name">{clinicaData.nombreComercial}</h3>
        <p className="ticket-clinic-legal">{clinicaData.razonSocial}</p>
        <p className="ticket-clinic-info">Casa Matriz: {clinicaData.direccion}</p>
        <p className="ticket-clinic-info">Tel: {clinicaData.telefono} • {clinicaData.ciudad} - {clinicaData.pais}</p>
        <hr className="ticket-divider" />
        <div className="ticket-meta-block">
          <div className="ticket-meta-row">
            <strong>NIT:</strong>
            <span>{clinicaData.nit}</span>
          </div>
          <div className="ticket-meta-row">
            <strong>FACTURA N°:</strong>
            <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{numeroFactura}</span>
          </div>
          <div className="ticket-meta-row">
            <strong>CÓD. AUTORIZACIÓN:</strong>
            <span style={{ fontSize: '0.68rem', wordBreak: 'break-all' }}>
              {factura?.codigoAutorizacion || factura?.sinReferencia || 'PENDIENTE'}
            </span>
          </div>
        </div>
      </header>

      <hr className="ticket-divider-double" />

      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '0.88rem', margin: '0.35rem 0' }}>
        FACTURA
        <div style={{ fontSize: '0.65rem', fontWeight: 'normal', color: '#475569' }}>
          (Con Derecho a Crédito Fiscal)
        </div>
      </div>

      <hr className="ticket-divider" />

      {/* Datos del Receptor */}
      <div className="ticket-meta-block">
        <div className="ticket-meta-row">
          <span><strong>Fecha:</strong> {fechaStr}</span>
        </div>
        <div className="ticket-meta-row">
          <span><strong>Señor(es):</strong> {factura?.razonSocial || 'CONSUMIDOR FINAL'}</span>
        </div>
        <div className="ticket-meta-row">
          <span>
            <strong>NIT/CI:</strong> {factura?.nitCi || '0'}
            {factura?.complemento ? ` - ${factura.complemento}` : ''}
          </span>
        </div>
        <div className="ticket-meta-row">
          <span><strong>Método Pago:</strong> {factura?.metodoPagoDisplay || factura?.metodoPago || 'EFECTIVO'}</span>
        </div>
      </div>

      {/* Recuadro monospaced del CUF */}
      <div className="ticket-cuf-box">
        <div className="ticket-cuf-label">CÓDIGO ÚNICO DE FACTURACIÓN (CUF)</div>
        <div className="ticket-cuf-value">{cuf}</div>
      </div>

      <hr className="ticket-divider" />

      {/* Detalle de Prestaciones Médicas */}
      <table className="ticket-items-table">
        <thead>
          <tr>
            <th style={{ width: '15%' }}>CANT</th>
            <th style={{ width: '50%' }}>DETALLE</th>
            <th className="text-right" style={{ width: '17%' }}>P.UNIT</th>
            <th className="text-right" style={{ width: '18%' }}>TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {(factura?.items && factura.items.length > 0) ? (
            factura.items.map((item, idx) => (
              <tr key={item.id || idx}>
                <td>{item.cantidad}</td>
                <td>{item.descripcion}</td>
                <td className="text-right">{Number(item.precioUnitario || 0).toFixed(2)}</td>
                <td className="text-right">{Number(item.subtotal || 0).toFixed(2)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="4" style={{ textAlign: 'center', fontStyle: 'italic', padding: '0.75rem 0' }}>
                (Sin prestaciones agregadas)
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <hr className="ticket-divider" />

      {/* Totales y Liquidación */}
      <div className="ticket-totals">
        <div className="ticket-meta-row">
          <span>SUBTOTAL BS:</span>
          <span>{subtotal.toFixed(2)}</span>
        </div>
        <div className="ticket-meta-row">
          <span>DESCUENTOS BS:</span>
          <span>0.00</span>
        </div>
        <div className="ticket-meta-row ticket-total-main">
          <span>TOTAL A PAGAR BS:</span>
          <span>{total.toFixed(2)}</span>
        </div>
        <div className="ticket-meta-row" style={{ fontWeight: 'bold', fontSize: '0.72rem', marginTop: '0.2rem' }}>
          <span>IMPORTE BASE CRÉDITO FISCAL:</span>
          <span>{total.toFixed(2)}</span>
        </div>
        <div className="ticket-literal">
          <strong>Son:</strong> {numeroALetras(total)}
        </div>
      </div>

      <hr className="ticket-divider" />

      {/* Código QR Dinámico (SIAT Bolivia) */}
      <div className="ticket-qr-section">
        <div className="ticket-qr-container">
          <QRCodeSVG
            value={qrValue}
            size={116}
            level="M"
            includeMargin={false}
          />
        </div>
        <div style={{ fontSize: '0.62rem', color: '#64748b' }}>
          Código QR Reglamentario SIAT
        </div>
      </div>

      {/* Leyendas Normativas del SIN */}
      <div className="ticket-legal-text">
        <p style={{ margin: '0 0 0.35rem 0', fontWeight: 'bold' }}>
          &ldquo;ESTA FACTURA CONTRIBUYE AL DESARROLLO DEL PAÍS, EL USO ILÍCITO SERÁ SANCIONADO PENALMENTE DE ACUERDO A LEY.&rdquo;
        </p>
        <p style={{ margin: 0, fontStyle: 'italic' }}>
          Ley N° 453: Los servicios deben prestarse en condiciones de inocuidad, calidad y seguridad.
        </p>
        <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.58rem', color: '#94a3b8' }}>
          Representación gráfica de Documento Fiscal Digital emitido en modalidad Computarizada en Línea.
        </p>
      </div>
    </div>
  );
}
