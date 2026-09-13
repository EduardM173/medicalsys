const { Router } = require('express');
const tenantController = require('../controllers/tenant.controller');
const requireAuth = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');

const router = Router();

// Rutas públicas de resolución de contexto y catálogo
router.get('/current', tenantController.getCurrentTenant);
router.get('/catalog', tenantController.listOrganizations);

// Suscripción y pagos QR
router.post('/subscription/renew-qr', tenantController.generateRenewalQr);
router.post('/subscription/confirm-payment', tenantController.confirmPayment);

// Rutas protegidas
router.get('/my-organizations', requireAuth, tenantController.getUserOrganizations);
router.post('/provision', requireAuth, requireRole('ADMINISTRADOR'), tenantController.provisionTenant);

module.exports = router;
