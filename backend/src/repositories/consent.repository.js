const { createEncryptedRepository } = require('./encrypted.repository');
const { isUniqueConstraintError } = require('./repository.factory');

module.exports = createEncryptedRepository(
  [
    'medico',
    'paciente',
    'cita',
    'consentimiento_informado',
    'plantilla_consentimiento',
    'firma_digital_consentimiento',
    'anulacion_consentimiento'
  ],
  undefined,
  () => ({ isUniqueConstraintError })
);