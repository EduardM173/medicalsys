import React, { useEffect, useState, useMemo } from 'react';
import {
  getPatients,
  getMedicalServices,
  getClinicBillingConfig,
  createInvoice,
  issueInvoice,
  getInvoices
} from '../services/api';
import { TicketFiscal80mm } from '../components/TicketFiscal80mm';
import { FacturaConfirmationModal } from '../components/FacturaConfirmationModal';
import { numeroALetras } from '../utils/numeroALetras';
import '../styles/facturacion.css';

export function FacturacionPage() {
  const [activeTab, setActiveTab] = useState('emitir'); // 'emitir' | 'historial'

  // Datos de la clínica
  const [clinica, setClinica] = useState(null);

  // Directorio de Pacientes y Catálogo de Servicios
  const [pacientes, setPacientes] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [servicioSeleccionadoId, setServicioSeleccionadoId] = useState('');

  // Estado del Formulario
  const [idPaciente, setIdPaciente] = useState('');
  const [pacienteSearch, setPacienteSearch] = useState('');
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [nitCi, setNitCi] = useState('');
  const [complemento, setComplemento] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [emailReceptor, setEmailReceptor] = useState('');
  const [metodoPago, setMetodoPago] = useState('QR_SIMPLE');

  // Ítems de la factura
  const [items, setItems] = useState([
    {
      idTemp: 'init-1',
      idServicio: null,
      descripcion: 'Consulta Médica General',
      cantidad: 1,
      precioUnitario: 100,
      subtotal: 100
    }
  ]);

  // Estado de Emisión y Carga
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Factura Emitida y Modal de Confirmación
  const [facturaEmitida, setFacturaEmitida] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Historial de Facturas
  const [historial, setHistorial] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [facturaSeleccionadaHistorial, setFacturaSeleccionadaHistorial] = useState(null);

  // Cargar datos iniciales
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [clinicaData, pacientesData, serviciosData] = await Promise.all([
          getClinicBillingConfig().catch(() => null),
          getPatients().catch(() => []),
          getMedicalServices().catch(() => [])
        ]);

        if (clinicaData) setClinica(clinicaData);
        if (Array.isArray(pacientesData)) setPacientes(pacientesData);
        if (Array.isArray(serviciosData)) {
          setServicios(serviciosData);
          if (serviciosData.length > 0) {
            setServicioSeleccionadoId(serviciosData[0].id.toString());
            // Si el ítem por defecto no tiene idServicio, asociarlo
            setItems((prev) => [
              {
                idTemp: 'init-1',
                idServicio: serviciosData[0].id.toString(),
                descripcion: serviciosData[0].nombre,
                cantidad: 1,
                precioUnitario: serviciosData[0].precioBase,
                subtotal: serviciosData[0].precioBase
              }
            ]);
          }
        }
      } catch (err) {
        console.error('Error al cargar datos iniciales de facturación:', err);
      }
    }
    loadInitialData();
  }, []);

  // Cargar historial si se cambia a la pestaña de historial
  useEffect(() => {
    if (activeTab === 'historial') {
      cargarHistorial();
    }
  }, [activeTab]);

  async function cargarHistorial() {
    setLoadingHistorial(true);
    try {
      const data = await getInvoices();
      setHistorial(data || []);
    } catch (err) {
      console.error('Error al cargar historial de facturas:', err);
    } finally {
      setLoadingHistorial(false);
    }
  }

  // Filtrado de pacientes en autocompletar
  const pacientesFiltrados = useMemo(() => {
    if (!pacienteSearch) return [];
    const query = pacienteSearch.toLowerCase().trim();
    return pacientes.filter((p) => {
      const nombreCompleto = `${p.nombres} ${p.apellidos}`.toLowerCase();
      const ci = (p.documento_identidad || p.documentoIdentidad || '').toLowerCase();
      return nombreCompleto.includes(query) || ci.includes(query);
    }).slice(0, 8);
  }, [pacientes, pacienteSearch]);

  function handleSelectPaciente(paciente) {
    const ci = paciente.documento_identidad || paciente.documentoIdentidad || '';
    const comp = paciente.complemento || '';
    const nombre = `${paciente.nombres} ${paciente.apellidos}`.trim();
    const email = paciente.email || '';

    setIdPaciente(paciente.id_paciente?.toString() || paciente.id?.toString() || '');
    setPacienteSearch(nombre);
    setNitCi(ci);
    setComplemento(comp);
    setRazonSocial(nombre);
    setEmailReceptor(email);
    setShowPatientDropdown(false);
    setErrorMessage('');
  }

  // Manejo de ítems
  function handleAddServiceFromCatalog() {
    if (!servicioSeleccionadoId) return;
    const serv = servicios.find((s) => s.id.toString() === servicioSeleccionadoId);
    if (!serv) return;

    setItems((prev) => [
      ...prev,
      {
        idTemp: `item-${Date.now()}-${Math.random()}`,
        idServicio: serv.id.toString(),
        descripcion: serv.nombre,
        cantidad: 1,
        precioUnitario: serv.precioBase,
        subtotal: serv.precioBase
      }
    ]);
  }

  function handleAddCustomItem() {
    setItems((prev) => [
      ...prev,
      {
        idTemp: `custom-${Date.now()}`,
        idServicio: null,
        descripcion: 'Servicio Médico Adicional',
        cantidad: 1,
        precioUnitario: 50,
        subtotal: 50
      }
    ]);
  }

  function handleUpdateItem(index, field, value) {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[index] };

      if (field === 'cantidad') {
        const cant = Math.max(1, parseInt(value, 10) || 1);
        item.cantidad = cant;
        item.subtotal = Math.round(cant * item.precioUnitario * 100) / 100;
      } else if (field === 'precioUnitario') {
        const precio = Math.max(0, parseFloat(value) || 0);
        item.precioUnitario = precio;
        item.subtotal = Math.round(item.cantidad * precio * 100) / 100;
      } else if (field === 'descripcion') {
        item.descripcion = value;
      }

      next[index] = item;
      return next;
    });
  }

  function handleRemoveItem(index) {
    if (items.length <= 1) {
      setErrorMessage('La factura debe tener al menos un ítem.');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
    setErrorMessage('');
  }

  // Cálculos de totales
  const total = useMemo(() => {
    const sum = items.reduce((acc, it) => acc + (Number(it.subtotal) || 0), 0);
    return Math.round(sum * 100) / 100;
  }, [items]);

  // Objeto de previsualización en tiempo real (Borrador)
  const facturaBorradorPreview = useMemo(() => {
    return {
      numeroFactura: 'FAC-BORRADOR',
      nitCi: nitCi || '0',
      complemento,
      razonSocial: razonSocial || 'CONSUMIDOR FINAL',
      emailReceptor,
      metodoPago,
      metodoPagoDisplay: metodoPago === 'QR_SIMPLE' ? 'QR Simple' : metodoPago === 'EFECTIVO' ? 'Efectivo' : 'Tarjeta',
      subtotal: total,
      total,
      items: items.map((it) => ({
        id: it.idTemp,
        descripcion: it.descripcion,
        cantidad: it.cantidad,
        precioUnitario: it.precioUnitario,
        subtotal: it.subtotal
      })),
      clinica
    };
  }, [nitCi, complemento, razonSocial, emailReceptor, metodoPago, total, items, clinica]);

  // Acción principal: Emitir Nueva Factura (MED-184, MED-185, MED-190, MED-193)
  async function handleEmitirFactura() {
    setErrorMessage('');

    // Validaciones del lado del cliente
    if (!nitCi.trim()) {
      setErrorMessage('Por favor ingrese el NIT o CI del receptor.');
      return;
    }
    if (!razonSocial.trim()) {
      setErrorMessage('Por favor ingrese la Razón Social o Nombre del receptor.');
      return;
    }
    if (!idPaciente) {
      // Si no seleccionó un paciente de la lista, intentamos buscarlo por CI o usar el primero
      const pacienteEncontrado = pacientes.find((p) => (p.documento_identidad || p.documentoIdentidad) === nitCi.trim());
      if (pacienteEncontrado) {
        setIdPaciente(pacienteEncontrado.id_paciente?.toString() || pacienteEncontrado.id?.toString());
      } else if (pacientes.length > 0) {
        setIdPaciente(pacientes[0].id_paciente?.toString() || pacientes[0].id?.toString());
      } else {
        setErrorMessage('No hay pacientes disponibles para asociar la factura.');
        return;
      }
    }

    if (items.length === 0) {
      setErrorMessage('Debe incluir al menos un ítem o prestación médica.');
      return;
    }

    setLoading(true);

    try {
      // 1. Crear factura borrador
      const pacienteFinalId = idPaciente || (pacientes[0]?.id_paciente?.toString() || pacientes[0]?.id?.toString());
      const nuevaFacturaData = {
        idPaciente: pacienteFinalId,
        nitCi: nitCi.trim(),
        complemento: complemento.trim(),
        razonSocial: razonSocial.trim(),
        emailReceptor: emailReceptor.trim(),
        metodoPago,
        items: items.map((it) => ({
          idServicio: it.idServicio,
          descripcion: it.descripcion,
          cantidad: it.cantidad,
          precioUnitario: it.precioUnitario
        }))
      };

      const facturaCreada = await createInvoice(nuevaFacturaData);

      // 2. Emitir factura computarizada ante el SIN
      const facturaEmitidaResult = await issueInvoice(facturaCreada.id);

      // 3. Éxito: Notificación y Modal de Confirmación
      setFacturaEmitida(facturaEmitidaResult);
      setShowModal(true);
      setToastMessage(`Factura N° ${facturaEmitidaResult.numeroFactura} autorizada con CUF y código QR oficial`);

      // Desvanecer toast tras 5 segundos
      setTimeout(() => setToastMessage(''), 5000);
    } catch (err) {
      console.error('Error al emitir factura:', err);
      setErrorMessage(err.message || 'Error al emitir factura computarizada. Intente nuevamente.');
    } finally {
      setLoading(false);
    }
  }

  function handleResetForm() {
    setShowModal(false);
    setFacturaEmitida(null);
    setNitCi('');
    setComplemento('');
    setRazonSocial('');
    setEmailReceptor('');
    setPacienteSearch('');
    setIdPaciente('');
    setErrorMessage('');
    if (servicios.length > 0) {
      setItems([
        {
          idTemp: `item-${Date.now()}`,
          idServicio: servicios[0].id.toString(),
          descripcion: servicios[0].nombre,
          cantidad: 1,
          precioUnitario: servicios[0].precioBase,
          subtotal: servicios[0].precioBase
        }
      ]);
    }
  }

  return (
    <div className="facturacion-page">
      {/* Toast Notificación Flotante (MED-190, MED-193 / PA-03) */}
      {toastMessage && (
        <div className="toast-floating" role="status" aria-live="polite">
          <span style={{ fontSize: '1.25rem' }}>✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Modal Prominente de Confirmación */}
      {showModal && facturaEmitida && (
        <FacturaConfirmationModal
          factura={facturaEmitida}
          onClose={() => setShowModal(false)}
          onNuevaFactura={handleResetForm}
        />
      )}

      {/* Modal para ver factura desde el historial */}
      {facturaSeleccionadaHistorial && (
        <FacturaConfirmationModal
          factura={facturaSeleccionadaHistorial}
          onClose={() => setFacturaSeleccionadaHistorial(null)}
        />
      )}

      {/* Encabezado Superior */}
      <header className="facturacion-header">
        <div className="facturacion-title-group">
          <h1>
            Facturación Computarizada
            <span className="facturacion-badge-bolivia">
              🇧🇴 SIN Bolivia • Modalidad en Línea
            </span>
          </h1>
          <p>Emisión electrónica de facturas con generación de CUF reglamentario y código QR oficial.</p>
        </div>

        {/* Selector de pestañas */}
        <div className="facturacion-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'emitir'}
            className={`facturacion-tab-btn ${activeTab === 'emitir' ? 'active' : ''}`}
            onClick={() => setActiveTab('emitir')}
          >
            + Nueva Emisión
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'historial'}
            className={`facturacion-tab-btn ${activeTab === 'historial' ? 'active' : ''}`}
            onClick={() => setActiveTab('historial')}
          >
            📋 Facturas Emitidas
          </button>
        </div>
      </header>

      {/* Alerta de Error */}
      {errorMessage && (
        <div className="billing-alert billing-alert-danger" role="alert">
          <span>⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {activeTab === 'emitir' ? (
        /* Workspace de Doble Columna (MED-190) */
        <div className="facturacion-workspace">
          {/* ============================================================
              COLUMNA IZQUIERDA: FORMULARIO DE FACTURACIÓN
              ============================================================ */}
          <div className="billing-card">
            <div className="billing-card-header">
              <h2>Datos de Emisión</h2>
              <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                Receptor y Prestaciones
              </span>
            </div>

            {/* Sección 1: Autocompletar y Datos del Receptor */}
            <section className="billing-section">
              <span className="billing-section-title">1. Datos del Paciente / Receptor</span>

              {/* Autocompletar desde el directorio de pacientes */}
              <div className="form-group patient-autocomplete-container">
                <label htmlFor="paciente-search">Buscar Paciente Registrado (Opcional)</label>
                <input
                  id="paciente-search"
                  type="text"
                  className="form-input"
                  placeholder="Escriba nombre o cédula de identidad..."
                  value={pacienteSearch}
                  onChange={(e) => {
                    setPacienteSearch(e.target.value);
                    setShowPatientDropdown(true);
                  }}
                  onFocus={() => setShowPatientDropdown(true)}
                  autoComplete="off"
                />

                {showPatientDropdown && pacientesFiltrados.length > 0 && (
                  <div className="patient-autocomplete-dropdown">
                    {pacientesFiltrados.map((p) => {
                      const id = p.id_paciente?.toString() || p.id?.toString();
                      const ci = p.documento_identidad || p.documentoIdentidad;
                      return (
                        <div
                          key={id}
                          className="patient-autocomplete-item"
                          onClick={() => handleSelectPaciente(p)}
                        >
                          <span className="patient-item-name">{p.nombres} {p.apellidos}</span>
                          <span className="patient-item-ci">CI: {ci}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Campos de NIT/CI y Razón Social */}
              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="input-nit-ci">NIT o CI del Receptor *</label>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <input
                      id="input-nit-ci"
                      type="text"
                      className="form-input"
                      placeholder="Ej. 4892104"
                      value={nitCi}
                      onChange={(e) => setNitCi(e.target.value)}
                      required
                      style={{ flex: 1 }}
                    />
                    <input
                      id="input-complemento"
                      type="text"
                      className="form-input"
                      placeholder="Compl."
                      title="Complemento de CI"
                      value={complemento}
                      onChange={(e) => setComplemento(e.target.value)}
                      style={{ width: '70px' }}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="input-razon-social">Nombre o Razón Social *</label>
                  <input
                    id="input-razon-social"
                    type="text"
                    className="form-input"
                    placeholder="Ej. Juan Pérez / Empresa S.A."
                    value={razonSocial}
                    onChange={(e) => setRazonSocial(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="input-email-receptor">Correo Electrónico (Para envío de factura digital)</label>
                <input
                  id="input-email-receptor"
                  type="email"
                  className="form-input"
                  placeholder="paciente@correo.com"
                  value={emailReceptor}
                  onChange={(e) => setEmailReceptor(e.target.value)}
                />
              </div>
            </section>

            {/* Sección 2: Selector estilizado de Método de Pago */}
            <section className="billing-section">
              <span className="billing-section-title">2. Método de Pago</span>
              <div className="payment-method-selector" role="radiogroup" aria-label="Método de pago">
                <button
                  type="button"
                  role="radio"
                  aria-checked={metodoPago === 'QR_SIMPLE'}
                  className={`payment-method-btn ${metodoPago === 'QR_SIMPLE' ? 'selected' : ''}`}
                  onClick={() => setMetodoPago('QR_SIMPLE')}
                  id="btn-pago-qr"
                >
                  <span className="payment-icon" aria-hidden="true">📱</span>
                  <span>QR Simple</span>
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={metodoPago === 'EFECTIVO'}
                  className={`payment-method-btn ${metodoPago === 'EFECTIVO' ? 'selected' : ''}`}
                  onClick={() => setMetodoPago('EFECTIVO')}
                  id="btn-pago-efectivo"
                >
                  <span className="payment-icon" aria-hidden="true">💵</span>
                  <span>Efectivo</span>
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={metodoPago === 'TARJETA'}
                  className={`payment-method-btn ${metodoPago === 'TARJETA' ? 'selected' : ''}`}
                  onClick={() => setMetodoPago('TARJETA')}
                  id="btn-pago-tarjeta"
                >
                  <span className="payment-icon" aria-hidden="true">💳</span>
                  <span>Tarjeta</span>
                </button>
              </div>
            </section>

            {/* Sección 3: Tabla Dinámica de Prestaciones Médicas e Ítems */}
            <section className="billing-section">
              <span className="billing-section-title">3. Prestaciones Médicas e Ítems</span>

              {/* Selector de servicios del catálogo */}
              {servicios.length > 0 && (
                <div className="add-service-row">
                  <select
                    className="form-select"
                    style={{ flex: 1 }}
                    value={servicioSeleccionadoId}
                    onChange={(e) => setServicioSeleccionadoId(e.target.value)}
                    id="select-servicio-catalogo"
                  >
                    {servicios.map((s) => (
                      <option key={s.id} value={s.id.toString()}>
                        {s.codigo} - {s.nombre} (Bs. {Number(s.precioBase).toFixed(2)})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-add-item"
                    onClick={handleAddServiceFromCatalog}
                    id="btn-agregar-servicio"
                  >
                    + Agregar del Catálogo
                  </button>
                </div>
              )}

              {/* Tabla de ítems */}
              <div className="items-table-wrapper">
                <table className="items-table">
                  <thead>
                    <tr>
                      <th style={{ width: '45%' }}>Concepto / Prestación</th>
                      <th style={{ width: '20%' }}>Cantidad</th>
                      <th style={{ width: '20%' }}>P. Unit (Bs.)</th>
                      <th style={{ width: '15%' }}>Subtotal</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => (
                      <tr key={it.idTemp}>
                        <td>
                          <input
                            type="text"
                            className="form-input"
                            style={{ height: '36px', fontSize: '0.8125rem' }}
                            value={it.descripcion}
                            onChange={(e) => handleUpdateItem(idx, 'descripcion', e.target.value)}
                          />
                        </td>
                        <td>
                          <div className="quantity-control">
                            <button
                              type="button"
                              className="quantity-btn"
                              onClick={() => handleUpdateItem(idx, 'cantidad', it.cantidad - 1)}
                            >
                              -
                            </button>
                            <input
                              type="number"
                              className="quantity-input"
                              min="1"
                              value={it.cantidad}
                              onChange={(e) => handleUpdateItem(idx, 'cantidad', e.target.value)}
                            />
                            <button
                              type="button"
                              className="quantity-btn"
                              onClick={() => handleUpdateItem(idx, 'cantidad', it.cantidad + 1)}
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-input"
                            style={{ height: '36px', width: '90px', fontSize: '0.8125rem' }}
                            min="0"
                            step="0.5"
                            value={it.precioUnitario}
                            onChange={(e) => handleUpdateItem(idx, 'precioUnitario', e.target.value)}
                          />
                        </td>
                        <td style={{ fontWeight: 'bold' }}>
                          Bs. {Number(it.subtotal).toFixed(2)}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="item-delete-btn"
                            title="Eliminar ítem"
                            onClick={() => handleRemoveItem(idx)}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-primary)',
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    fontWeight: '600'
                  }}
                  onClick={handleAddCustomItem}
                >
                  + Agregar concepto personalizado
                </button>
              </div>

              {/* Resumen financiero */}
              <div className="billing-financial-summary">
                <div className="summary-row">
                  <span>Subtotal:</span>
                  <span>Bs. {total.toFixed(2)}</span>
                </div>
                <div className="summary-row">
                  <span>Descuento:</span>
                  <span>Bs. 0.00</span>
                </div>
                <div className="summary-row total-row">
                  <span>TOTAL A PAGAR:</span>
                  <span>Bs. {total.toFixed(2)}</span>
                </div>
                <div className="summary-literal">
                  <strong>Son:</strong> {numeroALetras(total)}
                </div>
              </div>
            </section>

            {/* Botón Principal de Acción */}
            <button
              type="button"
              className="btn-emit-invoice"
              onClick={handleEmitirFactura}
              disabled={loading}
              id="btn-emitir-factura"
            >
              {loading ? (
                <>
                  <span className="spinner" aria-hidden="true"></span>
                  <span>Emitiendo y autorizando con SIN...</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '1.2rem' }}>🧾</span>
                  <span>Emitir Factura Computarizada</span>
                </>
              )}
            </button>
          </div>

          {/* ============================================================
              COLUMNA DERECHA: PREVISUALIZACIÓN EN VIVO DE TICKET 80MM
              ============================================================ */}
          <div className="ticket-preview-wrapper">
            <TicketFiscal80mm
              factura={facturaBorradorPreview}
              clinica={clinica}
              esBorrador={true}
            />
          </div>
        </div>
      ) : (
        /* Pestaña: Historial de Facturas Emitidas */
        <div className="billing-card">
          <div className="billing-card-header">
            <h2>Facturas Emitidas</h2>
            <button
              type="button"
              className="btn-secondary"
              onClick={cargarHistorial}
              style={{ fontSize: '0.8125rem', padding: '0.4rem 0.85rem' }}
            >
              ↻ Actualizar
            </button>
          </div>

          {loadingHistorial ? (
            <p style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
              Cargando historial de facturas...
            </p>
          ) : historial.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
              No se han emitido facturas en el sistema aún.
            </p>
          ) : (
            <div className="items-table-wrapper">
              <table className="items-table">
                <thead>
                  <tr>
                    <th>N° Factura</th>
                    <th>Fecha Emisión</th>
                    <th>NIT / CI</th>
                    <th>Razón Social</th>
                    <th>Método Pago</th>
                    <th>Total (Bs.)</th>
                    <th>Estado</th>
                    <th>CUF</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((fac) => (
                    <tr key={fac.id}>
                      <td style={{ fontWeight: 'bold' }}>{fac.numeroFactura}</td>
                      <td>
                        {fac.fechaEmision ? new Date(fac.fechaEmision).toLocaleString('es-BO') : '-'}
                      </td>
                      <td>{fac.nitCi}</td>
                      <td>{fac.razonSocial}</td>
                      <td>{fac.metodoPagoDisplay || fac.metodoPago}</td>
                      <td style={{ fontWeight: 'bold' }}>Bs. {Number(fac.total).toFixed(2)}</td>
                      <td>
                        <span
                          style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            background: fac.estado === 'EMITIDA' ? '#d1fae5' : '#fef3c7',
                            color: fac.estado === 'EMITIDA' ? '#065f46' : '#92400e'
                          }}
                        >
                          {fac.estado}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>
                        {fac.cuf ? `${fac.cuf.substring(0, 16)}...` : '-'}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                          onClick={() => setFacturaSeleccionadaHistorial(fac)}
                        >
                          Ver Ticket
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
