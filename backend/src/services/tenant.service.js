const tenantRepository = require('../repositories/tenant.repository');
const bcrypt = require('bcryptjs');

class TenantError extends Error {
  constructor(statusCode, message, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = statusCode;
    this.code = code;
  }
}

function normalizeSlug(str) {
  return String(str || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, '-');
}

async function getTenantClinicalConfig(schemaName) {
  try {
    const client = tenantRepository.getTenantClient(schemaName);
    const config = await client.configuracion_clinica.findFirst({
      where: { activa: true },
      orderBy: { id_configuracion: 'asc' }
    });
    return config || null;
  } catch (_e) {
    return null;
  }
}

class TenantService {
  async listOrganizations({ activeOnly = false } = {}) {
    const where = activeOnly ? { estado: 'ACTIVA' } : {};
    const orgs = await tenantRepository.organizacion.findMany({
      where,
      orderBy: { nombre: 'asc' }
    });

    const enriched = await Promise.all(
      orgs.map(async (org) => {
        const config = await getTenantClinicalConfig(org.schema_name);
        return {
          id: Number(org.id_organizacion),
          codigo: org.codigo,
          nombre: org.nombre,
          tipo: org.tipo,
          subdominio: org.subdominio,
          schemaName: org.schema_name,
          estado: org.estado,
          plan: org.plan_suscripcion,
          fechaSuscripcionFin: org.fecha_suscripcion_fin,
          isExpired: org.fecha_suscripcion_fin ? new Date(org.fecha_suscripcion_fin) < new Date() : false,
          nit: config?.nit || null,
          razonSocial: config?.razon_social || `${org.nombre} S.R.L.`,
          direccion: config?.direccion || null,
          telefono: config?.telefono || null,
          email: config?.email || null,
          ciudad: config?.ciudad || null,
          pais: config?.pais || 'Bolivia'
        };
      })
    );

    return enriched;
  }

  async getOrganizationByCode(code) {
    if (!code) return null;
    const clean = normalizeSlug(code);
    let org = await tenantRepository.organizacion.findUnique({
      where: { codigo: clean }
    });
    if (!org) {
      org = await tenantRepository.organizacion.findFirst({
        where: {
          OR: [
            { codigo: clean.replace(/-/g, '') },
            { subdominio: clean.replace(/-/g, '') }
          ]
        }
      });
    }
    if (!org) return null;

    const config = await getTenantClinicalConfig(org.schema_name);

    return {
      id: Number(org.id_organizacion),
      codigo: org.codigo,
      nombre: org.nombre,
      tipo: org.tipo,
      subdominio: org.subdominio,
      schemaName: org.schema_name,
      estado: org.estado,
      plan: org.plan_suscripcion,
      fechaSuscripcionFin: org.fecha_suscripcion_fin,
      isExpired: org.fecha_suscripcion_fin ? new Date(org.fecha_suscripcion_fin) < new Date() : false,
      nit: config?.nit || null,
      razonSocial: config?.razon_social || `${org.nombre} S.R.L.`,
      direccion: config?.direccion || null,
      telefono: config?.telefono || null,
      email: config?.email || null,
      ciudad: config?.ciudad || null,
      pais: config?.pais || 'Bolivia'
    };
  }

  async getOrganizationBySubdomain(subdomain) {
    if (!subdomain) return null;
    const clean = normalizeSlug(subdomain);
    const org = await tenantRepository.organizacion.findFirst({
      where: {
        OR: [
          { subdominio: clean },
          { subdominio: clean.replace(/-/g, '') },
          { codigo: clean },
          { codigo: clean.replace(/-/g, '') }
        ]
      }
    });
    if (!org) return null;

    const config = await getTenantClinicalConfig(org.schema_name);

    return {
      id: Number(org.id_organizacion),
      codigo: org.codigo,
      nombre: org.nombre,
      tipo: org.tipo,
      subdominio: org.subdominio,
      schemaName: org.schema_name,
      estado: org.estado,
      plan: org.plan_suscripcion,
      fechaSuscripcionFin: org.fecha_suscripcion_fin,
      isExpired: org.fecha_suscripcion_fin ? new Date(org.fecha_suscripcion_fin) < new Date() : false,
      nit: config?.nit || null,
      razonSocial: config?.razon_social || `${org.nombre} S.R.L.`,
      direccion: config?.direccion || null,
      telefono: config?.telefono || null,
      email: config?.email || null,
      ciudad: config?.ciudad || null,
      pais: config?.pais || 'Bolivia'
    };
  }

  async getUserOrganizations(userId) {
    if (!userId) return [];
    const relations = await tenantRepository.usuario_organizacion.findMany({
      where: {
        id_usuario: BigInt(userId),
        activo: true
      },
      include: {
        organizacion: true
      }
    });

    const enriched = await Promise.all(
      relations.map(async (rel) => {
        const config = await getTenantClinicalConfig(rel.organizacion.schema_name);
        return {
          id: Number(rel.organizacion.id_organizacion),
          codigo: rel.organizacion.codigo,
          nombre: rel.organizacion.nombre,
          tipo: rel.organizacion.tipo,
          subdominio: rel.organizacion.subdominio,
          rol: rel.rol_en_organizacion,
          estado: rel.organizacion.estado,
          plan: rel.organizacion.plan_suscripcion,
          fechaSuscripcionFin: rel.organizacion.fecha_suscripcion_fin,
          isExpired: rel.organizacion.fecha_suscripcion_fin ? new Date(rel.organizacion.fecha_suscripcion_fin) < new Date() : false,
          nit: config?.nit || null,
          razonSocial: config?.razon_social || `${rel.organizacion.nombre} S.R.L.`,
          direccion: config?.direccion || null,
          telefono: config?.telefono || null,
          email: config?.email || null,
          ciudad: config?.ciudad || null,
          pais: config?.pais || 'Bolivia'
        };
      })
    );

    return enriched;
  }

  async provisionTenant({
    codigo,
    nombre,
    tipo = 'CLINICA',
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
  }) {
    if (!codigo || !nombre || !nit) {
      throw new TenantError(400, 'Código, nombre y NIT son campos obligatorios para dar de alta un centro médico.');
    }

    const cleanCodigo = normalizeSlug(codigo);
    const cleanSubdominio = normalizeSlug(subdominio || codigo);

    const existing = await tenantRepository.organizacion.findFirst({
      where: {
        OR: [
          { codigo: cleanCodigo },
          { subdominio: cleanSubdominio }
        ]
      }
    });

    if (existing) {
      throw new TenantError(409, `Ya existe una organización con el código "${cleanCodigo}" o subdominio "${cleanSubdominio}".`);
    }

    await tenantRepository.provisionSchema(
      cleanCodigo,
      nombre,
      tipo,
      cleanSubdominio,
      String(nit),
      direccion || 'Sin dirección registrada',
      telefono || '',
      email || ''
    );

    const created = await this.getOrganizationByCode(cleanCodigo);

    let adminAccount = null;
    let targetUserId = userId;

    if (adminEmail && typeof adminEmail === 'string' && adminEmail.trim()) {
      const cleanEmail = adminEmail.trim().toLowerCase();
      let user = await tenantRepository.usuario.findUnique({
        where: { email: cleanEmail }
      });

      if (!user) {
        const adminRole = await tenantRepository.rol.findFirst({
          where: { codigo: 'ADMINISTRADOR' }
        });
        const hashedPassword = await bcrypt.hash(adminPassword || 'MedicalSys2026!', 10);
        user = await tenantRepository.usuario.create({
          data: {
            email: cleanEmail,
            password_hash: hashedPassword,
            nombres: adminNombres || `Admin ${nombre}`,
            apellidos: adminApellidos || 'Clínica',
            id_rol: adminRole ? adminRole.id_rol : 1n,
            estado: 'ACTIVO'
          }
        });
      }
      targetUserId = Number(user.id_usuario);
      adminAccount = {
        email: cleanEmail,
        nombres: user.nombres,
        apellidos: user.apellidos,
        rol: 'ADMINISTRADOR'
      };
    }

    if (targetUserId && created) {
      await tenantRepository.usuario_organizacion.upsert({
        where: {
          id_usuario_id_organizacion: {
            id_usuario: BigInt(targetUserId),
            id_organizacion: BigInt(created.id)
          }
        },
        create: {
          id_usuario: BigInt(targetUserId),
          id_organizacion: BigInt(created.id),
          rol_en_organizacion: 'ADMINISTRADOR',
          activo: true
        },
        update: {
          activo: true
        }
      });
    }

    return {
      ...created,
      tenant: created,
      admin: adminAccount
    };
  }

  async generateRenewalQr({ tenantCode, meses = 1, montoPersonalizado }) {
    const org = await this.getOrganizationByCode(tenantCode);
    if (!org) {
      throw new TenantError(404, `Centro médico "${tenantCode}" no encontrado.`);
    }

    const mesesNum = Math.max(1, parseInt(meses, 10) || 1);
    const tarifaMensual = 350.00;
    const totalMonto = montoPersonalizado ? Number(montoPersonalizado) : (tarifaMensual * mesesNum);

    const referencia = `REN-${org.codigo.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    const qrPayload = [
      '000201',
      '010212',
      '5303068',
      `540${totalMonto.toFixed(2).length}${totalMonto.toFixed(2)}`,
      '5802BO',
      '5910MEDICALSYS',
      '6006LA PAZ',
      `62${String(referencia.length + 4).padStart(2, '0')}01${String(referencia.length).padStart(2, '0')}${referencia}`,
      '6304'
    ].join('');

    const pago = await tenantRepository.pago_suscripcion_tenant.create({
      data: {
        id_organizacion: BigInt(org.id),
        monto: totalMonto,
        moneda: 'BOB',
        codigo_qr: qrPayload,
        referencia_pago: referencia,
        estado: 'PENDIENTE',
        meses_renovacion: mesesNum
      }
    });

    return {
      pagoId: Number(pago.id_pago),
      organizacion: org.nombre,
      referenciaPago: referencia,
      monto: totalMonto,
      moneda: 'BOB',
      meses: mesesNum,
      codigoQr: qrPayload,
      fechaEmision: pago.fecha_creacion
    };
  }

  async confirmPayment({ referenciaPago }) {
    if (!referenciaPago) {
      throw new TenantError(400, 'La referencia de pago es obligatoria.');
    }

    const pago = await tenantRepository.pago_suscripcion_tenant.findUnique({
      where: { referencia_pago: referenciaPago },
      include: { organizacion: true }
    });

    if (!pago) {
      throw new TenantError(404, `No se encontró el pago con referencia "${referenciaPago}".`);
    }

    if (pago.estado === 'CONFIRMADO') {
      return {
        alreadyConfirmed: true,
        message: 'Este pago ya fue procesado previamente.',
        nuevaFechaFin: pago.organizacion.fecha_suscripcion_fin
      };
    }

    const baseDate = (pago.organizacion.fecha_suscripcion_fin && new Date(pago.organizacion.fecha_suscripcion_fin) > new Date())
      ? new Date(pago.organizacion.fecha_suscripcion_fin)
      : new Date();

    const diasExtension = pago.meses_renovacion * 30;
    const nuevaFechaFin = new Date(baseDate.getTime() + (diasExtension * 24 * 60 * 60 * 1000));

    let updatedOrg = null;
    await tenantRepository.transaction(async (tx) => {
      await tx.pago_suscripcion_tenant.update({
        where: { id_pago: pago.id_pago },
        data: {
          estado: 'CONFIRMADO',
          fecha_pago: new Date()
        }
      });
      updatedOrg = await tx.organizacion.update({
        where: { id_organizacion: pago.id_organizacion },
        data: {
          estado: 'ACTIVA',
          fecha_suscripcion_fin: nuevaFechaFin,
          fecha_actualizacion: new Date()
        }
      });
    });

    return {
      success: true,
      organizacion: updatedOrg.nombre,
      estado: updatedOrg.estado,
      nuevaFechaFin: updatedOrg.fecha_suscripcion_fin,
      mesesRenovados: pago.meses_renovacion
    };
  }
}

module.exports = new TenantService();
module.exports.TenantError = TenantError;
