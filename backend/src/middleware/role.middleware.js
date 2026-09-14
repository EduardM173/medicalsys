const { permissionForRequest } = require('../security/permissions');
const { isClinicalPermission, recordUnauthorizedAccess } = require('../services/audit.service');

// Legacy router signatures remain supported; the central catalog is authoritative.
function requireRole() {
  return function authorize(request, response, next) {
    const permission = permissionForRequest(request);
    if (!permission || !request.user?.permissions?.includes(permission)) {
      // PA-05: los intentos no autorizados sobre datos clínicos se auditan.
      if (request.user && isClinicalPermission(permission)) {
        recordUnauthorizedAccess(request.user, permission, request.originalUrl);
      }
      return response.status(403).json({ message: 'No tiene permisos para realizar esta operación.' });
    }
    return next();
  };
}
requireRole.withMessage = () => requireRole();
module.exports = requireRole;