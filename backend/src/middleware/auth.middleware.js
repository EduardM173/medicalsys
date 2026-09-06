const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { permissionsForRole } = require('../services/security.service');
async function requireAuth(request, response, next) {
  let payload;
  try {
    payload = jwt.verify(request.cookies.medicalsys_session, process.env.JWT_SECRET);
    if (!/^\d+$/.test(payload.sub)) throw new Error('Invalid subject');
  } catch (_error) {
    return response.status(401).json({ message: 'Autenticación requerida.' });
  }
  try {
    const user = await prisma.usuario.findUnique({ where: { id_usuario: BigInt(payload.sub) }, include: { rol: true } });
    if (!user || user.estado !== 'ACTIVO' || !user.rol.activo) {
      return response.status(401).json({ message: 'Sesión sin acceso habilitado.' });
    }
    request.user = {
      id: String(user.id_usuario), idUsuario: String(user.id_usuario), rol: user.rol.codigo,
      permissions: await permissionsForRole(user.rol.codigo)
    };
    return next();
  } catch (error) { return next(error); }
}
module.exports = requireAuth;
