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
router.post('/', consentController.createConsent);
router.get('/:consentId', consentController.getConsent);

module.exports = router;
