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
router.post('/roles', async (req, res, next) => {
  try { res.status(201).json({ role: await security.createRole(req.body, req.user) }); }
  catch (error) { next(error); }
});
router.put('/roles/:role', async (req, res, next) => {
  try { res.json(await security.updatePolicy(req.params.role, req.body.permissions, req.user)); }
  catch (error) { next(error); }
});
router.get('/temporary-grants', async (_req, res, next) => {
  try { res.json({ grants: await security.listTemporaryGrants() }); } catch (error) { next(error); }
});
router.post('/temporary-grants', async (req, res, next) => {
  try { res.status(201).json({ grant: await security.grantTemporaryPermission(req.body, req.user) }); }
  catch (error) { next(error); }
});
router.delete('/temporary-grants/:id', async (req, res, next) => {
  try { res.json(await security.revokeTemporaryGrant(req.params.id, req.user)); }
  catch (error) { next(error); }
});
module.exports = router;
