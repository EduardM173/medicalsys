const { Router } = require('express');
const campaignController = require('../controllers/campaign.controller');
const requireAuth = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');

const router = Router();

router.use(requireAuth, requireRole('ADMINISTRADOR'));

// HU-27: Crear y gestionar campañas y promociones de salud
router.get('/', campaignController.listCampaigns);
router.get('/:id', campaignController.getCampaignById);
router.post('/', campaignController.createCampaign);
router.patch('/:id', campaignController.updateCampaign);
router.delete('/:id', campaignController.deleteCampaign);

module.exports = router;
