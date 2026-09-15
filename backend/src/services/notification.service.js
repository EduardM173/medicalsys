const repository = require('../repositories/notification.repository');
const {
  fullName,
  buildConfirmationMessage,
  buildReminderMessage
} = require('./whatsapp/appointment-message');
const { normalizeWhatsappPhone } = require('./whatsapp/phone');
const {
  scheduleNotificationForAppointment,
  cancelAppointmentNotificationJobs,
  listFailedNotificationJobs,
  retryFailedNotificationJob,
  retryAfterDeliveryFailure
} = require('./whatsapp/whatsapp-notification-queue.service');

// Ventana usada para listar citas candidatas a recordatorio en el MVP
// (MED-230): no se implementa un scheduler/cron, sino una acción manual
// que opera sobre las citas futuras próximas.
const REMINDER_WINDOW_HOURS = 72;

// Estados de cita que siguen "vigentes" (no cancelada ni completada).
const activeAppointmentStates = ['PROGRAMADA', 'CONFIRMADA', 'EN_CONSULTA'];

class NotificationError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function parseId(value, entity) {
  if (!/^\d+$/.test(String(value)) || BigInt(value) < 1n) {
    throw new NotificationError(400, `Identificador de ${entity} no válido.`);
  }
  return BigInt(value);
}

const appointmentSelect = {
  id_cita: true,
  estado: true,
  fecha_hora_inicio: true,
  fecha_hora_fin: true,
  paciente: {
    select: { id_paciente: true, nombres: true, apellidos: true, telefono: true }
  },
  medico: {
    select: {
      id_medico: true,
      especialidad: true,
      usuario: { select: { nombres: true, apellidos: true } }
    }
  },
  servicio_medico: { select: { nombre: true } }
};

const notificationSelect = {
  id_notificacion: true,
  id_paciente: true,
  id_cita: true,
  tipo: true,
  canal: true,
  telefono_destino: true,
  mensaje: true,
  fecha_envio: true,
  estado: true,
  proveedor_referencia: true,
  fecha_creacion: true
};

const historyNotificationTypes = ['CONFIRMACION_CITA', 'RECORDATORIO_CITA'];

function maskPhone(phone) {
  const value = String(phone || '');
  if (value.length <= 4) return value;
  return `${'*'.repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}

function toHistoryNotification(notification) {
  return {
    id: Number(notification.id_notificacion),
    tipo: notification.tipo,
    estado: notification.estado,
    canal: notification.canal,
    telefonoDestino: maskPhone(notification.telefono_destino),
    mensaje: notification.mensaje,
    fechaProgramada: notification.fecha_programada?.toISOString() || null,
    fechaEnvio: notification.fecha_envio?.toISOString() || null,
    fechaEntrega: notification.fecha_entrega?.toISOString() || null,
    fechaLectura: notification.fecha_lectura?.toISOString() || null,
    fechaCreacion: notification.fecha_creacion.toISOString(),
    cita: notification.cita ? {
      id: Number(notification.cita.id_cita),
      fechaHoraInicio: notification.cita.fecha_hora_inicio.toISOString(),
      estado: notification.cita.estado
    } : null
  };
}

// HU-26: consulta exclusivamente confirmaciones y recordatorios de citas.
async function listPatientNotificationHistory({ patientId: patientIdInput, appointmentId: appointmentIdInput } = {}) {
  if (patientIdInput === undefined || patientIdInput === null || patientIdInput === '') {
    throw new NotificationError(400, 'Debe seleccionar un paciente.');
  }
  const patientId = parseId(patientIdInput, 'paciente');
  const patient = await repository.paciente.findUnique({
    where: { id_paciente: patientId },
    select: { id_paciente: true, nombres: true, apellidos: true, documento_identidad: true, complemento: true }
  });
  if (!patient) throw new NotificationError(404, 'Paciente no encontrado.');

  let appointmentId = null;
  if (appointmentIdInput !== undefined && appointmentIdInput !== null && appointmentIdInput !== '') {
    appointmentId = parseId(appointmentIdInput, 'cita');
    const appointment = await repository.cita.findUnique({
      where: { id_cita: appointmentId },
      select: { id_paciente: true }
    });
    if (!appointment) throw new NotificationError(404, 'Cita no encontrada.');
    if (appointment.id_paciente !== patientId) {
      throw new NotificationError(400, 'La cita seleccionada no pertenece al paciente.');
    }
  }

  const notifications = await repository.notificacion.findMany({
    where: {
      id_paciente: patientId,
      tipo: { in: historyNotificationTypes },
      ...(appointmentId ? { id_cita: appointmentId } : {})
    },
    orderBy: [{ fecha_creacion: 'desc' }, { id_notificacion: 'desc' }],
    take: 200,
    select: {
      id_notificacion: true,
      tipo: true,
      estado: true,
      canal: true,
      telefono_destino: true,
      mensaje: true,
      fecha_programada: true,
      fecha_envio: true,
      fecha_entrega: true,
      fecha_lectura: true,
      fecha_creacion: true,
      cita: { select: { id_cita: true, fecha_hora_inicio: true, estado: true } }
    }
  });

  return {
    patient: {
      id: Number(patient.id_paciente),
      fullName: fullName(patient.nombres, patient.apellidos),
      document: `${patient.documento_identidad}${patient.complemento ? ` ${patient.complemento}` : ''}`
    },
    notifications: notifications.map(toHistoryNotification)
  };
}

async function findCitaOrThrow(citaId) {
  const cita = await repository.cita.findUnique({ where: { id_cita: citaId }, select: appointmentSelect });
  if (!cita) {
    throw new NotificationError(404, 'Cita no encontrada.');
  }
  return cita;
}

// PA-03 (HU-24): la confirmación (y el recordatorio) sólo pueden enviarse
// cuando el paciente cuenta con un medio de contacto válido.
function assertValidPhone(patient) {
  try {
    return normalizeWhatsappPhone(patient.telefono);
  } catch (error) {
    throw new NotificationError(400, error.message);
  }
}

function digitsFromWhatsappId(value) {
  return String(value || '').split('@')[0].replace(/\D/g, '');
}

// Deja solo dígitos, sin importar cómo se haya escrito el teléfono del
// paciente en el registro (espacios, guiones, paréntesis, "00" en vez de
// "+", etc.).
function phoneDigitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

// Busca al paciente dueño del número que escribió, comparando solo dígitos
// (ignora espacios/guiones/paréntesis guardados en paciente.telefono y
// tolera que el registro tenga o no el código de país 591).
async function findPatientsByWhatsappSender(sender) {
  const senderDigits = digitsFromWhatsappId(sender);
  if (!senderDigits) return [];
  const senderDigitsWithoutCountryCode = senderDigits.startsWith('591') && senderDigits.length > 8
    ? senderDigits.slice(3)
    : null;

  const candidates = await repository.paciente.findMany({
    where: { activo: true, telefono: { not: null } },
    select: { id_paciente: true, telefono: true }
  });

  return candidates.filter((candidate) => {
    const candidateDigits = phoneDigitsOnly(candidate.telefono);
    if (!candidateDigits) return false;
    if (candidateDigits === senderDigits) return true;
    if (senderDigitsWithoutCountryCode && candidateDigits === senderDigitsWithoutCountryCode) return true;
    if (candidateDigits.length <= 8 && `591${candidateDigits}` === senderDigits) return true;
    return false;
  });
}

function incomingTextFromGreenApi(payload) {
  const messageData = payload?.messageData || {};
  return String(
    messageData.textMessageData?.textMessage
      || messageData.extendedTextMessageData?.text
      || ''
  ).trim();
}

function isPositiveConfirmation(text) {
  return /^s[ií][.!]*$/iu.test(String(text || '').trim());
}

function isNegativeConfirmation(text) {
  return /^no[.!]*$/iu.test(String(text || '').trim());
}

function negativeResponseAction() {
  const configured = String(process.env.WHATSAPP_NO_RESPONSE_ACTION || 'PENDIENTE_REPROGRAMACION').toUpperCase();
  return configured === 'CANCELAR' ? 'CANCELADA' : 'PENDIENTE_REPROGRAMACION';
}

function quotedProviderReference(payload) {
  const messageData = payload?.messageData || {};
  return messageData.extendedTextMessageData?.stanzaId
    || messageData.textMessageData?.quotedMessage?.stanzaId
    || messageData.quotedMessage?.stanzaId
    || null;
}

async function findPendingNotificationForPatient(patientId, providerReference) {
  const baseWhere = {
    id_paciente: patientId,
    tipo: { in: ['CONFIRMACION_CITA', 'RECORDATORIO_CITA'] },
    direccion: 'SALIENTE',
    estado: { in: ['ENVIADA', 'ENTREGADA', 'LEIDA'] },
    cita: {
      estado: 'PROGRAMADA',
      fecha_hora_inicio: { gt: new Date() }
    }
  };

  if (providerReference) {
    const quoted = await repository.notificacion.findFirst({
      where: { ...baseWhere, proveedor_referencia: providerReference },
      orderBy: { fecha_creacion: 'desc' },
      select: { id_notificacion: true, id_cita: true }
    });
    if (quoted) return quoted;
  }

  // Si el usuario responde sin citar el mensaje, se elige la confirmación o
  // recordatorio pendiente más reciente de ese paciente. Solo se usa para
  // citas futuras.
  return repository.notificacion.findFirst({
    where: baseWhere,
    orderBy: { fecha_creacion: 'desc' },
    select: { id_notificacion: true, id_cita: true }
  });
}

// Recibe el cuerpo `incomingMessageReceived` de Green API. Las respuestas
// positivas se registran y confirman únicamente la cita futura asociada al
// mismo paciente; mensajes ajenos, grupos y duplicados nunca cambian citas.
async function processGreenApiIncomingNotification(payload) {
  if (payload?.typeWebhook !== 'incomingMessageReceived') {
    return { processed: false, reason: 'unsupported_event' };
  }

  const expectedInstance = String(process.env.GREENAPI_ID_INSTANCE || '');
  if (expectedInstance && String(payload?.instanceData?.idInstance || '') !== expectedInstance) {
    return { processed: false, reason: 'unexpected_instance' };
  }

  const sender = payload?.senderData?.sender || payload?.senderData?.chatId || '';
  if (!sender.endsWith('@c.us')) return { processed: false, reason: 'non_personal_chat' };

  const text = incomingTextFromGreenApi(payload);
  const incomingReference = payload?.idMessage ? `GREENAPI-IN:${payload.idMessage}` : null;
  if (!text || !incomingReference) return { processed: false, reason: 'invalid_message' };

  const duplicate = await repository.notificacion.findFirst({
    where: { proveedor_referencia: incomingReference },
    select: { id_notificacion: true }
  });
  if (duplicate) return { processed: true, duplicate: true, confirmed: false };

  const patients = await findPatientsByWhatsappSender(sender);
  if (patients.length !== 1) return { processed: false, reason: 'unknown_or_ambiguous_sender' };

  const patient = patients[0];
  const isPositive = isPositiveConfirmation(text);
  const isNegative = isNegativeConfirmation(text);
  const confirmation = (isPositive || isNegative)
    ? await findPendingNotificationForPatient(patient.id_paciente, quotedProviderReference(payload))
    : null;
  const receivedAt = Number.isFinite(Number(payload.timestamp))
    ? new Date(Number(payload.timestamp) * 1000)
    : new Date();

  const result = await repository.transaction(async (tx) => {
    const seen = await tx.notificacion.findFirst({
      where: { proveedor_referencia: incomingReference },
      select: { id_notificacion: true }
    });
    if (seen) return { duplicate: true, confirmed: false, appointmentId: null };

    await tx.notificacion.create({
      data: {
        id_paciente: patient.id_paciente,
        id_cita: confirmation?.id_cita || null,
        tipo: 'MENSAJE_DIRECTO',
        direccion: 'ENTRANTE',
        canal: 'WHATSAPP',
        telefono_destino: `+${digitsFromWhatsappId(sender)}`,
        mensaje: text.slice(0, 2000),
        fecha_envio: receivedAt,
        fecha_lectura: receivedAt,
        estado: 'LEIDA',
        proveedor_referencia: incomingReference
      }
    });

    if (!confirmation?.id_cita) return { duplicate: false, confirmed: false, appointmentId: null };

    const nextState = isPositive ? 'CONFIRMADA' : negativeResponseAction();
    const updated = await tx.cita.updateMany({
      where: { id_cita: confirmation.id_cita, estado: 'PROGRAMADA' },
      data: { estado: nextState, fecha_actualizacion: new Date() }
    });
    if (updated.count > 0) {
      await tx.notificacion.update({
        where: { id_notificacion: confirmation.id_notificacion },
        data: { estado: 'LEIDA', fecha_lectura: receivedAt }
      });
      if (isNegative) {
        await cancelAppointmentNotificationJobs(tx, confirmation.id_cita);
      }
    }
    if (isNegative) {
      return {
        duplicate: false,
        confirmed: false,
        negative: updated.count > 0,
        responseAction: updated.count > 0 ? nextState : null,
        appointmentId: Number(confirmation.id_cita)
      };
    }
    return { duplicate: false, confirmed: updated.count > 0, appointmentId: Number(confirmation.id_cita) };
  });

  return { processed: true, ...result };
}

// Green API entrega estos eventos por la misma cola HTTP que los mensajes
// entrantes. `idMessage` coincide con la referencia que devolvió sendMessage.
async function processGreenApiOutgoingStatusNotification(payload) {
  if (payload?.typeWebhook !== 'outgoingMessageStatus') {
    return { processed: false, reason: 'unsupported_event' };
  }

  const expectedInstance = String(process.env.GREENAPI_ID_INSTANCE || '');
  if (expectedInstance && String(payload?.instanceData?.idInstance || '') !== expectedInstance) {
    return { processed: false, reason: 'unexpected_instance' };
  }

  const providerReference = String(payload?.idMessage || '');
  const status = String(payload?.status || '').toLowerCase();
  if (!providerReference || !['sent', 'delivered', 'read', 'failed'].includes(status)) {
    return { processed: false, reason: 'invalid_status' };
  }

  const notification = await repository.notificacion.findFirst({
    where: { proveedor_referencia: providerReference, direccion: 'SALIENTE' },
    select: { id_notificacion: true, estado: true }
  });
  if (!notification) return { processed: false, reason: 'unknown_message' };

  const occurredAt = Number.isFinite(Number(payload.timestamp))
    ? new Date(Number(payload.timestamp) * 1000)
    : new Date();

  if (status === 'failed') {
    const retry = await retryAfterDeliveryFailure(
      notification.id_notificacion,
      'Green API informó que el mensaje no pudo ser entregado.',
      occurredAt
    );
    await repository.notificacion.update({
      where: { id_notificacion: notification.id_notificacion },
      data: {
        estado: retry.exhausted ? 'FALLIDA' : 'PENDIENTE',
        proveedor_referencia: 'Green API informó que el mensaje no pudo ser entregado.'
      }
    });
    return { processed: true, status, retried: retry.updated && !retry.exhausted };
  }

  // Los estados pueden llegar fuera de orden; nunca se rebaja LEIDA ni
  // ENTREGADA a ENVIADA por una notificación tardía de Green API.
  if (notification.estado === 'LEIDA' || (notification.estado === 'ENTREGADA' && status === 'sent')) {
    return { processed: true, status, ignored: true };
  }

  const data = status === 'read'
    ? { estado: 'LEIDA', fecha_entrega: occurredAt, fecha_lectura: occurredAt }
    : status === 'delivered'
      ? { estado: 'ENTREGADA', fecha_entrega: occurredAt }
      : { estado: 'ENVIADA', fecha_envio: occurredAt };
  await repository.notificacion.update({ where: { id_notificacion: notification.id_notificacion }, data });
  return { processed: true, status };
}

async function processGreenApiNotification(payload) {
  if (payload?.typeWebhook === 'incomingMessageReceived') {
    return processGreenApiIncomingNotification(payload);
  }
  if (payload?.typeWebhook === 'outgoingMessageStatus') {
    return processGreenApiOutgoingStatusNotification(payload);
  }
  return { processed: false, reason: 'unsupported_event' };
}

function toAppointmentSummary(cita) {
  return {
    id: Number(cita.id_cita),
    estado: cita.estado,
    fechaHoraInicio: cita.fecha_hora_inicio.toISOString(),
    fechaHoraFin: cita.fecha_hora_fin.toISOString(),
    paciente: {
      id: Number(cita.paciente.id_paciente),
      nombre: fullName(cita.paciente.nombres, cita.paciente.apellidos),
      telefono: cita.paciente.telefono || null
    },
    medico: {
      id: Number(cita.medico.id_medico),
      nombre: fullName(cita.medico.usuario.nombres, cita.medico.usuario.apellidos),
      especialidad: cita.medico.especialidad
    },
    servicio: cita.servicio_medico.nombre
  };
}

function toNotification(notificacion) {
  return {
    id: Number(notificacion.id_notificacion),
    citaId: notificacion.id_cita ? Number(notificacion.id_cita) : null,
    pacienteId: Number(notificacion.id_paciente),
    tipo: notificacion.tipo,
    canal: notificacion.canal,
    telefonoDestino: notificacion.telefono_destino,
    mensaje: notificacion.mensaje,
    estado: notificacion.estado,
    fechaEnvio: notificacion.fecha_envio ? notificacion.fecha_envio.toISOString() : null,
    proveedorReferencia: notificacion.proveedor_referencia
  };
}

// La API ya no llama al proveedor directamente. Programa el mismo trabajo
// persistente que el alta de cita; el worker independiente es quien envía.
async function sendAndRegister({ cita, tipo, mensaje, emitidoPorUserId }) {
  // Conserva la validación HTTP para la acción manual; al registrar una cita
  // sin teléfono se conserva la cita y se genera un fallo visible en cola.
  assertValidPhone(cita.paciente);
  const queued = await scheduleNotificationForAppointment(cita, tipo, emitidoPorUserId, { runNow: true });

  return {
    ...queued,
    mensaje,
    exito: queued.estado !== 'FALLIDA',
    error: queued.estado === 'FALLIDA' ? queued.ultimoError : null,
    enCola: queued.estado === 'PENDIENTE'
  };
}

// ==========================================
// HU-24: Confirmación de cita por WhatsApp
// ==========================================

// Citas activas y futuras disponibles para solicitar una confirmación.
async function listConfirmationCandidates() {
  const citas = await repository.cita.findMany({
    where: {
      estado: { in: activeAppointmentStates },
      fecha_hora_inicio: { gt: new Date() }
    },
    orderBy: { fecha_hora_inicio: 'asc' },
    take: 200,
    select: appointmentSelect
  });
  return citas.map(toAppointmentSummary);
}

// PA-01, PA-02, PA-03, PA-04, PA-05, PA-06.
async function sendAppointmentConfirmation(citaIdInput, emitidoPorUserId) {
  const citaId = parseId(citaIdInput, 'cita');
  // PA-01: la confirmación corresponde a una cita existente y a su paciente asociado.
  const cita = await findCitaOrThrow(citaId);

  // PA-06: una cita cancelada no puede presentarse al paciente como confirmada.
  if (cita.estado === 'CANCELADA') {
    throw new NotificationError(400, 'No se puede confirmar por WhatsApp: la cita fue cancelada.');
  }
  if (cita.estado === 'COMPLETADA') {
    throw new NotificationError(400, 'No se puede confirmar por WhatsApp: la cita ya fue completada.');
  }

  const existing = await repository.notificacion.findFirst({
    where: {
      id_cita: cita.id_cita,
      tipo: 'CONFIRMACION_CITA',
      estado: { in: ['ENVIADA', 'ENTREGADA', 'LEIDA'] }
    },
    orderBy: { fecha_creacion: 'desc' },
    select: notificationSelect
  });
  if (existing) {
    return { ...toNotification(existing), exito: true, duplicado: true, error: null };
  }

  // PA-02: mensaje con datos reales de paciente, médico, fecha y hora.
  const mensaje = buildConfirmationMessage(cita);

  // PA-03 (dentro de sendAndRegister), PA-04 y PA-05.
  return sendAndRegister({ cita, tipo: 'CONFIRMACION_CITA', mensaje, emitidoPorUserId });
}

// ==========================================
// HU-25: Recordatorio de cita por WhatsApp
// ==========================================

// PA-01, PA-03, PA-04: sólo citas futuras, vigentes (ni canceladas ni completadas).
async function listReminderCandidates() {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_HOURS * 60 * 60 * 1000);

  const citas = await repository.cita.findMany({
    where: {
      estado: { in: activeAppointmentStates },
      fecha_hora_inicio: { gt: now, lte: windowEnd }
    },
    orderBy: { fecha_hora_inicio: 'asc' },
    select: appointmentSelect
  });

  if (citas.length === 0) return [];

  // PA-06: se marca en la lista si la cita ya recibió un recordatorio
  // entregado con éxito, para evitar reenvíos accidentales desde la UI.
  const citaIds = citas.map((cita) => cita.id_cita);
  const yaEnviados = await repository.notificacion.findMany({
    where: {
      id_cita: { in: citaIds },
      tipo: 'RECORDATORIO_CITA',
      estado: { in: ['ENVIADA', 'ENTREGADA', 'LEIDA'] }
    },
    select: { id_cita: true }
  });
  const yaEnviadosSet = new Set(yaEnviados.map((notificacion) => Number(notificacion.id_cita)));

  return citas.map((cita) => ({
    ...toAppointmentSummary(cita),
    recordatorioYaEnviado: yaEnviadosSet.has(Number(cita.id_cita))
  }));
}

// PA-01 a PA-06.
async function sendAppointmentReminder(citaIdInput, emitidoPorUserId, { allowResend = false } = {}) {
  const citaId = parseId(citaIdInput, 'cita');
  const cita = await findCitaOrThrow(citaId);

  // PA-01: sólo se admite para una cita futura registrada para el paciente.
  if (cita.fecha_hora_inicio.getTime() <= Date.now()) {
    throw new NotificationError(400, 'Solo se pueden enviar recordatorios para citas futuras.');
  }
  // PA-03: una cita cancelada no recibe recordatorios como si continuara programada.
  if (cita.estado === 'CANCELADA') {
    throw new NotificationError(400, 'No se puede enviar un recordatorio: la cita fue cancelada.');
  }
  // PA-04: una cita completada no recibe recordatorio de asistencia.
  if (cita.estado === 'COMPLETADA') {
    throw new NotificationError(400, 'No se puede enviar un recordatorio: la cita ya fue completada.');
  }

  // PA-06: la misma cita no debe recibir el mismo recordatorio varias veces
  // (por doble clic o por una repetición de la ejecución del flujo).
  if (!allowResend) {
    const existente = await repository.notificacion.findFirst({
      where: {
        id_cita: cita.id_cita,
        tipo: 'RECORDATORIO_CITA',
        estado: { in: ['ENVIADA', 'ENTREGADA', 'LEIDA'] }
      },
      orderBy: { fecha_creacion: 'desc' },
      select: notificationSelect
    });
    if (existente) {
      return { ...toNotification(existente), exito: true, duplicado: true, error: null };
    }
  }

  // PA-02: mensaje con datos reales de paciente, médico, fecha y hora.
  const mensaje = buildReminderMessage(cita);

  // PA-05: el resultado del intento (éxito o falla) queda registrado.
  const resultado = await sendAndRegister({ cita, tipo: 'RECORDATORIO_CITA', mensaje, emitidoPorUserId });
  return { ...resultado, duplicado: false };
}

// MED-230: acción de ejecución manual (coherente con el alcance del MVP,
// sin un scheduler) que procesa un lote de citas seleccionadas por la
// recepción/administración desde la interfaz.
async function runAppointmentReminders(citaIdsInput, emitidoPorUserId) {
  if (!Array.isArray(citaIdsInput) || citaIdsInput.length === 0) {
    throw new NotificationError(400, 'Debe indicar al menos una cita para enviar recordatorios.');
  }

  // PA-06: se deduplican identificadores repetidos dentro de la misma ejecución.
  const uniqueIds = [...new Set(citaIdsInput.map((value) => String(value)))];

  const resultados = [];
  // Se procesa de forma secuencial para evitar condiciones de carrera al
  // verificar/crear registros de `notificacion` para la misma cita.
  for (const idInput of uniqueIds) {
    try {
      const resultado = await sendAppointmentReminder(idInput, emitidoPorUserId);
      resultados.push({ citaId: Number(idInput), ...resultado });
    } catch (error) {
      resultados.push({
        citaId: Number(idInput),
        exito: false,
        duplicado: false,
        estado: 'FALLIDA',
        error: error.message || 'No fue posible procesar el recordatorio.'
      });
    }
  }

  return {
    total: resultados.length,
    enviados: resultados.filter((resultado) => resultado.exito && !resultado.duplicado).length,
    duplicados: resultados.filter((resultado) => resultado.duplicado).length,
    fallidos: resultados.filter((resultado) => !resultado.exito).length,
    resultados
  };
}

module.exports = {
  NotificationError,
  listPatientNotificationHistory,
  listFailedNotificationJobs,
  retryFailedNotificationJob,
  processGreenApiNotification,
  processGreenApiIncomingNotification,
  processGreenApiOutgoingStatusNotification,
  listConfirmationCandidates,
  sendAppointmentConfirmation,
  listReminderCandidates,
  sendAppointmentReminder,
  runAppointmentReminders
};
