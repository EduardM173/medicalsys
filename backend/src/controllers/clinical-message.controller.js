const clinicalMessageService = require('../services/clinical-message.service');

async function sendClinicalMessage(request, response, next) {
  try {
    const message = await clinicalMessageService.sendMessage({
      userId: request.user.id,
      historyId: request.params.historyId,
      contenido: request.body.contenido,
      destinatarioRole: request.body.destinatarioRole
    });
    response.status(201).json({ message });
  } catch (error) {
    next(error);
  }
}

async function getClinicalMessages(request, response, next) {
  try {
    const messages = await clinicalMessageService.listMessages(request.params.historyId);
    response.status(200).json({ messages });
  } catch (error) {
    next(error);
  }
}

module.exports = { getClinicalMessages, sendClinicalMessage };