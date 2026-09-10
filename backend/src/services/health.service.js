const healthRepository = require('../repositories/health.repository');

async function checkHealth() {
  await healthRepository.checkConnection();

  return {
    status: 'ok',
    service: 'medicalsys-api',
    database: 'connected'
  };
}

module.exports = { checkHealth };
