const consentService = require('../services/consent.service');

async function getConsentOptions(request, response, next) {
  try {
    const options = await consentService.getConsentOptions(request.user.id);
    response.status(200).json(options);
  } catch (error) {
    next(error);
  }
}

async function createConsent(request, response, next) {
  try {
    const consent = await consentService.createConsent(request.user.id, request.body);
    response.status(201).json({ consent });
  } catch (error) {
    next(error);
  }
}

async function getConsent(request, response, next) {
  try {
    const consent = await consentService.getConsentById(
      request.user.id,
      request.params.consentId
    );
    response.status(200).json({ consent });
  } catch (error) {
    next(error);
  }
}

async function signConsent(request, response, next) {
  try {
    const consent = await consentService.signConsent(
      request.user.id,
      request.params.consentId,
      request.body.signatureData
    );
    response.status(200).json({ consent });
  } catch (error) {
    next(error);
  }
}

module.exports = { createConsent, getConsent, getConsentOptions, signConsent };

