const tenantService = require('../services/tenant.service');
let bnbService = null;
try {
  bnbService = require('../services/bnb/bnb.service');
} catch (e) {
  // BNB module is optional / local only
}

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
      const {
        codigo,
        nombre,
        tipo,
        subdominio,
        nit,
        direccion,
        telefono,
        email,
        adminEmail,
        adminPassword,
        adminNombres,
        adminApellidos
      } = req.body;
      const userId = req.user?.idUsuario || req.user?.id_usuario;

      const result = await tenantService.provisionTenant({
        codigo,
        nombre,
        tipo,
        subdominio,
        nit,
        direccion,
        telefono,
        email,
        userId,
        adminEmail,
        adminPassword,
        adminNombres,
        adminApellidos
      });

      res.status(201).json({
        message: `El centro médico "${result.tenant.nombre}" fue aprovisionado exitosamente con esquema de infraestructura aislado.`,
        tenant: result.tenant,
        admin: result.admin
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

  async generateBnbRenewalQr(req, res, next) {
    try {
      if (!bnbService) {
        const error = new Error('Módulo pasarela BNB no disponible.');
        error.statusCode = 501;
        return next(error);
      }
      const tenantCode = req.body.tenantCode || req.tenant?.codigo;
      const meses = req.body.meses || 1;
      const monto = req.body.monto;

      const resultado = await bnbService.generateSubscriptionQr({
        tenantCode,
        meses,
        montoPersonalizado: monto
      });
      res.json(resultado);
    } catch (err) {
      next(err);
    }
  }

  async checkBnbQrStatus(req, res, next) {
    try {
      if (!bnbService) {
        const error = new Error('Módulo pasarela BNB no disponible.');
        error.statusCode = 501;
        return next(error);
      }
      const { qrId } = req.params;
      const resultado = await bnbService.checkQrStatus(qrId);
      res.json(resultado);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new TenantController();
