const bcrypt = require('bcryptjs');
const { Prisma } = require('@prisma/client');
const prisma = require('../config/prisma');
const { recordAudit, permissionsForRole, permissionsForUser } = require('./security.service');
const allowedStatuses = ['ACTIVO', 'INACTIVO', 'SUSPENDIDO'];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordMaxLength = 128;

const safeUserSelect = {
  id_usuario: true,
  nombres: true,
  apellidos: true,
  email: true,
  telefono: true,
  estado: true,
  rol: { select: { codigo: true } }
};

class UserError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function toSafeUser(user) {
  return {
    id: Number(user.id_usuario),
    nombres: user.nombres,
    apellidos: user.apellidos,
    email: user.email,
    telefono: user.telefono,
    rol: user.rol.codigo,
    estado: user.estado
  };
}

function requiredText(value, fieldName) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    throw new UserError(400, `${fieldName} es obligatorio.`);
  }
  return normalized;
}

function normalizeEmail(value) {
  const email = requiredText(value, 'El correo electrónico').toLowerCase();
  if (!emailPattern.test(email)) {
    throw new UserError(400, 'El correo electrónico no es válido.');
  }
  return email;
}

function normalizePhone(value) {
  if (value === undefined || value === null) return null;
  const phone = String(value).trim();
  return phone || null;
}

function validatePassword(value) {
  if (typeof value !== 'string') {
    throw new UserError(400, 'La contraseña es obligatoria.');
  }
  if (value.length < 12) {
    throw new UserError(400, 'La contraseña debe tener al menos 12 caracteres.');
  }
  if (value.length > passwordMaxLength) {
    throw new UserError(400, `La contraseña no puede superar ${passwordMaxLength} caracteres.`);
  }
  if (/\s/.test(value)) {
    throw new UserError(400, 'La contraseña no puede contener espacios.');
  }
  if (!/[a-z]/.test(value)) {
    throw new UserError(400, 'La contraseña debe incluir una letra minúscula.');
  }
  if (!/[A-Z]/.test(value)) {
    throw new UserError(400, 'La contraseña debe incluir una letra mayúscula.');
  }
  if (!/\d/.test(value)) {
    throw new UserError(400, 'La contraseña debe incluir un número.');
  }
  if (!/[^A-Za-z0-9]/.test(value)) {
    throw new UserError(400, 'La contraseña debe incluir un símbolo.');
  }
  return value;
}

function validateRole(roleInput) {
  const role = typeof roleInput === 'string' ? roleInput.trim().toUpperCase() : '';
  if (!/^[A-Z][A-Z0-9_]{0,29}$/.test(role)) {
    throw new UserError(400, 'Rol no válido.');
  }
  return role;
}

function validateStatus(statusInput) {
  const status = typeof statusInput === 'string' ? statusInput.trim().toUpperCase() : '';
  if (!allowedStatuses.includes(status)) {
    throw new UserError(400, 'Estado no válido.');
  }
  return status;
}

function parseUserId(value) {
  if (!/^\d+$/.test(String(value))) {
    throw new UserError(400, 'Identificador de usuario no válido.');
  }
  return BigInt(value);
}

async function findRole(roleCode, db = prisma) {
  const role = await db.rol.findUnique({ where: { codigo: roleCode } });
  if (!role || !role.activo) {
    throw new UserError(400, 'Rol no válido.');
  }
  return role;
}

async function createUser(input, db = prisma) {
  const nombres = requiredText(input.nombres, 'Nombres');
  const apellidos = requiredText(input.apellidos, 'Apellidos');
  const email = normalizeEmail(input.email);
  const password = validatePassword(input.password);
  if (input.passwordConfirmation !== password) throw new UserError(400, 'Las contraseñas no coinciden.');
  const roleCode = validateRole(input.rol);
  const telefono = normalizePhone(input.telefono);

  const existingUser = await db.usuario.findUnique({ where: { email } });
  if (existingUser) {
    throw new UserError(409, 'El correo electrónico ya está registrado.');
  }

  const role = await findRole(roleCode, db);
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await db.usuario.create({
      data: {
        nombres,
        apellidos,
        email,
        password_hash: passwordHash,
        telefono,
        id_rol: role.id_rol,
        estado: 'ACTIVO'
      },
      select: safeUserSelect
    });
    return toSafeUser(user);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new UserError(409, 'El correo electrónico ya está registrado.');
    }
    throw error;
  }
}

async function listUsers() {
  const users = await prisma.usuario.findMany({
    orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }],
    select: safeUserSelect
  });
  return users.map(toSafeUser);
}

async function listRoles() {
  const roles = await prisma.rol.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } });
  return roles.map((role) => ({ code: role.codigo, name: role.nombre, description: role.descripcion }));
}

async function getUserById(idInput) {
  const id = parseUserId(idInput);
  const user = await prisma.usuario.findUnique({
    where: { id_usuario: id },
    select: safeUserSelect
  });
  if (!user) {
    throw new UserError(404, 'Usuario no encontrado.');
  }
  return toSafeUser(user);
}

async function updateUser(idInput, input, db = prisma) {
  const id = parseUserId(idInput);
  const existingUser = await db.usuario.findUnique({ where: { id_usuario: id } });
  if (!existingUser) {
    throw new UserError(404, 'Usuario no encontrado.');
  }

  const data = { fecha_actualizacion: new Date() };
  if (input.nombres !== undefined) data.nombres = requiredText(input.nombres, 'Nombres');
  if (input.apellidos !== undefined) data.apellidos = requiredText(input.apellidos, 'Apellidos');
  if (input.telefono !== undefined) data.telefono = normalizePhone(input.telefono);
  if (input.estado !== undefined) data.estado = validateStatus(input.estado);
  if (input.rol !== undefined) {
    const role = await findRole(validateRole(input.rol), db);
    data.id_rol = role.id_rol;
  }

  if (Object.keys(data).length === 1) {
    throw new UserError(400, 'No se enviaron campos para actualizar.');
  }

  const user = await db.usuario.update({
    where: { id_usuario: id },
    data,
    select: safeUserSelect
  });
  return toSafeUser(user);
}

async function deactivateUser(idInput, db = prisma) {
  const id = parseUserId(idInput);
  const existingUser = await db.usuario.findUnique({ where: { id_usuario: id } });
  if (!existingUser) {
    throw new UserError(404, 'Usuario no encontrado.');
  }
  await db.usuario.update({
    where: { id_usuario: id },
    data: { estado: 'INACTIVO', fecha_actualizacion: new Date() }
  });
}

async function mutateUser(action, idInput, input, actor) {
  return prisma.$transaction(async (db) => {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(742106)`;
    const account = await db.usuario.findUnique({ where: { id_usuario: BigInt(actor.id) }, include: { rol: true } });
    const actorPermissions = account && account.estado === 'ACTIVO' && account.rol.activo
      ? await permissionsForUser(account.id_usuario, account.rol.codigo, db) : [];
    if (!actorPermissions.includes('users.manage')) throw new UserError(403, 'No tiene permisos para administrar usuarios.');
    const id = idInput ? parseUserId(idInput) : null;
    if (id === BigInt(actor.id) && (action === 'DEACTIVATE' || input.rol !== undefined || input.estado !== undefined)) {
      throw new UserError(400, 'No puede cambiar su propio rol o estado desde esta pantalla.');
    }
    const before = id ? await db.usuario.findUnique({ where: { id_usuario: id }, select: safeUserSelect }) : null;
    if (!actorPermissions.includes('security.manage')) {
      const targetRoles = [before?.rol.codigo, input.rol].filter(Boolean);
      for (const targetRole of targetRoles) {
        const targetPermissions = await permissionsForRole(targetRole, db);
        if (targetPermissions.some((permission) => !actorPermissions.includes(permission))) {
          throw new UserError(403, 'Se requiere administrar seguridad para asignar o modificar accesos superiores a los propios.');
        }
      }
    }
    if (id && input.rol && before && input.rol !== before.rol.codigo) {
      const [doctor, patient] = await Promise.all([
        db.medico.findUnique({ where: { id_usuario: id } }),
        db.paciente.findUnique({ where: { id_usuario: id } })
      ]);
      if (doctor || patient) throw new UserError(400, 'El usuario tiene un perfil médico o de paciente vinculado; no se puede cambiar su rol.');
    }
    let result;
    if (action === 'CREATE') result = await createUser(input, db);
    else if (action === 'UPDATE') result = await updateUser(idInput, input, db);
    else await deactivateUser(idInput, db);
    await recordAudit(db, actor.id, 'USER_' + action, idInput || result.id, {
      before: before ? { rol: before.rol.codigo, estado: before.estado } : null,
      after: result ? { rol: result.rol, estado: result.estado } : { estado: 'INACTIVO' }
    });
    return result;
  }, { timeout: 15000 });
}
module.exports = {
  mutateUser,
  allowedStatuses,
  createUser,
  deactivateUser,
  getUserById,
  listUsers,
  listRoles,
  updateUser,
  UserError,
  validatePassword
};
