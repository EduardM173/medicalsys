const prisma = require('../config/prisma');
const { catalog, defaults } = require('../security/permissions');

function invalid(message, statusCode = 400) { return Object.assign(new Error(message), { statusCode }); }
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
      if (!expanded.has(required)) { expanded.add(required); addRequirements(required); }
    });
  };
  [...expanded].forEach(addRequirements);
  return [...expanded];
}

async function permissionsForRole(role, db = prisma) {
  const rows = await db.$queryRaw`SELECT permissions FROM security_role_policy WHERE role_code = ${role}`;
  const permitted = rows[0]?.permissions ?? defaults(role);
  return [...new Set(permitted)].filter((code) => permissionCodes.has(code));
}

async function permissionsForUser(userId, role, db = prisma) {
  const rolePermissions = await permissionsForRole(role, db);
  const grants = await db.$queryRaw`SELECT permission_code FROM security_user_grant
    WHERE user_id = ${BigInt(userId)} AND revoked_at IS NULL AND expires_at > NOW()`;
  return expandRequiredPermissions([...rolePermissions, ...grants.map((grant) => grant.permission_code)])
    .filter((code) => permissionCodes.has(code));
}

async function matrix() {
  const roleRows = await prisma.rol.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } });
  const entries = await Promise.all(roleRows.map(async (role) => ({
    code: role.codigo,
    name: role.nombre,
    description: role.descripcion,
    permissions: await permissionsForRole(role.codigo)
  })));
  return { roles: entries, permissions: catalog };
}

async function recordAudit(db, actorId, action, target, details = {}) {
  await db.$executeRaw`INSERT INTO security_audit (actor_id, action, target, details)
    VALUES (${BigInt(actorId)}, ${action}, ${String(target)}, ${JSON.stringify(details)}::jsonb)`;
}

async function requireSecurityActor(db, actor) {
  const account = await db.usuario.findUnique({ where: { id_usuario: BigInt(actor.id) }, include: { rol: true } });
  if (!account || account.estado !== 'ACTIVO' || !account.rol.activo) {
    throw invalid('No tiene permisos para administrar seguridad.', 403);
  }
  const permissions = await permissionsForUser(account.id_usuario, account.rol.codigo, db);
  if (!permissions.includes('security.manage')) throw invalid('No tiene permisos para administrar seguridad.', 403);
  return { account, permissions };
}

async function updatePolicy(role, permissions, actor) {
  const selected = validatePermissions(permissions);
  return prisma.$transaction(async (db) => {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(742106)`;
    const { account } = await requireSecurityActor(db, actor);
    const targetRole = await db.rol.findUnique({ where: { codigo: role } });
    if (!targetRole || !targetRole.activo) throw invalid('Rol no encontrado.', 404);
    if (role === account.rol.codigo && !selected.includes('security.manage')) {
      throw invalid('No puede retirar el acceso de seguridad a su propio rol. Asigne antes otro responsable.', 409);
    }
    const before = await permissionsForRole(role, db);
    await db.$executeRaw`INSERT INTO security_role_policy (role_code, permissions)
      VALUES (${role}, ${JSON.stringify(selected)}::jsonb)
      ON CONFLICT (role_code) DO UPDATE SET permissions = EXCLUDED.permissions, updated_at = NOW()`;
    await recordAudit(db, actor.id, 'PERMISSIONS_UPDATED', role, { before, after: selected });
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
  if (name.length < 3 || name.length > 80) throw invalid('El nombre del rol debe tener entre 3 y 80 caracteres.');
  const code = normalizeRoleCode(input.code, name);
  const description = typeof input.description === 'string' ? input.description.trim().slice(0, 255) : null;
  const permissions = validatePermissions(input.permissions || []);
  return prisma.$transaction(async (db) => {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(742106)`;
    await requireSecurityActor(db, actor);
    if (await db.rol.findUnique({ where: { codigo: code } })) throw invalid('Ya existe un rol con ese código.', 409);
    const role = await db.rol.create({ data: { codigo: code, nombre: name, descripcion: description || null, activo: true } });
    await db.$executeRaw`INSERT INTO security_role_policy (role_code, permissions)
      VALUES (${code}, ${JSON.stringify(permissions)}::jsonb)`;
    await recordAudit(db, actor.id, 'ROLE_CREATED', code, { name, permissions });
    return { code: role.codigo, name: role.nombre, description: role.descripcion, permissions };
  });
}

async function listTemporaryGrants() {
  return prisma.$queryRaw`SELECT g.id::text, g.user_id::text, g.permission_code, g.expires_at,
      g.granted_by::text, g.created_at, u.nombres, u.apellidos, u.email
    FROM security_user_grant g JOIN usuario u ON u.id_usuario = g.user_id
    WHERE g.revoked_at IS NULL AND g.expires_at > NOW()
    ORDER BY g.expires_at ASC`;
}

async function grantTemporaryPermission(input, actor) {
  if (!/^\d+$/.test(String(input?.userId))) throw invalid('Usuario no válido.');
  const permission = String(input?.permission || '');
  if (!permissionCodes.has(permission)) throw invalid('Permiso no válido.');
  const expiresAt = new Date(input.expiresAt);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) throw invalid('El vencimiento debe ser una fecha futura.');
  return prisma.$transaction(async (db) => {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(742106)`;
    await requireSecurityActor(db, actor);
    const target = await db.usuario.findUnique({ where: { id_usuario: BigInt(input.userId) }, include: { rol: true } });
    if (!target || target.estado !== 'ACTIVO' || !target.rol.activo) throw invalid('El usuario no tiene acceso activo.', 409);
    await db.$executeRaw`UPDATE security_user_grant SET revoked_at = NOW(), revoked_by = ${BigInt(actor.id)}
      WHERE user_id = ${target.id_usuario} AND permission_code = ${permission} AND revoked_at IS NULL`;
    const rows = await db.$queryRaw`INSERT INTO security_user_grant
      (user_id, permission_code, expires_at, granted_by)
      VALUES (${target.id_usuario}, ${permission}, ${expiresAt}, ${BigInt(actor.id)})
      RETURNING id::text, user_id::text, permission_code, expires_at, granted_by::text, created_at`;
    await recordAudit(db, actor.id, 'TEMPORARY_PERMISSION_GRANTED', target.id_usuario, { permission, expiresAt: expiresAt.toISOString() });
    return rows[0];
  });
}

async function revokeTemporaryGrant(idInput, actor) {
  if (!/^\d+$/.test(String(idInput))) throw invalid('Concesión no válida.');
  return prisma.$transaction(async (db) => {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(742106)`;
    await requireSecurityActor(db, actor);
    const rows = await db.$queryRaw`UPDATE security_user_grant
      SET revoked_at = NOW(), revoked_by = ${BigInt(actor.id)}
      WHERE id = ${BigInt(idInput)} AND revoked_at IS NULL AND expires_at > NOW()
      RETURNING user_id::text, permission_code`;
    if (!rows.length) throw invalid('La concesión ya no está activa.', 404);
    await recordAudit(db, actor.id, 'TEMPORARY_PERMISSION_REVOKED', rows[0].user_id, { permission: rows[0].permission_code });
    return { message: 'Permiso temporal revocado.' };
  });
}

async function audit() {
  return prisma.$queryRaw`SELECT id::text, actor_id::text, action, target, details, created_at
    FROM security_audit ORDER BY id DESC LIMIT 100`;
}

module.exports = {
  audit, createRole, grantTemporaryPermission, invalid, listTemporaryGrants, matrix,
  permissionsForRole, permissionsForUser, recordAudit, revokeTemporaryGrant, updatePolicy,
  validatePermissions, expandRequiredPermissions
};
