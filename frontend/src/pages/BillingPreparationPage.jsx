import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/Button';
import {
  ApiError,
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

export function BillingPreparationPage() {
  const [patients, setPatients] = useState([]);
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [selectedServiceId, setSelectedServiceId] = useState('');
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

  return (
    <main className="billing-page">
      <header className="billing-header">
        <div>
          <span className="billing-eyebrow">FACTURACIÓN</span>
          <h1>Preparar factura</h1>
          <p>Revise receptor, conceptos e importes antes de continuar con una futura emisión.</p>
        </div>
        <span className="billing-status">Vista previa · No emitida</span>
      </header>

      {loading ? (
        <section className="billing-card billing-message">Cargando pacientes y servicios...</section>
      ) : (
        <form onSubmit={handleSubmit}>
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
      )}

      {preview && (
        <section aria-live="polite" className="billing-preview">
          <div className="billing-preview-banner"><div><span>PREPARACIÓN VALIDADA</span><h2>Vista previa de factura</h2></div><strong>No emitida</strong></div>
          <div className="billing-preview-meta">
            <div><span>Paciente</span><strong>{preview.paciente.nombre}</strong><small>CI {preview.paciente.documentoIdentidad}{preview.paciente.complemento ? ` ${preview.paciente.complemento}` : ''}</small></div>
            <div><span>Receptor</span><strong>{preview.receptor.razonSocial}</strong><small>NIT/CI {preview.receptor.nitCi || 'Sin dato'}</small></div>
            <div><span>Método de pago</span><strong>{paymentMethods.find(([value]) => value === preview.metodoPago)?.[1] || preview.metodoPago}</strong><small>{preview.cita ? `Cita #${preview.cita.id}` : 'Sin cita relacionada'}</small></div>
          </div>
          <div className="billing-table-wrap">
            <table className="billing-table preview-table"><thead><tr><th>Concepto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead><tbody>
              {preview.conceptos.map((item) => <tr key={item.servicioId}><td><strong>{item.descripcion}</strong><small>{item.codigo}</small></td><td>{item.cantidad}</td><td>{formatMoney(item.precioUnitario)}</td><td><strong>{formatMoney(item.subtotal)}</strong></td></tr>)}
            </tbody></table>
          </div>
          <div className="billing-preview-total"><span>Total validado por el servidor</span><strong>{formatMoney(preview.total)}</strong></div>
          <p className="billing-warning">{preview.advertencia}</p>
        </section>
      )}
    </main>
  );
}
