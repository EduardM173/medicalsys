function authorize(allowedRoles, message) {
  return function authorizeRole(request, response, next) {
    if (!request.user || !allowedRoles.includes(request.user.rol)) {
      return response.status(403).json({
        message
      });
    }

    return next();
  };
}

function requireRole(...allowedRoles) {
  return authorize(allowedRoles, 'No tiene permisos para realizar esta operación.');
}

requireRole.withMessage = function requireRoleWithMessage(message, ...allowedRoles) {
  return authorize(allowedRoles, message);
};

module.exports = requireRole;
