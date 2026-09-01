const express = require('express');
const authenticate = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const roomController = require('../controllers/room.controller');

const router = express.Router();

// Listar todas las salas
router.get(
  '/',
  authenticate,
  requireRole('RECEPCIONISTA', 'ADMINISTRADOR', 'MEDICO'),
  roomController.listRooms
);

// Consultar salas disponibles en un intervalo horario
router.get(
  '/available',
  authenticate,
  requireRole('RECEPCIONISTA', 'ADMINISTRADOR', 'MEDICO'),
  roomController.getAvailableRooms
);

// Listar reservas de salas
router.get(
  '/reservations',
  authenticate,
  requireRole('RECEPCIONISTA', 'ADMINISTRADOR', 'MEDICO'),
  roomController.listReservations
);

// Crear reserva de sala para una cita
router.post(
  '/reservations',
  authenticate,
  requireRole('RECEPCIONISTA', 'ADMINISTRADOR'),
  roomController.createReservation
);

// Modificar o reasignar reserva
router.patch(
  '/reservations/:id',
  authenticate,
  requireRole('RECEPCIONISTA', 'ADMINISTRADOR'),
  roomController.updateReservation
);

// Cancelar reserva de sala
router.delete(
  '/reservations/:id',
  authenticate,
  requireRole('RECEPCIONISTA', 'ADMINISTRADOR'),
  roomController.cancelReservation
);

module.exports = router;
