const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const repository = require('../repositories/auth.repository');
const { permissionsForUser } = require('./security.service');

class AuthError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET no está configurado.');
  }

  return process.env.JWT_SECRET;
}

function toSafeUser(user) {
  return {
    id: Number(user.id_usuario),
    nombres: user.nombres,
    apellidos: user.apellidos,
    email: user.email,
    rol: user.rol.codigo
  };
}

async function login(emailInput, passwordInput) {
  const email = typeof emailInput === 'string' ? emailInput.trim().toLowerCase() : '';
  const password = typeof passwordInput === 'string' ? passwordInput : '';

  if (!email || !password.trim()) {
    throw new AuthError(400, 'Correo electrónico y contraseña son obligatorios.');
  }

  const user = await repository.usuario.findUnique({
    where: { email },
    include: { rol: true }
  });

  const passwordMatches = user
    ? await bcrypt.compare(password, user.password_hash)
    : false;

  if (!user || !passwordMatches) {
    throw new AuthError(401, 'Correo electrónico o contraseña incorrectos.');
  }

  if (user.estado !== 'ACTIVO' || !user.rol.activo) {
    throw new AuthError(403, 'Usuario sin acceso habilitado.');
  }

  const safeUser = toSafeUser(user);
  safeUser.permissions = await permissionsForUser(user.id_usuario, user.rol.codigo);
  const token = jwt.sign(
    { rol: safeUser.rol },
    getJwtSecret(),
    {
      subject: String(user.id_usuario),
      expiresIn: process.env.JWT_EXPIRES_IN || '8h'
    }
  );

  return { token, user: safeUser };
}

async function getCurrentUser(userId) {
  const user = await repository.usuario.findUnique({
    where: { id_usuario: BigInt(userId) },
    include: { rol: true }
  });

  if (!user) {
    throw new AuthError(401, 'Autenticación requerida.');
  }

  if (user.estado !== 'ACTIVO' || !user.rol.activo) {
    throw new AuthError(403, 'Usuario sin acceso habilitado.');
  }

  return { ...toSafeUser(user), permissions: await permissionsForUser(user.id_usuario, user.rol.codigo) };
}

async function authenticateSession(userId) {
  const user = await repository.usuario.findUnique({
    where: { id_usuario: BigInt(userId) },
    include: { rol: true }
  });
  if (!user || user.estado !== 'ACTIVO' || !user.rol.activo) {
    throw new AuthError(401, 'Sesión sin acceso habilitado.');
  }
  return {
    id: String(user.id_usuario),
    idUsuario: String(user.id_usuario),
    rol: user.rol.codigo,
    permissions: await permissionsForUser(user.id_usuario, user.rol.codigo)
  };
}

async function forgotPassword(emailInput) {
  const email = typeof emailInput === 'string' ? emailInput.trim().toLowerCase() : '';
  if (!email) {
    throw new AuthError(400, 'Ingrese su correo electrónico para continuar.');
  }

  const user = await repository.usuario.findUnique({
    where: { email },
    select: { id_usuario: true, email: true, nombres: true, apellidos: true, estado: true }
  });

  // No se revela si la cuenta existe: se devuelve el mismo mensaje en ambos casos.
  if (user && user.estado === 'ACTIVO') {
    const token = jwt.sign(
      { role: 'PASSWORD_RESET' },
      getJwtSecret(),
      { subject: String(user.id_usuario), expiresIn: '30m' }
    );
    const resetLink = `${process.env.APP_BASE_URL || 'http://localhost:5173'}/recuperar-contrasena?token=${token}`;

    // Simulación del envío por correo: se registra en consola en el entorno de desarrollo.
    // eslint-disable-next-line no-console
    console.log(`[forgot-password] Enviar a ${user.email}: ${user.nombres} ${user.apellidos} | Enlace: ${resetLink}`);
  }

  return { message: 'Se han enviado las instrucciones de restablecimiento a su correo electrónico.' };
}

module.exports = { AuthError, authenticateSession, forgotPassword, getCurrentUser, login };
