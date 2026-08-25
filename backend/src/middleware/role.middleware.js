function requireRole(...allowedRoles) {
  return function authorizeRole(request, response, next) {
    if (!request.user || !allowedRoles.includes(request.user.rol)) {
      return response.status(403).json({
        message: 'No tiene permisos para realizar esta operación.'
      });
    }

    return next();
  };
}

module.exports = requireRole;
