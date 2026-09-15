+require('dotenv').config();
const prisma = require('../src/config/prisma');
const { roles, defaults } = require('../src/security/permissions');

async function reconcileRolePermissions() {
  await require('./setup-security')();
  await prisma.$transaction(async (db) => {
    for (const role of roles) {
      const existing = await db.rol.findUnique({ where: { codigo: role } });
      if (!existing) throw new Error(`No existe el rol estándar ${role}. Ejecute el seed o cree el rol antes de reconciliar.`);
      const permissions = [...new Set(defaults(role))].sort();
      await db.$executeRaw`
        INSERT INTO public.security_role_policy (role_code, permissions)
        VALUES (${role}, ${JSON.stringify(permissions)}::jsonb)
        ON CONFLICT (role_code) DO UPDATE
        SET permissions = EXCLUDED.permissions, updated_at = NOW()`;
    }
    await db.$executeRaw`
      INSERT INTO public.security_audit (actor_id, action, target, details)
      VALUES (NULL, 'BASELINE_RBAC_RECONCILED', 'STANDARD_ROLES',
        ${JSON.stringify({ roles, source: 'security/permissions.js', temporaryGrantsPreserved: true })}::jsonb)`;
  });
  return Object.fromEntries(roles.map((role) => [role, defaults(role)]));
}

if (require.main === module) {
  reconcileRolePermissions()
    .then((policies) => console.log(JSON.stringify({ event: 'rbac.baseline.reconciled', policies })))
    .catch((error) => { console.error(error.message); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}

module.exports = reconcileRolePermissions;

