const { createRepository } = require('./repository.factory');

module.exports = createRepository(['paciente', 'cita', 'notificacion']);
