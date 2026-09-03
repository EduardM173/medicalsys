const prisma = require('../config/prisma');

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
const activeStates = ['PROGRAMADA', 'CONFIRMADA', 'EN_CONSULTA'];

// HU-15 / PA-04: transiciones de estado permitidas para una cita existente.
// COMPLETADA y CANCELADA son estados finales: no admiten nuevos cambios.
const allowedTransitions = {
  PROGRAMADA: ['CONFIRMADA', 'CANCELADA'],
  CONFIRMADA: ['EN_CONSULTA', 'CANCELADA'],
  EN_CONSULTA: ['COMPLETADA', 'CANCELADA'],
  COMPLETADA: [],
  CANCELADA: []
};
const validAppointmentStates = Object.keys(allowedTransitions);

class AppointmentError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function parseId(value, entity) {
  if (!/^\d+$/.test(String(value)) || BigInt(value) < 1n) {
    throw new AppointmentError(400, `Identificador de ${entity} no válido.`);
  }
  return BigInt(value);
}

function normalizeSpacing(value) {
  return String(value).trim().replace(/\s+/g, ' ');
}

function optionalText(value, fieldName, maxLength) {
  if (value === undefined || value === null) return null;
  const normalized = normalizeSpacing(value);
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw new AppointmentError(400, `${fieldName} supera la longitud permitida.`);
  }
  return normalized;
}

// Convierte una hora "HH:mm" al mismo formato usado por horario_medico
// (fecha fija 1970-01-01 en UTC) para poder comparar directamente contra
// las columnas TIME de la base de datos, igual que en schedule.service.js.
function timeTextToTimeValue(value) {
  return new Date(`1970-01-01T${value}:00.000Z`);
}

function dateTimeToTimeText(date) {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

// PA-04 usa la misma convención de horario_medico.dia_semana: 1=Lunes...7=Domingo
function dayOfWeek(date) {
  const jsDay = date.getDay(); // 0=Domingo...6=Sábado
  return jsDay === 0 ? 7 : jsDay;
}

function toAppointment(appointment) {
  return {
    id: Number(appointment.id_cita),
    estado: appointment.estado,
    fechaHoraInicio: appointment.fecha_hora_inicio.toISOString(),
    fechaHoraFin: appointment.fecha_hora_fin.toISOString(),
    motivo: appointment.motivo,
    indicacionesPrevias: appointment.indicaciones_previas,
    fechaCreacion: appointment.fecha_creacion.toISOString(),
    paciente: {
      id: Number(appointment.paciente.id_paciente),
      nombre: `${appointment.paciente.nombres} ${appointment.paciente.apellidos}`.trim(),
      documentoIdentidad: appointment.paciente.documento_identidad
    },
    medico: {
      id: Number(appointment.medico.id_medico),
      nombre: `${appointment.medico.usuario.nombres} ${appointment.medico.usuario.apellidos}`.trim(),
      especialidad: appointment.medico.especialidad
    },
    servicio: {
      id: Number(appointment.servicio_medico.id_servicio),
      nombre: appointment.servicio_medico.nombre,
      duracionMinutos: appointment.servicio_medico.duracion_minutos
    }
  };
}

const appointmentInclude = {
  paciente: { select: { id_paciente: true, nombres: true, apellidos: true, documento_identidad: true } },
  medico: {
    select: {
      id_medico: true,
      especialidad: true,
      usuario: { select: { nombres: true, apellidos: true } }
    }
  },
  servicio_medico: { select: { id_servicio: true, nombre: true, duracion_minutos: true } }
};

async function findActivePatient(patientId) {
  const patient = await prisma.paciente.findUnique({ where: { id_paciente: patientId } });
  if (!patient || !patient.activo) {
    throw new AppointmentError(400, 'El paciente seleccionado no existe o no está activo.');
  }
  return patient;
}

async function findActiveDoctor(doctorId) {
  const doctor = await prisma.medico.findUnique({ where: { id_medico: doctorId } });
  if (!doctor || !doctor.activo) {
    throw new AppointmentError(400, 'El médico seleccionado no existe o no está activo.');
  }
  return doctor;
}

async function findActiveService(serviceId) {
  const service = await prisma.servicio_medico.findUnique({ where: { id_servicio: serviceId } });
  if (!service || !service.activo) {
    throw new AppointmentError(400, 'El servicio seleccionado no existe o no está activo.');
  }
  return service;
}

// PA-04: la cita no puede caer fuera de los horarios activos configurados para el médico.
async function assertWithinDoctorSchedule(doctorId, start, end) {
  const day = dayOfWeek(start);
  const startTime = timeTextToTimeValue(dateTimeToTimeText(start));
  const endTime = timeTextToTimeValue(dateTimeToTimeText(end));

  const schedule = await prisma.horario_medico.findFirst({
    where: {
      id_medico: doctorId,
      dia_semana: day,
      activo: true,
      hora_inicio: { lte: startTime },
      hora_fin: { gte: endTime }
    }
  });

  if (!schedule) {
    throw new AppointmentError(400, 'La cita está fuera de los horarios activos configurados para el médico.');
  }
}

// PA-05: no se permite registrar una cita que se solape con otra cita activa del mismo médico.
async function assertNoAppointmentConflict(doctorId, start, end, excludeId) {
  const overlapping = await prisma.cita.findFirst({
    where: {
      id_medico: doctorId,
      estado: { in: activeStates },
      fecha_hora_inicio: { lt: end },
      fecha_hora_fin: { gt: start },
      ...(excludeId ? { id_cita: { not: excludeId } } : {})
    }
  });

  if (overlapping) {
    throw new AppointmentError(409, 'El médico ya tiene una cita activa que se superpone con este horario.');
  }
}

async function createAppointment(input, createdByUserId) {
  const patientId = parseId(input.pacienteId, 'paciente');
  const doctorId = parseId(input.medicoId, 'médico');
  const serviceId = parseId(input.servicioId, 'servicio');

  if (typeof input.fecha !== 'string' || !datePattern.test(input.fecha)) {
    throw new AppointmentError(400, 'La fecha de la cita no es válida.');
  }
  if (typeof input.horaInicio !== 'string' || !timePattern.test(input.horaInicio)) {
    throw new AppointmentError(400, 'La hora de inicio de la cita no es válida.');
  }

  // PA-01: la cita debe estar asociada a un paciente, médico y servicio existentes (y activos).
  const [patient, doctor, service] = await Promise.all([
    findActivePatient(patientId),
    findActiveDoctor(doctorId),
    findActiveService(serviceId)
  ]);

  const start = new Date(`${input.fecha}T${input.horaInicio}:00`);
  if (Number.isNaN(start.getTime())) {
    throw new AppointmentError(400, 'La fecha u hora de la cita no es válida.');
  }

  const now = new Date();
  if (start.getTime() < now.getTime()) {
    throw new AppointmentError(400, 'No se puede programar una cita en una fecha u hora pasada.');
  }

  const end = new Date(start.getTime() + service.duracion_minutos * 60000);

  // PA-03: la fecha y hora de fin debe ser posterior a la fecha y hora de inicio.
  if (end.getTime() <= start.getTime()) {
    throw new AppointmentError(400, 'La fecha y hora de fin debe ser posterior a la fecha y hora de inicio.');
  }

  await assertWithinDoctorSchedule(doctorId, start, end);
  await assertNoAppointmentConflict(doctorId, start, end);

  const indicacionesPrevias = optionalText(input.indicacionesPrevias, 'Las notas e instrucciones', 2000);

  // PA-02 / PA-06: se almacena fecha/hora de inicio y fin, motivo y el estado inicial PROGRAMADA.
  const appointment = await prisma.cita.create({
    data: {
      id_paciente: patientId,
      id_medico: doctorId,
      id_servicio: serviceId,
      creado_por: createdByUserId ? BigInt(createdByUserId) : null,
      fecha_hora_inicio: start,
      fecha_hora_fin: end,
      motivo: service.nombre,
      indicaciones_previas: indicacionesPrevias,
      estado: 'PROGRAMADA'
    },
    include: appointmentInclude
  });

  return toAppointment(appointment);
}

// HU-15 / MED-97: endpoint genérico de actualización de una cita existente.
// Admite dos operaciones, que pueden combinarse en la misma solicitud:
//  - Reprogramación (fecha/horaInicio): PA-01, PA-02, PA-03.
//  - Cambio de estado (estado): PA-04, y como caso particular la
//    cancelación lógica (PA-05).
async function updateAppointment(idInput, input = {}) {
  const id = parseId(idInput, 'cita');

  const existing = await prisma.cita.findUnique({
    where: { id_cita: id },
    include: appointmentInclude
  });
  if (!existing) {
    throw new AppointmentError(404, 'Cita no encontrada.');
  }

  const wantsReschedule = input.fecha !== undefined || input.horaInicio !== undefined;
  const wantsStatusChange = input.estado !== undefined && input.estado !== null && input.estado !== '';

  if (!wantsReschedule && !wantsStatusChange) {
    throw new AppointmentError(400, 'Debe indicar el nuevo estado o la nueva fecha y hora de la cita.');
  }

  // Una cita en un estado final (COMPLETADA o CANCELADA) ya no puede
  // reprogramarse ni cambiar de estado.
  if (['COMPLETADA', 'CANCELADA'].includes(existing.estado)) {
    throw new AppointmentError(400, `No es posible modificar una cita en estado ${existing.estado}.`);
  }

  const data = {};

  // PA-01 / PA-02 / PA-03: reprogramación de fecha y hora.
  if (wantsReschedule) {
    if (typeof input.fecha !== 'string' || !datePattern.test(input.fecha)) {
      throw new AppointmentError(400, 'La fecha de la cita no es válida.');
    }
    if (typeof input.horaInicio !== 'string' || !timePattern.test(input.horaInicio)) {
      throw new AppointmentError(400, 'La hora de inicio de la cita no es válida.');
    }

    const start = new Date(`${input.fecha}T${input.horaInicio}:00`);
    if (Number.isNaN(start.getTime())) {
      throw new AppointmentError(400, 'La fecha u hora de la cita no es válida.');
    }

    const now = new Date();
    if (start.getTime() < now.getTime()) {
      throw new AppointmentError(400, 'No se puede reprogramar una cita a una fecha u hora pasada.');
    }

    const durationMs = existing.fecha_hora_fin.getTime() - existing.fecha_hora_inicio.getTime();
    const end = new Date(start.getTime() + durationMs);

    // PA-02: la reprogramación vuelve a aplicar las validaciones de horario del médico.
    await assertWithinDoctorSchedule(existing.id_medico, start, end);
    // PA-03: una reprogramación que se solape con otra cita activa del médico recibe HTTP 409.
    await assertNoAppointmentConflict(existing.id_medico, start, end, id);

    data.fecha_hora_inicio = start;
    data.fecha_hora_fin = end;
  }

  // PA-04 / PA-05: cambio de estado, incluida la cancelación lógica.
  if (wantsStatusChange) {
    if (!validAppointmentStates.includes(input.estado)) {
      throw new AppointmentError(400, 'El estado indicado no es válido.');
    }

    const allowedNextStates = allowedTransitions[existing.estado] || [];
    if (!allowedNextStates.includes(input.estado)) {
      throw new AppointmentError(
        400,
        `No se puede cambiar la cita de ${existing.estado} a ${input.estado}.`
      );
    }

    // PA-05: cancelar una cita solo actualiza su estado a CANCELADA; el
    // registro nunca se elimina de PostgreSQL (cancelación lógica).
    data.estado = input.estado;
  }

  data.fecha_actualizacion = new Date();

  const appointment = await prisma.cita.update({
    where: { id_cita: id },
    data,
    include: appointmentInclude
  });

  // PA-06: los cambios quedan disponibles en una consulta posterior de la misma cita.
  return toAppointment(appointment);
}

// PA-07: una consulta posterior de la cita recupera los datos almacenados en PostgreSQL.
async function getAppointmentById(idInput) {
  const id = parseId(idInput, 'cita');
  const appointment = await prisma.cita.findUnique({
    where: { id_cita: id },
    include: appointmentInclude
  });
  if (!appointment) {
    throw new AppointmentError(404, 'Cita no encontrada.');
  }
  return toAppointment(appointment);
}

async function listAppointments(filters = {}) {
  const where = {};

  if (filters.fecha) {
    if (!datePattern.test(filters.fecha)) {
      throw new AppointmentError(400, 'La fecha de búsqueda no es válida.');
    }
    const dayStart = new Date(`${filters.fecha}T00:00:00`);
    const dayEnd = new Date(`${filters.fecha}T23:59:59.999`);
    where.fecha_hora_inicio = { gte: dayStart, lte: dayEnd };
  }

  if (filters.medicoId) {
    where.id_medico = parseId(filters.medicoId, 'médico');
  }

  if (filters.pacienteId) {
    where.id_paciente = parseId(filters.pacienteId, 'paciente');
  }

  if (filters.estado) {
    where.estado = filters.estado;
  }

  const appointments = await prisma.cita.findMany({
    where,
    orderBy: { fecha_hora_inicio: 'asc' },
    include: appointmentInclude
  });

  return appointments.map(toAppointment);
}

module.exports = {
  AppointmentError,
  allowedTransitions,
  createAppointment,
  getAppointmentById,
  listAppointments,
  updateAppointment
};
