const crypto = require('crypto');

/**
 * MedicalSys - Servicio criptográfico (HU-31)
 *
 * Implementa cifrado autenticado AES-256-GCM sobre datos clínicos (MED-298,
 * MED-299, MED-300):
 *  - IV único e impredecible de 12 bytes por operación (PA-02).
 *  - Formato persistido con prefijo de versión:
 *      v1:iv_hex:authTag_hex:ciphertext_hex
 *  - Verificación del authTag en descifrado (PA-03).
 *  - Índices ciegos HMAC-SHA256 para búsquedas exactas (MED-299).
 *  - Rotación y versionado de claves con soporte de claves antiguas (PA-08).
 *  - Cifrado de archivos/documentos (PA-06).
 *
 * La configuración se lee de las variables de entorno (ENCRYPTION_KEYS,
 * CURRENT_KEY_VERSION, BLIND_INDEX_SECRET) o se inyecta explícitamente con
 * configure() para pruebas.
 */

class CryptoConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CryptoConfigError';
    this.statusCode = 500;
  }
}

class CryptoIntegrityError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CryptoIntegrityError';
    this.statusCode = 422;
    this.code = 'CRYPTO_INTEGRITY';
  }
}

let injected = {
  encryptionKeys: null,
  currentKeyVersion: null,
  blindIndexSecret: null
};

const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const FILE_HEADER_PREFIX = 'MSEC';
const FILE_HEADER_SEPARATOR = '|';
const ENCRYPTED_PATTERN = /^v(\d+):([0-9a-f]{24}):([0-9a-f]{32}):([0-9a-f]*)$/;

function resolveEntries() {
  if (injected.encryptionKeys && injected.currentKeyVersion) {
    return injected;
  }

  const raw = process.env.ENCRYPTION_KEYS;
  const currentKeyVersion = process.env.CURRENT_KEY_VERSION;
  const blindIndexSecret = process.env.BLIND_INDEX_SECRET;

  if (!raw || !currentKeyVersion) {
    throw new CryptoConfigError(
      'Configuración de cifrado incompleta: defina ENCRYPTION_KEYS y CURRENT_KEY_VERSION.'
    );
  }

  let encryptionKeys;
  try {
    encryptionKeys = JSON.parse(raw);
  } catch (_error) {
    throw new CryptoConfigError('ENCRYPTION_KEYS no es un JSON válido.');
  }

  return { encryptionKeys, currentKeyVersion, blindIndexSecret };
}

function configure(options = {}) {
  if (Object.prototype.hasOwnProperty.call(options, 'encryptionKeys')) {
    injected.encryptionKeys = options.encryptionKeys;
  }
  if (Object.prototype.hasOwnProperty.call(options, 'currentKeyVersion')) {
    injected.currentKeyVersion = options.currentKeyVersion;
  }
  if (Object.prototype.hasOwnProperty.call(options, 'blindIndexSecret')) {
    injected.blindIndexSecret = options.blindIndexSecret;
  }
  return { ...injected };
}

function getKey(version) {
  const entries = resolveEntries();
  const lookup = version.startsWith('v') ? version : `v${version}`;
  const keyHex = entries.encryptionKeys[lookup];
  if (!keyHex) {
    throw new CryptoConfigError(`No existe una clave de cifrado para la versión «${lookup}».`);
  }
  const key = Buffer.from(String(keyHex), 'hex');
  if (key.length !== KEY_BYTES) {
    throw new CryptoConfigError(
      `La clave «${version}» debe tener exactamente ${KEY_BYTES} bytes (${KEY_BYTES * 2} caracteres hex).`
    );
  }
  return key;
}

function getBlindIndexSecret() {
  const entries = resolveEntries();
  if (!entries.blindIndexSecret) {
    throw new CryptoConfigError('BLIND_INDEX_SECRET no está configurado.');
  }
  return String(entries.blindIndexSecret);
}

function currentVersion() {
  return resolveEntries().currentKeyVersion;
}

/**
 * Cifra texto plano con AES-256-GCM (PA-02: dos cifrados del mismo texto
 * producen salidas distintas porque cada operación usa un IV aleatorio).
 */
function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined) return null;
  const value = String(plaintext);
  const version = currentVersion();
  const key = getKey(version);
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${version}:${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/**
 * Descifra y verifica la integridad autenticada (PA-03). Si el texto fue
 * alterado (ciphertext o authTag), lanza CryptoIntegrityError.
 */
function decrypt(payload) {
  if (payload === null || payload === undefined) return null;
  const value = String(payload);
  const match = ENCRYPTED_PATTERN.exec(value);
  if (!match) {
    throw new CryptoIntegrityError('El dato no presenta un formato de cifrado válido.');
  }

  const [, version, ivHex, tagHex, ciphertextHex] = match;
  const key = getKey(version);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch (_error) {
    throw new CryptoIntegrityError(
      'El dato fue alterado o no corresponde a la clave de cifrado vigente.'
    );
  }
}

/**
 * Indica si una cadena persistida está cifrada (prefijo de versión).
 * Las cadenas legadas sin prefijo se conservan tal cual (migración).
 */
function isEncrypted(payload) {
  return typeof payload === 'string' && /^v\d+:/.test(payload);
}

/**
 * Índice ciego HMAC-SHA256 para búsquedas exactas (ej. CI, diagnósticos)
 * sin necesidad de descifrar la base de datos completa (MED-299).
 */
function generateBlindIndex(text) {
  if (text === null || text === undefined || text === '') return null;
  return crypto
    .createHmac('sha256', getBlindIndexSecret())
    .update(String(text))
    .digest('hex');
}

/**
 * Rotación de claves: descifra con la versión original (claves antiguas
 * disponibles en ENCRYPTION_KEYS) y vuelve a cifrar con la versión activa
 * (MED-300 / PA-08).
 */
function reencryptValue(payload) {
  if (payload === null || payload === undefined) return null;
  return encrypt(decrypt(payload));
}

const FILE_HEADER_PATTERN = /^MSEC\|(v\d+)\|([0-9a-f]{24})\|([0-9a-f]{32})\|/;

/**
 * Cifra el contenido de un archivo (PDF, imagen, DICOM, etc.) con AES-256-GCM.
 * El resultado comienza con el encabezado MSEC y NO es legible como PDF/imagen
 * estándar fuera de MedicalSys (PA-06).
 */
function encryptBuffer(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('encryptBuffer espera un Buffer.');
  }
  const version = currentVersion();
  const key = getKey(version);
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const header = Buffer.from(
    `${FILE_HEADER_PREFIX}${FILE_HEADER_SEPARATOR}${version}${FILE_HEADER_SEPARATOR}` +
      `${iv.toString('hex')}${FILE_HEADER_SEPARATOR}${authTag.toString('hex')}${FILE_HEADER_SEPARATOR}`,
    'utf8'
  );
  return Buffer.concat([header, ciphertext]);
}

/**
 * Descifra un archivo cifrado con encryptBuffer. Si el buffer no contiene el
 * encabezado MSEC (archivo heredado guardado en claro), se devuelve sin cambios.
 */
function decryptBuffer(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('decryptBuffer espera un Buffer.');
  }
  const headerText = buffer.slice(0, 128).toString('utf8');
  const match = FILE_HEADER_PATTERN.exec(headerText);
  if (!match) return buffer;

  const [, version, ivHex, tagHex] = match;
  const headerLength = Buffer.byteLength(match[0], 'utf8');
  const key = getKey(version);
  const ciphertext = buffer.subarray(headerLength);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch (_error) {
    throw new CryptoIntegrityError(
      'El archivo fue alterado o no corresponde a la clave de cifrado vigente.'
    );
  }
}

module.exports = {
  CryptoConfigError,
  CryptoIntegrityError,
  configure,
  decrypt,
  decryptBuffer,
  encrypt,
  encryptBuffer,
  generateBlindIndex,
  isEncrypted,
  reencryptValue
};