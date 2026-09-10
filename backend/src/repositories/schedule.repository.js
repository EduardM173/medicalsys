const { createRepository, isUniqueConstraintError } = require('./repository.factory');

module.exports = createRepository(
  ['medico', 'horario_medico'],
  undefined,
  () => ({ isUniqueConstraintError })
);
