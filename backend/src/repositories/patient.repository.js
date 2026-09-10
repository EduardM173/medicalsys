const { createRepository, isUniqueConstraintError } = require('./repository.factory');

module.exports = createRepository(
  ['paciente'],
  undefined,
  () => ({ isUniqueConstraintError })
);
