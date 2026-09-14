const database = require('../config/prisma');
const { createRepository, isUniqueConstraintError } = require('./repository.factory');
const { createSecurityRepository } = require('./security.repository');

function createUserRepository(client = database) {
  const decorate = (activeClient) => ({
    isUniqueConstraintError,
    security: createSecurityRepository(activeClient)
  });
  return createRepository(['usuario', 'rol', 'medico', 'paciente'], client, decorate);
}

module.exports = createUserRepository();
