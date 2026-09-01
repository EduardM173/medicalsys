const appointmentService = require('../services/appointment.service');

async function createAppointment(request, response, next) {
  try {
    const appointment = await appointmentService.createAppointment(request.body, request.user.id);
    response.status(201).json({ appointment });
  } catch (error) {
    next(error);
  }
}

async function listAppointments(request, response, next) {
  try {
    const appointments = await appointmentService.listAppointments({
      fecha: request.query.fecha,
      medicoId: request.query.medicoId,
      pacienteId: request.query.pacienteId,
      estado: request.query.estado
    });
    response.status(200).json({ appointments });
  } catch (error) {
    next(error);
  }
}

async function getAppointment(request, response, next) {
  try {
    const appointment = await appointmentService.getAppointmentById(request.params.id);
    response.status(200).json({ appointment });
  } catch (error) {
    next(error);
  }
}

module.exports = { createAppointment, getAppointment, listAppointments };
