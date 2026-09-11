/**
 * Middleware de seguridad de transporte (HU-31 / MED-301 / PA-09).
 * Fuerza HTTPS/HSTS en producción y elimina cabeceras informativas.
 */
function enforceHttps() {
  return function httpsGuard(request, response, next) {
    if (process.env.NODE_ENV === 'production') {
      const forwardedProto = request.headers['x-forwarded-proto'];
      if (!request.secure && forwardedProto !== 'https') {
        return response.redirect(301, `https://${request.get('host')}${request.originalUrl}`);
      }
      response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    response.removeHeader('X-Powered-By');
    return next();
  };
}

module.exports = { enforceHttps };