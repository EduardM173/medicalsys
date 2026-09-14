const consentService = require('../services/consent.service');

async function getConsents(request, response, next) {
  try {
    const result = await consentService.getConsentHistory(request.user.id, request.query);
    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

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
      request.body
    );
    response.status(200).json({ consent });
  } catch (error) {
    next(error);
  }
}

// HU-33: vista previa (PA-03) y descarga (PA-09) del PDF.
function sendPdfStream(response, pdf, disposition) {
  response.setHeader('Content-Type', pdf.mimeType || 'application/pdf');
  response.setHeader('Content-Length', String(pdf.buffer.length));
  response.setHeader(
    'Content-Disposition',
    `${disposition}; filename*=UTF-8''${encodeURIComponent(pdf.fileName)}`
  );
  response.end(pdf.buffer);
}

async function previewConsent(request, response, next) {
  try {
    const pdf = await consentService.getConsentPdf(request.user.id, request.params.consentId);
    sendPdfStream(response, pdf, 'inline');
  } catch (error) {
    next(error);
  }
}

async function downloadConsent(request, response, next) {
  try {
    const pdf = await consentService.getConsentPdf(request.user.id, request.params.consentId);
    sendPdfStream(response, pdf, 'attachment');
  } catch (error) {
    next(error);
  }
}

async function verifyConsent(request, response, next) {
  try {
    const result = await consentService.verifyConsent(request.user.id, request.params.consentId);
    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function annulConsent(request, response, next) {
  try {
    const consent = await consentService.annulConsent(
      request.user.id,
      request.params.consentId,
      request.body
    );
    response.status(200).json({ consent });
  } catch (error) {
    next(error);
  }
}

async function updateConsent(request, response, next) {
  try {
    const consent = await consentService.updateConsent(
      request.user.id,
      request.params.consentId,
      request.body
    );
    response.status(200).json({ consent });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  annulConsent,
  createConsent,
  downloadConsent,
  getConsent,
  getConsentOptions,
  getConsents,
  previewConsent,
  signConsent,
  updateConsent,
  verifyConsent
};