import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { PageContext } from '../components/PageContext';
import { getIssuedInvoice, getIssuedInvoices, getPatients } from '../services/api';
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
function SinBadge({ value }) {
  const simulated = value === 'SIMULADA';
  return <span className={`invoice-badge invoice-sin-${String(value || '').toLowerCase()}`}>{simulated ? 'SIMULACIÓN' : value || '—'}</span>;
}

function InvoiceDetail({ invoiceId }) {
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    getIssuedInvoice(invoiceId)
      .then((response) => { if (active) setInvoice(response.invoice); })
      .catch((requestError) => { if (active) setError(requestError.status === 404 ? 'Factura no encontrada.' : requestError.message || 'No fue posible cargar la información de facturación.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [invoiceId]);
  if (loading) return <main className="billing-page invoice-query-page"><p className="invoice-state">Cargando factura...</p></main>;
  if (error) return <main className="billing-page invoice-query-page"><p className="billing-alert error" role="alert">{error}</p><Link className="button button-secondary" to="/facturacion">Volver a facturas</Link></main>;
  return <main className="billing-page invoice-query-page">
    <PageContext
      actions={<div className="invoice-badges"><span className="invoice-badge invoice-issued">{invoice.estado}</span><SinBadge value={invoice.sinEstado} /></div>}
      breadcrumbs={[{ label: 'Inicio', to: '/dashboard' }, { label: 'Facturación', to: '/facturacion' }, { label: invoice.numeroFactura }]}
      subtitle={`Emitida el ${formatDate(invoice.fechaEmision)}`}
      title={`Factura ${invoice.numeroFactura}`}
    />
    {invoice.sinEstado === 'SIMULADA' && <p className="invoice-simulation-notice">Simulación de desarrollo: esta factura no representa una aceptación real del SIN.</p>}
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
    <section className="ui-card invoice-detail-card"><h2>Resultado de emisión</h2>
      <div className="invoice-result-grid"><div><span>Estado factura</span><strong>{invoice.estado}</strong></div><div><span>Resultado SIN</span><SinBadge value={invoice.sinEstado} /></div>{invoice.emitidaPor && <div><span>Emitida por</span><strong>{invoice.emitidaPor}</strong></div>}{invoice.sinReferencia && <div><span>Referencia SIN</span><code>{invoice.sinReferencia}</code></div>}{invoice.codigoAutorizacion && <div><span>Código de autorización</span><code>{invoice.codigoAutorizacion}</code></div>}{invoice.cuf && <div className="invoice-result-wide"><span>CUF</span><code>{invoice.cuf}</code></div>}</div>
    </section>
    <Link className="button button-secondary invoice-back" to="/facturacion">Volver al listado</Link>
  </main>;
}

export function BillingInvoicesPage() {
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
  }, []);
  useEffect(() => {
    if (invoiceId) return undefined;
    let active = true;
    Promise.all([getIssuedInvoices({}), getPatients()]).then(([invoiceResponse, patientResponse]) => {
      if (!active) return;
      setInvoices(invoiceResponse.invoices); setPatients(patientResponse.patients);
    }).catch((requestError) => { if (active) setError(requestError.message || 'No fue posible cargar la información de facturación.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [invoiceId]);
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
      <div className="invoice-list-heading"><div><h2>Facturas emitidas</h2><p>Se muestran hasta 100 resultados, desde la emisión más reciente.</p></div><strong>{invoices.length}</strong></div>
      {loading ? <p className="invoice-state">Cargando facturas emitidas...</p> : invoices.length === 0 ? <p className="invoice-state">{hasFilters ? 'No se encontraron facturas con los criterios seleccionados.' : 'No hay facturas emitidas registradas.'}</p> :
        <div className="billing-table-wrap"><table className="billing-table invoice-list"><thead><tr><th>N° factura</th><th>Paciente / receptor</th><th>Fecha</th><th>Total</th><th>Estado</th><th>Resultado SIN</th><th>Acción</th></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id}><td><strong>{invoice.numeroFactura}</strong><small>{invoice.receptor.nitCi || 'Sin NIT/CI'}</small></td><td>{invoice.paciente.nombre}<small>{invoice.receptor.razonSocial}</small></td><td>{formatDate(invoice.fechaEmision)}</td><td className="invoice-money"><strong>{formatMoney(invoice.total)}</strong></td><td><span className="invoice-badge invoice-issued">{invoice.estado}</span></td><td><SinBadge value={invoice.sinEstado} /></td><td><Link className="invoice-detail-link" to={`/facturacion/${invoice.id}`}>Ver detalle</Link></td></tr>)}</tbody></table></div>}
    </section>
  </main>;
}
