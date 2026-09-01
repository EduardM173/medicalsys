const express = require('express');
const authenticate = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const { uploadClinicalDocument } = require('../middleware/upload.middleware');
const clinicalDocumentController = require('../controllers/clinical-document.controller');

const router = express.Router();

// Listar documentos de un paciente
router.get(
  '/patients/:patientId/documents',
  authenticate,
  requireRole('MEDICO', 'ADMINISTRADOR', 'RECEPCIONISTA'),
  clinicalDocumentController.getPatientDocuments
);

// Subir documento clínico adjunto
router.post(
  '/patients/:patientId/documents',
  authenticate,
  requireRole('MEDICO', 'ADMINISTRADOR'),
  uploadClinicalDocument.single('file'),
  clinicalDocumentController.uploadDocument
);

// Descargar o previsualizar documento clínico
router.get(
  '/documents/:documentId/download',
  authenticate,
  clinicalDocumentController.downloadDocument
);

// Eliminar documento clínico
router.delete(
  '/documents/:documentId',
  authenticate,
  requireRole('MEDICO', 'ADMINISTRADOR'),
  clinicalDocumentController.deleteDocument
);

module.exports = router;
