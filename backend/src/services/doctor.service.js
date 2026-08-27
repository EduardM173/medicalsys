const { Prisma } = require('@prisma/client');
const prisma = require('../config/prisma');

const doctorSelect = {
  id_medico: true,
  id_usuario: true,
  matricula_profesional: true,
  especialidad: true,
  activo: true,
  usuario: {
    select: {
      id_usuario: true,
      nombres: true,
      apellidos: true,
      email: true,
      telefono: true,
      estado: true,
      rol: { select: { codigo: true } }
    }
  }
};

class DoctorError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function parseId(value, entity) {
  if (!/^\d+$/.test(String(value)) || BigInt(value) < 1n) {
    throw new DoctorError(400, `Identificador de ${entity} no válido.`);
  }
  return BigInt(value);
}

function requiredText(value, fieldName, maxLength) {
  const normalized = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (!normalized) {
    throw new DoctorError(400, `${fieldName} es obligatorio.`);
  }
  if (normalized.length > maxLength) {
    throw new DoctorError(400, `${fieldName} supera la longitud permitida.`);
  }
  return normalized;
}

function toDoctor(doctor) {
  const fullName = `${doctor.usuario.nombres} ${doctor.usuario.apellidos}`.trim();
  return {
    id: Number(doctor.id_medico),
    usuarioId: Number(doctor.id_usuario),
    nombre: fullName,
    nombreCompleto: fullName,
    matriculaProfesional: doctor.matricula_profesional,
    especialidad: doctor.especialidad,
    activo: doctor.activo,
    estado: doctor.activo ? 'ACTIVO' : 'INACTIVO',
    usuario: {
      id: Number(doctor.usuario.id_usuario),
      nombres: doctor.usuario.nombres,
      apellidos: doctor.usuario.apellidos,
      email: doctor.usuario.email,
      telefono: doctor.usuario.telefono,
      estado: doctor.usuario.estado,
      rol: doctor.usuario.rol.codigo
    }
  };
}

async function ensureUniqueLicense(license, excludeId) {
  const existing = await prisma.medico.findFirst({
    where: {
      matricula_profesional: license,
      ...(excludeId ? { id_medico: { not: excludeId } } : {})
    },
    select: { id_medico: true }
  });
  if (existing) {
    throw new DoctorError(409, 'La matrícula profesional ya está registrada.');
  }
}

async function createDoctor(input) {
  const userId = parseId(input.usuarioId, 'usuario');
  const license = requiredText(input.matriculaProfesional, 'La matrícula profesional', 100);
  const specialty = requiredText(input.especialidad, 'La especialidad', 150);

  const user = await prisma.usuario.findUnique({
    where: { id_usuario: userId },
    include: { rol: { select: { codigo: true } }, medico: { select: { id_medico: true } } }
  });
  if (!user) {
    throw new DoctorError(404, 'Usuario no encontrado.');
  }
  if (user.rol.codigo !== 'MEDICO') {
    throw new DoctorError(400, 'El usuario seleccionado no posee el rol MEDICO.');
  }
  if (user.medico) {
    throw new DoctorError(409, 'El usuario ya posee un perfil médico.');
  }
  await ensureUniqueLicense(license);

  try {
    const doctor = await prisma.medico.create({
      data: {
        id_usuario: userId,
        matricula_profesional: license,
        especialidad: specialty,
        activo: true
      },
      select: doctorSelect
    });
    return toDoctor(doctor);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = String(error.meta?.target || '');
      if (target.includes('id_usuario')) {
        throw new DoctorError(409, 'El usuario ya posee un perfil médico.');
      }
      throw new DoctorError(409, 'La matrícula profesional ya está registrada.');
    }
    throw error;
  }
}

async function listDoctors(searchInput = '') {
  const search = typeof searchInput === 'string' ? searchInput.trim().slice(0, 100) : '';
  const doctors = await prisma.medico.findMany({
    where: search ? {
      OR: [
        { matricula_profesional: { contains: search, mode: 'insensitive' } },
        { especialidad: { contains: search, mode: 'insensitive' } },
        { usuario: { nombres: { contains: search, mode: 'insensitive' } } },
        { usuario: { apellidos: { contains: search, mode: 'insensitive' } } }
      ]
    } : undefined,
    orderBy: [{ usuario: { apellidos: 'asc' } }, { usuario: { nombres: 'asc' } }],
    select: doctorSelect
  });
  return doctors.map(toDoctor);
}

async function getDoctorById(idInput) {
  const id = parseId(idInput, 'médico');
  const doctor = await prisma.medico.findUnique({
    where: { id_medico: id },
    select: doctorSelect
  });
  if (!doctor) {
    throw new DoctorError(404, 'Médico no encontrado.');
  }
  return toDoctor(doctor);
}

async function updateDoctor(idInput, input) {
  const id = parseId(idInput, 'médico');
  const existing = await prisma.medico.findUnique({ where: { id_medico: id } });
  if (!existing) {
    throw new DoctorError(404, 'Médico no encontrado.');
  }

  const allowedFields = ['matriculaProfesional', 'especialidad', 'activo'];
  if (!allowedFields.some((field) => input[field] !== undefined)) {
    throw new DoctorError(400, 'No se enviaron campos profesionales para actualizar.');
  }

  const data = { fecha_actualizacion: new Date() };
  if (input.matriculaProfesional !== undefined) {
    const license = requiredText(input.matriculaProfesional, 'La matrícula profesional', 100);
    if (license !== existing.matricula_profesional) await ensureUniqueLicense(license, id);
    data.matricula_profesional = license;
  }
  if (input.especialidad !== undefined) {
    data.especialidad = requiredText(input.especialidad, 'La especialidad', 150);
  }
  if (input.activo !== undefined) {
    if (typeof input.activo !== 'boolean') {
      throw new DoctorError(400, 'El estado activo debe ser verdadero o falso.');
    }
    data.activo = input.activo;
  }

  try {
    const doctor = await prisma.medico.update({
      where: { id_medico: id },
      data,
      select: doctorSelect
    });
    return toDoctor(doctor);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new DoctorError(409, 'La matrícula profesional ya está registrada.');
    }
    throw error;
  }
}

module.exports = { createDoctor, DoctorError, getDoctorById, listDoctors, updateDoctor };
