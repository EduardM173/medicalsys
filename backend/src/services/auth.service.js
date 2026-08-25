const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

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

  const user = await prisma.usuario.findUnique({
    where: { email },
    include: { rol: true }
  });

  const passwordMatches = user
    ? await bcrypt.compare(password, user.password_hash)
    : false;

  if (!user || !passwordMatches) {
    throw new AuthError(401, 'Correo electrónico o contraseña incorrectos.');
  }

  if (user.estado !== 'ACTIVO') {
    throw new AuthError(403, 'Usuario sin acceso habilitado.');
  }

  const safeUser = toSafeUser(user);
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
  const user = await prisma.usuario.findUnique({
    where: { id_usuario: BigInt(userId) },
    include: { rol: true }
  });

  if (!user) {
    throw new AuthError(401, 'Autenticación requerida.');
  }

  if (user.estado !== 'ACTIVO') {
    throw new AuthError(403, 'Usuario sin acceso habilitado.');
  }

  return toSafeUser(user);
}

module.exports = { AuthError, getCurrentUser, login };
