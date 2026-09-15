const repository = require('../repositories/campaign.repository');

class CampaignError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

const VALID_ESTADOS = ['BORRADOR', 'PROGRAMADA', 'ACTIVA', 'FINALIZADA', 'CANCELADA'];

function normalizeDiscount(value) {
  const discount = Number(value || 0);
  if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
    throw new CampaignError(400, 'El descuento debe estar entre 0 y 100%.');
  }
  return discount;
}

function normalizeNonNegativeInteger(value, field) {
  const number = Number(value || 0);
  if (!Number.isInteger(number) || number < 0) {
    throw new CampaignError(400, `${field} debe ser un entero mayor o igual a 0.`);
  }
  return number;
}

function campaignPublicationStatus(campaign, now = new Date()) {
  if (['BORRADOR', 'FINALIZADA', 'CANCELADA'].includes(campaign.estado)) return campaign.estado;
  if (campaign.fecha_fin && campaign.fecha_fin < now) return 'FINALIZADA';
  if (campaign.fecha_inicio && campaign.fecha_inicio > now) return 'PROGRAMADA';
  return 'ACTIVA';
}

async function synchronizePublicationStates(now = new Date()) {
  try {
    await repository.campania.updateMany({
      where: { estado: { in: ['PROGRAMADA', 'ACTIVA'] }, fecha_fin: { lt: now } },
      data: { estado: 'FINALIZADA', fecha_actualizacion: now }
    });
    await repository.campania.updateMany({
      where: { estado: 'PROGRAMADA', fecha_inicio: { lte: now }, OR: [{ fecha_fin: null }, { fecha_fin: { gte: now } }] },
      data: { estado: 'ACTIVA', fecha_actualizacion: now }
    });
  } catch (error) {
    // Compatibilidad con repositorios simulados mínimos usados por pruebas
    // unitarias de HU-27; Prisma siempre ofrece updateMany en ejecución real.
    if (!String(error.message).includes('campania.updateMany no está disponible')) throw error;
  }
}

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
    contenidoPublicable: campaign.contenido_publicable || campaign.descripcion || '',
    imagenUrl: campaign.imagen_url || '',
    segmento: {
      edadMin: campaign.segmento_edad_min,
      edadMax: campaign.segmento_edad_max,
      sexo: campaign.segmento_sexo,
      ubicacion: campaign.segmento_ubicacion,
      condiciones: Array.isArray(campaign.segmento_condiciones) ? campaign.segmento_condiciones : [],
      nivel: campaign.segmento_nivel
    },
    whatsappHabilitado: Boolean(campaign.whatsapp_habilitado),
    puntosConversion: campaign.puntos_conversion || 0,
    servicios: campaign.servicios?.map((item) => ({
      id: Number(item.servicio.id_servicio),
      nombre: item.servicio.nombre,
      precioBase: Number(item.servicio.precio_base)
    })) || [],
    fechaCreacion: campaign.fecha_creacion ? campaign.fecha_creacion.toISOString() : null,
    fechaActualizacion: campaign.fecha_actualizacion ? campaign.fecha_actualizacion.toISOString() : null,
    creadaPor: campaign.usuario ? {
      id: Number(campaign.usuario.id_usuario),
      nombres: campaign.usuario.nombres,
      apellidos: campaign.usuario.apellidos,
      email: campaign.usuario.email
    } : null,
    totalNotificaciones: campaign._count ? campaign._count.notificacion : 0,
    alcance: campaign._count ? campaign._count.destinatarios : 0,
    conversiones: campaign._count ? campaign._count.usos : 0
  };
}

async function listCampaigns({ search = '', estado = '' } = {}) {
  await synchronizePublicationStates();
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
    repository.campania.findMany({
      where,
      orderBy: [{ fecha_creacion: 'desc' }],
      include: {
        usuario: {
          select: { id_usuario: true, nombres: true, apellidos: true, email: true }
        },
        _count: {
          select: { notificacion: true, destinatarios: true, usos: true }
        },
        servicios: { include: { servicio: true } }
      }
    }),
    repository.campania.groupBy({
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
    stats: { ...stats, presupuestoTotal: campaigns.reduce((sum, item) => sum + Number(item.presupuesto || 0), 0) }
  };
}

async function getCampaignById(id) {
  const campaignId = BigInt(id);
  const campaign = await repository.campania.findUnique({
    where: { id_campania: campaignId },
    include: {
      usuario: {
        select: { id_usuario: true, nombres: true, apellidos: true, email: true }
      },
      _count: {
        select: { notificacion: true, destinatarios: true, usos: true }
      },
      servicios: { include: { servicio: true } }
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

  const descuento = normalizeDiscount(data.descuentoPorcentaje);
  const puntos = normalizeNonNegativeInteger(data.puntosConversion, 'Los puntos por conversión');
  const presupuesto = Number(data.presupuesto || 0);
  if (!Number.isFinite(presupuesto) || presupuesto < 0) throw new CampaignError(400, 'El presupuesto no puede ser negativo.');
  const edadMin = data.segmento?.edadMin === '' || data.segmento?.edadMin == null ? null : normalizeNonNegativeInteger(data.segmento.edadMin, 'La edad mínima');
  const edadMax = data.segmento?.edadMax === '' || data.segmento?.edadMax == null ? null : normalizeNonNegativeInteger(data.segmento.edadMax, 'La edad máxima');
  if (edadMin !== null && edadMax !== null && edadMax < edadMin) throw new CampaignError(400, 'La edad máxima no puede ser menor a la mínima.');

  const requestedState = data.estado && VALID_ESTADOS.includes(data.estado.toUpperCase())
    ? data.estado.toUpperCase() : 'BORRADOR';
  const estadoFinal = campaignPublicationStatus({ estado: requestedState, fecha_inicio: fechaInicio, fecha_fin: fechaFin });
  const serviceIds = [...new Set((data.servicioIds || []).map(String).filter((id) => /^\d+$/.test(id)))];

  const campaign = await repository.campania.create({
    data: {
      nombre: data.nombre.trim(),
      descripcion: data.descripcion ? data.descripcion.trim() : null,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      estado: estadoFinal,
      tipo_promocion: data.tipoPromocion || 'GENERAL',
      descuento_porcentaje: descuento,
      publico_objetivo: data.publicoObjetivo ? data.publicoObjetivo.trim() : null,
      presupuesto,
      contenido_publicable: data.contenidoPublicable?.trim() || data.descripcion?.trim() || null,
      imagen_url: data.imagenUrl?.trim() || null,
      segmento_edad_min: edadMin,
      segmento_edad_max: edadMax,
      segmento_sexo: data.segmento?.sexo || null,
      segmento_ubicacion: data.segmento?.ubicacion?.trim() || null,
      segmento_condiciones: Array.isArray(data.segmento?.condiciones) ? data.segmento.condiciones.map(String).filter(Boolean) : [],
      segmento_nivel: data.segmento?.nivel || null,
      whatsapp_habilitado: Boolean(data.whatsappHabilitado),
      puntos_conversion: puntos,
      creada_por: userId ? BigInt(userId) : null,
      servicios: serviceIds.length ? { create: serviceIds.map((id) => ({ id_servicio: BigInt(id) })) } : undefined
    },
    include: {
      usuario: {
        select: { id_usuario: true, nombres: true, apellidos: true, email: true }
      },
      servicios: { include: { servicio: true } }
    }
  });

  return serializeCampaign(campaign);
}

async function updateCampaign(id, data) {
  const campaignId = BigInt(id);
  const existing = await repository.campania.findUnique({
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
    updateData.descuento_porcentaje = normalizeDiscount(data.descuentoPorcentaje);
  }

  if (data.publicoObjetivo !== undefined) {
    updateData.publico_objetivo = data.publicoObjetivo ? data.publicoObjetivo.trim() : null;
  }

  if (data.presupuesto !== undefined) {
    const value = Number(data.presupuesto);
    if (!Number.isFinite(value) || value < 0) throw new CampaignError(400, 'El presupuesto no puede ser negativo.');
    updateData.presupuesto = value;
  }

  if (data.contenidoPublicable !== undefined) updateData.contenido_publicable = data.contenidoPublicable?.trim() || null;
  if (data.imagenUrl !== undefined) updateData.imagen_url = data.imagenUrl?.trim() || null;
  if (data.whatsappHabilitado !== undefined) updateData.whatsapp_habilitado = Boolean(data.whatsappHabilitado);
  if (data.puntosConversion !== undefined) updateData.puntos_conversion = normalizeNonNegativeInteger(data.puntosConversion, 'Los puntos por conversión');
  if (data.segmento !== undefined) {
    const min = data.segmento.edadMin === '' || data.segmento.edadMin == null ? null : normalizeNonNegativeInteger(data.segmento.edadMin, 'La edad mínima');
    const max = data.segmento.edadMax === '' || data.segmento.edadMax == null ? null : normalizeNonNegativeInteger(data.segmento.edadMax, 'La edad máxima');
    if (min !== null && max !== null && max < min) throw new CampaignError(400, 'La edad máxima no puede ser menor a la mínima.');
    Object.assign(updateData, { segmento_edad_min: min, segmento_edad_max: max, segmento_sexo: data.segmento.sexo || null, segmento_ubicacion: data.segmento.ubicacion?.trim() || null, segmento_condiciones: Array.isArray(data.segmento.condiciones) ? data.segmento.condiciones.map(String).filter(Boolean) : [], segmento_nivel: data.segmento.nivel || null });
  }

  if (updateData.estado || (['PROGRAMADA', 'ACTIVA'].includes(existing.estado) && (data.fechaInicio !== undefined || data.fechaFin !== undefined))) {
    updateData.estado = campaignPublicationStatus({ estado: updateData.estado || existing.estado, fecha_inicio: fechaInicio, fecha_fin: fechaFin });
  }

  const serviceIds = data.servicioIds === undefined
    ? null
    : [...new Set((data.servicioIds || []).map(String).filter((value) => /^\d+$/.test(value)))];
  const updateWith = (gateway) => gateway.campania.update({
    where: { id_campania: campaignId }, data: updateData,
    include: {
      usuario: { select: { id_usuario: true, nombres: true, apellidos: true, email: true } },
      _count: { select: { notificacion: true, destinatarios: true, usos: true } },
      servicios: { include: { servicio: true } }
    }
  });
  const updated = serviceIds === null
    ? await updateWith(repository)
    : await repository.transaction(async (tx) => {
      await tx.campania_servicio.deleteMany({ where: { id_campania: campaignId } });
      if (serviceIds.length) await tx.campania_servicio.createMany({ data: serviceIds.map((value) => ({ id_campania: campaignId, id_servicio: BigInt(value) })) });
      return updateWith(tx);
    });

  return serializeCampaign(updated);
}

async function deleteCampaign(id) {
  const campaignId = BigInt(id);
  const existing = await repository.campania.findUnique({
    where: { id_campania: campaignId },
    include: {
      _count: {
        select: { notificacion: true, destinatarios: true, usos: true }
      }
    }
  });

  if (!existing) {
    throw new CampaignError(404, 'La campaña especificada no existe.');
  }

  // Si tiene notificaciones asociadas, realizar baja lógica pasando a CANCELADA
  if (existing._count.notificacion > 0 || existing._count.destinatarios > 0 || existing._count.usos > 0) {
    const updated = await repository.campania.update({
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

  await repository.campania.delete({
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
  synchronizePublicationStates,
  CampaignError,
  campaignPublicationStatus
};
