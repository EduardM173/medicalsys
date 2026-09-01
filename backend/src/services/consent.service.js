const crypto = require('crypto');
const { Prisma } = require('@prisma/client');
const prisma = require('../config/prisma');

const folioAttempts = 3;

const consentSelect = {
  id_consentimiento: true,
  folio: true,
  procedimiento: true,
  contenido: true,
  estado: true,
  fecha_generacion: true,
  fecha_firma: true,
  firma_storage_key: true,
  firma_hash_sha256: true,
  paciente: {
    select: { id_paciente: true, nombres: true, apellidos: true }
  },
  medico: {
    select: {
      id_medico: true,
      especialidad: true,
      usuario: { select: { nombres: true, apellidos: true } }
    }
  },
  cita: {
    select: {
      id_cita: true,
      fecha_hora_inicio: true,
      fecha_hora_fin: true,
      estado: true,
      servicio_medico: { select: { nombre: true } }
    }
  }
};

class ConsentError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function parseId(value, entity, optional = false) {
  if (optional && (value === undefined || value === null || value === '')) return null;
  if (!/^\d+$/.test(String(value)) || BigInt(value) < 1n) {
    throw new ConsentError(400, `Identificador de ${entity} no válido.`);
  }
  return BigInt(value);
}

function requiredText(value, fieldName, maxLength) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    throw new ConsentError(400, `${fieldName} es obligatorio.`);
  }
  if (normalized.length > maxLength) {
    throw new ConsentError(400, `${fieldName} supera la longitud permitida.`);
  }
  return normalized;
}

function generateFolio() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `CI-${datePart}-${randomPart}`;
}

function toDoctor(doctor) {
  return {
    id: Number(doctor.id_medico),
    fullName: `${doctor.usuario.nombres} ${doctor.usuario.apellidos}`.trim(),
    specialty: doctor.especialidad
  };
}

function toPatient(patient) {
  return {
    id: Number(patient.id_paciente),
    fullName: `${patient.nombres} ${patient.apellidos}`.trim()
  };
}

function toAppointment(appointment) {
  if (!appointment) return null;
  return {
    id: Number(appointment.id_cita),
    startTime: appointment.fecha_hora_inicio.toISOString(),
    endTime: appointment.fecha_hora_fin.toISOString(),
    status: appointment.estado,
    service: appointment.servicio_medico.nombre
  };
}

function toConsent(consent) {
  return {
    id: Number(consent.id_consentimiento),
    folio: consent.folio,
    procedure: consent.procedimiento,
    content: consent.contenido,
    status: consent.estado,
    generatedAt: consent.fecha_generacion.toISOString(),
    signedAt: consent.fecha_firma?.toISOString() || null,
    hasSignature: Boolean(consent.firma_storage_key || consent.firma_hash_sha256),
    patient: toPatient(consent.paciente),
    doctor: toDoctor(consent.medico),
    appointment: toAppointment(consent.cita)
  };
}

async function findAuthenticatedDoctor(userIdInput) {
  const doctor = await prisma.medico.findUnique({
    where: { id_usuario: BigInt(userIdInput) },
    select: {
      id_medico: true,
      especialidad: true,
      usuario: { select: { nombres: true, apellidos: true } }
    }
  });
  if (!doctor) {
    throw new ConsentError(
      403,
      'El usuario autenticado no posee un perfil médico asociado.'
    );
  }
  return doctor;
}

async function validateAssociations(patientId, doctorId, appointmentId) {
  const patient = await prisma.paciente.findUnique({
    where: { id_paciente: patientId },
    select: { id_paciente: true }
  });
  if (!patient) throw new ConsentError(404, 'Paciente no encontrado.');

  if (!appointmentId) return;
  const appointment = await prisma.cita.findUnique({
    where: { id_cita: appointmentId },
    select: { id_paciente: true, id_medico: true }
  });
  if (!appointment) throw new ConsentError(404, 'Cita no encontrada.');
  if (appointment.id_paciente !== patientId) {
    throw new ConsentError(400, 'La cita no corresponde al paciente seleccionado.');
  }
  if (appointment.id_medico !== doctorId) {
    throw new ConsentError(403, 'La cita no corresponde al médico autenticado.');
  }
}

function isFolioCollision(error) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }
  return String(error.meta?.target || '').includes('folio');
}

async function createConsent(userIdInput, input) {
  const patientId = parseId(input.patientId, 'paciente');
  const appointmentId = parseId(input.appointmentId, 'cita', true);
  const procedure = requiredText(input.procedure, 'El procedimiento', 255);
  const content = requiredText(input.content, 'El contenido', 100000);
  const doctor = await findAuthenticatedDoctor(userIdInput);
  await validateAssociations(patientId, doctor.id_medico, appointmentId);

  for (let attempt = 1; attempt <= folioAttempts; attempt += 1) {
    try {
      const consent = await prisma.consentimiento_informado.create({
        data: {
          id_paciente: patientId,
          id_medico: doctor.id_medico,
          id_cita: appointmentId,
          folio: generateFolio(),
          procedimiento: procedure,
          contenido: content,
          estado: 'GENERADO'
        },
        select: consentSelect
      });
      return toConsent(consent);
    } catch (error) {
      if (!isFolioCollision(error) || attempt === folioAttempts) throw error;
    }
  }

  throw new ConsentError(500, 'No fue posible generar un folio único.');
}

async function getConsentById(userIdInput, consentIdInput) {
  const consentId = parseId(consentIdInput, 'consentimiento');
  const doctor = await findAuthenticatedDoctor(userIdInput);
  const consent = await prisma.consentimiento_informado.findFirst({
    where: { id_consentimiento: consentId, id_medico: doctor.id_medico },
    select: consentSelect
  });
  if (!consent) {
    throw new ConsentError(404, 'Consentimiento informado no encontrado.');
  }
  return toConsent(consent);
}

async function getConsentOptions(userIdInput) {
  const doctor = await findAuthenticatedDoctor(userIdInput);
  const [patients, appointments] = await Promise.all([
    prisma.paciente.findMany({
      where: { activo: true },
      orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }],
      select: { id_paciente: true, nombres: true, apellidos: true }
    }),
    prisma.cita.findMany({
      where: { id_medico: doctor.id_medico },
      orderBy: { fecha_hora_inicio: 'desc' },
      take: 100,
      select: {
        id_cita: true,
        id_paciente: true,
        fecha_hora_inicio: true,
        fecha_hora_fin: true,
        estado: true,
        servicio_medico: { select: { nombre: true } }
      }
    })
  ]);

  return {
    doctor: toDoctor(doctor),
    patients: patients.map(toPatient),
    appointments: appointments.map((appointment) => ({
      ...toAppointment(appointment),
      patientId: Number(appointment.id_paciente)
    }))
  };
}

module.exports = {
  ConsentError,
  createConsent,
  getConsentById,
  getConsentOptions
};
