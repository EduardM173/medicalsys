const { Prisma } = require('@prisma/client');
const prisma = require('../config/prisma');
const SinFacturacionProvider = require('./sin/sin.service');

const paymentMethods = ['EFECTIVO', 'QR', 'TARJETA', 'TRANSFERENCIA', 'OTRO'];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class BillingError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function parseId(value, entity) {
  if (!/^\d+$/.test(String(value)) || BigInt(value) < 1n) {
    throw new BillingError(400, `Identificador de ${entity} no válido.`);
  }
  return BigInt(value);
}

function normalizeText(value) {
  return String(value).trim().replace(/\s+/g, ' ');
}

function requiredText(value, fieldName, maxLength) {
  const normalized = typeof value === 'string' ? normalizeText(value) : '';
  if (!normalized) throw new BillingError(400, `${fieldName} es obligatorio.`);
  if (normalized.length > maxLength) {
    throw new BillingError(400, `${fieldName} supera la longitud permitida.`);
  }
  return normalized;
}

function optionalText(value, fieldName, maxLength) {
  if (value === undefined || value === null) return null;
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw new BillingError(400, `${fieldName} supera la longitud permitida.`);
  }
  return normalized;
}

function money(value) {
  return new Prisma.Decimal(value).toDecimalPlaces(2).toFixed(2);
}

async function ensureActiveClinicConfig() {
  let configuration = await prisma.configuracion_clinica.findFirst({
    where: { activa: true }
  });
  if (!configuration) {
    configuration = await prisma.configuracion_clinica.create({
      data: {
        nombre_comercial: 'MedicalSys Centro Médico',
        razon_social: 'MEDICALSYS S.R.L.',
        nit: '1023942027',
        direccion: 'Av. Arce Nro. 2300, La Paz',
        telefono: '+591 2 244 0000',
        email: 'facturacion@medicalsys.bo',
        ciudad: 'La Paz',
        pais: 'Bolivia',
        activa: true
      }
    });
  }
  return configuration;
}

async function generateNumeroFactura(configuration) {
  const count = await prisma.factura.count();
  const anio = new Date().getFullYear();
  const secuencia = String(count + 1).padStart(8, '0');
  return `${configuration.nit} 0 0${configuration.id_configuracion}-${anio}${secuencia}`.slice(0, 60);
}

async function prepareInvoice(input = {}) {
  const patientId = parseId(input.pacienteId, 'paciente');
  const patient = await prisma.paciente.findUnique({
    where: { id_paciente: patientId },
    select: {
      id_paciente: true,
      nombres: true,
      apellidos: true,
      documento_identidad: true,
      complemento: true,
      email: true,
      activo: true
    }
  });

  if (!patient || !patient.activo) {
    throw new BillingError(404, 'Paciente no encontrado o inactivo.');
  }

  let appointment = null;
  if (input.citaId !== undefined && input.citaId !== null && input.citaId !== '') {
    const appointmentId = parseId(input.citaId, 'cita');
    appointment = await prisma.cita.findUnique({
      where: { id_cita: appointmentId },
      select: {
        id_cita: true,
        id_paciente: true,
        estado: true,
        fecha_hora_inicio: true,
        medico: {
          select: {
            especialidad: true,
            usuario: { select: { nombres: true, apellidos: true } }
          }
        },
        servicio_medico: {
          select: { id_servicio: true, codigo: true, nombre: true }
        }
      }
    });
    if (!appointment) throw new BillingError(404, 'Cita no encontrada.');
    if (appointment.id_paciente !== patientId) {
      throw new BillingError(400, 'La cita seleccionada no pertenece al paciente.');
    }
  }

  if (!Array.isArray(input.conceptos) || input.conceptos.length === 0) {
    throw new BillingError(400, 'Debe agregar al menos un concepto facturable.');
  }
  if (input.conceptos.length > 50) {
    throw new BillingError(400, 'No se permiten más de 50 conceptos por preparación.');
  }

  const normalizedItems = input.conceptos.map((item, index) => {
    const serviceId = parseId(item?.servicioId, `servicio del concepto ${index + 1}`);
    const quantity = Number(item?.cantidad);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999) {
      throw new BillingError(400, `La cantidad del concepto ${index + 1} debe ser un entero entre 1 y 9999.`);
    }
    return { serviceId, quantity };
  });

  const duplicateIds = normalizedItems
    .map((item) => item.serviceId.toString())
    .filter((id, index, ids) => ids.indexOf(id) !== index);
  if (duplicateIds.length) {
    throw new BillingError(400, 'Cada servicio debe aparecer una sola vez; ajuste su cantidad.');
  }

  const services = await prisma.servicio_medico.findMany({
    where: {
      id_servicio: { in: normalizedItems.map((item) => item.serviceId) },
      activo: true
    },
    select: {
      id_servicio: true,
      codigo: true,
      nombre: true,
      precio_base: true
    }
  });
  const servicesById = new Map(services.map((service) => [service.id_servicio.toString(), service]));

  let subtotal = new Prisma.Decimal(0);
  const concepts = normalizedItems.map(({ serviceId, quantity }, index) => {
    const service = servicesById.get(serviceId.toString());
    if (!service) {
      throw new BillingError(404, `El servicio del concepto ${index + 1} no existe o está inactivo.`);
    }
    const unitPrice = new Prisma.Decimal(service.precio_base).toDecimalPlaces(2);
    const itemSubtotal = unitPrice.mul(quantity).toDecimalPlaces(2);
    subtotal = subtotal.add(itemSubtotal);
    return {
      servicioId: Number(service.id_servicio),
      codigo: service.codigo,
      descripcion: service.nombre,
      cantidad: quantity,
      precioUnitario: money(unitPrice),
      subtotal: money(itemSubtotal)
    };
  });
  subtotal = subtotal.toDecimalPlaces(2);

  const receiverInput = input.receptor && typeof input.receptor === 'object' ? input.receptor : {};
  const document = optionalText(receiverInput.nitCi, 'El NIT/CI', 40)
    || patient.documento_identidad;
  const complement = optionalText(receiverInput.complemento, 'El complemento', 10)
    ?? patient.complemento
    ?? '';
  const businessName = requiredText(
    receiverInput.razonSocial,
    'La razón social o nombre del receptor',
    200
  );
  const email = optionalText(receiverInput.email, 'El correo del receptor', 150);
  if (email && !emailPattern.test(email)) {
    throw new BillingError(400, 'El correo del receptor no es válido.');
  }

  if (!paymentMethods.includes(input.metodoPago)) {
    throw new BillingError(400, 'El método de pago no es válido.');
  }

  const clinicConfig = await ensureActiveClinicConfig();
  const numeroFactura = await generateNumeroFactura(clinicConfig);

  const factura = await prisma.factura.create({
    data: {
      id_configuracion_clinica: clinicConfig.id_configuracion,
      id_paciente: patientId,
      id_cita: appointment ? appointment.id_cita : null,
      numero_factura: numeroFactura,
      nit_ci: document,
      complemento: complement,
      razon_social: businessName,
      email_receptor: email,
      metodo_pago: input.metodoPago,
      subtotal: money(subtotal),
      total: money(subtotal),
      estado: 'BORRADOR',
      sin_estado: 'NO_ENVIADA',
      detalle_factura: {
        create: concepts.map((concept) => ({
          id_servicio: BigInt(concept.servicioId),
          descripcion: concept.descripcion,
          cantidad: concept.cantidad,
          precio_unitario: concept.precioUnitario,
          subtotal: concept.subtotal
        }))
      }
    },
    select: { id_factura: true, numero_factura: true }
  });

  return {
    estrategia: 'PREPARADA_Y_PERSISTIDA',
    persistida: true,
    id: Number(factura.id_factura),
    numeroFactura: factura.numero_factura,
    estado: 'BORRADOR',
    configuracion: {
      nombreComercial: clinicConfig.nombre_comercial,
      razonSocial: clinicConfig.razon_social,
      nit: clinicConfig.nit,
      direccion: clinicConfig.direccion,
      telefono: clinicConfig.telefono,
      email: clinicConfig.email,
      ciudad: clinicConfig.ciudad,
      pais: clinicConfig.pais
    },
    paciente: {
      id: Number(patient.id_paciente),
      nombre: `${patient.nombres} ${patient.apellidos}`.trim(),
      documentoIdentidad: patient.documento_identidad,
      complemento: patient.complemento,
      email: patient.email
    },
    cita: appointment ? {
      id: Number(appointment.id_cita),
      estado: appointment.estado,
      fechaHoraInicio: appointment.fecha_hora_inicio.toISOString(),
      medico: `${appointment.medico.usuario.nombres} ${appointment.medico.usuario.apellidos}`.trim(),
      especialidad: appointment.medico.especialidad,
      servicio: {
        id: Number(appointment.servicio_medico.id_servicio),
        codigo: appointment.servicio_medico.codigo,
        nombre: appointment.servicio_medico.nombre
      }
    } : null,
    receptor: {
      nitCi: document,
      complemento: complement,
      razonSocial: businessName,
      email
    },
    metodoPago: input.metodoPago,
    conceptos: concepts,
    subtotal: money(subtotal),
    total: money(subtotal),
    advertencia: 'Factura preparada como borrador. Aún no contacta al SIN ni reserva una autorización definitiva.'
  };
}

async function emitirFacturaComputarizada(idFactura, userId) {
  const facturaId = parseId(idFactura, 'factura');

  const factura = await prisma.factura.findUnique({
    where: { id_factura: facturaId },
    include: {
      detalle_factura: {
        include: {
          servicio_medico: { select: { id_servicio: true, codigo: true, nombre: true } }
        }
      },
      configuracion_clinica: true,
      paciente: {
        select: {
          id_paciente: true,
          nombres: true,
          apellidos: true,
          documento_identidad: true,
          complemento: true
        }
      },
      usuario: { select: { nombres: true, apellidos: true } }
    }
  });

  if (!factura) {
    throw new BillingError(404, 'Factura no encontrada.');
  }

  // MED-189/MED-196: idempotencia de emisión.
  if (factura.estado === 'EMITIDA') {
    throw new BillingError(400, 'La factura ya fue emitida; no se permite una segunda emisión.');
  }
  if (factura.estado === 'ANULADA') {
    throw new BillingError(400, 'La factura está anulada y no puede emitirse.');
  }

  // MED-191: validación de datos del receptor y de ítems antes de emitir.
  if (!factura.razon_social || !factura.nit_ci) {
    throw new BillingError(400, 'La factura debe contar con receptor (NIT/CI y razón social) para ser emitida.');
  }
  if (!factura.detalle_factura || factura.detalle_factura.length === 0) {
    throw new BillingError(400, 'La factura debe contener al menos un ítem detallado para ser emitida.');
  }

  // MED-188: el adaptador SIN genera CUF, cadena QR y timestamp de emisión.
  const resultado = await SinFacturacionProvider.emitir({
    factura,
    configuracion: factura.configuracion_clinica
  });
  if (!resultado.success) {
    throw new BillingError(502, resultado.errorMessage || 'El SIN rechazó la factura.');
  }

  const fechaEmision = resultado.fechaEmision || new Date();

  const emitida = await prisma.factura.update({
    where: { id_factura: facturaId },
    data: {
      estado: 'EMITIDA',
      sin_estado: resultado.sinEstado,
      cuf: resultado.cuf,
      qr_payload: resultado.qrPayload,
      codigo_autorizacion: resultado.codigoAutorizacion,
      sin_referencia: resultado.sinReferencia,
      fecha_emision: fechaEmision,
      emitida_por: userId ? BigInt(userId) : null
    },
    include: {
      detalle_factura: {
        include: {
          servicio_medico: { select: { id_servicio: true, codigo: true, nombre: true } }
        }
      },
      configuracion_clinica: true,
      paciente: {
        select: {
          id_paciente: true,
          nombres: true,
          apellidos: true,
          documento_identidad: true,
          complemento: true
        }
      }
    }
  });

  const configuracion = emitida.configuracion_clinica;
  return {
    id: Number(emitida.id_factura),
    numeroFactura: emitida.numero_factura,
    estado: emitida.estado,
    sinEstado: emitida.sin_estado,
    cuf: emitida.cuf,
    qrPayload: emitida.qr_payload,
    codigoAutorizacion: emitida.codigo_autorizacion,
    sinReferencia: emitida.sin_referencia,
    fechaEmision: emitida.fecha_emision.toISOString(),
    metodoPago: emitida.metodo_pago,
    subtotal: money(emitida.subtotal),
    total: money(emitida.total),
    emitidaPor: {
      nombre: `${factura.usuario?.nombres || ''} ${factura.usuario?.apellidos || ''}`.trim() || null
    },
    configuracion: {
      nombreComercial: configuracion.nombre_comercial,
      razonSocial: configuracion.razon_social,
      nit: configuracion.nit,
      direccion: configuracion.direccion,
      telefono: configuracion.telefono,
      email: configuracion.email,
      ciudad: configuracion.ciudad,
      pais: configuracion.pais
    },
    receptor: {
      nitCi: emitida.nit_ci,
      complemento: emitida.complemento,
      razonSocial: emitida.razon_social,
      email: emitida.email_receptor
    },
    conceptos: emitida.detalle_factura.map((item) => ({
      servicioId: Number(item.id_servicio),
      codigo: item.servicio_medico?.codigo || '',
      descripcion: item.descripcion,
      cantidad: item.cantidad,
      precioUnitario: money(item.precio_unitario),
      subtotal: money(item.subtotal)
    }))
  };
}

module.exports = { BillingError, paymentMethods, prepareInvoice, emitirFacturaComputarizada };