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

const tenantRepository = require('../repositories/tenant.repository');

async function getUserOrganizations(userId) {
  try {
    const rels = await tenantRepository.usuario_organizacion.findMany({
      where: {
        id_usuario: BigInt(userId),
        activo: true
      },
      include: {
        organizacion: true
      }
    });

    return rels.map((r) => ({
      id: Number(r.organizacion.id_organizacion),
      codigo: r.organizacion.codigo,
      nombre: r.organizacion.nombre,
      subdominio: r.organizacion.subdominio,
      rol: r.rol_en_organizacion
    }));
  } catch (_err) {
    return [];
  }
}

function toSafeUser(user, organizaciones = []) {
  const isSuperAdmin = user.rol.codigo === 'SUPERADMIN';
  return {
    id: Number(user.id_usuario),
    nombres: user.nombres,
    apellidos: user.apellidos,
    email: user.email,
    rol: user.rol.codigo,
    isSuperAdmin,
    organizaciones
  };
}

async function login(emailInput, passwordInput, activeTenantCode = null) {
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

  const userOrgs = await getUserOrganizations(user.id_usuario);
  const isSuperAdmin = user.rol.codigo === 'SUPERADMIN';

  // Strict tenant boundary check on login
  if (activeTenantCode && !isSuperAdmin) {
    const cleanTenant = String(activeTenantCode).trim().toLowerCase();
    const hasAccess = userOrgs.some(
      (o) => o.codigo === cleanTenant || o.subdominio === cleanTenant
    );
    if (!hasAccess && userOrgs.length > 0) {
      throw new AuthError(
        403,
        `Esta cuenta no tiene autorización para acceder a la clínica solicitada (${cleanTenant}).`
      );
    }
  }

  const safeUser = toSafeUser(user, userOrgs);
  safeUser.permissions = await permissionsForUser(user.id_usuario, user.rol.codigo);
  const token = jwt.sign(
    {
      rol: safeUser.rol,
      isSuperAdmin,
      organizaciones: userOrgs.map((o) => o.codigo)
    },
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

  const userOrgs = await getUserOrganizations(user.id_usuario);
  const safeUser = toSafeUser(user, userOrgs);
  safeUser.permissions = await permissionsForUser(user.id_usuario, user.rol.codigo);
  return safeUser;
}

async function authenticateSession(userId) {
  const user = await repository.usuario.findUnique({
    where: { id_usuario: BigInt(userId) },
    include: { rol: true }
  });
  if (!user || user.estado !== 'ACTIVO' || !user.rol.activo) {
    throw new AuthError(401, 'Sesión sin acceso habilitado.');
  }
  const userOrgs = await getUserOrganizations(user.id_usuario);
  const isSuperAdmin = user.rol.codigo === 'SUPERADMIN';
  return {
    id: String(user.id_usuario),
    idUsuario: String(user.id_usuario),
    rol: user.rol.codigo,
    isSuperAdmin,
    organizaciones: userOrgs.map((o) => o.codigo),
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
