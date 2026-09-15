const repository = require('../repositories/campaign.repository');
const whatsapp = require('./whatsapp/whatsapp.service');
const campaignService = require('./campaign.service');

class AnnouncementError extends Error {
  constructor(statusCode, message) { super(message); this.statusCode = statusCode; }
}

const LEVEL_LABEL = { ESTANDAR: 'BRONCE', FRECUENTE: 'PLATA', PREMIUM: 'ORO' };

function id(value, entity) {
  if (!/^\d+$/.test(String(value)) || BigInt(value) < 1n) throw new AnnouncementError(400, `${entity} no válido.`);
  return BigInt(value);
}

function age(date) {
  if (!date) return null;
  const today = new Date();
  let result = today.getUTCFullYear() - date.getUTCFullYear();
  const beforeBirthday = today.getUTCMonth() < date.getUTCMonth() || (today.getUTCMonth() === date.getUTCMonth() && today.getUTCDate() < date.getUTCDate());
  if (beforeBirthday) result -= 1;
  return result;
}

function eligible(patient, campaign) {
  const patientAge = age(patient.fecha_nacimiento);
  if (campaign.segmento_edad_min != null && (patientAge == null || patientAge < campaign.segmento_edad_min)) return false;
  if (campaign.segmento_edad_max != null && (patientAge == null || patientAge > campaign.segmento_edad_max)) return false;
  if (campaign.segmento_sexo && String(patient.sexo || '').toUpperCase() !== campaign.segmento_sexo.toUpperCase()) return false;
  if (campaign.segmento_ubicacion && !String(patient.direccion || '').toLowerCase().includes(campaign.segmento_ubicacion.toLowerCase())) return false;
  const targetLevel = String(campaign.segmento_nivel || '').toUpperCase();
  const patientLevel = LEVEL_LABEL[patient.fidelizacion?.nivel] || null;
  if (targetLevel && targetLevel !== patientLevel) return false;
  const conditions = Array.isArray(campaign.segmento_condiciones) ? campaign.segmento_condiciones : [];
  if (conditions.length) {
    const clinical = String(patient.historia_clinica?.condiciones_cronicas || '').toLowerCase();
    if (!conditions.every((condition) => clinical.includes(String(condition).toLowerCase()))) return false;
  }
  return true;
}

function canReceiveWhatsApp(patient, campaign) {
  return Boolean(patient.telefono && campaign.whatsapp_habilitado && patient.preferencia_marketing?.suscrito === true && patient.preferencia_marketing?.whatsapp_autorizado === true && eligible(patient, campaign));
}

async function loadPatient(patientId) {
  const patient = await repository.paciente.findUnique({
    where: { id_paciente: patientId },
    include: { fidelizacion: true, preferencia_marketing: true, historia_clinica: true }
  });
  if (!patient || !patient.activo) throw new AnnouncementError(404, 'Paciente no encontrado.');
  return patient;
}

function present(campaign) {
  return {
    id: Number(campaign.id_campania),
    title: campaign.nombre,
    content: campaign.contenido_publicable || campaign.descripcion || '',
    imageUrl: campaign.imagen_url || null,
    startsAt: campaign.fecha_inicio?.toISOString() || null,
    endsAt: campaign.fecha_fin?.toISOString() || null,
    discountPercent: Number(campaign.descuento_porcentaje || 0),
    points: campaign.puntos_conversion || 0,
    services: campaign.servicios?.map(({ servicio }) => ({ id: Number(servicio.id_servicio), name: servicio.nombre, price: Number(servicio.precio_base) })) || []
  };
}

async function listForPatient(patientIdInput) {
  const patientId = id(patientIdInput, 'Paciente');
  await campaignService.synchronizePublicationStates();
  const [patient, campaigns] = await Promise.all([
    loadPatient(patientId),
    repository.campania.findMany({
      where: { estado: 'ACTIVA', fecha_inicio: { lte: new Date() }, OR: [{ fecha_fin: null }, { fecha_fin: { gte: new Date() } }] },
      orderBy: { fecha_inicio: 'desc' },
      include: { servicios: { include: { servicio: true } } }
    })
  ]);
  const matching = campaigns.filter((campaign) => eligible(patient, campaign));
  await Promise.all(matching.map((campaign) => repository.campania_destinatario.upsert({
    where: { id_campania_id_paciente: { id_campania: campaign.id_campania, id_paciente: patientId } },
    create: { id_campania: campaign.id_campania, id_paciente: patientId, estado: 'ALCANZADO' },
    update: {}
  })));
  return {
    announcements: matching.map(present),
    preferences: {
      subscribed: patient.preferencia_marketing?.suscrito === true,
      whatsappAuthorized: patient.preferencia_marketing?.whatsapp_autorizado === true
    }
  };
}

async function updatePreferences(patientIdInput, input = {}) {
  const patientId = id(patientIdInput, 'Paciente');
  const patient = await loadPatient(patientId);
  const subscribed = input.subscribed === undefined ? patient.preferencia_marketing?.suscrito === true : input.subscribed === true;
  const whatsappAuthorized = subscribed && (input.whatsappAuthorized === undefined ? patient.preferencia_marketing?.whatsapp_autorizado === true : input.whatsappAuthorized === true);
  const preference = await repository.preferencia_marketing.upsert({
    where: { id_paciente: patientId },
    create: { id_paciente: patientId, suscrito: subscribed, whatsapp_autorizado: whatsappAuthorized, fecha_exclusion: subscribed ? null : new Date() },
    update: { suscrito: subscribed, whatsapp_autorizado: whatsappAuthorized, fecha_exclusion: subscribed ? null : new Date(), fecha_actualizacion: new Date() }
  });
  return { subscribed: preference.suscrito, whatsappAuthorized: preference.whatsapp_autorizado };
}

async function sendCampaign(campaignIdInput) {
  const campaignId = id(campaignIdInput, 'Campaña');
  await campaignService.synchronizePublicationStates();
  const campaign = await repository.campania.findUnique({ where: { id_campania: campaignId }, include: { servicios: { include: { servicio: true } } } });
  if (!campaign || campaign.estado !== 'ACTIVA') throw new AnnouncementError(409, 'Solo una campaña activa y vigente puede enviarse.');
  if (!campaign.whatsapp_habilitado) throw new AnnouncementError(409, 'La campaña no tiene habilitado el canal WhatsApp.');
  const patients = await repository.paciente.findMany({ where: { activo: true }, include: { fidelizacion: true, preferencia_marketing: true, historia_clinica: true } });
  const targets = patients.filter((patient) => canReceiveWhatsApp(patient, campaign));
  let sent = 0; let failed = 0;
  for (const patient of targets) {
    const message = `${campaign.nombre}\n${campaign.contenido_publicable || campaign.descripcion || ''}`.trim();
    const result = await whatsapp.sendMessage({ to: patient.telefono, body: message });
    const status = result.success ? 'ENVIADA' : 'FALLIDA';
    await repository.notificacion.create({ data: { id_paciente: patient.id_paciente, id_campania: campaignId, tipo: 'CAMPANIA', canal: 'WHATSAPP', telefono_destino: patient.telefono, mensaje: message, estado: status, fecha_envio: result.success ? new Date() : null, proveedor_referencia: result.providerReference || result.errorMessage || null } });
    await repository.campania_destinatario.upsert({
      where: { id_campania_id_paciente: { id_campania: campaignId, id_paciente: patient.id_paciente } },
      create: { id_campania: campaignId, id_paciente: patient.id_paciente, estado: status, proveedor_referencia: result.providerReference || null, fecha_entrega: result.success ? new Date() : null },
      update: { estado: status, proveedor_referencia: result.providerReference || null, fecha_entrega: result.success ? new Date() : null }
    });
    if (result.success) sent += 1; else failed += 1;
  }
  return { eligible: targets.length, sent, failed, excluded: patients.length - targets.length };
}

function loyaltyLevel(points) {
  const silver = Number(process.env.LOYALTY_SILVER_POINTS || 200);
  const gold = Number(process.env.LOYALTY_GOLD_POINTS || 500);
  if (points >= gold) return 'PREMIUM';
  if (points >= silver) return 'FRECUENTE';
  return 'ESTANDAR';
}

async function usePromotion(patientIdInput, campaignIdInput, input = {}) {
  const patientId = id(patientIdInput, 'Paciente');
  const campaignId = id(campaignIdInput, 'Campaña');
  const serviceId = id(input.serviceId, 'Servicio');
  const key = String(input.operationKey || '').trim();
  if (!key || key.length > 120) throw new AnnouncementError(400, 'La clave única de operación es obligatoria.');
  const previous = await repository.promocion_uso.findUnique({ where: { clave_idempotencia: key } });
  if (previous) {
    if (previous.id_paciente !== patientId || previous.id_campania !== campaignId) throw new AnnouncementError(409, 'La clave de operación ya fue utilizada.');
    return { duplicate: true, usageId: Number(previous.id_uso), discountApplied: Number(previous.descuento_aplicado), pointsAwarded: previous.puntos_otorgados };
  }
  await campaignService.synchronizePublicationStates();
  const [patient, campaign, service] = await Promise.all([
    loadPatient(patientId),
    repository.campania.findUnique({ where: { id_campania: campaignId }, include: { servicios: true } }),
    repository.servicio_medico.findUnique({ where: { id_servicio: serviceId } })
  ]);
  if (!campaign || campaign.estado !== 'ACTIVA' || (campaign.fecha_fin && campaign.fecha_fin < new Date())) throw new AnnouncementError(409, 'La promoción no está vigente.');
  if (!eligible(patient, campaign)) throw new AnnouncementError(403, 'La promoción no corresponde al segmento del paciente.');
  if (!service || !campaign.servicios.some((item) => item.id_servicio === serviceId)) throw new AnnouncementError(400, 'La promoción no aplica al servicio seleccionado.');
  const percentage = Number(campaign.descuento_porcentaje || 0);
  if (percentage < 0 || percentage > 100) throw new AnnouncementError(409, 'El descuento configurado es inválido.');
  const discount = Number((Number(service.precio_base) * percentage / 100).toFixed(2));
  const points = Math.max(0, campaign.puntos_conversion || 0);
  let usage;
  try {
    usage = await repository.transaction(async (tx) => {
      const current = await tx.fidelizacion_paciente.findUnique({ where: { id_paciente: patientId } });
      const oldPoints = current?.puntos_acumulados || 0;
      const nextPoints = oldPoints + points;
      const oldLevel = current?.nivel || 'ESTANDAR';
      const nextLevel = loyaltyLevel(nextPoints);
      const created = await tx.promocion_uso.create({ data: { id_campania: campaignId, id_paciente: patientId, id_servicio: serviceId, clave_idempotencia: key, descuento_aplicado: discount, puntos_otorgados: points } });
      await tx.fidelizacion_paciente.upsert({ where: { id_paciente: patientId }, create: { id_paciente: patientId, puntos_acumulados: nextPoints, nivel: nextLevel, estado: 'ACTIVO' }, update: { puntos_acumulados: nextPoints, nivel: nextLevel, fecha_actualizacion: new Date() } });
      await tx.evento_fidelizacion.create({ data: { id_paciente: patientId, clave_idempotencia: `LOY-${key}`, tipo: 'PROMOCION_USADA', puntos: points, nivel_anterior: LEVEL_LABEL[oldLevel], nivel_nuevo: LEVEL_LABEL[nextLevel], referencia: `campania:${campaignId}` } });
      await tx.campania_destinatario.upsert({ where: { id_campania_id_paciente: { id_campania: campaignId, id_paciente: patientId } }, create: { id_campania: campaignId, id_paciente: patientId, estado: 'CONVERTIDA', fecha_conversion: new Date() }, update: { estado: 'CONVERTIDA', fecha_conversion: new Date() } });
      return { created, nextPoints, nextLevel, changedLevel: oldLevel !== nextLevel };
    });
  } catch (error) {
    if (error.code !== 'P2002') throw error;
    const concurrent = await repository.promocion_uso.findUnique({ where: { clave_idempotencia: key } });
    if (!concurrent || concurrent.id_paciente !== patientId || concurrent.id_campania !== campaignId) throw new AnnouncementError(409, 'La clave de operación ya fue utilizada.');
    return { duplicate: true, usageId: Number(concurrent.id_uso), discountApplied: Number(concurrent.descuento_aplicado), pointsAwarded: concurrent.puntos_otorgados };
  }
  return { duplicate: false, usageId: Number(usage.created.id_uso), discountApplied: discount, pointsAwarded: points, totalPoints: usage.nextPoints, level: LEVEL_LABEL[usage.nextLevel], levelChanged: usage.changedLevel };
}

async function metrics(campaignIdInput) {
  const campaignId = id(campaignIdInput, 'Campaña');
  const campaign = await repository.campania.findUnique({ where: { id_campania: campaignId } });
  if (!campaign) throw new AnnouncementError(404, 'Campaña no encontrada.');
  const [recipients, uses] = await Promise.all([
    repository.campania_destinatario.findMany({ where: { id_campania: campaignId } }),
    repository.promocion_uso.findMany({ where: { id_campania: campaignId } })
  ]);
  const sent = recipients.filter((row) => ['ENVIADA', 'ENTREGADA', 'CONVERTIDA'].includes(row.estado)).length;
  const delivered = recipients.filter((row) => ['ENTREGADA', 'CONVERTIDA'].includes(row.estado)).length;
  const conversions = uses.length;
  const spent = uses.reduce((sum, row) => sum + Number(row.descuento_aplicado), 0);
  return { budget: Number(campaign.presupuesto || 0), spent: Number(spent.toFixed(2)), remaining: Math.max(0, Number(campaign.presupuesto || 0) - spent), reach: recipients.length, sent, delivered, conversions, conversionRate: recipients.length ? Number((conversions * 100 / recipients.length).toFixed(1)) : 0 };
}

module.exports = { AnnouncementError, canReceiveWhatsApp, eligible, listForPatient, loyaltyLevel, metrics, sendCampaign, updatePreferences, usePromotion };
