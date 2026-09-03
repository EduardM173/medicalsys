const attentionService = require('../services/attention.service');

async function createAttention(request, response, next) {
  try {
    const attention = await attentionService.createAttention(
      request.user.id,
      request.body
    );
    response.status(201).json({ attention });
  } catch (error) {
    next(error);
  }
}

async function getAttentionsByHistoryId(request, response, next) {
  try {
    const historyId = request.params.historyId || request.params.id_historia;
    const attentions = await attentionService.getAttentionsByHistoryId(historyId);
    response.status(200).json({ attentions });
  } catch (error) {
    next(error);
  }
}

async function getAttentionOptions(request, response, next) {
  try {
    const options = await attentionService.getAttentionOptions(request.user.id);
    response.status(200).json(options);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createAttention,
  getAttentionsByHistoryId,
  getAttentionOptions
};
