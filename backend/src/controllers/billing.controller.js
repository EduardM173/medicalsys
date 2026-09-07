const billingService = require('../services/billing.service');

async function prepareInvoice(request, response, next) {
  try {
    const preview = await billingService.prepareInvoice(request.body);
    response.status(200).json({ preview });
  } catch (error) {
    next(error);
  }
}

async function emitInvoice(request, response, next) {
  try {
    const factura = await billingService.emitirFacturaComputarizada(
      request.params.id,
      request.user.idUsuario
    );
    response.status(200).json({ factura });
  } catch (error) {
    next(error);
  }
}

module.exports = { prepareInvoice, emitInvoice };