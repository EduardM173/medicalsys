require('dotenv').config();
const prisma = require('../src/config/prisma');

const ROLES_CON_ACCESO = ['ADMINISTRADOR', 'RECEPCIONISTA'];
const PERMISO = 'notifications.manage';

// Si un rol nunca fue personalizado desde "Roles y Seguridad", no existe fila
// en security_role_policy y el sistema ya usa los defaults (que incluyen
// notifications.manage). Este script solo actúa sobre roles que SÍ tienen
// una política guardada en la base de datos, para no dejar el nuevo permiso
// fuera de una matriz ya personalizada manualmente.
async function ensureNotificationsPermission() {
  for (const role of ROLES_CON_ACCESO) {
    const rows = await prisma.$queryRaw`SELECT permissions FROM security_role_policy WHERE role_code = ${role}`;
    if (!rows.length) {
      console.log(`${role}: sin política personalizada, usa los valores por defecto (ya incluyen ${PERMISO}).`);
      continue;
    }
    const current = rows[0].permissions;
    if (current.includes(PERMISO)) {
      console.log(`${role}: ya tiene ${PERMISO}.`);
      continue;
    }
    const updated = [...new Set([...current, PERMISO])].sort();
    await prisma.$executeRaw`UPDATE security_role_policy SET permissions = ${JSON.stringify(updated)}::jsonb, updated_at = NOW() WHERE role_code = ${role}`;
    console.log(`${role}: se agregó ${PERMISO} a su política personalizada.`);
  }
}

if (require.main === module) {
  ensureNotificationsPermission()
    .then(() => console.log('Listo.'))
    .catch((error) => { console.error(error.message); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}

module.exports = ensureNotificationsPermission;
