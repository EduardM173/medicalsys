const serviceService = require('../services/service.service');

async function listServices(_request, response, next) {
  try {
    const services = await serviceService.listServices();
    response.status(200).json({ services });
  } catch (error) {
    next(error);
  }
}

module.exports = { listServices };
