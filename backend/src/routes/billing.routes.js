const { Router } = require('express');
const billingController = require('../controllers/billing.controller');
const requireAuth = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');

const router = Router();

router.use(requireAuth, requireRole('RECEPCIONISTA', 'ADMINISTRADOR'));
router.post('/prepare', billingController.prepareInvoice);

module.exports = router;
