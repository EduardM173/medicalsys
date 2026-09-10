const { createRepository, isUniqueConstraintError } = require('./repository.factory');

module.exports = createRepository(
  ['medico', 'usuario'],
  undefined,
  () => ({ isUniqueConstraintError })
);
