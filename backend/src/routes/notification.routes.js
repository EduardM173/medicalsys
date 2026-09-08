const { Router } = require('express');
const notificationController = require('../controllers/notification.controller');
const requireAuth = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');

const router = Router();

// El catálogo central de permisos (security/permissions.js) es quien decide
// realmente el acceso a través de permissionForRequest(); estos argumentos
// se mantienen solo por legibilidad, igual que en el resto de rutas.
router.use(requireAuth, requireRole('RECEPCIONISTA', 'ADMINISTRADOR'));

// HU-26: historial de confirmaciones y recordatorios por paciente/cita.
router.get('/', notificationController.getHistory);

// HU-24: Enviar confirmación de cita por WhatsApp
router.get('/confirmations/candidates', notificationController.getConfirmationCandidates);
router.post('/confirmations', notificationController.sendConfirmation);

// HU-25: Enviar recordatorio de cita por WhatsApp
router.get('/reminders/candidates', notificationController.getReminderCandidates);
router.post('/reminders', notificationController.sendReminder);
router.post('/reminders/run', notificationController.runReminders);

module.exports = router;
