const prisma = require('../config/prisma');
const { roles, catalog, defaults } = require('../security/permissions');
function invalid(message, statusCode = 400) { return Object.assign(new Error(message), { statusCode }); }
async function permissionsForRole(role, db = prisma) {
  if (!roles.includes(role)) return [];
  const rows = await db.$queryRaw`SELECT permissions FROM security_role_policy WHERE role_code = ${role}`;
  const permitted = rows[0]?.permissions ?? defaults(role);
  return defaults(role).filter((code) => permitted.includes(code));
}
async function matrix() {
  const entries = await Promise.all(roles.map(async (code) => ({ code, permissions: await permissionsForRole(code) })));
  return { roles: entries, permissions: catalog };
}
async function recordAudit(db, actorId, action, target, details = {}) {
  await db.$executeRaw`INSERT INTO security_audit (actor_id, action, target, details)
    VALUES (${BigInt(actorId)}, ${action}, ${String(target)}, ${JSON.stringify(details)}::jsonb)`;
}
async function updatePolicy(role, permissions, actor) {
  if (!roles.includes(role) || !Array.isArray(permissions) || permissions.some((code) => !defaults(role).includes(code))) {
    throw invalid('La selección contiene permisos no habilitados para este rol.');
  }
  const selected = [...new Set(permissions)].sort();
  for (const code of selected) {
    const rule = catalog.find((p) => p.code === code);
    if (rule.requires.some((required) => !selected.includes(required))) {
      throw invalid(`«${rule.label}» requiere: ${rule.requires.join(', ')}.`);
    }
  }
  if (role === actor.rol && !selected.includes('security.manage')) {
    throw invalid('No puede retirar el acceso de seguridad a su propio rol.');
  }
  return prisma.$transaction(async (db) => {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(742106)`;
    const account = await db.usuario.findUnique({ where: { id_usuario: BigInt(actor.id) }, include: { rol: true } });
    if (!account || account.estado !== 'ACTIVO' || !account.rol.activo ||
        !(await permissionsForRole(account.rol.codigo, db)).includes('security.manage')) {
      throw invalid('No tiene permisos para administrar seguridad.', 403);
    }
    if (role === account.rol.codigo && !selected.includes('security.manage')) {
      throw invalid('No puede retirar el acceso de seguridad a su propio rol.');
    }
    const before = await permissionsForRole(role, db);
    await db.$executeRaw`INSERT INTO security_role_policy (role_code, permissions)
      VALUES (${role}, ${JSON.stringify(selected)}::jsonb)
      ON CONFLICT (role_code) DO UPDATE SET permissions = EXCLUDED.permissions, updated_at = NOW()`;
    await recordAudit(db, actor.id, 'PERMISSIONS_UPDATED', role, { before, after: selected });
    return { role, permissions: selected };
  });
}
async function audit() {
  return prisma.$queryRaw`SELECT id::text, actor_id::text, action, target, details, created_at
    FROM security_audit ORDER BY id DESC LIMIT 100`;
}
module.exports = { permissionsForRole, matrix, updatePolicy, audit, recordAudit, invalid };
