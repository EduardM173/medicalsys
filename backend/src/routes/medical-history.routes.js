const { Router } = require('express');
const medicalHistoryController = require('../controllers/medical-history.controller');
const requireAuth = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');

const router = Router();

router.get(
  '/:patientId/medical-history',
  requireAuth,
  requireRole.withMessage(
    'No tiene permisos para consultar información clínica.',
    'MEDICO',
    'ADMINISTRADOR'
  ),
  medicalHistoryController.getMedicalHistory
);

module.exports = router;
