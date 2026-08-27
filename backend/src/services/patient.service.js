const { Prisma } = require('@prisma/client');
const prisma = require('../config/prisma');

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const patientSelect = {
  id_paciente: true,
  id_usuario: true,
  nombres: true,
  apellidos: true,
  documento_identidad: true,
  complemento: true,
  fecha_nacimiento: true,
  sexo: true,
  grupo_sanguineo: true,
  email: true,
  telefono: true,
  direccion: true,
  contacto_emergencia: true,
  telefono_emergencia: true,
  activo: true
};

class PatientError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function parsePatientId(value) {
  if (!/^\d+$/.test(String(value)) || BigInt(value) < 1n) {
    throw new PatientError(400, 'Identificador de paciente no válido.');
  }
  return BigInt(value);
}

function normalizeSpacing(value) {
  return String(value).trim().replace(/\s+/g, ' ');
}

function requiredText(value, fieldName, maxLength) {
  const normalized = typeof value === 'string' ? normalizeSpacing(value) : '';
  if (!normalized) {
    throw new PatientError(400, `${fieldName} es obligatorio.`);
  }
  if (normalized.length > maxLength) {
    throw new PatientError(400, `${fieldName} supera la longitud permitida.`);
  }
  return normalized;
}

function optionalText(value, fieldName, maxLength) {
  if (value === undefined || value === null) return null;
  const normalized = normalizeSpacing(value);
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw new PatientError(400, `${fieldName} supera la longitud permitida.`);
  }
  return normalized;
}

function normalizeDocument(value) {
  const document = requiredText(value, 'El documento de identidad', 30).replace(/\s+/g, '');
  if (!document) {
    throw new PatientError(400, 'El documento de identidad es obligatorio.');
  }
  return document;
}

function normalizeComplement(value) {
  const complement = optionalText(value, 'El complemento', 10);
  return complement ? complement.toUpperCase() : '';
}

function normalizeEmail(value) {
  const email = optionalText(value, 'El correo electrónico', 150);
  if (email && !emailPattern.test(email)) {
    throw new PatientError(400, 'El correo electrónico no es válido.');
  }
  return email ? email.toLowerCase() : null;
}

function normalizeBirthDate(value) {
  if (typeof value !== 'string' || !datePattern.test(value)) {
    throw new PatientError(400, 'La fecha de nacimiento no es válida.');
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new PatientError(400, 'La fecha de nacimiento no es válida.');
  }
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if (date > todayUtc) {
    throw new PatientError(400, 'La fecha de nacimiento no puede ser futura.');
  }
  return date;
}

function toPatient(patient) {
  return {
    id: Number(patient.id_paciente),
    nombres: patient.nombres,
    apellidos: patient.apellidos,
    documentoIdentidad: patient.documento_identidad,
    complemento: patient.complemento,
    fechaNacimiento: patient.fecha_nacimiento?.toISOString().slice(0, 10) || null,
    sexo: patient.sexo,
    grupoSanguineo: patient.grupo_sanguineo,
    email: patient.email,
    telefono: patient.telefono,
    direccion: patient.direccion,
    contactoEmergencia: patient.contacto_emergencia,
    telefonoEmergencia: patient.telefono_emergencia,
    activo: patient.activo,
    tieneCuenta: patient.id_usuario !== null
  };
}

async function ensureUniqueDocument(document, complement, excludeId) {
  const existing = await prisma.paciente.findFirst({
    where: {
      documento_identidad: document,
      complemento: complement,
      ...(excludeId ? { id_paciente: { not: excludeId } } : {})
    },
    select: { id_paciente: true }
  });
  if (existing) {
    throw new PatientError(409, 'Ya existe un paciente con este documento de identidad.');
  }
}

async function createPatient(input) {
  const document = normalizeDocument(input.documentoIdentidad);
  const complement = normalizeComplement(input.complemento);
  await ensureUniqueDocument(document, complement);

  const data = {
    documento_identidad: document,
    complemento: complement,
    nombres: requiredText(input.nombres, 'Los nombres', 100),
    apellidos: requiredText(input.apellidos, 'Los apellidos', 100),
    fecha_nacimiento: normalizeBirthDate(input.fechaNacimiento),
    telefono: requiredText(input.telefono, 'El teléfono', 30),
    email: normalizeEmail(input.email),
    sexo: optionalText(input.sexo, 'El sexo', 20),
    grupo_sanguineo: optionalText(input.grupoSanguineo, 'El grupo sanguíneo', 5),
    direccion: optionalText(input.direccion, 'La dirección', 255),
    contacto_emergencia: optionalText(input.contactoEmergencia, 'El contacto de emergencia', 150),
    telefono_emergencia: optionalText(input.telefonoEmergencia, 'El teléfono de emergencia', 30),
    activo: true
  };

  try {
    const patient = await prisma.paciente.create({ data, select: patientSelect });
    return toPatient(patient);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new PatientError(409, 'Ya existe un paciente con este documento de identidad.');
    }
    throw error;
  }
}

async function listPatients(searchInput = '') {
  const search = typeof searchInput === 'string' ? normalizeSpacing(searchInput).slice(0, 100) : '';
  const terms = search ? search.split(' ') : [];
  const patients = await prisma.paciente.findMany({
    where: {
      activo: true,
      ...(terms.length ? {
        AND: terms.map((term) => ({
          OR: [
            { nombres: { contains: term, mode: 'insensitive' } },
            { apellidos: { contains: term, mode: 'insensitive' } },
            { documento_identidad: { contains: term, mode: 'insensitive' } },
            { complemento: { contains: term, mode: 'insensitive' } }
          ]
        }))
      } : {})
    },
    orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }],
    select: patientSelect
  });
  return patients.map(toPatient);
}

async function getPatientById(idInput) {
  const id = parsePatientId(idInput);
  const patient = await prisma.paciente.findUnique({
    where: { id_paciente: id },
    select: patientSelect
  });
  if (!patient) {
    throw new PatientError(404, 'Paciente no encontrado.');
  }
  return toPatient(patient);
}

async function updatePatient(idInput, input) {
  const id = parsePatientId(idInput);
  const existing = await prisma.paciente.findUnique({ where: { id_paciente: id } });
  if (!existing) {
    throw new PatientError(404, 'Paciente no encontrado.');
  }

  const allowedFields = [
    'documentoIdentidad', 'complemento', 'nombres', 'apellidos', 'fechaNacimiento',
    'telefono', 'email', 'sexo', 'grupoSanguineo', 'direccion',
    'contactoEmergencia', 'telefonoEmergencia'
  ];
  if (!allowedFields.some((field) => input[field] !== undefined)) {
    throw new PatientError(400, 'No se enviaron campos para actualizar.');
  }

  const document = input.documentoIdentidad === undefined
    ? existing.documento_identidad
    : normalizeDocument(input.documentoIdentidad);
  const complement = input.complemento === undefined
    ? existing.complemento
    : normalizeComplement(input.complemento);
  if (document !== existing.documento_identidad || complement !== existing.complemento) {
    await ensureUniqueDocument(document, complement, id);
  }

  const data = {
    documento_identidad: document,
    complemento: complement,
    fecha_actualizacion: new Date()
  };
  if (input.nombres !== undefined) data.nombres = requiredText(input.nombres, 'Los nombres', 100);
  if (input.apellidos !== undefined) data.apellidos = requiredText(input.apellidos, 'Los apellidos', 100);
  if (input.fechaNacimiento !== undefined) data.fecha_nacimiento = normalizeBirthDate(input.fechaNacimiento);
  if (input.telefono !== undefined) data.telefono = requiredText(input.telefono, 'El teléfono', 30);
  if (input.email !== undefined) data.email = normalizeEmail(input.email);
  if (input.sexo !== undefined) data.sexo = optionalText(input.sexo, 'El sexo', 20);
  if (input.grupoSanguineo !== undefined) data.grupo_sanguineo = optionalText(input.grupoSanguineo, 'El grupo sanguíneo', 5);
  if (input.direccion !== undefined) data.direccion = optionalText(input.direccion, 'La dirección', 255);
  if (input.contactoEmergencia !== undefined) data.contacto_emergencia = optionalText(input.contactoEmergencia, 'El contacto de emergencia', 150);
  if (input.telefonoEmergencia !== undefined) data.telefono_emergencia = optionalText(input.telefonoEmergencia, 'El teléfono de emergencia', 30);

  try {
    const patient = await prisma.paciente.update({
      where: { id_paciente: id },
      data,
      select: patientSelect
    });
    return toPatient(patient);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new PatientError(409, 'Ya existe un paciente con este documento de identidad.');
    }
    throw error;
  }
}

module.exports = {
  createPatient,
  getPatientById,
  listPatients,
  PatientError,
  updatePatient
};
