require('dotenv').config();
const prisma = require('../src/config/prisma');
async function setupSecurity() {
  await prisma.$transaction(async (db) => {
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS security_role_policy (
      role_code VARCHAR(30) PRIMARY KEY REFERENCES rol(codigo),
      permissions JSONB NOT NULL CHECK (jsonb_typeof(permissions) = 'array'),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS security_audit (
      id BIGSERIAL PRIMARY KEY, actor_id BIGINT REFERENCES usuario(id_usuario),
      action VARCHAR(60) NOT NULL, target VARCHAR(100) NOT NULL,
      details JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS security_user_grant (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES usuario(id_usuario),
      permission_code VARCHAR(80) NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      granted_by BIGINT NOT NULL REFERENCES usuario(id_usuario),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_at TIMESTAMPTZ,
      revoked_by BIGINT REFERENCES usuario(id_usuario)
    )`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_security_user_grant_active
      ON security_user_grant (user_id, expires_at) WHERE revoked_at IS NULL`);
    await db.rol.upsert({ where: { codigo: 'OSI' }, update: {}, create: {
      codigo: 'OSI', nombre: 'Oficial de Seguridad de la Información',
      descripcion: 'Administración de usuarios, roles, permisos y auditoría de accesos', activo: true
    } });
  });
}
if (require.main === module) {
  setupSecurity().then(() => console.log('Configuración de seguridad lista. Datos existentes conservados.'))
    .catch((error) => { console.error(error.message); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
module.exports = setupSecurity;
