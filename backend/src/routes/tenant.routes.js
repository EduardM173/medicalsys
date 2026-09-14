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
router.post('/subscription/renew-bnb-qr', tenantController.generateBnbRenewalQr);
router.get('/subscription/bnb-status/:qrId', tenantController.checkBnbQrStatus);

// Rutas protegidas
router.get('/my-organizations', requireAuth, tenantController.getUserOrganizations);
router.post('/provision', requireAuth, (req, res, next) => {
  const isSuper = req.user?.isSuperAdmin || req.user?.rol === 'SUPERADMIN';
  if (!isSuper) {
    return res.status(403).json({ message: 'Solo el SuperAdmin de la plataforma puede aprovisionar nuevos centros médicos.' });
  }
  return tenantController.provisionTenant(req, res, next);
});

module.exports = router;
