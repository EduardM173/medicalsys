const { Router } = require('express');
const scheduleController = require('../controllers/schedule.controller');
const requireAuth = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');

const router = Router();

router.get('/doctors/:doctorId/schedules', requireAuth, requireRole('ADMINISTRADOR', 'RECEPCIONISTA', 'MEDICO'), scheduleController.listSchedules);
router.get('/doctors/:doctorId/schedules/active', requireAuth, requireRole('ADMINISTRADOR', 'RECEPCIONISTA', 'MEDICO'), scheduleController.listActiveSchedules);
router.post('/doctors/:doctorId/schedules', requireAuth, requireRole('ADMINISTRADOR'), scheduleController.createSchedule);
router.patch('/schedules/:scheduleId', requireAuth, requireRole('ADMINISTRADOR'), scheduleController.updateSchedule);

module.exports = router;
