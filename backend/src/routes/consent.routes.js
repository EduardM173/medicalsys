const { Router } = require('express');
const consentController = require('../controllers/consent.controller');
const requireAuth = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');

const router = Router();
const requireConsentAccess = requireRole.withMessage(
  'No tiene permisos para generar consentimientos informados.',
  'MEDICO'
);

router.use(requireAuth, requireConsentAccess);
router.get('/options', consentController.getConsentOptions);
router.get('/', consentController.getConsents);
router.post('/', consentController.createConsent);
router.get('/:consentId', consentController.getConsent);
router.get('/:consentId/preview', consentController.previewConsent);
router.get('/:consentId/download', consentController.downloadConsent);
router.post('/:consentId/verify', consentController.verifyConsent);
router.post('/:consentId/annul', consentController.annulConsent);
router.post('/:consentId/sign', consentController.signConsent);
router.post('/:consentId/firmar', consentController.signConsent);
router.put('/:consentId', consentController.updateConsent);
router.patch('/:consentId', consentController.updateConsent);

module.exports = router;

