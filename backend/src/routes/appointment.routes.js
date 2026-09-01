const { Router } = require('express');
const appointmentController = require('../controllers/appointment.controller');
const requireAuth = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');

const router = Router();

router.use(requireAuth, requireRole('RECEPCIONISTA', 'ADMINISTRADOR'));
router.post('/', appointmentController.createAppointment);
router.get('/', appointmentController.listAppointments);
router.get('/:id', appointmentController.getAppointment);

module.exports = router;
