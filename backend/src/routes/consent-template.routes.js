const { Router } = require('express');
const consentTemplateController = require('../controllers/consent-template.controller');
const requireAuth = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');

const router = Router();
const requireConsentAccess = requireRole.withMessage(
  'No tiene permisos para gestionar plantillas de consentimiento.',
  'MEDICO'
);

router.use(requireAuth, requireConsentAccess);
router.get('/', consentTemplateController.listTemplates);
router.post('/', consentTemplateController.createTemplate);
router.get('/:templateId', consentTemplateController.getTemplate);
router.put('/:templateId', consentTemplateController.updateTemplate);
router.post('/:templateId/generate', consentTemplateController.generateConsent);

module.exports = router;