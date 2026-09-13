const tenantService = require('../services/tenant.service');
const tenantRepository = require('../repositories/tenant.repository');

function extractTenantIdentifier(req) {
  const headerCode = req.headers['x-tenant-code'] || req.headers['x-tenant-id'];
  if (headerCode && typeof headerCode === 'string') {
    return { type: 'code', value: headerCode.trim().toLowerCase() };
  }

  if (req.query && req.query.tenant && typeof req.query.tenant === 'string') {
    return { type: 'code', value: req.query.tenant.trim().toLowerCase() };
  }

  const host = req.headers.host || '';
  const cleanHost = host.split(':')[0].toLowerCase();
  
  if (cleanHost.endsWith('.localhost')) {
    const sub = cleanHost.replace('.localhost', '');
    if (sub && sub !== 'www') {
      return { type: 'subdomain', value: sub };
    }
  }

  const parts = cleanHost.split('.');
  if (parts.length > 2 && !['www', 'localhost', '127', 'api'].includes(parts[0])) {
    return { type: 'subdomain', value: parts[0] };
  }

  return { type: 'code', value: 'cumed' };
}

async function tenantMiddleware(req, res, next) {
  try {
    const ident = extractTenantIdentifier(req);
    let org = null;

    if (ident.type === 'subdomain') {
      org = await tenantService.getOrganizationBySubdomain(ident.value);
    }
    
    if (!org && ident.value) {
      org = await tenantService.getOrganizationByCode(ident.value);
    }

    if (!org) {
      const err = new Error(`El centro médico o tenant "${ident.value}" no fue encontrado en MedicalSys SaaS.`);
      err.statusCode = 404;
      err.code = 'TENANT_NOT_FOUND';
      return next(err);
    }

    if (org.estado === 'INACTIVA') {
      const err = new Error(`El centro médico "${org.nombre}" se encuentra inactivo. Contacte a soporte de la plataforma.`);
      err.statusCode = 403;
      err.code = 'TENANT_INACTIVE';
      return next(err);
    }

    req.tenant = org;
    req.prisma = tenantRepository.getTenantClient(org.schemaName);

    const isExemptPath = req.path.startsWith('/api/tenants')
      || req.path.startsWith('/api/auth')
      || req.path.startsWith('/api/health')
      || req.path === '/health';

    if (org.isExpired && !isExemptPath) {
      const err = new Error(`La suscripción del centro médico "${org.nombre}" ha expirado. Renueve su plan para habilitar la atención clínica.`);
      err.statusCode = 402;
      err.code = 'SUBSCRIPTION_EXPIRED';
      err.tenant = org.codigo;
      err.fechaVencimiento = org.fechaSuscripcionFin;
      return next(err);
    }

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = tenantMiddleware;
module.exports.extractTenantIdentifier = extractTenantIdentifier;
