import React, { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '../components/Button';
import {
  ApiError,
  emitBilling,
  getAppointments,
  getPatients,
  getServices,
  prepareBilling
} from '../services/api';
import '../styles/billing.css';

const paymentMethods = [
  ['EFECTIVO', 'Efectivo'],
  ['QR', 'QR'],
  ['TARJETA', 'Tarjeta'],
  ['TRANSFERENCIA', 'Transferencia'],
  ['OTRO', 'Otro']
];

function formatMoneyFromCents(cents) {
  return new Intl.NumberFormat('es-BO', {
    style: 'currency',
    currency: 'BOB',
    minimumFractionDigits: 2
  }).format(cents / 100);
}

function formatMoney(value) {
  const number = Number(value);
  return Number.isFinite(number) ? formatMoneyFromCents(Math.round(number * 100)) : 'Bs 0,00';
}

function formatAppointment(appointment) {
  const date = new Date(appointment.fechaHoraInicio);
  return `${new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeStyle: 'short' }).format(date)} · ${appointment.servicio.nombre}`;
}

function paymentLabel(value) {
  return paymentMethods.find(([code]) => code === value)?.[1] || value || '—';
}

function formatFechaEmision(value) {
  if (!value) return 'Pendiente';
  return new Intl.DateTimeFormat('es-BO', { dateStyle: 'long', timeStyle: 'medium' }).format(new Date(value));
}

function TicketUi({ data, emitted = false }) {
  return (
    <div className={`ticket${emitted ? ' ticket-emitida' : ''}`}>
      <header className="ticket-header">
        <strong>{data.configuracion?.nombreComercial || 'MedicalSys Centro Médico'}</strong>
        <span>{data.configuracion?.razonSocial || ''}</span>
        <small>
          NIT: {data.configuracion?.nit || '—'}
          {data.configuracion?.direccion ? ` · ${data.configuracion.direccion}` : ''}
        </small>
        {data.configuracion?.telefono && <small>Tel: {data.configuracion.telefono}</small>}
      </header>

      {emitted && data.cuf && (
        <p className="ticket-leyenda">
          FACTURA COMPUTARIZADA · LEY Nº 453 · <em>“Este documento solo tiene validez con la verificación en el SIN”</em>
        </p>
      )}

      <dl className="ticket-rows">
        <div><dt>Factura Nº</dt><dd>{data.numeroFactura || '—'}</dd></div>
        <div><dt>Fecha emisión</dt><dd>{formatFechaEmision(emitted ? data.fechaEmision : null)}</dd></div>
        <div><dt>NIT/CI</dt><dd>{data.receptor?.nitCi || '—'}{data.receptor?.complemento ? ` ${data.receptor.complemento}` : ''}</dd></div>
        <div><dt>Razón social</dt><dd>{data.receptor?.razonSocial || '—'}</dd></div>
        <div><dt>Método de pago</dt><dd>{paymentLabel(data.metodoPago)}</dd></div>
      </dl>

      <table className="ticket-items">
        <thead><tr><th>Detalle</th><th>Cant.</th><th>Subtotal</th></tr></thead>
        <tbody>
          {(data.conceptos || []).map((item) => (
            <tr key={item.servicioId || item.descripcion}>
              <td><strong>{item.descripcion}</strong>{item.codigo ? <small>{item.codigo}</small> : null}</td>
              <td>{item.cantidad}</td>
              <td>{formatMoney(item.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ticket-total">
        <span>Total Bs</span>
        <strong>{formatMoney(data.total)}</strong>
      </div>

      <div className={`ticket-cuf${emitted && data.cuf ? ' ticket-cuf-activo' : ''}`}>
        <span>CUF · CÓDIGO ÚNICO DE FACTURACIÓN</span>
        {emitted && data.cuf ? <code>{data.cuf}</code> : <small>Pendiente de autorización del SIN</small>}
      </div>

      <div className="ticket-qr">
        {emitted && data.qrPayload ? (
          <>
            <div className="ticket-qr-frame"><QRCodeSVG value={data.qrPayload} size={104} level="M" includeMargin={false} /></div>
            <small>Verifique con el SIAT escaneando el QR</small>
          </>
        ) : (
          <div className="ticket-qr-empty" aria-hidden="true" />
        )}
      </div>

      {emitted && data.sinReferencia && <div className="ticket-autorizacion">Autorizada por SIN · {data.sinReferencia}</div>}
    </div>
  );
}

export function BillingPreparationPage() {
  const [patients, setPatients] = useState([]);
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [emitting, setEmitting] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [emittedInvoice, setEmittedInvoice] = useState(null);
  const [copied, setCopied] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const ticketRef = useRef(null);
  const [form, setForm] = useState({
    pacienteId: '',
    citaId: '',
    nitCi: '',
    complemento: '',
    razonSocial: '',
    email: '',
    metodoPago: 'EFECTIVO'
  });
  const [items, setItems] = useState([]);

  useEffect(() => {
    let active = true;
    async function loadOptions() {
      try {
        const [patientsResponse, servicesResponse] = await Promise.all([
          getPatients(),
          getServices()
        ]);
        if (!active) return;
        setPatients(patientsResponse.patients);
        setServices(servicesResponse.services);
      } catch (requestError) {
        if (active) setError(requestError.message || 'No fue posible cargar los datos de facturación.');
      } finally {
        if (active) setLoading(false);
      }
    }
    loadOptions();
    return () => { active = false; };
  }, []);

  const servicesById = useMemo(
    () => new Map(services.map((service) => [String(service.id), service])),
    [services]
  );

  const localTotalCents = items.reduce((total, item) => {
    const service = servicesById.get(String(item.servicioId));
    const unitCents = Math.round(Number(service?.precioBase || 0) * 100);
    return total + unitCents * Number(item.cantidad || 0);
  }, 0);

  const liveTicketData = useMemo(() => {
    if (preview) return preview;
    const patient = patients.find((option) => String(option.id) === form.pacienteId);
    const conceptos = items.map((item) => {
      const service = servicesById.get(String(item.servicioId));
      const unit = Number(service?.precioBase || 0);
      const cantidad = Number(item.cantidad || 0);
      return {
        servicioId: item.servicioId,
        descripcion: service?.nombre || '—',
        codigo: service?.codigo || '',
        cantidad,
        precioUnitario: unit,
        subtotal: unit * cantidad
      };
    });
    return {
      numeroFactura: 'Pendiente',
      configuracion: null,
      receptor: {
        nitCi: form.nitCi || patient?.documentoIdentidad || '',
        complemento: form.complemento || '',
        razonSocial: form.razonSocial
          || (patient ? `${patient.nombres} ${patient.apellidos}`.trim() : ''),
        email: form.email
      },
      metodoPago: form.metodoPago,
      conceptos,
      total: localTotalCents / 100
    };
  }, [preview, patients, form, items, servicesById, localTotalCents]);

  function markChanged() {
    setPreview(null);
    setError('');
  }

  function setField(field, value) {
    markChanged();
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function selectPatient(value) {
    const patient = patients.find((option) => String(option.id) === value);
    markChanged();
    setItems([]);
    setAppointments([]);
    setForm((current) => ({
      ...current,
      pacienteId: value,
      citaId: '',
      nitCi: patient?.documentoIdentidad || '',
      complemento: patient?.complemento || '',
      razonSocial: patient ? `${patient.nombres} ${patient.apellidos}`.trim() : '',
      email: patient?.email || ''
    }));
    if (!value) return;

    setAppointmentsLoading(true);
    try {
      const response = await getAppointments({ pacienteId: value });
      setAppointments(response.appointments);
    } catch (requestError) {
      setError(requestError.message || 'No fue posible cargar las citas del paciente.');
    } finally {
      setAppointmentsLoading(false);
    }
  }

  function selectAppointment(value) {
    markChanged();
    setForm((current) => ({ ...current, citaId: value }));
    const appointment = appointments.find((option) => String(option.id) === value);
    if (appointment && !items.some((item) => item.servicioId === appointment.servicio.id)) {
      setItems((current) => [...current, { servicioId: appointment.servicio.id, cantidad: 1 }]);
    }
  }

  function addService() {
    if (!selectedServiceId) return;
    const serviceId = Number(selectedServiceId);
    if (items.some((item) => item.servicioId === serviceId)) {
      setError('Ese servicio ya está agregado; ajuste su cantidad.');
      return;
    }
    markChanged();
    setItems((current) => [...current, { servicioId: serviceId, cantidad: 1 }]);
    setSelectedServiceId('');
  }

  function changeQuantity(serviceId, value) {
    markChanged();
    setItems((current) => current.map((item) => (
      item.servicioId === serviceId ? { ...item, cantidad: value } : item
    )));
  }

  function removeItem(serviceId) {
    markChanged();
    setItems((current) => current.filter((item) => item.servicioId !== serviceId));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setPreview(null);
    setEmittedInvoice(null);
    if (!form.pacienteId) {
      setError('Seleccione un paciente.');
      return;
    }
    if (!form.razonSocial.trim()) {
      setError('Ingrese la razón social o nombre del receptor.');
      return;
    }
    if (!items.length) {
      setError('Agregue al menos un concepto facturable.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await prepareBilling({
        pacienteId: Number(form.pacienteId),
        citaId: form.citaId ? Number(form.citaId) : undefined,
        receptor: {
          nitCi: form.nitCi,
          complemento: form.complemento,
          razonSocial: form.razonSocial,
          email: form.email
        },
        metodoPago: form.metodoPago,
        conceptos: items.map((item) => ({
          servicioId: item.servicioId,
          cantidad: Number(item.cantidad)
        }))
      });
      setPreview(response.preview);
    } catch (requestError) {
      setError(requestError instanceof ApiError
        ? requestError.message
        : 'No fue posible preparar la factura.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEmit() {
    if (!preview?.id) return;
    setError('');
    setCopied(false);
    setEmitting(true);
    try {
      const response = await emitBilling(preview.id);
      setEmittedInvoice(response.factura);
      setPreview(null);
    } catch (requestError) {
      let message = requestError instanceof ApiError
        ? requestError.message
        : 'No fue posible emitir la factura.';
      if (requestError?.status === 400) message = 'Esta factura ya fue emitida; no es posible emitirla nuevamente.';
      setError(message);
      setPreview(null);
    } finally {
      setEmitting(false);
    }
  }

  async function copyCuf() {
    if (!emittedInvoice?.cuf) return;
    try {
      await navigator.clipboard.writeText(emittedInvoice.cuf);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_error) {
      setError('No fue posible copiar el CUF.');
    }
  }

  function handlePrint() {
    if (ticketRef.current) {
      window.print();
    }
  }

  function closeSuccessModal() {
    setEmittedInvoice(null);
    setPreview(null);
    setForm({ ...form, pacienteId: '', citaId: '', nitCi: '', complemento: '', razonSocial: '', email: '' });
    setItems([]);
  }

  return (
    <main className="billing-page">
      <header className="billing-header billing-header-hero animate-fade-in">
        <div>
          <span className="billing-eyebrow">Módulo de Facturación</span>
          <h1>Emitir factura computarizada</h1>
          <p>Prepare, valide y emita la factura con respaldo del SIN/SIAT.</p>
        </div>
        <span className={`billing-status${emittedInvoice || (preview && preview.estado === 'EMITIDA') ? ' billing-status-emitida' : ''}`}>
          {emittedInvoice || (preview && preview.estado === 'EMITIDA') ? 'Factura Emitida y Autorizada' : 'Borrador de Factura'}
        </span>
      </header>

      {loading ? (
        <section className="billing-card billing-message">Cargando pacientes y servicios...</section>
      ) : (
        <div className="billing-layout">
          <section className="billing-left">
            <form className="billing-form-card ui-card animate-fade-in" onSubmit={handleSubmit}>
              <section className="billing-card">
                <div className="billing-section-heading">
                  <span>1</span>
              <div><h2>Paciente y atención</h2><p>La cita es opcional y puede precargar su servicio.</p></div>
            </div>
            <div className="billing-grid">
              <div className="form-field">
                <label htmlFor="billing-patient">Paciente *</label>
                <select id="billing-patient" onChange={(event) => selectPatient(event.target.value)} value={form.pacienteId}>
                  <option value="">Seleccione un paciente</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.apellidos} {patient.nombres} · CI {patient.documentoIdentidad}{patient.complemento ? ` ${patient.complemento}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="billing-appointment">Cita relacionada (opcional)</label>
                <select
                  disabled={!form.pacienteId || appointmentsLoading}
                  id="billing-appointment"
                  onChange={(event) => selectAppointment(event.target.value)}
                  value={form.citaId}
                >
                  <option value="">{appointmentsLoading ? 'Cargando citas...' : 'Sin cita relacionada'}</option>
                  {appointments.map((appointment) => (
                    <option key={appointment.id} value={appointment.id}>{formatAppointment(appointment)}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="billing-card">
            <div className="billing-section-heading">
              <span>2</span>
              <div><h2>Datos del receptor</h2><p>Se completan desde el paciente y pueden revisarse antes de preparar.</p></div>
            </div>
            <div className="billing-grid billing-grid-receiver">
              <div className="form-field"><label htmlFor="billing-name">Razón social / nombre *</label><input id="billing-name" maxLength={200} onChange={(event) => setField('razonSocial', event.target.value)} value={form.razonSocial} /></div>
              <div className="form-field"><label htmlFor="billing-document">NIT / CI</label><input id="billing-document" maxLength={40} onChange={(event) => setField('nitCi', event.target.value)} value={form.nitCi} /></div>
              <div className="form-field"><label htmlFor="billing-complement">Complemento</label><input id="billing-complement" maxLength={10} onChange={(event) => setField('complemento', event.target.value)} value={form.complemento} /></div>
              <div className="form-field"><label htmlFor="billing-email">Correo</label><input id="billing-email" maxLength={150} onChange={(event) => setField('email', event.target.value)} type="email" value={form.email} /></div>
              <div className="form-field"><label htmlFor="billing-payment">Método de pago *</label><select id="billing-payment" onChange={(event) => setField('metodoPago', event.target.value)} value={form.metodoPago}>{paymentMethods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            </div>
          </section>

          <section className="billing-card">
            <div className="billing-section-heading">
              <span>3</span>
              <div><h2>Conceptos facturables</h2><p>Los precios provienen del catálogo y no son editables.</p></div>
            </div>
            <div className="billing-add-row">
              <select aria-label="Servicio para agregar" onChange={(event) => setSelectedServiceId(event.target.value)} value={selectedServiceId}>
                <option value="">Seleccione un servicio</option>
                {services.map((service) => <option key={service.id} value={service.id}>{service.codigo} · {service.nombre} · {formatMoney(service.precioBase)}</option>)}
              </select>
              <Button onClick={addService} type="button" variant="secondary">+ Agregar concepto</Button>
            </div>

            {items.length === 0 ? <p className="billing-empty">Todavía no agregó conceptos.</p> : (
              <div className="billing-table-wrap">
                <table className="billing-table">
                  <thead><tr><th>Descripción</th><th>Cantidad</th><th>Precio unitario</th><th>Subtotal</th><th><span className="sr-only">Acciones</span></th></tr></thead>
                  <tbody>{items.map((item) => {
                    const service = servicesById.get(String(item.servicioId));
                    const subtotalCents = Math.round(Number(service?.precioBase || 0) * 100) * Number(item.cantidad || 0);
                    return <tr key={item.servicioId}>
                      <td><strong>{service?.nombre}</strong><small>{service?.codigo}</small></td>
                      <td><input aria-label={`Cantidad de ${service?.nombre}`} className="billing-quantity" min="1" max="9999" onChange={(event) => changeQuantity(item.servicioId, event.target.value)} step="1" type="number" value={item.cantidad} /></td>
                      <td>{formatMoney(service?.precioBase)}</td>
                      <td><strong>{formatMoneyFromCents(subtotalCents)}</strong></td>
                      <td><button aria-label={`Quitar ${service?.nombre}`} className="billing-remove" onClick={() => removeItem(item.servicioId)} type="button">×</button></td>
                    </tr>;
                  })}</tbody>
                </table>
              </div>
            )}
            <div className="billing-total"><span>Total estimado</span><strong>{formatMoneyFromCents(localTotalCents)}</strong></div>
          </section>

          {error && <p className="billing-alert error" role="alert">{error}</p>}
          <div className="billing-actions"><Button disabled={submitting} type="submit">{submitting ? 'Validando...' : 'Preparar vista previa'}</Button></div>
            </form>
          </section>

          <aside className="billing-ticket-deck animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="billing-deck-head">
              <span>Ticket fiscal · 80 mm</span>
              {preview ? <em>Preparada · Nº {preview.numeroFactura}</em> : <em>Previsualización en tiempo real</em>}
            </div>
            <div className="billing-deck-inner">
              <div ref={ticketRef}>
                <TicketUi data={liveTicketData} emitted={false} />
              </div>
            </div>
            {preview && (
              <div className="billing-emit-actions">
                <Button disabled={emitting} onClick={handleEmit} type="button" variant="teal">
                  {emitting ? 'Autorizando con el SIN...' : 'Emitir factura computarizada'}
                </Button>
              </div>
            )}
          </aside>
        </div>
      )}

      {emittedInvoice && (
        <div className="billing-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="billing-success-title">
          <div className="billing-modal">
            <div className="billing-modal-head">
              <span className="billing-success-check" aria-hidden="true">✓</span>
              <div><h2 id="billing-success-title">Factura emitida correctamente</h2><p>El SIN autorizó el documento fiscal.</p></div>
              <span className="billing-invoice-badge">Autorizada por SIN</span>
            </div>

            <div id="ticket-impresion" ref={ticketRef}>
              <TicketUi data={emittedInvoice} emitted />
            </div>

            <div className="billing-modal-actions">
              <Button onClick={handlePrint} type="button" variant="teal">Imprimir Ticket</Button>
              <Button onClick={copyCuf} type="button" variant="gold">{copied ? 'CUF copiado ✓' : 'Copiar CUF'}</Button>
              <Button onClick={closeSuccessModal} type="button" variant="ghost">Cerrar</Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}