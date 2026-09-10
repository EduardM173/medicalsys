const { createRepository, decimal } = require('./repository.factory');

module.exports = createRepository(
  ['configuracion_clinica', 'paciente', 'cita', 'servicio_medico', 'factura'],
  undefined,
  () => ({ decimal })
);
