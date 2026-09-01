const agendaService = require('../services/agenda.service');

async function getMyAgenda(request, response, next) {
  try {
    const agenda = await agendaService.getAgendaForAuthenticatedDoctor(
      request.user.id,
      request.query.date
    );
    response.status(200).json(agenda);
  } catch (error) {
    next(error);
  }
}

module.exports = { getMyAgenda };
