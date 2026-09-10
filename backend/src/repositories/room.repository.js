const { createRepository } = require('./repository.factory');

module.exports = createRepository(['sala', 'reserva_sala', 'cita']);
