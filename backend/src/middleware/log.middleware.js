const { logger, sanitize } = require('../config/logger');

/**
 * Logging de peticiones con cuerpo sanitizado (HU-31 / MED-301 / PA-07).
 * Jamás se escribe en disco el cuerpo con datos clínicos o claves.
 */
function requestLogger(request, response, next) {
  const startedAt = Date.now();
  response.on('finish', () => {
    const entry = {
      method: request.method,
      path: request.route?.path || request.path.replace(/\/\d+(?=\/|$)/g, '/:id'),
      status: response.statusCode,
      durationMs: Date.now() - startedAt,
      user: request.user?.id ? { id: request.user.id, rol: request.user.rol } : null
    };
    // No query terms, personal data or medical form bodies in access logs.
    logger.info(entry);
  });
  next();
}

module.exports = requestLogger;
