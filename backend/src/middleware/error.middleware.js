function errorHandler(error, _request, response, _next) {
  console.error(error);
  response.status(503).json({
    status: 'error',
    service: 'medicalsys-api',
    database: 'unavailable'
  });
}

module.exports = errorHandler;
