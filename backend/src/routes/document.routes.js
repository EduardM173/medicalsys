const { Router } = require('express');
const documentController = require('../controllers/document.controller');
const requireAuth = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');

const router = Router();
const requireClinicalAccess = requireRole.withMessage(
  'No tiene permisos para consultar documentos clínicos.',
  'MEDICO',
  'ADMINISTRADOR',
  'RECEPCIONISTA'
);

router.get(
  '/patients/:patientId/documents',
  requireAuth,
  requireClinicalAccess,
  documentController.listPatientDocuments
);

router.get(
  '/documents/:documentId/file',
  requireAuth,
  requireClinicalAccess,
  documentController.openDocumentFile
);

module.exports = router;
