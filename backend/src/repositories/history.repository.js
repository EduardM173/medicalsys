const { createEncryptedRepository } = require('./encrypted.repository');

module.exports = createEncryptedRepository(['paciente', 'historia_clinica', 'atencion_medica', 'cita', 'medico', 'receta']);