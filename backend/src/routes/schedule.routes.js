const { Router } = require('express');
const scheduleController = require('../controllers/schedule.controller');
const requireAuth = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');

const router = Router();

router.use(requireAuth, requireRole('ADMINISTRADOR'));
router.get('/doctors', scheduleController.listDoctors);
router.get('/doctors/:doctorId/schedules', scheduleController.listSchedules);
router.get('/doctors/:doctorId/schedules/active', scheduleController.listActiveSchedules);
router.post('/doctors/:doctorId/schedules', scheduleController.createSchedule);
router.patch('/schedules/:scheduleId', scheduleController.updateSchedule);

module.exports = router;
