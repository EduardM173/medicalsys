const { Router } = require('express');
const attentionController = require('../controllers/attention.controller');
const requireAuth = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');

const router = Router();
const requireClinicalAccess = requireRole.withMessage(
  'No tiene permisos para registrar o consultar atenciones médicas.',
  'MEDICO',
  'ADMINISTRADOR'
);

router.use(requireAuth, requireClinicalAccess);

router.get('/options', attentionController.getAttentionOptions);
router.post('/', attentionController.createAttention);
router.post('/atenciones', attentionController.createAttention);
router.get('/:historyId/atenciones', attentionController.getAttentionsByHistoryId);

module.exports = router;
