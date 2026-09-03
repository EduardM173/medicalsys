const billingService = require('../services/billing.service');

async function prepareInvoice(request, response, next) {
  try {
    const preview = await billingService.prepareInvoice(request.body);
    response.status(200).json({ preview });
  } catch (error) {
    next(error);
  }
}

module.exports = { prepareInvoice };
