const { permissionForRequest } = require('../security/permissions');
// Legacy router signatures remain supported; the central catalog is authoritative.
function requireRole() {
  return function authorize(request, response, next) {
    const permission = permissionForRequest(request);
    if (!permission || !request.user?.permissions?.includes(permission)) {
      return response.status(403).json({ message: 'No tiene permisos para realizar esta operación.' });
    }
    return next();
  };
}
requireRole.withMessage = () => requireRole();
module.exports = requireRole;
