const jwt = require('jsonwebtoken');

function requireAuth(request, response, next) {
  const token = request.cookies.medicalsys_session;

  if (!token) {
    return response.status(401).json({ message: 'Autenticación requerida.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    request.user = {
      id: payload.sub,
      idUsuario: payload.sub,
      rol: payload.rol
    };
    return next();
  } catch (_error) {
    return response.status(401).json({ message: 'Autenticación requerida.' });
  }
}

module.exports = requireAuth;
