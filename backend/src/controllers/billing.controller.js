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

async function getSummary(request, response, next) {
  try {
    const result = await billingService.getBillingSummary();
    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function listIssuedInvoices(request, response, next) {
  try {
    const result = await billingService.listIssuedInvoices({
      search: request.query.search,
      patientId: request.query.patientId,
      date: request.query.date
    });
    response.status(200).json(result);
  } catch (error) { next(error); }
}

async function getIssuedInvoice(request, response, next) {
  try {
    const result = await billingService.getIssuedInvoiceById(request.params.id);
    response.status(200).json(result);
  } catch (error) { next(error); }
}

module.exports = { emitInvoice, getIssuedInvoice, getSummary, listIssuedInvoices, prepareInvoice };
