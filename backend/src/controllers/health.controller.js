const healthService = require('../services/health.service');

async function getHealth(_request, response, next) {
  try {
    const health = await healthService.checkHealth();
    response.status(200).json(health);
  } catch (error) {
    next(error);
  }
}

function getLive(_request, response) { response.json(healthService.liveness()); }
async function getReady(_request, response) {
  const result = await healthService.readiness();
  response.status(result.status === 'ok' ? 200 : 503).json(result);
}
function getMetrics(_request, response) { response.json(healthService.metrics()); }
module.exports = { getHealth, getLive, getReady, getMetrics };
