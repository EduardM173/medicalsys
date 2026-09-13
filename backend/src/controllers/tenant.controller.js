const tenantService = require('../services/tenant.service');

class TenantController {
  async getCurrentTenant(req, res, next) {
    try {
      if (!req.tenant) {
        const error = new Error('No hay centro médico activo en el contexto.');
        error.statusCode = 404;
        return next(error);
      }
      res.json({ tenant: req.tenant });
    } catch (err) {
      next(err);
    }
  }

  async listOrganizations(req, res, next) {
    try {
      const orgs = await tenantService.listOrganizations({ activeOnly: true });
      res.json({ organizations: orgs });
    } catch (err) {
      next(err);
    }
  }

  async getUserOrganizations(req, res, next) {
    try {
      const userId = req.user?.idUsuario || req.user?.id_usuario;
      if (!userId) {
        const error = new Error('Autenticación requerida.');
        error.statusCode = 401;
        return next(error);
      }
      const orgs = await tenantService.getUserOrganizations(userId);
      res.json({ organizations: orgs });
    } catch (err) {
      next(err);
    }
  }

  async provisionTenant(req, res, next) {
    try {
      const { codigo, nombre, tipo, subdominio, nit, direccion, telefono, email } = req.body;
      const userId = req.user?.idUsuario || req.user?.id_usuario;

      const created = await tenantService.provisionTenant({
        codigo,
        nombre,
        tipo,
        subdominio,
        nit,
        direccion,
        telefono,
        email,
        userId
      });

      res.status(201).json({
        message: `El centro médico "${created.nombre}" fue aprovisionado exitosamente con esquema de infraestructura aislado.`,
        tenant: created
      });
    } catch (err) {
      next(err);
    }
  }

  async generateRenewalQr(req, res, next) {
    try {
      const tenantCode = req.body.tenantCode || req.tenant?.codigo;
      const meses = req.body.meses || 1;
      const montoPersonalizado = req.body.monto;

      const resultado = await tenantService.generateRenewalQr({
        tenantCode,
        meses,
        montoPersonalizado
      });

      res.json(resultado);
    } catch (err) {
      next(err);
    }
  }

  async confirmPayment(req, res, next) {
    try {
      const { referenciaPago } = req.body;
      const resultado = await tenantService.confirmPayment({ referenciaPago });
      res.json(resultado);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new TenantController();
