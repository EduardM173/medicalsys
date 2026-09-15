const { createEncryptedRepository } = require('./encrypted.repository');

module.exports = createEncryptedRepository([
  'campania',
  'campania_servicio',
  'campania_destinatario',
  'preferencia_marketing',
  'promocion_uso',
  'evento_fidelizacion',
  'paciente',
  'historia_clinica',
  'fidelizacion_paciente',
  'servicio_medico',
  'notificacion'
]);
