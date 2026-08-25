const { Prisma } = require('@prisma/client');
const prisma = require('../config/prisma');

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

class ScheduleError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function parseId(value, entity) {
  if (!/^\d+$/.test(String(value)) || BigInt(value) < 1n) {
    throw new ScheduleError(400, `Identificador de ${entity} no válido.`);
  }
  return BigInt(value);
}

function validateDay(value) {
  const day = Number(value);
  if (!Number.isInteger(day) || day < 1 || day > 7) {
    throw new ScheduleError(400, 'El día de la semana no es válido.');
  }
  return day;
}

function validateTime(value, fieldName) {
  if (typeof value !== 'string' || !timePattern.test(value)) {
    throw new ScheduleError(400, `${fieldName} debe tener el formato HH:mm.`);
  }
  return value;
}

function timeToDate(value) {
  return new Date(`1970-01-01T${value}:00.000Z`);
}

function dateToTime(value) {
  return value.toISOString().slice(11, 16);
}

function validateInterval(start, end) {
  if (end <= start) {
    throw new ScheduleError(400, 'La hora de fin debe ser posterior a la hora de inicio.');
  }
}

function toDoctor(doctor) {
  return {
    id: Number(doctor.id_medico),
    nombre: `${doctor.usuario.nombres} ${doctor.usuario.apellidos}`.trim(),
    especialidad: doctor.especialidad,
    activo: doctor.activo
  };
}

function toSchedule(schedule) {
  return {
    id: Number(schedule.id_horario),
    medicoId: Number(schedule.id_medico),
    diaSemana: schedule.dia_semana,
    horaInicio: dateToTime(schedule.hora_inicio),
    horaFin: dateToTime(schedule.hora_fin),
    activo: schedule.activo
  };
}

async function findDoctor(doctorId) {
  const doctor = await prisma.medico.findUnique({
    where: { id_medico: doctorId },
    include: { usuario: { select: { nombres: true, apellidos: true } } }
  });
  if (!doctor) {
    throw new ScheduleError(404, 'Médico no encontrado.');
  }
  return doctor;
}

async function listDoctors() {
  const doctors = await prisma.medico.findMany({
    where: { activo: true, usuario: { estado: 'ACTIVO' } },
    orderBy: [{ usuario: { apellidos: 'asc' } }, { usuario: { nombres: 'asc' } }],
    include: { usuario: { select: { nombres: true, apellidos: true } } }
  });
  return doctors.map(toDoctor);
}

async function listSchedulesByDoctor(doctorIdInput, options = {}) {
  const doctorId = parseId(doctorIdInput, 'médico');
  const doctor = await findDoctor(doctorId);
  const schedules = await prisma.horario_medico.findMany({
    where: {
      id_medico: doctorId,
      ...(options.activeOnly ? { activo: true } : {})
    },
    orderBy: [{ dia_semana: 'asc' }, { hora_inicio: 'asc' }]
  });
  return { doctor: toDoctor(doctor), schedules: schedules.map(toSchedule) };
}

async function listActiveSchedulesByDoctor(doctorIdInput) {
  return listSchedulesByDoctor(doctorIdInput, { activeOnly: true });
}

async function assertNoOverlap({ doctorId, day, start, end, excludeId }) {
  const overlap = await prisma.horario_medico.findFirst({
    where: {
      id_medico: doctorId,
      dia_semana: day,
      activo: true,
      hora_inicio: { lt: end },
      hora_fin: { gt: start },
      ...(excludeId ? { id_horario: { not: excludeId } } : {})
    }
  });
  if (overlap) {
    throw new ScheduleError(409, 'El horario se superpone con otro horario activo del médico.');
  }
}

async function createSchedule(doctorIdInput, input) {
  const doctorId = parseId(doctorIdInput, 'médico');
  await findDoctor(doctorId);
  const day = validateDay(input.diaSemana);
  const startText = validateTime(input.horaInicio, 'La hora de inicio');
  const endText = validateTime(input.horaFin, 'La hora de fin');
  const start = timeToDate(startText);
  const end = timeToDate(endText);
  validateInterval(start, end);
  await assertNoOverlap({ doctorId, day, start, end });

  try {
    const schedule = await prisma.horario_medico.create({
      data: {
        id_medico: doctorId,
        dia_semana: day,
        hora_inicio: start,
        hora_fin: end,
        activo: true
      }
    });
    return toSchedule(schedule);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ScheduleError(409, 'Ya existe un horario con el mismo día e intervalo.');
    }
    throw error;
  }
}

async function updateSchedule(scheduleIdInput, input) {
  const scheduleId = parseId(scheduleIdInput, 'horario');
  const existing = await prisma.horario_medico.findUnique({ where: { id_horario: scheduleId } });
  if (!existing) {
    throw new ScheduleError(404, 'Horario no encontrado.');
  }

  const allowedFields = ['diaSemana', 'horaInicio', 'horaFin', 'activo'];
  if (!allowedFields.some((field) => input[field] !== undefined)) {
    throw new ScheduleError(400, 'No se enviaron campos para actualizar.');
  }

  const day = input.diaSemana === undefined ? existing.dia_semana : validateDay(input.diaSemana);
  const startText = input.horaInicio === undefined
    ? dateToTime(existing.hora_inicio)
    : validateTime(input.horaInicio, 'La hora de inicio');
  const endText = input.horaFin === undefined
    ? dateToTime(existing.hora_fin)
    : validateTime(input.horaFin, 'La hora de fin');
  if (input.activo !== undefined && typeof input.activo !== 'boolean') {
    throw new ScheduleError(400, 'El estado activo debe ser verdadero o falso.');
  }

  const start = timeToDate(startText);
  const end = timeToDate(endText);
  const active = input.activo === undefined ? existing.activo : input.activo;
  validateInterval(start, end);
  if (active) {
    await assertNoOverlap({
      doctorId: existing.id_medico,
      day,
      start,
      end,
      excludeId: scheduleId
    });
  }

  try {
    const schedule = await prisma.horario_medico.update({
      where: { id_horario: scheduleId },
      data: {
        dia_semana: day,
        hora_inicio: start,
        hora_fin: end,
        activo: active,
        fecha_actualizacion: new Date()
      }
    });
    return toSchedule(schedule);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ScheduleError(409, 'Ya existe un horario con el mismo día e intervalo.');
    }
    throw error;
  }
}

module.exports = {
  createSchedule,
  listActiveSchedulesByDoctor,
  listDoctors,
  listSchedulesByDoctor,
  ScheduleError,
  updateSchedule
};
