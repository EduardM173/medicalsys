const { Router } = require('express');
const securityController = require('../controllers/security.controller');
const requireAuth = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');

const router = Router();

router.use(requireAuth, requireRole());
router.get('/', securityController.getMatrix);
router.get('/audit', securityController.getAudit);
router.post('/roles', securityController.createRole);
router.put('/roles/:role', securityController.updatePolicy);
router.get('/temporary-grants', securityController.listTemporaryGrants);
router.post('/temporary-grants', securityController.grantTemporaryPermission);
router.delete('/temporary-grants/:id', securityController.revokeTemporaryGrant);

module.exports = router;
