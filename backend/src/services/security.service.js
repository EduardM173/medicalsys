const repository = require('../repositories/security.repository');
const { catalog, defaults } = require('../security/permissions');

function invalid(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

const permissionCodes = new Set(catalog.map((permission) => permission.code));

function validatePermissions(permissions) {
  if (!Array.isArray(permissions) || permissions.some((code) => !permissionCodes.has(code))) {
    throw invalid('La selección contiene permisos no válidos.');
  }
  const selected = [...new Set(permissions)].sort();
  for (const code of selected) {
    const rule = catalog.find((permission) => permission.code === code);
    if (rule.requires.some((required) => !selected.includes(required))) {
      throw invalid(`«${rule.label}» requiere: ${rule.requires.join(', ')}.`);
    }
  }
  return selected;
}

function expandRequiredPermissions(permissions) {
  const expanded = new Set(permissions);
  const addRequirements = (code) => {
    const rule = catalog.find((permission) => permission.code === code);
    rule?.requires.forEach((required) => {
      if (!expanded.has(required)) {
        expanded.add(required);
        addRequirements(required);
      }
    });
  };
  [...expanded].forEach(addRequirements);
  return [...expanded];
}

async function permissionsForRole(role, data = repository) {
  const rows = await data.getRolePolicy(role);
  const permitted = rows[0]?.permissions ?? defaults(role);
  return [...new Set(permitted)].filter((code) => permissionCodes.has(code));
}

async function permissionsForUser(userId, role, data = repository) {
  const rolePermissions = await permissionsForRole(role, data);
  const grants = await data.getActiveUserGrants(userId);
  return expandRequiredPermissions([...rolePermissions, ...grants.map((grant) => grant.permission_code)])
    .filter((code) => permissionCodes.has(code));
}

async function matrix() {
  const roleRows = await repository.rol.findMany({
    where: { activo: true },
    orderBy: { nombre: 'asc' }
  });
  const entries = await Promise.all(roleRows.map(async (role) => ({
    code: role.codigo,
    name: role.nombre,
    description: role.descripcion,
    permissions: await permissionsForRole(role.codigo)
  })));
  return { roles: entries, permissions: catalog };
}

async function recordAudit(data, actorId, action, target, details = {}) {
  await data.recordAudit(actorId, action, target, details);
}

async function requireSecurityActor(data, actor) {
  const account = await data.usuario.findUnique({
    where: { id_usuario: BigInt(actor.id) },
    include: { rol: true }
  });
  if (!account || account.estado !== 'ACTIVO' || !account.rol.activo) {
    throw invalid('No tiene permisos para administrar seguridad.', 403);
  }
  const permissions = await permissionsForUser(account.id_usuario, account.rol.codigo, data);
  if (!permissions.includes('security.manage')) {
    throw invalid('No tiene permisos para administrar seguridad.', 403);
  }
  return { account, permissions };
}

async function updatePolicy(role, permissions, actor) {
  const selected = validatePermissions(permissions);
  return repository.transaction(async (data) => {
    await data.lockAdministration();
    const { account } = await requireSecurityActor(data, actor);
    const targetRole = await data.rol.findUnique({ where: { codigo: role } });
    if (!targetRole || !targetRole.activo) throw invalid('Rol no encontrado.', 404);
    if (role === account.rol.codigo && !selected.includes('security.manage')) {
      throw invalid('No puede retirar el acceso de seguridad a su propio rol. Asigne antes otro responsable.', 409);
    }
    const before = await permissionsForRole(role, data);
    await data.saveRolePolicy(role, selected);
    await recordAudit(data, actor.id, 'PERMISSIONS_UPDATED', role, { before, after: selected });
    return { role, permissions: selected };
  });
}

function normalizeRoleCode(value, fallback) {
  const source = String(value || fallback || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const code = source.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30);
  if (!code || !/^[A-Z][A-Z0-9_]*$/.test(code)) throw invalid('El código del rol no es válido.');
  return code;
}

async function createRole(input, actor) {
  const name = typeof input?.name === 'string' ? input.name.trim() : '';
  if (name.length < 3 || name.length > 80) {
    throw invalid('El nombre del rol debe tener entre 3 y 80 caracteres.');
  }
  const code = normalizeRoleCode(input.code, name);
  const description = typeof input.description === 'string' ? input.description.trim().slice(0, 255) : null;
  const permissions = validatePermissions(input.permissions || []);
  return repository.transaction(async (data) => {
    await data.lockAdministration();
    await requireSecurityActor(data, actor);
    if (await data.rol.findUnique({ where: { codigo: code } })) {
      throw invalid('Ya existe un rol con ese código.', 409);
    }
    const role = await data.rol.create({
      data: { codigo: code, nombre: name, descripcion: description || null, activo: true }
    });
    await data.insertRolePolicy(code, permissions);
    await recordAudit(data, actor.id, 'ROLE_CREATED', code, { name, permissions });
    return { code: role.codigo, name: role.nombre, description: role.descripcion, permissions };
  });
}

async function listTemporaryGrants() {
  return repository.listTemporaryGrants();
}

async function grantTemporaryPermission(input, actor) {
  if (!/^\d+$/.test(String(input?.userId))) throw invalid('Usuario no válido.');
  const permission = String(input?.permission || '');
  if (!permissionCodes.has(permission)) throw invalid('Permiso no válido.');
  const expiresAt = new Date(input.expiresAt);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
    throw invalid('El vencimiento debe ser una fecha futura.');
  }
  return repository.transaction(async (data) => {
    await data.lockAdministration();
    await requireSecurityActor(data, actor);
    const target = await data.usuario.findUnique({
      where: { id_usuario: BigInt(input.userId) },
      include: { rol: true }
    });
    if (!target || target.estado !== 'ACTIVO' || !target.rol.activo) {
      throw invalid('El usuario no tiene acceso activo.', 409);
    }
    await data.revokeExistingGrant(target.id_usuario, permission, actor.id);
    const rows = await data.createTemporaryGrant(target.id_usuario, permission, expiresAt, actor.id);
    await recordAudit(data, actor.id, 'TEMPORARY_PERMISSION_GRANTED', target.id_usuario, {
      permission,
      expiresAt: expiresAt.toISOString()
    });
    return rows[0];
  });
}

async function revokeTemporaryGrant(idInput, actor) {
  if (!/^\d+$/.test(String(idInput))) throw invalid('Concesión no válida.');
  return repository.transaction(async (data) => {
    await data.lockAdministration();
    await requireSecurityActor(data, actor);
    const rows = await data.revokeTemporaryGrant(idInput, actor.id);
    if (!rows.length) throw invalid('La concesión ya no está activa.', 404);
    await recordAudit(data, actor.id, 'TEMPORARY_PERMISSION_REVOKED', rows[0].user_id, {
      permission: rows[0].permission_code
    });
    return { message: 'Permiso temporal revocado.' };
  });
}

async function audit() {
  return repository.listAudit();
}

module.exports = {
  audit,
  createRole,
  grantTemporaryPermission,
  invalid,
  listTemporaryGrants,
  matrix,
  permissionsForRole,
  permissionsForUser,
  recordAudit,
  revokeTemporaryGrant,
  updatePolicy,
  validatePermissions,
  expandRequiredPermissions
};
