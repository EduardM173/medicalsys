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
  listConfirmationCandidates,
  sendAppointmentConfirmation,
  listReminderCandidates,
  sendAppointmentReminder,
  runAppointmentReminders
};
