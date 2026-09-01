const prisma = require('../config/prisma');

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const clinicUtcOffset = '-04:00';

class AgendaError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function validateDate(value) {
  if (value === undefined || value === null || value === '') {
    throw new AgendaError(400, 'La fecha es obligatoria.');
  }
  if (typeof value !== 'string' || !datePattern.test(value)) {
    throw new AgendaError(400, 'La fecha no es válida.');
  }

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.toISOString().slice(0, 10) !== value) {
    throw new AgendaError(400, 'La fecha no es válida.');
  }

  return { value, year, month, day };
}

function getDateRange(date) {
  const start = new Date(`${date.value}T00:00:00.000${clinicUtcOffset}`);
  const nextDay = new Date(Date.UTC(date.year, date.month - 1, date.day + 1))
    .toISOString()
    .slice(0, 10);
  const end = new Date(`${nextDay}T00:00:00.000${clinicUtcOffset}`);
  return { start, end };
}

function toDoctor(doctor) {
  return {
    id: Number(doctor.id_medico),
    name: `${doctor.usuario.nombres} ${doctor.usuario.apellidos}`.trim(),
    specialty: doctor.especialidad
  };
}

function toAppointment(appointment) {
  return {
    id: Number(appointment.id_cita),
    startTime: appointment.fecha_hora_inicio.toISOString(),
    endTime: appointment.fecha_hora_fin.toISOString(),
    status: appointment.estado,
    reason: appointment.motivo,
    patient: {
      id: Number(appointment.paciente.id_paciente),
      fullName: `${appointment.paciente.nombres} ${appointment.paciente.apellidos}`.trim()
    },
    service: {
      id: Number(appointment.servicio_medico.id_servicio),
      name: appointment.servicio_medico.nombre
    }
  };
}

async function getAgendaForAuthenticatedDoctor(userIdInput, dateInput) {
  const date = validateDate(dateInput);
  const doctor = await prisma.medico.findUnique({
    where: { id_usuario: BigInt(userIdInput) },
    select: {
      id_medico: true,
      especialidad: true,
      usuario: { select: { nombres: true, apellidos: true } }
    }
  });

  if (!doctor) {
    throw new AgendaError(
      403,
      'El usuario autenticado no posee un perfil médico asociado.'
    );
  }

  const range = getDateRange(date);
  const appointments = await prisma.cita.findMany({
    where: {
      id_medico: doctor.id_medico,
      fecha_hora_inicio: { gte: range.start, lt: range.end }
    },
    orderBy: { fecha_hora_inicio: 'asc' },
    select: {
      id_cita: true,
      fecha_hora_inicio: true,
      fecha_hora_fin: true,
      motivo: true,
      estado: true,
      paciente: {
        select: { id_paciente: true, nombres: true, apellidos: true }
      },
      servicio_medico: {
        select: { id_servicio: true, nombre: true }
      }
    }
  });

  return {
    doctor: toDoctor(doctor),
    date: date.value,
    appointments: appointments.map(toAppointment)
  };
}

module.exports = {
  AgendaError,
  getAgendaForAuthenticatedDoctor
};
