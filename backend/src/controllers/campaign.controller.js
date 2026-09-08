const campaignService = require('../services/campaign.service');

async function listCampaigns(req, res, next) {
  try {
    const { search, estado } = req.query;
    const result = await campaignService.listCampaigns({ search, estado });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function getCampaignById(req, res, next) {
  try {
    const campaign = await campaignService.getCampaignById(req.params.id);
    res.json(campaign);
  } catch (error) {
    next(error);
  }
}

async function createCampaign(req, res, next) {
  try {
    const userId = req.user?.id || req.user?.idUsuario;
    const campaign = await campaignService.createCampaign(req.body, userId);
    res.status(201).json({
      message: 'Campaña creada exitosamente.',
      campaign
    });
  } catch (error) {
    next(error);
  }
}

async function updateCampaign(req, res, next) {
  try {
    const campaign = await campaignService.updateCampaign(req.params.id, req.body);
    res.json({
      message: 'Campaña actualizada exitosamente.',
      campaign
    });
  } catch (error) {
    next(error);
  }
}

async function deleteCampaign(req, res, next) {
  try {
    const result = await campaignService.deleteCampaign(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign
};
