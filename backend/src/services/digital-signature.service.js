const crypto = require('crypto');

/**
 * HU-33 / MED-310: Firma digital PKI para consentimientos informados.
 *
 * La criptografía es la nativa de Node.js (crypto). El servicio valida el
 * certificado digital X.509 del firmante (emisor, número de serie, periodo de
 * vigencia y, opcionalmente, huella contra un ancla de confianza), vincula la
 * firma al hash SHA-256 del PDF completo y verifica firmas de forma
 * independiente.
 *
 * Configuración:
 *   - CERTIFICATE_AUTHORITY_ALLOWLIST: lista separada por comas de CN de emisores
 *     aceptados (ej: "ADSIB").
 *   - CERTIFICATE_TRUST_ANCHOR_PEM: opcional, PEM del certificado raíz de confianza.
 *   - Una llamada a configure() sobreescribe estos valores (usado en las pruebas).
 */

class SignatureError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = 'SignatureError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

let injected = null;

function resolveOptions() {
  if (injected) return injected;
  const allowlist = process.env.CERTIFICATE_AUTHORITY_ALLOWLIST || '';
  return {
    trustedIssuerCNs: allowlist.split(',').map((item) => item.trim()).filter(Boolean),
    trustAnchorPem: process.env.CERTIFICATE_TRUST_ANCHOR_PEM || null
  };
}

function configure(options = {}) {
  injected = {
    trustedIssuerCNs: options.trustedIssuerCNs
      ? [...options.trustedIssuerCNs]
      : (options.allowedIssuer ? [options.allowedIssuer] : null),
    trustAnchorPem: options.trustAnchorPem || null
  };
  return { ...injected };
}

/**
 * Extrae el primer CN de una cadena de asunto/emisor X.509 (ej: "CN=ADSIB, O=X").
 */
function extractCN(subject) {
  const match = /(?:^|,\s*)CN=([^,\n]+)/.exec(String(subject));
  if (!match) return null;
  // Los CN suelen ir citados: "CN=ADSIB CA" o CN="ADSIB CA".
  return match[1].replace(/^"|"$/g, '').trim();
}

const MONTHS = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
};

/**
 * Convierte el formato asctime de Node (ej: "Apr 24 13:45:22 2033 GMT") a Date.
 */
function parseAsctime(value) {
  const match = /^(\w{3})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s+(\d{4})\s+GMT$/i.exec(String(value));
  if (!match) return null;
  const [, mon, day, hh, mm, ss, year] = match;
  return new Date(Date.UTC(Number(year), MONTHS[mon], Number(day), Number(hh), Number(mm), Number(ss)));
}

function parseCertificate(certificatePem) {
  if (typeof certificatePem !== 'string' || !certificatePem.includes('BEGIN CERTIFICATE')) {
    throw new SignatureError(400, 'ERROR_SIGNATURE_CERTIFICATE', 'El certificado digital no es un X.509 PEM válido.');
  }
  let cert;
  try {
    cert = new crypto.X509Certificate(certificatePem);
  } catch (_error) {
    throw new SignatureError(400, 'ERROR_SIGNATURE_CERTIFICATE', 'El certificado digital no es un X.509 PEM válido.');
  }
  return cert;
}

/**
 * Valida el certificado X.509 del firmante:
 *  - estructura parseable,
 *  - emisor dentro de la lista de autoridades aceptadas,
 *  - periodo de vigencia cubre el momento actual,
 *  - (opcional) verificación de cadena contra el ancla de confianza.
 */
function validateCertificate(certificatePem) {
  const cert = parseCertificate(certificatePem);
  const options = resolveOptions();

  const issuer = cert.issuer;
  const issuerCN = extractCN(issuer);
  const serialNumber = cert.serialNumber;

  if (options.trustedIssuerCNs.length > 0 && !options.trustedIssuerCNs.includes(issuerCN)) {
    throw new SignatureError(
      400,
      'ERROR_SIGNATURE_ISSUER',
      `El emisor del certificado («${issuerCN}») no está autorizado para firmar consentimientos.`
    );
  }

  const validFrom = parseAsctime(cert.validFrom);
  const validTo = parseAsctime(cert.validTo);
  const now = new Date();
  if (!validFrom || !validTo) {
    throw new SignatureError(400, 'ERROR_SIGNATURE_VALIDITY', 'No fue posible determinar la vigencia del certificado.');
  }
  if (now < validFrom) {
    throw new SignatureError(
      400,
      'ERROR_SIGNATURE_EXPIRED',
      'El certificado digital aún no es válido (notBefore).'
    );
  }
  if (now > validTo) {
    throw new SignatureError(
      400,
      'ERROR_SIGNATURE_EXPIRED',
      `El certificado digital está vencido desde ${validTo.toISOString()}.`
    );
  }

  if (options.trustAnchorPem) {
    let anchor;
    try {
      anchor = new crypto.X509Certificate(options.trustAnchorPem);
    } catch (_error) {
      anchor = null;
    }
    if (anchor) {
      const chainValid = anchor.verify(cert.publicKey) || (cert.subject === anchor.subject && cert.verify(anchor.publicKey));
      if (!chainValid) {
        throw new SignatureError(
          400,
          'ERROR_SIGNATURE_CHAIN',
          'La cadena de confianza del certificado no pudo verificarse con el ancla configurada.'
        );
      }
    }
  }

  return {
    subject: cert.subject,
    issuer,
    issuerCN,
    serialNumber,
    validFrom: validFrom.toISOString(),
    validTo: validTo.toISOString(),
    publicKey: cert.publicKey
  };
}

/**
 * Aplica la firma con la clave privada del certificado sobre el digest del PDF.
 * La clave privada vive en el dispositivo/HSM del firmante; el servidor nunca
 * la almacena, solo verifica con la clave pública del certificado.
 */
function signDigest(privateKeyPem, digestHex) {
  if (typeof digestHex !== 'string' || !/^[0-9a-f]{64}$/i.test(digestHex)) {
    throw new SignatureError(400, 'ERROR_SIGNATURE_DIGEST', 'El digest a firmar debe ser un SHA-256 en hexadecimal.');
  }
  try {
    const signature = crypto.sign('sha256', Buffer.from(digestHex, 'utf8'), privateKeyPem);
    return signature.toString('hex');
  } catch (_error) {
    throw new SignatureError(400, 'ERROR_SIGNATURE_PRIVATE_KEY', 'No fue posible firmar con la clave privada proporcionada.');
  }
}

/**
 * Verifica la firma criptográfica sobre el hash del documento usando la
 * clave pública del certificado (PA-04 / PA-05).
 */
function verifySignature(certificatePem, digestHex, signatureHex) {
  const cert = parseCertificate(certificatePem);
  if (typeof digestHex !== 'string' || !/^[0-9a-f]{64}$/i.test(digestHex)) {
    throw new SignatureError(400, 'ERROR_SIGNATURE_DIGEST', 'El digest a verificar debe ser un SHA-256 en hexadecimal.');
  }
  if (typeof signatureHex !== 'string' || !/^[0-9a-f]+$/i.test(signatureHex)) {
    return false;
  }
  try {
    return crypto.verify(
      'sha256',
      Buffer.from(digestHex, 'utf8'),
      cert.publicKey,
      Buffer.from(signatureHex, 'hex')
    );
  } catch (_error) {
    return false;
  }
}

module.exports = {
  SignatureError,
  configure,
  extractCN,
  parseAsctime,
  signDigest,
  validateCertificate,
  verifySignature
};