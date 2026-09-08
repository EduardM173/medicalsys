const prisma = require('../config/prisma');
const whatsappService = require('./whatsapp/whatsapp.service');

// Ventana usada para listar citas candidatas a recordatorio en el MVP
// (MED-230): no se implementa un scheduler/cron, sino una acción manual
// que opera sobre las citas futuras próximas.
const REMINDER_WINDOW_HOURS = 72;

// Estados de cita que siguen "vigentes" (no cancelada ni completada).
const activeAppointmentStates = ['PROGRAMADA', 'CONFIRMADA', 'EN_CONSULTA'];

// Acepta números bolivianos de 8 dígitos o cualquier número en formato E.164.
const phonePattern = /^\+?\d{7,15}$/;

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
  const patient = await prisma.paciente.findUnique({
    where: { id_paciente: patientId },
    select: { id_paciente: true, nombres: true, apellidos: true, documento_identidad: true, complemento: true }
  });
  if (!patient) throw new NotificationError(404, 'Paciente no encontrado.');

  let appointmentId = null;
  if (appointmentIdInput !== undefined && appointmentIdInput !== null && appointmentIdInput !== '') {
    appointmentId = parseId(appointmentIdInput, 'cita');
    const appointment = await prisma.cita.findUnique({
      where: { id_cita: appointmentId },
      select: { id_paciente: true }
    });
    if (!appointment) throw new NotificationError(404, 'Cita no encontrada.');
    if (appointment.id_paciente !== patientId) {
      throw new NotificationError(400, 'La cita seleccionada no pertenece al paciente.');
    }
  }

  const notifications = await prisma.notificacion.findMany({
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
  const cita = await prisma.cita.findUnique({ where: { id_cita: citaId }, select: appointmentSelect });
  if (!cita) {
    throw new NotificationError(404, 'Cita no encontrada.');
  }
  return cita;
}

// PA-03 (HU-24): la confirmación (y el recordatorio) sólo pueden enviarse
// cuando el paciente cuenta con un medio de contacto válido.
function assertValidPhone(patient) {
  const rawPhone = typeof patient.telefono === 'string' ? patient.telefono.trim() : '';
  if (!rawPhone || !phonePattern.test(rawPhone)) {
    throw new NotificationError(
      400,
      'El paciente no cuenta con un número de teléfono válido para enviar la notificación por WhatsApp.'
    );
  }
  // Normaliza a formato internacional; los números de prueba se registran
  // sin código de país (Bolivia, +591) en el seed del proyecto.
  if (rawPhone.startsWith('+')) return rawPhone;
  return `+591${rawPhone.replace(/^0+/, '')}`;
}

function formatFechaHora(date) {
  const fecha = new Intl.DateTimeFormat('es-BO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/La_Paz'
  }).format(date);
  const hora = new Intl.DateTimeFormat('es-BO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/La_Paz'
  }).format(date);
  return { fecha, hora, texto: `${fecha} a las ${hora}` };
}

function fullName(nombres, apellidos) {
  return `${nombres} ${apellidos}`.trim();
}

// PA-02 (HU-24 y HU-25): el mensaje se construye con datos reales de la
// cita: paciente, médico, fecha y hora.
function buildConfirmationMessage(cita) {
  const pacienteNombre = fullName(cita.paciente.nombres, cita.paciente.apellidos);
  const medicoNombre = fullName(cita.medico.usuario.nombres, cita.medico.usuario.apellidos);
  const { texto } = formatFechaHora(cita.fecha_hora_inicio);
  return `*MedicalSys:* Estimado(a) ${pacienteNombre}, le confirmamos su cita para el ${texto} `
    + `con el Dr(a). ${medicoNombre} (${cita.servicio_medico.nombre}). `
    + 'Responda *SI* para confirmar su asistencia.';
}

function buildReminderMessage(cita) {
  const pacienteNombre = fullName(cita.paciente.nombres, cita.paciente.apellidos);
  const medicoNombre = fullName(cita.medico.usuario.nombres, cita.medico.usuario.apellidos);
  const { texto } = formatFechaHora(cita.fecha_hora_inicio);
  return `*Recordatorio MedicalSys:* Hola ${pacienteNombre}, le recordamos su cita el ${texto} `
    + `con el Dr(a). ${medicoNombre} (${cita.servicio_medico.nombre}). `
    + 'Por favor confirme su asistencia respondiendo *SI*.';
}

function digitsFromWhatsappId(value) {
  return String(value || '').split('@')[0].replace(/\D/g, '');
}

function phoneVariantsFromWhatsappId(value) {
  const digits = digitsFromWhatsappId(value);
  if (!digits) return [];
  const variants = new Set([digits, `+${digits}`]);
  // Los datos históricos del MVP pueden estar guardados con o sin +591.
  if (digits.startsWith('591') && digits.length > 8) {
    variants.add(digits.slice(3));
    variants.add(`+${digits.slice(3)}`);
  }
  return [...variants];
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
    const quoted = await prisma.notificacion.findFirst({
      where: { ...baseWhere, proveedor_referencia: providerReference },
      orderBy: { fecha_creacion: 'desc' },
      select: { id_notificacion: true, id_cita: true }
    });
    if (quoted) return quoted;
  }

  // Si el usuario responde sin citar el mensaje, se elige la confirmación o
  // recordatorio pendiente más reciente de ese paciente. Solo se usa para
  // citas futuras.
  return prisma.notificacion.findFirst({
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

  const duplicate = await prisma.notificacion.findFirst({
    where: { proveedor_referencia: incomingReference },
    select: { id_notificacion: true }
  });
  if (duplicate) return { processed: true, duplicate: true, confirmed: false };

  const patients = await prisma.paciente.findMany({
    where: { telefono: { in: phoneVariantsFromWhatsappId(sender) }, activo: true },
    select: { id_paciente: true }
  });
  if (patients.length !== 1) return { processed: false, reason: 'unknown_or_ambiguous_sender' };

  const patient = patients[0];
  const confirmation = isPositiveConfirmation(text)
    ? await findPendingNotificationForPatient(patient.id_paciente, quotedProviderReference(payload))
    : null;
  const receivedAt = Number.isFinite(Number(payload.timestamp))
    ? new Date(Number(payload.timestamp) * 1000)
    : new Date();

  const result = await prisma.$transaction(async (tx) => {
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

    const updated = await tx.cita.updateMany({
      where: { id_cita: confirmation.id_cita, estado: 'PROGRAMADA' },
      data: { estado: 'CONFIRMADA', fecha_actualizacion: new Date() }
    });
    if (updated.count > 0) {
      await tx.notificacion.update({
        where: { id_notificacion: confirmation.id_notificacion },
        data: { estado: 'LEIDA', fecha_lectura: receivedAt }
      });
    }
    return {
      duplicate: false,
      confirmed: updated.count > 0,
      appointmentId: Number(confirmation.id_cita)
    };
  });

  return { processed: true, ...result };
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

// Ejecuta el envío por WhatsApp y persiste el intento (éxito o fallo) en la
// tabla `notificacion`, cualquiera sea el resultado informado por el
// proveedor (MED-216 / MED-228, PA-04 / PA-05).
async function sendAndRegister({ cita, tipo, mensaje, emitidoPorUserId }) {
  const telefono = assertValidPhone(cita.paciente);
  const resultadoEnvio = await whatsappService.sendMessage({ to: telefono, body: mensaje });

  const notificacion = await prisma.notificacion.create({
    data: {
      id_paciente: cita.paciente.id_paciente,
      id_cita: cita.id_cita,
      usuario_emisor: emitidoPorUserId ? BigInt(emitidoPorUserId) : null,
      tipo,
      direccion: 'SALIENTE',
      canal: 'WHATSAPP',
      telefono_destino: telefono,
      mensaje,
      fecha_envio: new Date(),
      estado: resultadoEnvio.success ? 'ENVIADA' : 'FALLIDA',
      proveedor_referencia: resultadoEnvio.providerReference || resultadoEnvio.errorMessage || null
    },
    select: notificationSelect
  });

  return {
    ...toNotification(notificacion),
    exito: resultadoEnvio.success,
    error: resultadoEnvio.success ? null : (resultadoEnvio.errorMessage || 'No fue posible enviar el mensaje por WhatsApp.')
  };
}

// ==========================================
// HU-24: Confirmación de cita por WhatsApp
// ==========================================

// Citas activas y futuras disponibles para solicitar una confirmación.
async function listConfirmationCandidates() {
  const citas = await prisma.cita.findMany({
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

  const citas = await prisma.cita.findMany({
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
  const yaEnviados = await prisma.notificacion.findMany({
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
    const existente = await prisma.notificacion.findFirst({
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
  processGreenApiIncomingNotification,
  listConfirmationCandidates,
  sendAppointmentConfirmation,
  listReminderCandidates,
  sendAppointmentReminder,
  runAppointmentReminders
};
