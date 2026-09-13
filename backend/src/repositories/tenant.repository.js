const { createRepository } = require('./repository.factory');
const database = require('../config/prisma');

module.exports = createRepository(
  ['organizacion', 'usuario_organizacion', 'pago_suscripcion_tenant'],
  database,
  (client) => ({
    getTenantClient: (schemaName) => database.getTenantPrisma(schemaName),
    provisionSchema: (codigo, nombre, tipo, subdominio, nit, direccion, telefono, email) => {
      return client.$executeRaw`CALL public.sp_provision_tenant(${codigo}, ${nombre}, ${tipo}, ${subdominio}, ${nit}, ${direccion}, ${telefono}, ${email})`;
    }
  })
);
