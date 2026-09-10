const { createRepository } = require('./repository.factory');

module.exports = createRepository(['paciente', 'historia_clinica', 'atencion_medica', 'cita', 'medico', 'receta']);
