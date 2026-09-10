const database = require('../config/prisma');
const { createRepository } = require('./repository.factory');

function createSecurityRepository(client = database) {
  const models = createRepository(['usuario', 'rol'], client);
  return Object.freeze({
    ...models,
    transaction: (work, options) => client.$transaction(
      (transactionClient) => work(createSecurityRepository(transactionClient)),
      options
    ),
    lockAdministration: () => client.$executeRaw`SELECT pg_advisory_xact_lock(742106)`,
    getRolePolicy: (role) => client.$queryRaw`
      SELECT permissions FROM security_role_policy WHERE role_code = ${role}`,
    getActiveUserGrants: (userId) => client.$queryRaw`
      SELECT permission_code FROM security_user_grant
      WHERE user_id = ${BigInt(userId)} AND revoked_at IS NULL AND expires_at > NOW()`,
    saveRolePolicy: (role, permissions) => client.$executeRaw`
      INSERT INTO security_role_policy (role_code, permissions)
      VALUES (${role}, ${JSON.stringify(permissions)}::jsonb)
      ON CONFLICT (role_code) DO UPDATE SET permissions = EXCLUDED.permissions, updated_at = NOW()`,
    insertRolePolicy: (role, permissions) => client.$executeRaw`
      INSERT INTO security_role_policy (role_code, permissions)
      VALUES (${role}, ${JSON.stringify(permissions)}::jsonb)`,
    recordAudit: (actorId, action, target, details) => client.$executeRaw`
      INSERT INTO security_audit (actor_id, action, target, details)
      VALUES (${BigInt(actorId)}, ${action}, ${String(target)}, ${JSON.stringify(details)}::jsonb)`,
    listTemporaryGrants: () => client.$queryRaw`
      SELECT g.id::text, g.user_id::text, g.permission_code, g.expires_at,
        g.granted_by::text, g.created_at, u.nombres, u.apellidos, u.email
      FROM security_user_grant g JOIN usuario u ON u.id_usuario = g.user_id
      WHERE g.revoked_at IS NULL AND g.expires_at > NOW()
      ORDER BY g.expires_at ASC`,
    revokeMatchingGrants: (userId, permission, actorId) => client.$executeRaw`
      UPDATE security_user_grant SET revoked_at = NOW(), revoked_by = ${BigInt(actorId)}
      WHERE user_id = ${BigInt(userId)} AND permission_code = ${permission} AND revoked_at IS NULL`,
    createTemporaryGrant: (userId, permission, expiresAt, actorId) => client.$queryRaw`
      INSERT INTO security_user_grant (user_id, permission_code, expires_at, granted_by)
      VALUES (${BigInt(userId)}, ${permission}, ${expiresAt}, ${BigInt(actorId)})
      RETURNING id::text, user_id::text, permission_code, expires_at, granted_by::text, created_at`,
    revokeTemporaryGrant: (grantId, actorId) => client.$queryRaw`
      UPDATE security_user_grant
      SET revoked_at = NOW(), revoked_by = ${BigInt(actorId)}
      WHERE id = ${BigInt(grantId)} AND revoked_at IS NULL AND expires_at > NOW()
      RETURNING user_id::text, permission_code`,
    listAudit: () => client.$queryRaw`
      SELECT id::text, actor_id::text, action, target, details, created_at
      FROM security_audit ORDER BY id DESC LIMIT 100`
  });
}

module.exports = { ...createSecurityRepository(), createSecurityRepository };
