const { Router } = require('express');
const clinicalMessageController = require('../controllers/clinical-message.controller');
const requireAuth = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');

const router = Router();
const requireClinicalAccess = requireRole.withMessage(
  'No tiene permisos para gestionar mensajes clínicos.',
  'MEDICO',
  'ADMINISTRADOR'
);

router.use(requireAuth, requireClinicalAccess);

router.get('/historias/:historyId/mensajes', clinicalMessageController.getClinicalMessages);
router.post('/historias/:historyId/mensajes', clinicalMessageController.sendClinicalMessage);

module.exports = router;