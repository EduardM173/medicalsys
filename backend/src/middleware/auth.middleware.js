const jwt = require('jsonwebtoken');
const authService = require('../services/auth.service');
async function requireAuth(request, response, next) {
  let payload;
  try {
    const authHeader = request.headers.authorization;
    const bearerToken = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.substring(7).trim()
      : null;

    const rawToken = request.cookies?.medicalsys_session || bearerToken;
    if (!rawToken) {
      return response.status(401).json({ message: 'Autenticación requerida.' });
    }

    payload = jwt.verify(rawToken, process.env.JWT_SECRET);
    if (!/^\d+$/.test(payload.sub)) throw new Error('Invalid subject');
  } catch (_error) {
    return response.status(401).json({ message: 'Autenticación requerida.' });
  }

  try {
    request.user = await authService.authenticateSession(payload.sub);

    // Strict Tenant Isolation Guard:
    if (request.tenant && !request.user.isSuperAdmin) {
      const activeCode = request.tenant.codigo;
      const userOrgs = request.user.organizaciones || [];
      if (!userOrgs.includes(activeCode)) {
        return response.status(403).json({
          message: `Acceso denegado: Su usuario no pertenece al centro médico "${request.tenant.nombre}".`,
          code: 'TENANT_ACCESS_DENIED'
        });
      }
    }

    return next();
  } catch (error) {
    if (error.statusCode === 401) return response.status(401).json({ message: error.message });
    if (error.statusCode === 403) return response.status(403).json({ message: error.message });
    return next(error);
  }
}
module.exports = requireAuth;
