const { Router } = require('express');
const billingController = require('../controllers/billing.controller');
const requireAuth = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');

const router = Router();

router.use(requireAuth, requireRole('RECEPCIONISTA', 'ADMINISTRADOR'));
router.get('/invoices', billingController.listIssuedInvoices);
router.get('/invoices/:id', billingController.getIssuedInvoice);
router.get('/summary', billingController.getSummary);
router.post('/prepare', billingController.prepareInvoice);
router.post('/:id/emit', billingController.emitInvoice);

module.exports = router;
