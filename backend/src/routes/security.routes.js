const { Router } = require('express');
const requireAuth = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const security = require('../services/security.service');
const router = Router();
router.use(requireAuth, requireRole());
router.get('/', async (_req, res, next) => {
  try { res.json(await security.matrix()); } catch (error) { next(error); }
});
router.get('/audit', async (_req, res, next) => {
  try { res.json({ events: await security.audit() }); } catch (error) { next(error); }
});
router.put('/roles/:role', async (req, res, next) => {
  try { res.json(await security.updatePolicy(req.params.role, req.body.permissions, req.user)); }
  catch (error) { next(error); }
});
module.exports = router;
