const bcrypt = require('bcryptjs');
const { Prisma } = require('@prisma/client');
const prisma = require('../config/prisma');

const allowedRoles = ['ADMINISTRADOR', 'MEDICO', 'RECEPCIONISTA', 'PACIENTE'];
const allowedStatuses = ['ACTIVO', 'INACTIVO', 'SUSPENDIDO'];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function validateRole(roleInput) {
  const role = typeof roleInput === 'string' ? roleInput.trim().toUpperCase() : '';
  if (!allowedRoles.includes(role)) {
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

async function findRole(roleCode) {
  const role = await prisma.rol.findUnique({ where: { codigo: roleCode } });
  if (!role || !role.activo) {
    throw new UserError(400, 'Rol no válido.');
  }
  return role;
}

async function createUser(input) {
  const nombres = requiredText(input.nombres, 'Nombres');
  const apellidos = requiredText(input.apellidos, 'Apellidos');
  const email = normalizeEmail(input.email);
  const password = requiredText(input.password, 'La contraseña');
  const roleCode = validateRole(input.rol);
  const telefono = normalizePhone(input.telefono);

  const existingUser = await prisma.usuario.findUnique({ where: { email } });
  if (existingUser) {
    throw new UserError(409, 'El correo electrónico ya está registrado.');
  }

  const role = await findRole(roleCode);
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await prisma.usuario.create({
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

async function updateUser(idInput, input) {
  const id = parseUserId(idInput);
  const existingUser = await prisma.usuario.findUnique({ where: { id_usuario: id } });
  if (!existingUser) {
    throw new UserError(404, 'Usuario no encontrado.');
  }

  const data = { fecha_actualizacion: new Date() };
  if (input.nombres !== undefined) data.nombres = requiredText(input.nombres, 'Nombres');
  if (input.apellidos !== undefined) data.apellidos = requiredText(input.apellidos, 'Apellidos');
  if (input.telefono !== undefined) data.telefono = normalizePhone(input.telefono);
  if (input.estado !== undefined) data.estado = validateStatus(input.estado);
  if (input.rol !== undefined) {
    const role = await findRole(validateRole(input.rol));
    data.id_rol = role.id_rol;
  }

  if (Object.keys(data).length === 1) {
    throw new UserError(400, 'No se enviaron campos para actualizar.');
  }

  const user = await prisma.usuario.update({
    where: { id_usuario: id },
    data,
    select: safeUserSelect
  });
  return toSafeUser(user);
}

async function deactivateUser(idInput) {
  const id = parseUserId(idInput);
  const existingUser = await prisma.usuario.findUnique({ where: { id_usuario: id } });
  if (!existingUser) {
    throw new UserError(404, 'Usuario no encontrado.');
  }
  await prisma.usuario.update({
    where: { id_usuario: id },
    data: { estado: 'INACTIVO', fecha_actualizacion: new Date() }
  });
}

module.exports = {
  allowedRoles,
  allowedStatuses,
  createUser,
  deactivateUser,
  getUserById,
  listUsers,
  updateUser,
  UserError
};
