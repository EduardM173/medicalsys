import { useListPagination } from '../components/ListPagination';
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '../components/Button';
import { PageContext } from '../components/PageContext';
import { getIssuedInvoice, getIssuedInvoices, getPatients, getInvoiceXmlUrl, cancelInvoice } from '../services/api';
import '../styles/billing.css';
import '../styles/billing-invoices.css';

const paymentLabels = {
  EFECTIVO: 'Efectivo', QR: 'QR', TARJETA: 'Tarjeta', TRANSFERENCIA: 'Transferencia', OTRO: 'Otro'
};
function formatMoney(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB', minimumFractionDigits: 2 }).format(number)
    : '—';
}
function formatDate(value) {
  return value ? new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
}
function SinBadge({ value, referencia }) {
  if (value === 'PENDIENTE' || (referencia && String(referencia).startsWith('CONT-'))) {
    return (
      <span
        className="invoice-badge"
        style={{
          background: '#fef3c7',
          color: '#92400e',
          border: '1px solid #fde68a',
          fontWeight: 600
        }}
      >
        🟡 CONTINGENCIA (RND 102100000011)
      </span>
    );
  }
  if (value === 'EMITIDA') {
    return (
      <span
        className="invoice-badge"
        style={{
          background: '#ecfdf5',
          color: '#065f46',
          border: '1px solid #a7f3d0',
          fontWeight: 600
        }}
      >
        🟢 EN LÍNEA (SIAT v2)
      </span>
    );
  }
  const simulated = value === 'SIMULADA';
  return <span className={`invoice-badge invoice-sin-${String(value || '').toLowerCase()}`}>{simulated ? 'SIMULACIÓN' : value || '—'}</span>;
}

function InvoiceDetail({ invoiceId }) {
  const paginationKey = useListPagination();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedCuf, setCopiedCuf] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState(1);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const fetchInvoice = useCallback(() => {
    let active = true;
    setLoading(true);
    getIssuedInvoice(invoiceId)
      .then((response) => { if (active) setInvoice(response.invoice); })
      .catch((requestError) => { if (active) setError(requestError.status === 404 ? 'Factura no encontrada.' : requestError.message || 'No fue posible cargar la información de facturación.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [invoiceId, paginationKey]);

  useEffect(() => {
    return fetchInvoice();
  }, [fetchInvoice]);

  const handleCopyCuf = () => {
    if (invoice?.cuf) {
      navigator.clipboard.writeText(invoice.cuf);
      setCopiedCuf(true);
      setTimeout(() => setCopiedCuf(false), 2000);
    }
  };

  const handleConfirmCancel = async () => {
    try {
      setCancelling(true);
      setCancelError('');
      await cancelInvoice(invoiceId, { motivo: cancelReason });
      setShowCancelModal(false);
      fetchInvoice();
    } catch (err) {
      setCancelError(err.message || 'No fue posible anular la factura ante el SIN.');
    } finally {
      setCancelling(false);
    }
  };
  if (loading) return <main className="billing-page invoice-query-page"><p className="invoice-state">Cargando factura...</p></main>;
  if (error) return <main className="billing-page invoice-query-page"><p className="billing-alert error" role="alert">{error}</p><Link className="button button-secondary" to="/facturacion">Volver a facturas</Link></main>;

  const qrUrl = invoice.qrPayload && invoice.qrPayload.startsWith('http')
    ? invoice.qrPayload
    : `https://pilotosiat.impuestos.gob.bo/consulta/QR?nit=4247012018&cuf=${invoice.cuf}&numero=${invoice.numeroFactura}&t=2`;

  const isContingencia = invoice.sinEstado === 'PENDIENTE' || (invoice.sinReferencia && invoice.sinReferencia.startsWith('CONT-'));

  return <main className="billing-page invoice-query-page">
    <PageContext
      actions={
        <div className="invoice-badges" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className={`invoice-badge ${invoice.estado === 'ANULADA' ? 'invoice-error' : 'invoice-issued'}`}>
            {invoice.estado}
          </span>
          <SinBadge value={invoice.sinEstado} referencia={invoice.sinReferencia} />
          {invoice.estado === 'EMITIDA' && (
            <button
              type="button"
              className="button button-secondary"
              style={{ padding: '4px 10px', fontSize: '0.8rem', color: '#b91c1c', borderColor: '#fca5a5' }}
              onClick={() => setShowCancelModal(true)}
            >
              🚫 Anular Factura
            </button>
          )}
        </div>
      }
      breadcrumbs={[{ label: 'Inicio', to: '/dashboard' }, { label: 'Facturación', to: '/facturacion' }, { label: invoice.numeroFactura }]}
      subtitle={`Emitida el ${formatDate(invoice.fechaEmision)}`}
      title={`Factura ${invoice.numeroFactura}`}
    />

    {isContingencia && (
      <div style={{ padding: '12px 16px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', marginBottom: '20px', color: '#92400e', fontSize: '0.88rem' }}>
        <strong>ℹ️ Factura emitida legalmente bajo Contingencia (RND 102100000011):</strong> El documento cuenta con validez fiscal plena (Tipo Emisión 2: Fuera de Línea) y paquete XML firmado en cola de sincronización.
      </div>
    )}

    <div className="invoice-detail-grid">
      <section className="ui-card invoice-detail-card"><h2>Paciente</h2><dl>
        <div><dt>Nombre completo</dt><dd>{invoice.paciente.nombre}</dd></div>
        <div><dt>Documento</dt><dd>{invoice.paciente.documentoIdentidad}{invoice.paciente.complemento ? ` ${invoice.paciente.complemento}` : ''}</dd></div>
      </dl></section>
      <section className="ui-card invoice-detail-card"><h2>Datos de facturación</h2><dl>
        <div><dt>Razón social</dt><dd>{invoice.receptor.razonSocial}</dd></div>
        <div><dt>NIT / CI</dt><dd>{invoice.receptor.nitCi || '—'}{invoice.receptor.complemento ? ` ${invoice.receptor.complemento}` : ''}</dd></div>
        <div><dt>Email receptor</dt><dd>{invoice.receptor.email || '—'}</dd></div>
        <div><dt>Método de pago</dt><dd>{paymentLabels[invoice.metodoPago] || invoice.metodoPago}</dd></div>
      </dl></section>
    </div>

    <section className="ui-card invoice-detail-card invoice-concepts"><h2>Servicios facturados</h2>
      <div className="billing-table-wrap"><table className="billing-table"><thead><tr><th>Descripción</th><th>Cantidad</th><th>Precio unitario</th><th>Subtotal</th></tr></thead><tbody>
        {invoice.conceptos.map((item) => <tr key={item.id}><td><strong>{item.descripcion}</strong></td><td>{item.cantidad}</td><td className="invoice-money">{formatMoney(item.precioUnitario)}</td><td className="invoice-money"><strong>{formatMoney(item.subtotal)}</strong></td></tr>)}
      </tbody></table></div>
      <div className="invoice-totals"><div><span>Subtotal</span><strong>{formatMoney(invoice.subtotal)}</strong></div><div className="invoice-grand-total"><span>Total</span><strong>{formatMoney(invoice.total)}</strong></div></div>
    </section>

    <section className="ui-card invoice-detail-card">
      <h2>Validación Fiscal y Comunicación SIAT (SIN)</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '20px', alignItems: 'start' }}>
        <div className="invoice-result-grid" style={{ marginTop: 0 }}>
          <div><span>Estado factura</span><strong>{invoice.estado}</strong></div>
          <div><span>Modalidad SIN</span><strong>Computarizada en Línea</strong></div>
          <div><span>Resultado SIN</span><SinBadge value={invoice.sinEstado} referencia={invoice.sinReferencia} /></div>
          {invoice.emitidaPor && <div><span>Emitida por</span><strong>{invoice.emitidaPor}</strong></div>}
          {invoice.sinReferencia && <div><span>Referencia / Paquete</span><code>{invoice.sinReferencia}</code></div>}
          {invoice.codigoAutorizacion && <div><span>Código de autorización</span><code>{invoice.codigoAutorizacion}</code></div>}
          {invoice.cuf && (
            <div className="invoice-result-wide">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span>Código Único de Factura (CUF - Módulo 11 Base 16)</span>
                <button
                  type="button"
                  onClick={handleCopyCuf}
                  style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                >
                  {copiedCuf ? '✓ ¡Copiado!' : '📋 Copiar CUF'}
                </button>
              </div>
              <code style={{ wordBreak: 'break-all', fontSize: '0.85rem' }}>{invoice.cuf}</code>
            </div>
          )}
        </div>

        {invoice.cuf && (
          <div style={{ textAlign: 'center', padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', minWidth: '150px' }}>
            <QRCodeSVG value={qrUrl} size={120} level="M" />
            <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', marginTop: '6px' }}>
              QR Fiscal Oficial SIN
            </span>
            <a
              href={qrUrl}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'inline-block', fontSize: '0.75rem', color: '#2563eb', marginTop: '4px', textDecoration: 'underline' }}
            >
              Consultar en SIAT ↗
            </a>
          </div>
        )}
      </div>

      <div style={{ marginTop: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
        <a
          href={getInvoiceXmlUrl(invoice.id)}
          target="_blank"
          rel="noreferrer"
          className="button button-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
        >
          📄 Descargar XML Oficial (XSD Compra-Venta)
        </a>
      </div>
    </section>

    {showCancelModal && (
      <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="cancel-title">
        <div className="modal-card" style={{ maxWidth: '480px', width: '100%' }}>
          <header className="modal-header">
            <h2 id="cancel-title" style={{ margin: 0, fontSize: '1.2rem', color: '#b91c1c' }}>
              🚫 Anular Factura Fiscal
            </h2>
            <button type="button" className="modal-close" onClick={() => setShowCancelModal(false)}>✕</button>
          </header>
          <div style={{ padding: '16px 20px' }}>
            <p style={{ margin: '0 0 12px', fontSize: '0.9rem', color: '#334155' }}>
              ¿Está seguro de anular la factura <strong>{invoice.numeroFactura}</strong>? Esta acción reportará la anulación al SIN conforme a la normativa vigente.
            </p>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: '#1e293b' }}>
              Motivo de Anulación (Catálogo Oficial SIN):
            </label>
            <select
              value={cancelReason}
              onChange={(e) => setCancelReason(Number(e.target.value))}
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '14px' }}
            >
              <option value={1}>1 - Factura mal emitida</option>
              <option value={2}>2 - Datos de emisión incorrectos</option>
              <option value={3}>3 - Factura devuelta</option>
              <option value={4}>4 - Otro / Modificación clínica</option>
            </select>
            {cancelError && (
              <p style={{ color: '#dc2626', fontSize: '0.85rem', margin: '0 0 10px' }}>⚠️ {cancelError}</p>
            )}
          </div>
          <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '12px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <button type="button" className="button button-secondary" onClick={() => setShowCancelModal(false)} disabled={cancelling}>
              Cancelar
            </button>
            <button
              type="button"
              className="button"
              style={{ background: '#dc2626', borderColor: '#b91c1c', color: '#fff' }}
              onClick={handleConfirmCancel}
              disabled={cancelling}
            >
              {cancelling ? 'Anulando...' : 'Confirmar Anulación ante el SIN'}
            </button>
          </footer>
        </div>
      </div>
    )}

    <Link className="button button-secondary invoice-back" to="/facturacion">Volver al listado</Link>
  </main>;
}


export function BillingInvoicesPage() {
  const paginationKey = useListPagination();
  const { invoiceId } = useParams();
  const [invoices, setInvoices] = useState([]);
  const [patients, setPatients] = useState([]);
  const [filters, setFilters] = useState({ search: '', patientId: '', date: '' });
  const [applied, setApplied] = useState({ search: '', patientId: '', date: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const loadInvoices = useCallback(async (query) => {
    setLoading(true); setError('');
    try { setInvoices((await getIssuedInvoices(query)).invoices); }
    catch (requestError) { setError(requestError.status === 403 ? 'No tiene permisos para consultar información de facturación.' : requestError.message || 'No fue posible cargar la información de facturación.'); }
    finally { setLoading(false); }
  }, [paginationKey]);
  useEffect(() => {
    if (invoiceId) return undefined;
    let active = true;
    Promise.all([getIssuedInvoices(applied), getPatients()]).then(([invoiceResponse, patientResponse]) => {
      if (!active) return;
      setInvoices(invoiceResponse.invoices); setPatients(patientResponse.patients);
    }).catch((requestError) => { if (active) setError(requestError.message || 'No fue posible cargar la información de facturación.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [invoiceId, paginationKey]);
  if (invoiceId) return <InvoiceDetail invoiceId={invoiceId} />;
  function submit(event) {
    event.preventDefault(); setApplied(filters); loadInvoices(filters);
  }
  function clearFilters() {
    const empty = { search: '', patientId: '', date: '' };
    setFilters(empty); setApplied(empty); loadInvoices(empty);
  }
  const hasFilters = Object.values(applied).some(Boolean);
  return <main className="billing-page invoice-query-page">
    <PageContext breadcrumbs={[{ label: 'Inicio', to: '/dashboard' }, { label: 'Facturación' }]} subtitle="Consulta de facturas emitidas" title="Facturación" />
    <form className="ui-card invoice-filters" onSubmit={submit}>
      <label>Buscar factura o receptor<input aria-label="Buscar por número, receptor o NIT CI" placeholder="Número, razón social o NIT/CI" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></label>
      <label>Paciente<select aria-label="Filtrar por paciente" value={filters.patientId} onChange={(event) => setFilters({ ...filters, patientId: event.target.value })}><option value="">Todos los pacientes</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.apellidos} {patient.nombres}</option>)}</select></label>
      <label>Fecha de emisión<input aria-label="Filtrar por fecha de emisión" type="date" value={filters.date} onChange={(event) => setFilters({ ...filters, date: event.target.value })} /></label>
      <div className="invoice-filter-actions"><Button disabled={loading} type="submit">Buscar</Button>{hasFilters && <Button disabled={loading} onClick={clearFilters} variant="secondary">Limpiar</Button>}</div>
    </form>
    {error && <p className="billing-alert error" role="alert">{error}</p>}
    <section className="ui-card invoice-list-card">
      <div className="invoice-list-heading"><div><h2>Facturas emitidas</h2><p>Resultados paginados, desde la emisión más reciente.</p></div><strong>{invoices.length}</strong></div>
      {loading ? <p className="invoice-state">Cargando facturas emitidas...</p> : invoices.length === 0 ? <p className="invoice-state">{hasFilters ? 'No se encontraron facturas con los criterios seleccionados.' : 'No hay facturas emitidas registradas.'}</p> :
        <div className="billing-table-wrap"><table className="billing-table invoice-list"><thead><tr><th>N° factura</th><th>Paciente / receptor</th><th>Fecha</th><th>Total</th><th>Estado</th><th>Resultado SIN</th><th>Acción</th></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id}><td><strong>{invoice.numeroFactura}</strong><small>{invoice.receptor.nitCi || 'Sin NIT/CI'}</small></td><td>{invoice.paciente.nombre}<small>{invoice.receptor.razonSocial}</small></td><td>{formatDate(invoice.fechaEmision)}</td><td className="invoice-money"><strong>{formatMoney(invoice.total)}</strong></td><td><span className="invoice-badge invoice-issued">{invoice.estado}</span></td><td><SinBadge value={invoice.sinEstado} /></td><td><Link className="invoice-detail-link" to={`/facturacion/${invoice.id}`}>Ver detalle</Link></td></tr>)}</tbody></table></div>}
    </section>
  </main>;
}
