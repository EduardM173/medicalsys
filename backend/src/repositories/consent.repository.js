const { createRepository, isUniqueConstraintError } = require('./repository.factory');

module.exports = createRepository(
  ['medico', 'paciente', 'cita', 'consentimiento_informado'],
  undefined,
  () => ({ isUniqueConstraintError })
);
