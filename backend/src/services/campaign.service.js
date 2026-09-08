const prisma = require('../config/prisma');

class CampaignError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

const VALID_ESTADOS = ['BORRADOR', 'PROGRAMADA', 'ACTIVA', 'FINALIZADA', 'CANCELADA'];

function serializeCampaign(campaign) {
  if (!campaign) return null;
  return {
    id: Number(campaign.id_campania),
    nombre: campaign.nombre,
    descripcion: campaign.descripcion,
    fechaInicio: campaign.fecha_inicio ? campaign.fecha_inicio.toISOString() : null,
    fechaFin: campaign.fecha_fin ? campaign.fecha_fin.toISOString() : null,
    estado: campaign.estado,
    tipoPromocion: campaign.tipo_promocion || 'GENERAL',
    descuentoPorcentaje: campaign.descuento_porcentaje ? Number(campaign.descuento_porcentaje) : 0,
    publicoObjetivo: campaign.publico_objetivo,
    presupuesto: campaign.presupuesto ? Number(campaign.presupuesto) : 0,
    fechaCreacion: campaign.fecha_creacion ? campaign.fecha_creacion.toISOString() : null,
    fechaActualizacion: campaign.fecha_actualizacion ? campaign.fecha_actualizacion.toISOString() : null,
    creadaPor: campaign.usuario ? {
      id: Number(campaign.usuario.id_usuario),
      nombres: campaign.usuario.nombres,
      apellidos: campaign.usuario.apellidos,
      email: campaign.usuario.email
    } : null,
    totalNotificaciones: campaign._count ? campaign._count.notificacion : 0
  };
}

async function listCampaigns({ search = '', estado = '' } = {}) {
  const where = {};

  if (estado && VALID_ESTADOS.includes(estado.toUpperCase())) {
    where.estado = estado.toUpperCase();
  }

  if (search && search.trim()) {
    const term = search.trim();
    where.OR = [
      { nombre: { contains: term, mode: 'insensitive' } },
      { descripcion: { contains: term, mode: 'insensitive' } },
      { publico_objetivo: { contains: term, mode: 'insensitive' } }
    ];
  }

  const [campaigns, counts] = await Promise.all([
    prisma.campania.findMany({
      where,
      orderBy: [{ fecha_creacion: 'desc' }],
      include: {
        usuario: {
          select: { id_usuario: true, nombres: true, apellidos: true, email: true }
        },
        _count: {
          select: { notificacion: true }
        }
      }
    }),
    prisma.campania.groupBy({
      by: ['estado'],
      _count: { id_campania: true }
    })
  ]);

  const stats = {
    total: 0,
    activas: 0,
    programadas: 0,
    borrador: 0,
    finalizadas: 0,
    canceladas: 0
  };

  for (const c of counts) {
    const count = Number(c._count.id_campania);
    stats.total += count;
    if (c.estado === 'ACTIVA') stats.activas = count;
    if (c.estado === 'PROGRAMADA') stats.programadas = count;
    if (c.estado === 'BORRADOR') stats.borrador = count;
    if (c.estado === 'FINALIZADA') stats.finalizadas = count;
    if (c.estado === 'CANCELADA') stats.canceladas = count;
  }

  return {
    campaigns: campaigns.map(serializeCampaign),
    stats
  };
}

async function getCampaignById(id) {
  const campaignId = BigInt(id);
  const campaign = await prisma.campania.findUnique({
    where: { id_campania: campaignId },
    include: {
      usuario: {
        select: { id_usuario: true, nombres: true, apellidos: true, email: true }
      },
      _count: {
        select: { notificacion: true }
      }
    }
  });

  if (!campaign) {
    throw new CampaignError(404, 'La campaña especificada no existe.');
  }

  return serializeCampaign(campaign);
}

async function createCampaign(data, userId) {
  if (!data.nombre || !data.nombre.trim()) {
    throw new CampaignError(400, 'El nombre de la campaña es obligatorio.');
  }

  let fechaInicio = null;
  let fechaFin = null;

  if (data.fechaInicio) {
    fechaInicio = new Date(data.fechaInicio);
    if (isNaN(fechaInicio.getTime())) {
      throw new CampaignError(400, 'La fecha de inicio es inválida.');
    }
  }

  if (data.fechaFin) {
    fechaFin = new Date(data.fechaFin);
    if (isNaN(fechaFin.getTime())) {
      throw new CampaignError(400, 'La fecha de fin es inválida.');
    }
  }

  if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
    throw new CampaignError(400, 'La fecha de fin no puede ser anterior a la fecha de inicio.');
  }

  const estado = data.estado && VALID_ESTADOS.includes(data.estado.toUpperCase())
    ? data.estado.toUpperCase()
    : 'BORRADOR';

  const campaign = await prisma.campania.create({
    data: {
      nombre: data.nombre.trim(),
      descripcion: data.descripcion ? data.descripcion.trim() : null,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      estado,
      tipo_promocion: data.tipoPromocion || 'GENERAL',
      descuento_porcentaje: data.descuentoPorcentaje !== undefined ? data.descuentoPorcentaje : 0,
      publico_objetivo: data.publicoObjetivo ? data.publicoObjetivo.trim() : null,
      presupuesto: data.presupuesto !== undefined ? data.presupuesto : 0,
      creada_por: userId ? BigInt(userId) : null
    },
    include: {
      usuario: {
        select: { id_usuario: true, nombres: true, apellidos: true, email: true }
      }
    }
  });

  return serializeCampaign(campaign);
}

async function updateCampaign(id, data) {
  const campaignId = BigInt(id);
  const existing = await prisma.campania.findUnique({
    where: { id_campania: campaignId }
  });

  if (!existing) {
    throw new CampaignError(404, 'La campaña especificada no existe.');
  }

  const updateData = {
    fecha_actualizacion: new Date()
  };

  if (data.nombre !== undefined) {
    if (!data.nombre || !data.nombre.trim()) {
      throw new CampaignError(400, 'El nombre de la campaña no puede estar vacío.');
    }
    updateData.nombre = data.nombre.trim();
  }

  if (data.descripcion !== undefined) {
    updateData.descripcion = data.descripcion ? data.descripcion.trim() : null;
  }

  let fechaInicio = existing.fecha_inicio;
  let fechaFin = existing.fecha_fin;

  if (data.fechaInicio !== undefined) {
    if (data.fechaInicio === null || data.fechaInicio === '') {
      fechaInicio = null;
    } else {
      fechaInicio = new Date(data.fechaInicio);
      if (isNaN(fechaInicio.getTime())) {
        throw new CampaignError(400, 'La fecha de inicio es inválida.');
      }
    }
    updateData.fecha_inicio = fechaInicio;
  }

  if (data.fechaFin !== undefined) {
    if (data.fechaFin === null || data.fechaFin === '') {
      fechaFin = null;
    } else {
      fechaFin = new Date(data.fechaFin);
      if (isNaN(fechaFin.getTime())) {
        throw new CampaignError(400, 'La fecha de fin es inválida.');
      }
    }
    updateData.fecha_fin = fechaFin;
  }

  if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
    throw new CampaignError(400, 'La fecha de fin no puede ser anterior a la fecha de inicio.');
  }

  if (data.estado !== undefined) {
    const estadoUpper = data.estado.toUpperCase();
    if (!VALID_ESTADOS.includes(estadoUpper)) {
      throw new CampaignError(400, `Estado inválido. Valores permitidos: ${VALID_ESTADOS.join(', ')}.`);
    }
    updateData.estado = estadoUpper;
  }

  if (data.tipoPromocion !== undefined) {
    updateData.tipo_promocion = data.tipoPromocion;
  }

  if (data.descuentoPorcentaje !== undefined) {
    updateData.descuento_porcentaje = data.descuentoPorcentaje;
  }

  if (data.publicoObjetivo !== undefined) {
    updateData.publico_objetivo = data.publicoObjetivo ? data.publicoObjetivo.trim() : null;
  }

  if (data.presupuesto !== undefined) {
    updateData.presupuesto = data.presupuesto;
  }

  const updated = await prisma.campania.update({
    where: { id_campania: campaignId },
    data: updateData,
    include: {
      usuario: {
        select: { id_usuario: true, nombres: true, apellidos: true, email: true }
      },
      _count: {
        select: { notificacion: true }
      }
    }
  });

  return serializeCampaign(updated);
}

async function deleteCampaign(id) {
  const campaignId = BigInt(id);
  const existing = await prisma.campania.findUnique({
    where: { id_campania: campaignId },
    include: {
      _count: {
        select: { notificacion: true }
      }
    }
  });

  if (!existing) {
    throw new CampaignError(404, 'La campaña especificada no existe.');
  }

  // Si tiene notificaciones asociadas, realizar baja lógica pasando a CANCELADA
  if (existing._count.notificacion > 0) {
    const updated = await prisma.campania.update({
      where: { id_campania: campaignId },
      data: {
        estado: 'CANCELADA',
        fecha_actualizacion: new Date()
      }
    });
    return {
      success: true,
      message: 'La campaña tiene registros asociados y fue marcada como CANCELADA.',
      campaign: serializeCampaign(updated)
    };
  }

  await prisma.campania.delete({
    where: { id_campania: campaignId }
  });

  return {
    success: true,
    message: 'Campaña eliminada correctamente.'
  };
}

module.exports = {
  listCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  CampaignError
};
