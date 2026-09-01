const roomService = require('../services/room.service');

async function listRooms(req, res, next) {
  try {
    const { tipo, estado } = req.query;
    const rooms = await roomService.listRooms({ tipo, estado });
    return res.status(200).json(rooms);
  } catch (error) {
    return next(error);
  }
}

async function getAvailableRooms(req, res, next) {
  try {
    const { fechaHoraInicio, fechaHoraFin, tipo } = req.query;
    const availableRooms = await roomService.getAvailableRooms({ fechaHoraInicio, fechaHoraFin, tipo });
    return res.status(200).json(availableRooms);
  } catch (error) {
    return next(error);
  }
}

async function listReservations(req, res, next) {
  try {
    const { idSala, fecha, estado } = req.query;
    const reservations = await roomService.listReservations({ idSala, fecha, estado });
    return res.status(200).json(reservations);
  } catch (error) {
    return next(error);
  }
}

async function createReservation(req, res, next) {
  try {
    const { idCita, idSala, fechaHoraInicio, fechaHoraFin } = req.body;
    const reservation = await roomService.createRoomReservation({
      idCita,
      idSala,
      fechaHoraInicio,
      fechaHoraFin
    });
    return res.status(201).json({
      message: 'Sala/Quirófano reservado exitosamente.',
      reservation
    });
  } catch (error) {
    return next(error);
  }
}

async function updateReservation(req, res, next) {
  try {
    const { id } = req.params;
    const { idSala, fechaHoraInicio, fechaHoraFin, estado } = req.body;
    const reservation = await roomService.updateRoomReservation(id, {
      idSala,
      fechaHoraInicio,
      fechaHoraFin,
      estado
    });
    return res.status(200).json({
      message: 'Reserva de sala actualizada.',
      reservation
    });
  } catch (error) {
    return next(error);
  }
}

async function cancelReservation(req, res, next) {
  try {
    const { id } = req.params;
    const reservation = await roomService.cancelRoomReservation(id);
    return res.status(200).json({
      message: 'Reserva de sala cancelada exitosamente.',
      reservation
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listRooms,
  getAvailableRooms,
  listReservations,
  createReservation,
  updateReservation,
  cancelReservation
};
