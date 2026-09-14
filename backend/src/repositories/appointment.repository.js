const { createRepository } = require('./repository.factory');

module.exports = createRepository(['paciente', 'medico', 'servicio_medico', 'horario_medico', 'cita']);
