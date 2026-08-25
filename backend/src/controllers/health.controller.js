const healthService = require('../services/health.service');

async function getHealth(_request, response, next) {
  try {
    const health = await healthService.checkHealth();
    response.status(200).json(health);
  } catch (error) {
    next(error);
  }
}

module.exports = { getHealth };
