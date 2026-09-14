const jwt = require('jsonwebtoken');
const authService = require('../services/auth.service');
async function requireAuth(request, response, next) {
  let payload;
  try {
    payload = jwt.verify(request.cookies.medicalsys_session, process.env.JWT_SECRET);
    if (!/^\d+$/.test(payload.sub)) throw new Error('Invalid subject');
  } catch (_error) {
    return response.status(401).json({ message: 'Autenticación requerida.' });
  }
  try {
    request.user = await authService.authenticateSession(payload.sub);
    return next();
  } catch (error) {
    if (error.statusCode === 401) return response.status(401).json({ message: error.message });
    return next(error);
  }
}
module.exports = requireAuth;
