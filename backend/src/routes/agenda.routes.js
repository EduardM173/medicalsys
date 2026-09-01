const { Router } = require('express');
const agendaController = require('../controllers/agenda.controller');
const requireAuth = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');

const router = Router();

router.get(
  '/me',
  requireAuth,
  requireRole.withMessage('No tiene permisos para consultar esta agenda.', 'MEDICO'),
  agendaController.getMyAgenda
);

module.exports = router;
