const prisma = require('../config/prisma');

const VALID_ROOM_TYPES = ['CONSULTORIO', 'QUIROFANO', 'SALA'];
const VALID_ROOM_STATUSES = ['DISPONIBLE', 'MANTENIMIENTO', 'INACTIVA'];

function serializeRoom(room) {
  if (!room) return null;
  return {
    id: room.id_sala.toString(),
    nombre: room.nombre,
    tipo: room.tipo,
    ubicacion: room.ubicacion,
    estado: room.estado,
    fechaCreacion: room.fecha_creacion?.toISOString(),
    fechaActualizacion: room.fecha_actualizacion?.toISOString()
  };
}

function serializeReservation(res) {
  if (!res) return null;
  return {
    id: res.id_reserva.toString(),
    idCita: res.id_cita.toString(),
    idSala: res.id_sala.toString(),
    fechaHoraInicio: res.fecha_hora_inicio.toISOString(),
    fechaHoraFin: res.fecha_hora_fin.toISOString(),
    estado: res.estado,
    fechaCreacion: res.fecha_creacion?.toISOString(),
    sala: res.sala ? serializeRoom(res.sala) : null,
    cita: res.cita ? {
      id: res.cita.id_cita.toString(),
      motivo: res.cita.motivo,
      estado: res.cita.estado,
      paciente: res.cita.paciente ? {
        id: res.cita.paciente.id_paciente.toString(),
        nombreCompleto: `${res.cita.paciente.nombres} ${res.cita.paciente.apellidos}`.trim(),
        ci: `${res.cita.paciente.documento_identidad}${res.cita.paciente.complemento ? ` ${res.cita.paciente.complemento}` : ''}`
      } : null,
      medico: res.cita.medico ? {
        id: res.cita.medico.id_medico.toString(),
        especialidad: res.cita.medico.especialidad,
        matricula: res.cita.medico.matricula_profesional,
        nombreCompleto: res.cita.medico.usuario ? `${res.cita.medico.usuario.nombres} ${res.cita.medico.usuario.apellidos}`.trim() : 'Médico'
      } : null,
      servicio: res.cita.servicio_medico ? {
        id: res.cita.servicio_medico.id_servicio.toString(),
        nombre: res.cita.servicio_medico.nombre,
        tipo: res.cita.servicio_medico.tipo
      } : null
    } : null
  };
}

class RoomService {
  async listRooms(filters = {}) {
    const where = {};
    if (filters.tipo && VALID_ROOM_TYPES.includes(filters.tipo.toUpperCase())) {
      where.tipo = filters.tipo.toUpperCase();
    }
    if (filters.estado && VALID_ROOM_STATUSES.includes(filters.estado.toUpperCase())) {
      where.estado = filters.estado.toUpperCase();
    }

    const rooms = await prisma.sala.findMany({
      where,
      orderBy: { nombre: 'asc' }
    });

    return rooms.map(serializeRoom);
  }

  async getRoomById(roomId) {
    const rId = BigInt(roomId);
    const room = await prisma.sala.findUnique({
      where: { id_sala: rId }
    });

    if (!room) {
      const error = new Error('La sala especificada no existe.');
      error.statusCode = 404;
      throw error;
    }

    return serializeRoom(room);
  }

  async getAvailableRooms({ fechaHoraInicio, fechaHoraFin, tipo }) {
    if (!fechaHoraInicio || !fechaHoraFin) {
      const error = new Error('Debe proporcionar fechaHoraInicio y fechaHoraFin para verificar disponibilidad.');
      error.statusCode = 400;
      throw error;
    }

    const start = new Date(fechaHoraInicio);
    const end = new Date(fechaHoraFin);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      const error = new Error('Formato de fecha u hora no válido.');
      error.statusCode = 400;
      throw error;
    }

    if (end <= start) {
      const error = new Error('La fecha y hora de fin debe ser posterior a la de inicio.');
      error.statusCode = 400;
      throw error;
    }

    // Buscar reservas activas que se solapan en el intervalo
    // Condición de solapamiento: (inicio_reserva < end) AND (fin_reserva > start)
    const overlappingReservations = await prisma.reserva_sala.findMany({
      where: {
        estado: 'ACTIVA',
        fecha_hora_inicio: { lt: end },
        fecha_hora_fin: { gt: start }
      },
      select: { id_sala: true }
    });

    const occupiedRoomIds = overlappingReservations.map((r) => r.id_sala);

    const where = {
      estado: 'DISPONIBLE'
    };

    if (occupiedRoomIds.length > 0) {
      where.id_sala = { notIn: occupiedRoomIds };
    }

    if (tipo && VALID_ROOM_TYPES.includes(tipo.toUpperCase())) {
      where.tipo = tipo.toUpperCase();
    }

    const availableRooms = await prisma.sala.findMany({
      where,
      orderBy: { nombre: 'asc' }
    });

    return availableRooms.map(serializeRoom);
  }

  async listPendingAppointments() {
    const appointments = await prisma.cita.findMany({
      where: {
        estado: { in: ['PROGRAMADA', 'CONFIRMADA'] }
      },
      orderBy: { fecha_hora_inicio: 'asc' },
      include: {
        paciente: true,
        medico: {
          include: { usuario: true }
        },
        servicio_medico: true,
        reserva_sala: {
          include: { sala: true }
        }
      }
    });

    return appointments.map((appt) => ({
      id: appt.id_cita.toString(),
      motivo: appt.motivo,
      estado: appt.estado,
      fechaHoraInicio: appt.fecha_hora_inicio.toISOString(),
      fechaHoraFin: appt.fecha_hora_fin.toISOString(),
      paciente: appt.paciente ? {
        id: appt.paciente.id_paciente.toString(),
        nombreCompleto: `${appt.paciente.nombres} ${appt.paciente.apellidos}`.trim(),
        ci: `${appt.paciente.documento_identidad}${appt.paciente.complemento ? ` ${appt.paciente.complemento}` : ''}`
      } : null,
      medico: appt.medico ? {
        id: appt.medico.id_medico.toString(),
        especialidad: appt.medico.especialidad,
        nombreCompleto: appt.medico.usuario ? `${appt.medico.usuario.nombres} ${appt.medico.usuario.apellidos}`.trim() : 'Médico'
      } : null,
      servicio: appt.servicio_medico ? {
        id: appt.servicio_medico.id_servicio.toString(),
        nombre: appt.servicio_medico.nombre,
        tipo: appt.servicio_medico.tipo
      } : null,
      reserva: appt.reserva_sala ? {
        id: appt.reserva_sala.id_reserva.toString(),
        idSala: appt.reserva_sala.id_sala.toString(),
        estado: appt.reserva_sala.estado,
        salaNombre: appt.reserva_sala.sala?.nombre
      } : null
    }));
  }

  async listReservations(filters = {}) {
    const where = {};

    if (filters.idSala) {
      where.id_sala = BigInt(filters.idSala);
    }
    if (filters.estado) {
      where.estado = filters.estado;
    }
    if (filters.fecha) {
      const startOfDay = new Date(`${filters.fecha}T00:00:00.000Z`);
      const endOfDay = new Date(`${filters.fecha}T23:59:59.999Z`);
      where.fecha_hora_inicio = { gte: startOfDay, lte: endOfDay };
    }

    const reservations = await prisma.reserva_sala.findMany({
      where,
      orderBy: { fecha_hora_inicio: 'asc' },
      include: {
        sala: true,
        cita: {
          include: {
            paciente: true,
            medico: {
              include: { usuario: true }
            },
            servicio_medico: true
          }
        }
      }
    });

    return reservations.map(serializeReservation);
  }

  async createRoomReservation({ idCita, idSala, fechaHoraInicio, fechaHoraFin }) {
    if (!idCita || !idSala || !fechaHoraInicio || !fechaHoraFin) {
      const error = new Error('Todos los campos son obligatorios: idCita, idSala, fechaHoraInicio, fechaHoraFin.');
      error.statusCode = 400;
      throw error;
    }

    const start = new Date(fechaHoraInicio);
    const end = new Date(fechaHoraFin);

    if (end <= start) {
      const error = new Error('La fecha/hora de fin debe ser posterior a la de inicio.');
      error.statusCode = 400;
      throw error;
    }

    const sId = BigInt(idSala);
    const cId = BigInt(idCita);

    // 1. Validar que la sala exista y esté DISPONIBLE
    const room = await prisma.sala.findUnique({
      where: { id_sala: sId }
    });
    if (!room) {
      const error = new Error('La sala especificada no existe.');
      error.statusCode = 404;
      throw error;
    }
    if (room.estado !== 'DISPONIBLE') {
      const error = new Error(`La sala ${room.nombre} no se encuentra disponible (Estado: ${room.estado}).`);
      error.statusCode = 400;
      throw error;
    }

    // 2. Validar que la cita exista
    const appointment = await prisma.cita.findUnique({
      where: { id_cita: cId }
    });
    if (!appointment) {
      const error = new Error('La cita especificada no existe.');
      error.statusCode = 404;
      throw error;
    }

    // 3. Validar si la cita ya tiene una reserva activa
    const existingCitaReservation = await prisma.reserva_sala.findUnique({
      where: { id_cita: cId }
    });
    if (existingCitaReservation && existingCitaReservation.estado === 'ACTIVA') {
      const error = new Error('Esta cita ya tiene una reserva de sala activa asignada.');
      error.statusCode = 400;
      throw error;
    }

    // 4. Algoritmo anti-solapamiento de sala: verificar que no haya colisión en la sala
    const collision = await prisma.reserva_sala.findFirst({
      where: {
        id_sala: sId,
        estado: 'ACTIVA',
        fecha_hora_inicio: { lt: end },
        fecha_hora_fin: { gt: start }
      },
      include: {
        cita: {
          include: { paciente: true }
        }
      }
    });

    if (collision) {
      const collisionStart = collision.fecha_hora_inicio.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
      const collisionEnd = collision.fecha_hora_fin.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
      const error = new Error(`Conflicto de reserva: La sala "${room.nombre}" ya está reservada en ese horario (${collisionStart} - ${collisionEnd}).`);
      error.statusCode = 409;
      throw error;
    }

    // 5. Crear o actualizar la reserva
    let reservation;
    if (existingCitaReservation) {
      reservation = await prisma.reserva_sala.update({
        where: { id_cita: cId },
        data: {
          id_sala: sId,
          fecha_hora_inicio: start,
          fecha_hora_fin: end,
          estado: 'ACTIVA'
        },
        include: {
          sala: true,
          cita: {
            include: {
              paciente: true,
              medico: { include: { usuario: true } },
              servicio_medico: true
            }
          }
        }
      });
    } else {
      reservation = await prisma.reserva_sala.create({
        data: {
          id_cita: cId,
          id_sala: sId,
          fecha_hora_inicio: start,
          fecha_hora_fin: end,
          estado: 'ACTIVA'
        },
        include: {
          sala: true,
          cita: {
            include: {
              paciente: true,
              medico: { include: { usuario: true } },
              servicio_medico: true
            }
          }
        }
      });
    }

    return serializeReservation(reservation);
  }

  async updateRoomReservation(reservationId, { idSala, fechaHoraInicio, fechaHoraFin, estado }) {
    const resId = BigInt(reservationId);
    const existing = await prisma.reserva_sala.findUnique({
      where: { id_reserva: resId }
    });

    if (!existing) {
      const error = new Error('La reserva especificada no existe.');
      error.statusCode = 404;
      throw error;
    }

    const data = {};
    const targetSalaId = idSala ? BigInt(idSala) : existing.id_sala;
    const start = fechaHoraInicio ? new Date(fechaHoraInicio) : existing.fecha_hora_inicio;
    const end = fechaHoraFin ? new Date(fechaHoraFin) : existing.fecha_hora_fin;

    if (end <= start) {
      const error = new Error('La fecha/hora de fin debe ser posterior a la de inicio.');
      error.statusCode = 400;
      throw error;
    }

    if (estado) {
      data.estado = estado;
    }

    if (idSala || fechaHoraInicio || fechaHoraFin) {
      // Verificar colisiones excluyendo esta misma reserva
      const collision = await prisma.reserva_sala.findFirst({
        where: {
          id_reserva: { not: resId },
          id_sala: targetSalaId,
          estado: 'ACTIVA',
          fecha_hora_inicio: { lt: end },
          fecha_hora_fin: { gt: start }
        }
      });

      if (collision) {
        const error = new Error('Conflicto de horario: La sala seleccionada ya está ocupada en ese intervalo.');
        error.statusCode = 409;
        throw error;
      }

      data.id_sala = targetSalaId;
      data.fecha_hora_inicio = start;
      data.fecha_hora_fin = end;
    }

    const updated = await prisma.reserva_sala.update({
      where: { id_reserva: resId },
      data,
      include: {
        sala: true,
        cita: {
          include: {
            paciente: true,
            medico: { include: { usuario: true } },
            servicio_medico: true
          }
        }
      }
    });

    return serializeReservation(updated);
  }

  async cancelRoomReservation(reservationId) {
    const resId = BigInt(reservationId);
    const existing = await prisma.reserva_sala.findUnique({
      where: { id_reserva: resId }
    });

    if (!existing) {
      const error = new Error('La reserva especificada no existe.');
      error.statusCode = 404;
      throw error;
    }

    const cancelled = await prisma.reserva_sala.update({
      where: { id_reserva: resId },
      data: { estado: 'CANCELADA' },
      include: {
        sala: true,
        cita: true
      }
    });

    return serializeReservation(cancelled);
  }
}

module.exports = new RoomService();
