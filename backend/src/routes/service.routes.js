const { Router } = require('express');
const serviceController = require('../controllers/service.controller');
const requireAuth = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');

const router = Router();

router.use(requireAuth, requireRole('RECEPCIONISTA', 'ADMINISTRADOR'));
router.get('/', serviceController.listServices);

module.exports = router;
