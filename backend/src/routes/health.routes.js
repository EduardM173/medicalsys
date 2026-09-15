const { Router } = require('express');
const healthController = require('../controllers/health.controller');

const router = Router();

router.get('/health', healthController.getHealth);
router.get('/live', healthController.getLive);
router.get('/ready', healthController.getReady);
// Aggregate counters contain no identities or clinical data.
router.get('/metrics', healthController.getMetrics);

module.exports = router;
