const consentTemplateService = require('../services/consent-template.service');

async function listTemplates(request, response, next) {
  try {
    const activeOnly = request.query.active === 'true';
    const result = await consentTemplateService.listTemplates({ activeOnly });
    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function getTemplate(request, response, next) {
  try {
    const result = await consentTemplateService.getTemplate(request.params.templateId);
    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function createTemplate(request, response, next) {
  try {
    const template = await consentTemplateService.createTemplate(request.body);
    response.status(201).json({ template });
  } catch (error) {
    next(error);
  }
}

async function updateTemplate(request, response, next) {
  try {
    const template = await consentTemplateService.updateTemplate(
      request.params.templateId,
      request.body
    );
    response.status(200).json({ template });
  } catch (error) {
    next(error);
  }
}

async function generateConsent(request, response, next) {
  try {
    const input = {
      ...request.body,
      ...(request.params.templateId ? { templateId: request.params.templateId } : {})
    };
    const consent = await consentTemplateService.generateConsent(request.user.id, input);
    response.status(201).json({ consent });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createTemplate,
  generateConsent,
  getTemplate,
  listTemplates,
  updateTemplate
};