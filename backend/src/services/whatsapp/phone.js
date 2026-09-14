const phonePattern = /^\+?\d{7,15}$/;

class WhatsappPhoneError extends Error {}

function normalizeWhatsappPhone(value) {
  const rawPhone = typeof value === 'string' ? value.trim() : '';
  if (!rawPhone) {
    throw new WhatsappPhoneError(
      'El paciente no cuenta con un número de teléfono válido para enviar la notificación por WhatsApp.'
    );
  }

  // Se toleran los formatos que la gente suele escribir a mano: espacios,
  // guiones, puntos o paréntesis alrededor del número (ej. "+591 67131556",
  // "591-67131556", "(591) 6713-1556").
  let cleaned = rawPhone.replace(/[\s\-.()]/g, '');

  // Algunas personas anteponen "00" en vez de "+" para el prefijo internacional.
  if (cleaned.startsWith('00')) {
    cleaned = `+${cleaned.slice(2)}`;
  }

  if (!phonePattern.test(cleaned)) {
    throw new WhatsappPhoneError(
      'El paciente no cuenta con un número de teléfono válido para enviar la notificación por WhatsApp.'
    );
  }

  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // Ya incluye el código de país de Bolivia (591) pero sin el "+" adelante.
  if (cleaned.startsWith('591') && cleaned.length > 8) {
    return `+${cleaned}`;
  }

  return `+591${cleaned.replace(/^0+/, '')}`;
}

module.exports = { WhatsappPhoneError, normalizeWhatsappPhone };