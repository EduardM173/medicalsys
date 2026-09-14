const repository = require('../repositories/clinical-message.repository');

class ClinicalMessageError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function parseId(value, entity) {
  if (!/^\d+$/.test(String(value)) || BigInt(value) < 1n) {
    throw new ClinicalMessageError(400, `Identificador de ${entity} no válido.`);
  }
  return BigInt(value);
}

function requiredText(value, fieldName, maxLength) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    throw new ClinicalMessageError(400, `${fieldName} es obligatorio.`);
  }
  if (normalized.length > maxLength) {
    throw new ClinicalMessageError(400, `${fieldName} supera la longitud permitida.`);
  }
  return normalized;
}

function toMessage(message) {
  return {
    id: Number(message.id_mensaje),
    historiaId: Number(message.id_historia),
    medicoId: Number(message.id_medico),
    destinatarioRole: message.destinatario_role || null,
    contenido: message.contenido,
    fechaEnvio: message.fecha_envio.toISOString()
  };
}

/**
 * HU-31 / MED-298: envía un mensaje clínico asociado a una historia clínica.
 * El contenido queda cifrado en repositorio (contenido de mensaje clínico).
 */
async function sendMessage({ userId, historyId, contenido, destinatarioRole }) {
  const parsedHistoryId = parseId(historyId, 'historia clínica');

  const [doctor, history] = await Promise.all([
    repository.medico.findUnique({
      where: { id_usuario: BigInt(userId) },
      select: { id_medico: true, usuario: { select: { nombres: true, apellidos: true } } }
    }),
    repository.historia_clinica.findUnique({
      where: { id_historia: parsedHistoryId },
      select: { id_historia: true }
    })
  ]);

  if (!doctor) {
    throw new ClinicalMessageError(403, 'El usuario autenticado no posee un perfil médico asociado.');
  }
  if (!history) {
    throw new ClinicalMessageError(404, 'Historia clínica no encontrada.');
  }

  const content = requiredText(contenido, 'El contenido del mensaje', 20000);
  const role = typeof destinatarioRole === 'string' && destinatarioRole.trim()
    ? destinatarioRole.trim().slice(0, 50)
    : null;

  const message = await repository.mensaje_clinico.create({
    data: {
      id_historia: parsedHistoryId,
      id_medico: doctor.id_medico,
      destinatario_role: role,
      contenido: content,
      fecha_envio: new Date()
    }
  });

  return toMessage(message);
}

/**
 * Lista los mensajes clínicos de una historia clínica (descifrados).
 */
async function listMessages(historyId) {
  const parsedHistoryId = parseId(historyId, 'historia clínica');
  const messages = await repository.mensaje_clinico.findMany({
    where: { id_historia: parsedHistoryId },
    orderBy: { fecha_envio: 'desc' }
  });
  return messages.map(toMessage);
}

module.exports = {
  ClinicalMessageError,
  listMessages,
  sendMessage
};