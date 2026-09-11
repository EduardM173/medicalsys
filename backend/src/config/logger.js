/**
 * MedicalSys - Logger centralizado con sanitización de datos sensibles
 * (HU-31 / MED-301 / PA-07).
 *
 * Enmascara los campos sensibles (antecedentes, alergias, token, key,
 * password, authorization, secret, contenido clínico, etc.) antes de escribir
 * en consola o disco, evitando que claves de cifrado o datos clínicos se
 * filtren en los registros.
 */

const SENSITIVE_TOKENS = [
  'password',
  'contrasena',
  'passwd',
  'pwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'key_version',
  'encryptionkeys',
  'encryption_keys',
  'blindindex',
  'blind_index',
  'antecedentes',
  'alergias',
  'alergies',
  'condiciones_cronicas',
  'diagnostico',
  'tratamiento',
  'observaciones',
  'anamnesis',
  'contenido',
  'content',
  'indicaciones',
  'mensaje_clinico',
  'notas_clinicas'
];

const REDACTED = '[REDACTED]';
const MAX_DEPTH = 12;

function isSensitiveKey(key) {
  if (typeof key !== 'string') return false;
  const normalized = key.toLowerCase().replace(/_/g, '');
  return SENSITIVE_TOKENS.some((token) => normalized.includes(token));
}

function sanitize(input, depth = 0) {
  if (depth > MAX_DEPTH) return REDACTED;
  if (input instanceof Error) {
    return sanitize({ name: input.name, message: input.message, stack: input.stack }, depth + 1);
  }
  if (Array.isArray(input)) {
    return input.map((item) => sanitize(item, depth + 1));
  }
  if (input === null || input === undefined) return input;
  if (typeof input === 'object') {
    const output = {};
    for (const [key, value] of Object.entries(input)) {
      output[key] = isSensitiveKey(key) ? REDACTED : sanitize(value, depth + 1);
    }
    return output;
  }
  if (typeof input === 'string' && input.length > 4000) {
    return `${input.slice(0, 4000)}…[truncado]`;
  }
  return input;
}

function write(level, args) {
  const safeArgs = args.map((arg) => sanitize(arg));
  if (level === 'error') console.error(...safeArgs);
  else if (level === 'warn') console.warn(...safeArgs);
  else console.log(...safeArgs);
}

const logger = {
  info: (...args) => write('info', args),
  warn: (...args) => write('warn', args),
  error: (...args) => write('error', args)
};

module.exports = { REDACTED, isSensitiveKey, logger, sanitize };