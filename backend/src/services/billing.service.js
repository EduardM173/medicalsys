const { Prisma } = require('@prisma/client');
const prisma = require('../config/prisma');

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

  return {
    estrategia: 'VISTA_PREVIA_VALIDADA',
    persistida: false,
    estado: 'PREPARACION',
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
    advertencia: 'Vista previa no emitida. No reserva número de factura ni realiza operaciones con el SIN.'
  };
}

module.exports = { BillingError, paymentMethods, prepareInvoice };
