require('dotenv').config();
const prisma = require('../src/config/prisma');
const bcrypt = require('bcryptjs');
async function seedSecurity() {
  if (process.env.NODE_ENV === 'production') throw new Error('La cuenta OSI de prueba es solo para desarrollo.');
  await require('./setup-security')();
  const role = await prisma.rol.findUnique({ where: { codigo: 'OSI' } });
  await prisma.usuario.upsert({
    where: { email: 'osi@medicalsys.test' }, update: {},
    create: { nombres: 'Seguridad', apellidos: 'MedicalSys', email: 'osi@medicalsys.test',
      password_hash: await bcrypt.hash('MedicalSys2026!', 12), id_rol: role.id_rol, estado: 'ACTIVO' }
  });
}
if (require.main === module) {
  seedSecurity().then(() => console.log('Cuenta de prueba OSI lista; cuentas existentes conservadas.'))
    .catch((error) => { console.error(error.message); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
module.exports = seedSecurity;
