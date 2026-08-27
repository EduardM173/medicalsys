function errorHandler(error, _request, response, _next) {
  const statusCode = error.statusCode || 500;

  if (statusCode >= 500) {
    console.error(error);
  }

  response.status(statusCode).json({
    message: statusCode >= 500 ? 'No fue posible procesar la solicitud.' : error.message
  });
}

module.exports = errorHandler;
