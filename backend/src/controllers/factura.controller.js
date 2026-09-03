const facturacionService = require('../services/facturacion.service');
const { FacturacionError } = require('../services/facturacion.service');

class FacturaController {
  async crearFactura(req, res, next) {
    try {
      const factura = await facturacionService.crearFactura(req.body, req.user?.idUsuario || req.user?.id);
      return res.status(201).json(factura);
    } catch (error) {
      if (error instanceof FacturacionError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      return next(error);
    }
  }

  async emitirFactura(req, res, next) {
    try {
      const { id } = req.params;
      const facturaEmitida = await facturacionService.emitirFactura(id, req.user?.idUsuario || req.user?.id);
      return res.status(200).json(facturaEmitida);
    } catch (error) {
      if (error instanceof FacturacionError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      return next(error);
    }
  }

  async obtenerFactura(req, res, next) {
    try {
      const { id } = req.params;
      const factura = await facturacionService.obtenerFactura(id);
      return res.status(200).json(factura);
    } catch (error) {
      if (error instanceof FacturacionError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      return next(error);
    }
  }

  async listarFacturas(req, res, next) {
    try {
      const facturas = await facturacionService.listarFacturas(req.query);
      return res.status(200).json(facturas);
    } catch (error) {
      if (error instanceof FacturacionError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      return next(error);
    }
  }

  async obtenerConfiguracionClinica(req, res, next) {
    try {
      const config = await facturacionService.obtenerConfiguracionClinica();
      return res.status(200).json(config);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new FacturaController();
