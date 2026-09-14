const { createEncryptedRepository } = require('./encrypted.repository');

module.exports = createEncryptedRepository(['historia_clinica', 'medico', 'mensaje_clinico']);