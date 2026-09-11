const { createEncryptedRepository } = require('./encrypted.repository');
const { isUniqueConstraintError } = require('./repository.factory');

module.exports = createEncryptedRepository(
  ['medico', 'paciente', 'cita', 'consentimiento_informado'],
  undefined,
  () => ({ isUniqueConstraintError })
);