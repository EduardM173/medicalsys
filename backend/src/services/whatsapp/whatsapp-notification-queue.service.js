const os = require('os');
const repository = require('../../repositories/notification.repository');
const whatsappService = require('./whatsapp.service');
const { buildConfirmationMessage, buildReminderMessage } = require('./appointment-message');
const { normalizeWhatsappPhone } = require('./phone');

const OUTBOUND_TYPES = ['CONFIRMACION_CITA', 'RECORDATORIO_CITA'];
const ACTIVE_APPOINTMENT_STATES = ['PROGRAMADA', 'CONFIRMADA'];
const PROCESSABLE_JOB_STATES = ['PENDIENTE', 'PROCESANDO'];

class NotificationQueueError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function positiveInteger(value, fallback, minimum = 1) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum ? parsed : fallback;
}

function configuredMaxAttempts() {
  return positiveInteger(process.env.WHATSAPP_MAX_ATTEMPTS, 5);
}

function configuredReminderMinutes() {
  return positiveInteger(process.env.WHATSAPP_REMINDER_MINUTES_BEFORE, 24 * 60, 0);
}

function configuredConfirmationDelayMinutes() {
  return positiveInteger(process.env.WHATSAPP_CONFIRMATION_DELAY_MINUTES, 0, 0);
}

function configuredLockMs() {
  return positiveInteger(process.env.WHATSAPP_JOB_LOCK_SECONDS, 15 * 60, 30) * 1000;
}

function retryDelayMs(attempt) {
  const base = positiveInteger(process.env.WHATSAPP_RETRY_BASE_SECONDS, 60, 1) * 1000;
  const ceiling = positiveInteger(process.env.WHATSAPP_RETRY_MAX_SECONDS, 60 * 60, 1) * 1000;
  return Math.min(base * (2 ** Math.max(0, attempt - 1)), ceiling);
}

function workerIdentity() {
  return process.env.WHATSAPP_WORKER_ID || `whatsapp-${os.hostname()}-${process.pid}`;
}

function parseJobId(value) {
  if (!/^\d+$/.test(String(value)) || BigInt(value) < 1n) {
    throw new NotificationQueueError(400, 'Identificador de notificación en cola no válido.');
  }
  return BigInt(value);
}

function shortError(value) {
  return String(value || 'No fue posible enviar el mensaje por WhatsApp.').slice(0, 2000);
}

function scheduledAtFor(cita, tipo, now) {
  if (tipo === 'CONFIRMACION_CITA') {
    return new Date(now.getTime() + configuredConfirmationDelayMinutes() * 60 * 1000);
  }
  const reminderAt = new Date(cita.fecha_hora_inicio.getTime() - configuredReminderMinutes() * 60 * 1000);
  return reminderAt.getTime() > now.getTime() ? reminderAt : now;
}

function idempotencyKey(cita, tipo) {
  return `CITA:${cita.id_cita.toString()}:${tipo}:${cita.fecha_hora_inicio.toISOString()}`;
}

function messageFor(cita, tipo) {
  return tipo === 'CONFIRMACION_CITA'
    ? buildConfirmationMessage(cita)
    : buildReminderMessage(cita);
}

function notificationDataFor(cita, tipo, emitidoPorUserId, now) {
  const fechaProgramada = scheduledAtFor(cita, tipo, now);
  let telefono = 'SIN_TELEFONO';
  let estado = 'PENDIENTE';
  let error = null;

  try {
    telefono = normalizeWhatsappPhone(cita.paciente.telefono);
  } catch (phoneError) {
    estado = 'FALLIDA';
    error = shortError(phoneError.message);
  }

  return {
    key: idempotencyKey(cita, tipo),
    citaId: cita.id_cita,
    jobData: {
      fecha_cita_programada: cita.fecha_hora_inicio,
      fecha_disponible: fechaProgramada,
      estado: estado === 'FALLIDA' ? 'FALLIDA' : 'PENDIENTE',
      intentos: 0,
      max_intentos: configuredMaxAttempts(),
      bloqueado_por: null,
      bloqueado_hasta: null,
      ultimo_error: error,
      fecha_procesada: estado === 'FALLIDA' ? now : null,
      fecha_actualizacion: now
    },
    notificationData: {
      id_paciente: cita.paciente.id_paciente,
      id_cita: cita.id_cita,
      usuario_emisor: emitidoPorUserId ? BigInt(emitidoPorUserId) : null,
      tipo,
      direccion: 'SALIENTE',
      canal: 'WHATSAPP',
      telefono_destino: telefono,
      mensaje: messageFor(cita, tipo),
      fecha_programada: fechaProgramada,
      fecha_envio: null,
      estado,
      proveedor_referencia: error,
      fecha_creacion: now
    }
  };
}

const jobInclude = {
  notificacion: {
    select: {
      id_notificacion: true,
      id_paciente: true,
      id_cita: true,
      tipo: true,
      telefono_destino: true,
      mensaje: true,
      fecha_programada: true,
      fecha_envio: true,
      fecha_entrega: true,
      fecha_lectura: true,
      estado: true,
      proveedor_referencia: true
    }
  },
  cita: {
    select: {
      id_cita: true,
      estado: true,
      fecha_hora_inicio: true,
      paciente: { select: { id_paciente: true, nombres: true, apellidos: true, telefono: true } },
      medico: { select: { id_medico: true, especialidad: true, usuario: { select: { nombres: true, apellidos: true } } } },
      servicio_medico: { select: { nombre: true } }
    }
  }
};

function toQueuedNotification(job) {
  const notification = job.notificacion;
  return {
    id: Number(notification.id_notificacion),
    queueId: Number(job.id_cola),
    citaId: Number(job.id_cita),
    tipo: notification.tipo,
    estado: notification.estado,
    estadoCola: job.estado,
    intentos: job.intentos,
    maxIntentos: job.max_intentos,
    fechaProgramada: notification.fecha_programada?.toISOString() || null,
    fechaDisponible: job.fecha_disponible.toISOString(),
    proveedorReferencia: notification.proveedor_referencia,
    ultimoError: job.ultimo_error
  };
}

/**
 * Se ejecuta dentro de la misma transacción que la creación/reprogramación de
 * la cita. Esto es el patrón outbox: si se confirma la cita en PostgreSQL,
 * también quedan confirmados los trabajos pendientes antes de responder HTTP.
 */
async function scheduleAppointmentNotifications(
  tx,
  cita,
  { emitidoPorUserId, types = OUTBOUND_TYPES, cancelStaleJobs = true } = {}
) {
  const now = new Date();
  const requestedTypes = [...new Set(types)].filter((type) => OUTBOUND_TYPES.includes(type));
  if (requestedTypes.length === 0) return [];

  const prepared = requestedTypes.map((type) => notificationDataFor(cita, type, emitidoPorUserId, now));
  const requestedKeys = prepared.map((item) => item.key);

  // Los trabajos de una fecha anterior no pueden sobrevivir a una reprogramación.
  if (cancelStaleJobs) {
    await tx.cola_notificacion.updateMany({
      where: {
        id_cita: cita.id_cita,
        estado: { in: PROCESSABLE_JOB_STATES },
        clave_idempotencia: { notIn: requestedKeys }
      },
      data: {
        estado: 'CANCELADA',
        bloqueado_por: null,
        bloqueado_hasta: null,
        fecha_actualizacion: now
      }
    });
  }

  const jobs = [];
  for (const item of prepared) {
    const job = await tx.cola_notificacion.upsert({
      where: { clave_idempotencia: item.key },
      create: {
        ...item.jobData,
        clave_idempotencia: item.key,
        cita: { connect: { id_cita: item.citaId } },
        notificacion: { create: item.notificationData }
      },
      update: {
        ...item.jobData,
        notificacion: { update: item.notificationData }
      },
      include: jobInclude
    });
    jobs.push(job);
  }
  return jobs;
}

async function cancelAppointmentNotificationJobs(tx, citaId, types = OUTBOUND_TYPES) {
  const now = new Date();
  return tx.cola_notificacion.updateMany({
    where: {
      id_cita: citaId,
      estado: { in: PROCESSABLE_JOB_STATES },
      notificacion: { tipo: { in: types } }
    },
    data: {
      estado: 'CANCELADA',
      bloqueado_por: null,
      bloqueado_hasta: null,
      fecha_actualizacion: now
    }
  });
}

async function scheduleNotificationForAppointment(cita, tipo, emitidoPorUserId, { runNow = false } = {}) {
  const key = idempotencyKey(cita, tipo);
  let job = await repository.cola_notificacion.findUnique({ where: { clave_idempotencia: key }, include: jobInclude });
  if (!job) {
    const jobs = await repository.transaction(async (tx) => scheduleAppointmentNotifications(tx, cita, {
      emitidoPorUserId,
      types: [tipo],
      cancelStaleJobs: false
    }));
    job = jobs[0];
  } else if (job.estado === 'FALLIDA' || job.estado === 'CANCELADA') {
    // Un trabajo previo fallido (p. ej. por un teléfono inválido en su
    // momento) no debe reciclarse tal cual: se recalculan teléfono y
    // mensaje contra los datos actuales del paciente/cita antes de
    // reintentar, igual que en un reintento manual desde "Fallos y
    // reintentos". Sin esto, corregir el teléfono del paciente nunca
    // surtía efecto porque siempre se devolvía el mismo registro viejo.
    const now = new Date();
    const { notificationData } = notificationDataFor(cita, tipo, emitidoPorUserId, now);
    const { fecha_creacion: _ignored, ...notificationUpdateData } = notificationData;

    await repository.transaction(async (tx) => {
      await tx.cola_notificacion.update({
        where: { id_cola: job.id_cola },
        data: {
          fecha_cita_programada: cita.fecha_hora_inicio,
          fecha_disponible: notificationData.fecha_programada,
          estado: notificationData.estado === 'FALLIDA' ? 'FALLIDA' : 'PENDIENTE',
          intentos: 0,
          max_intentos: configuredMaxAttempts(),
          bloqueado_por: null,
          bloqueado_hasta: null,
          ultimo_error: notificationData.proveedor_referencia,
          fecha_procesada: notificationData.estado === 'FALLIDA' ? now : null,
          fecha_actualizacion: now
        }
      });
      await tx.notificacion.update({
        where: { id_notificacion: job.id_notificacion },
        data: notificationUpdateData
      });
    });
    job = await repository.cola_notificacion.findUnique({ where: { id_cola: job.id_cola }, include: jobInclude });
  }
  if (!job) throw new NotificationQueueError(500, 'No fue posible programar la notificación.');

  if (runNow && job.estado === 'PENDIENTE') {
    const now = new Date();
    // No se toca un trabajo ya reclamado por otro worker. Esta condición es
    // importante para que un clic manual no reabra una entrega en curso.
    const expedited = await repository.cola_notificacion.updateMany({
      where: { id_cola: job.id_cola, estado: 'PENDIENTE' },
      data: { fecha_disponible: now, fecha_actualizacion: now },
    });
    if (expedited.count === 1) {
      job = await repository.cola_notificacion.findUnique({ where: { id_cola: job.id_cola }, include: jobInclude });
    }
  }
  return toQueuedNotification(job);
}

async function claimNextNotificationJob(workerId = workerIdentity(), now = new Date()) {
  // Recupera trabajos abandonados por un proceso caído. La actualización
  // condicional posterior es el bloqueo distribuido entre instancias.
  await repository.cola_notificacion.updateMany({
    where: { estado: 'PROCESANDO', bloqueado_hasta: { lt: now } },
    data: {
      estado: 'PENDIENTE',
      bloqueado_por: null,
      bloqueado_hasta: null,
      fecha_actualizacion: now
    }
  });

  const candidates = await repository.cola_notificacion.findMany({
    where: { estado: 'PENDIENTE', fecha_disponible: { lte: now } },
    orderBy: [{ fecha_disponible: 'asc' }, { id_cola: 'asc' }],
    take: 10,
    select: { id_cola: true }
  });

  const lockUntil = new Date(now.getTime() + configuredLockMs());
  for (const candidate of candidates) {
    const locked = await repository.cola_notificacion.updateMany({
      where: {
        id_cola: candidate.id_cola,
        estado: 'PENDIENTE',
        fecha_disponible: { lte: now }
      },
      data: {
        estado: 'PROCESANDO',
        bloqueado_por: workerId,
        bloqueado_hasta: lockUntil,
        intentos: { increment: 1 },
        fecha_actualizacion: now
      }
    });
    if (locked.count !== 1) continue;

    return repository.cola_notificacion.findUnique({
      where: { id_cola: candidate.id_cola },
      include: jobInclude
    });
  }
  return null;
}

function appointmentCanReceive(job) {
  const cita = job.cita;
  return ACTIVE_APPOINTMENT_STATES.includes(cita.estado)
    && cita.fecha_hora_inicio.getTime() === job.fecha_cita_programada.getTime()
    && cita.fecha_hora_inicio.getTime() > Date.now();
}

async function withLeaseRenewal(job, workerId, action) {
  const lockMs = configuredLockMs();
  const timer = setInterval(() => {
    const now = new Date();
    void repository.cola_notificacion.updateMany({
      where: { id_cola: job.id_cola, estado: 'PROCESANDO', bloqueado_por: workerId },
      data: { bloqueado_hasta: new Date(now.getTime() + lockMs), fecha_actualizacion: now }
    });
  }, Math.max(10000, Math.floor(lockMs / 3)));
  timer.unref?.();
  try {
    return await action();
  } finally {
    clearInterval(timer);
  }
}

async function cancelClaimedJob(job, workerId, reason) {
  const now = new Date();
  await repository.cola_notificacion.updateMany({
    where: { id_cola: job.id_cola, estado: 'PROCESANDO', bloqueado_por: workerId },
    data: {
      estado: 'CANCELADA',
      bloqueado_por: null,
      bloqueado_hasta: null,
      ultimo_error: reason,
      fecha_procesada: now,
      fecha_actualizacion: now
    }
  });
}

async function completeSuccessfulJob(job, workerId, providerReference) {
  const now = new Date();
  return repository.transaction(async (tx) => {
    const completed = await tx.cola_notificacion.updateMany({
      where: { id_cola: job.id_cola, estado: 'PROCESANDO', bloqueado_por: workerId },
      data: {
        estado: 'ENVIADA',
        bloqueado_por: null,
        bloqueado_hasta: null,
        ultimo_error: null,
        fecha_procesada: now,
        fecha_actualizacion: now
      }
    });
    if (completed.count !== 1) return false;
    await tx.notificacion.update({
      where: { id_notificacion: job.id_notificacion },
      data: {
        estado: 'ENVIADA',
        fecha_envio: now,
        proveedor_referencia: providerReference || null
      }
    });
    return true;
  });
}

async function completeFailedJob(job, workerId, errorMessage) {
  const now = new Date();
  const exhausted = job.intentos >= job.max_intentos;
  const nextAttempt = exhausted ? null : new Date(now.getTime() + retryDelayMs(job.intentos));
  return repository.transaction(async (tx) => {
    const completed = await tx.cola_notificacion.updateMany({
      where: { id_cola: job.id_cola, estado: 'PROCESANDO', bloqueado_por: workerId },
      data: exhausted ? {
        estado: 'FALLIDA',
        bloqueado_por: null,
        bloqueado_hasta: null,
        ultimo_error: shortError(errorMessage),
        fecha_procesada: now,
        fecha_actualizacion: now
      } : {
        estado: 'PENDIENTE',
        fecha_disponible: nextAttempt,
        bloqueado_por: null,
        bloqueado_hasta: null,
        ultimo_error: shortError(errorMessage),
        fecha_actualizacion: now
      }
    });
    if (completed.count !== 1) return { updated: false, exhausted };
    await tx.notificacion.update({
      where: { id_notificacion: job.id_notificacion },
      data: {
        estado: exhausted ? 'FALLIDA' : 'PENDIENTE',
        fecha_envio: now,
        proveedor_referencia: shortError(errorMessage)
      }
    });
    return { updated: true, exhausted, nextAttempt };
  });
}

async function processClaimedNotificationJob(job, workerId = workerIdentity()) {
  if (!job || job.estado !== 'PROCESANDO' || job.bloqueado_por !== workerId) {
    return { processed: false, reason: 'not_claim_owner' };
  }

  if (!appointmentCanReceive(job)) {
    await cancelClaimedJob(job, workerId, 'La cita fue cancelada, reprogramada o ya no admite notificaciones.');
    return { processed: false, cancelled: true, jobId: Number(job.id_cola) };
  }

  let result;
  try {
    result = await withLeaseRenewal(job, workerId, () => whatsappService.sendMessage({
      to: job.notificacion.telefono_destino,
      body: job.notificacion.mensaje
    }));
  } catch (error) {
    result = { success: false, errorMessage: error.message || 'Error inesperado del proveedor de WhatsApp.' };
  }

  if (result?.success) {
    const completed = await completeSuccessfulJob(job, workerId, result.providerReference);
    return { processed: completed, sent: completed, jobId: Number(job.id_cola) };
  }

  const failed = await completeFailedJob(job, workerId, result?.errorMessage);
  return {
    processed: failed.updated,
    sent: false,
    exhausted: failed.exhausted,
    retryAt: failed.nextAttempt?.toISOString() || null,
    jobId: Number(job.id_cola)
  };
}

async function processNextNotificationJob(workerId = workerIdentity()) {
  const job = await claimNextNotificationJob(workerId);
  if (!job) return { processed: false, reason: 'empty' };
  return processClaimedNotificationJob(job, workerId);
}

async function listFailedNotificationJobs() {
  const jobs = await repository.cola_notificacion.findPage({
    where: { estado: 'FALLIDA' },
    orderBy: [{ fecha_actualizacion: 'desc' }, { id_cola: 'desc' }],
    include: jobInclude
  });
  return jobs.map((job) => ({
    ...toQueuedNotification(job),
    paciente: {
      id: Number(job.cita.paciente.id_paciente),
      nombre: `${job.cita.paciente.nombres} ${job.cita.paciente.apellidos}`.trim()
    },
    cita: { fechaHoraInicio: job.cita.fecha_hora_inicio.toISOString(), estado: job.cita.estado }
  }));
}

async function retryFailedNotificationJob(jobIdInput) {
  const jobId = parseJobId(jobIdInput);
  const now = new Date();
  return repository.transaction(async (tx) => {
    const existing = await tx.cola_notificacion.findUnique({ where: { id_cola: jobId }, include: jobInclude });
    if (!existing || existing.estado !== 'FALLIDA') {
      throw new NotificationQueueError(409, 'La notificación no está en estado FALLIDA o ya fue reintentada.');
    }

    // El teléfono pudo haberse corregido después de que el trabajo se creó,
    // así que se recalcula contra el dato actual del paciente en lugar de
    // reutilizar el que quedó guardado (posiblemente inválido) en su momento.
    let telefono;
    try {
      telefono = normalizeWhatsappPhone(existing.cita.paciente.telefono);
    } catch (phoneError) {
      throw new NotificationQueueError(
        409,
        `El paciente sigue sin un número de teléfono válido: ${phoneError.message}`
      );
    }

    const retried = await tx.cola_notificacion.updateMany({
      where: { id_cola: jobId, estado: 'FALLIDA' },
      data: {
        estado: 'PENDIENTE',
        intentos: 0,
        bloqueado_por: null,
        bloqueado_hasta: null,
        ultimo_error: null,
        fecha_procesada: null,
        fecha_disponible: now,
        fecha_actualizacion: now
      }
    });
    if (retried.count !== 1) {
      throw new NotificationQueueError(409, 'La notificación no está en estado FALLIDA o ya fue reintentada.');
    }
    await tx.notificacion.update({
      where: { id_notificacion: existing.id_notificacion },
      data: {
        estado: 'PENDIENTE',
        telefono_destino: telefono,
        mensaje: messageFor(existing.cita, existing.notificacion.tipo),
        fecha_envio: null,
        proveedor_referencia: null
      }
    });
    const job = await tx.cola_notificacion.findUnique({ where: { id_cola: jobId }, include: jobInclude });
    return toQueuedNotification(job);
  });
}

/** Registra un fallo asíncrono de entrega informado por Green API. */
async function retryAfterDeliveryFailure(notificationId, errorMessage, occurredAt = new Date()) {
  return repository.transaction(async (tx) => {
    const job = await tx.cola_notificacion.findUnique({ where: { id_notificacion: notificationId } });
    if (!job || job.estado !== 'ENVIADA') return { updated: false, exhausted: false };

    const exhausted = job.intentos >= job.max_intentos;
    const nextAttempt = exhausted ? null : new Date(occurredAt.getTime() + retryDelayMs(job.intentos));
    await tx.cola_notificacion.update({
      where: { id_cola: job.id_cola },
      data: exhausted ? {
        estado: 'FALLIDA', ultimo_error: shortError(errorMessage), fecha_procesada: occurredAt,
        fecha_actualizacion: occurredAt
      } : {
        estado: 'PENDIENTE', fecha_disponible: nextAttempt, ultimo_error: shortError(errorMessage),
        fecha_actualizacion: occurredAt
      }
    });
    return { updated: true, exhausted, nextAttempt };
  });
}

module.exports = {
  NotificationQueueError,
  configuredMaxAttempts,
  retryDelayMs,
  workerIdentity,
  scheduleAppointmentNotifications,
  cancelAppointmentNotificationJobs,
  scheduleNotificationForAppointment,
  claimNextNotificationJob,
  processClaimedNotificationJob,
  processNextNotificationJob,
  listFailedNotificationJobs,
  retryFailedNotificationJob,
  retryAfterDeliveryFailure
};
