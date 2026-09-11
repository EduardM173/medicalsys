const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const path = require('path');
const { Readable } = require('stream');
const express = require('express');
const forge = require('node-forge');

/**
 * HU-33 - Generar y firmar digitalmente consentimientos informados (PKI).
 *
 * Cubre PA-01 a PA-10. La criptografía es REAL:
 *   - PDF real con pdf-lib (vista previa e inmutable, MED-309).
 *   - Certificados X.509 reales (node-forge) y verificación con la librería
 *     nativa crypto de Node (crypto.X509Certificate + sign/verify RSA SHA-256).
 *   - Firmas RSA reales (SHA256withRSA) sobre el SHA-256 del PDF completo.
 * Únicamente se simulan los adaptadores de persistencia (Prisma) y de
 * almacenamiento de archivos, igual que en el resto de las suites del repo.
 */

// ---------------------------------------------------------------------------
// Configuración criptográfica de prueba.
// ---------------------------------------------------------------------------
const KEY_V1 = '3a9f8b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a';
const BLIND_SECRET = 'f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7';

const cryptoService = require('../../src/services/crypto.service');
cryptoService.configure({
  encryptionKeys: { v1: KEY_V1 },
  currentKeyVersion: 'v1',
  blindIndexSecret: BLIND_SECRET
});

const digitalSignature = require('../../src/services/digital-signature.service');
digitalSignature.configure({ trustedIssuerCNs: ['TEST-ADSIB-CA'] });

// ---------------------------------------------------------------------------
// Adaptador de persistencia simulado (estilo del resto de la suite).
// ---------------------------------------------------------------------------
const PK_NAMES = {
  usuario: 'id_usuario',
  paciente: 'id_paciente',
  medico: 'id_medico',
  cita: 'id_cita',
  plantilla_consentimiento: 'id_plantilla',
  consentimiento_informado: 'id_consentimiento',
  firma_digital_consentimiento: 'id_firma',
  anulacion_consentimiento: 'id_anulacion'
};
const REQUIRED_MODELS = Object.keys(PK_NAMES);

function matchesWhere(record, where) {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (key === 'AND' && Array.isArray(cond)) {
      if (!cond.every((item) => matchesWhere(record, item))) return false;
      continue;
    }
    if (key === 'OR' && Array.isArray(cond)) {
      if (!cond.some((item) => matchesWhere(record, item))) return false;
      continue;
    }
    if (key === 'NOT') {
      if (matchesWhere(record, cond)) return false;
      continue;
    }
    if (record[key] === undefined) return false;
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      if (Object.prototype.hasOwnProperty.call(cond, 'in')) {
        if (!cond.in.some((val) => String(val) === String(record[key]))) return false;
      } else if (Object.prototype.hasOwnProperty.call(cond, 'equals')) {
        if (String(record[key]) !== String(cond.equals)) return false;
      } else if (Object.prototype.hasOwnProperty.call(cond, 'not')) {
        if (String(record[key]) === String(cond.not)) return false;
      } else if (String(record[key]) !== String(cond)) {
        return false;
      }
    } else if (cond instanceof Date) {
      if (new Date(record[key]).getTime() !== cond.getTime()) return false;
    } else if (String(record[key]) !== String(cond)) {
      return false;
    }
  }
  return true;
}

function project(record, select) {
  if (!select) return record;
  if (record === null || record === undefined) return record;
  const output = {};
  for (const [key, spec] of Object.entries(select)) {
    if (record[key] === undefined) continue;
    if (spec === true) { output[key] = record[key]; continue; }
    if (Array.isArray(record[key])) {
      const childSpec = spec?.select || spec?.include || spec;
      if (childSpec && typeof childSpec === 'object') {
        output[key] = record[key].map((child) => project(child, childSpec.select || childSpec));
      } else {
        output[key] = record[key];
      }
      continue;
    }
    if (record[key] && typeof record[key] === 'object' && spec && typeof spec === 'object') {
      output[key] = project(record[key], spec.select || spec);
      continue;
    }
    output[key] = record[key];
  }
  return output;
}

function cloneRecord(record) {
  const cloned = {};
  for (const [key, value] of Object.entries(record)) {
    cloned[key] = value instanceof Date ? new Date(value) : value;
  }
  return cloned;
}

const DEFAULT_TIMESTAMPS = {
  plantilla_consentimiento: ['fecha_creacion', 'fecha_actualizacion'],
  consentimiento_informado: ['fecha_generacion'],
  firma_digital_consentimiento: ['fecha_firma'],
  anulacion_consentimiento: ['fecha_anulacion']
};

function contractFor(tables, tableName) {
  const table = tables[tableName];
  const pk = PK_NAMES[tableName];

  // Hidrata las relaciones aplanadas que Prisma resolvería con JOINS, para
  // que los selects con relaciones (consentSelect) funcionen de forma realista.
  const joinRelations = (record) => {
    if (tableName !== 'consentimiento_informado') return record;
    const consentId = record.id_consentimiento;
    record.firma = [...tables['firma_digital_consentimiento'].values()].find(
      (row) => row.id_consentimiento === consentId
    ) || null;
    record.anulacion = [...tables['anulacion_consentimiento'].values()].find(
      (row) => row.id_consentimiento === consentId
    ) || null;
    record.plantilla = record.id_plantilla
      ? tables['plantilla_consentimiento'].get(record.id_plantilla) || null
      : null;
    record.paciente = record.id_paciente
      ? tables['paciente'].get(record.id_paciente) || null
      : null;
    record.medico = record.id_medico
      ? tables['medico'].get(record.id_medico) || null
      : null;
    record.cita = record.id_cita
      ? tables['cita'].get(record.id_cita) || null
      : null;
    return record;
  };

  const materialize = (record) => joinRelations(cloneRecord(record));

  const withDefaults = (data) => {
    const row = cloneRecord(data);
    for (const field of DEFAULT_TIMESTAMPS[tableName] || []) {
      if (row[field] === undefined) row[field] = new Date();
    }
    return row;
  };

  return {
    findUnique: async ({ where, select } = {}) => {
      for (const record of table.values()) {
        if (matchesWhere(record, where)) return project(materialize(record), select);
      }
      return null;
    },
    findFirst: async ({ where, select } = {}) => {
      for (const record of table.values()) {
        if (matchesWhere(record, where)) return project(materialize(record), select);
      }
      return null;
    },
    findMany: async ({ where, take, select } = {}) => {
      const rows = [...table.values()].filter((record) => matchesWhere(record, where));
      const limited = typeof take === 'number' ? rows.slice(0, take) : rows;
      return limited.map((record) => project(materialize(record), select));
    },
    create: async ({ data, select } = {}) => {
      const record = withDefaults(data);
      const id = BigInt(table.size + 1);
      record[pk] = id;
      table.set(id, record);
      return project(materialize(record), select);
    },
    update: async ({ where, data, select } = {}) => {
      for (const record of table.values()) {
        if (matchesWhere(record, where)) {
          Object.assign(record, cloneRecord(data));
          return project(materialize(record), select);
        }
      }
      return null;
    },
    upsert: async ({ where, create, update, select } = {}) => {
      for (const record of table.values()) {
        if (matchesWhere(record, where)) {
          Object.assign(record, cloneRecord(update));
          return project(materialize(record), select);
        }
      }
      const created = withDefaults(create);
      const id = BigInt(table.size + 1);
      created[pk] = id;
      table.set(id, created);
      return project(materialize(created), select);
    },
    delete: async ({ where } = {}) => {
      for (const [id, record] of table.entries()) {
        if (matchesWhere(record, where)) {
          table.delete(id);
          return cloneRecord(record);
        }
      }
      return null;
    },
    count: async ({ where } = {}) => [...table.values()].filter((record) => matchesWhere(record, where)).length,
    createMany: async ({ data } = {}) => {
      for (const item of data || []) await contractFor(tables, tableName).create({ data: item });
      return { count: (data || []).length };
    },
    updateMany: async () => ({ count: 0 }),
    deleteMany: async () => ({ count: 0 }),
    aggregate: async () => ({ _count: 0 }),
    groupBy: async () => []
  };
}

function createFakePrisma() {
  const tables = {};
  for (const model of REQUIRED_MODELS) tables[model] = new Map();
  const db = { tables };
  for (const model of REQUIRED_MODELS) db[model] = contractFor(tables, model);
  db.$transaction = async (callback, options) => callback(db, options);
  db.$executeRaw = async () => 1;
  db.$queryRaw = async () => [];
  db.$disconnect = async () => {};
  return db;
}

const fakeDb = createFakePrisma();
require.cache[require.resolve('../../src/config/prisma')] = { exports: fakeDb };

// ---------------------------------------------------------------------------
// Almacenamiento de archivos simulado (el PDF firmado se persiste cifrado).
// ---------------------------------------------------------------------------
const storedFiles = new Map();
const fakeStorage = {
  saveFile: async ({ buffer, filename }) => {
    const cleanKey = path.basename(filename);
    storedFiles.set(cleanKey, buffer);
    return { storageProvider: 'LOCAL', storageKey: cleanKey };
  },
  getFileStream: async (storageKey) => {
    const cleanKey = path.basename(storageKey);
    const buffer = storedFiles.get(cleanKey);
    if (!buffer) {
      const error = new Error('El archivo asociado al documento no está disponible.');
      error.statusCode = 404;
      throw error;
    }
    return { stream: Readable.from(buffer), size: buffer.length };
  },
  deleteFile: async () => true
};
require.cache[require.resolve('../../src/services/storage/storage.service')] = { exports: fakeStorage };

// ---------------------------------------------------------------------------
// Importar capas reales (tras inyectar adaptadores).
// ---------------------------------------------------------------------------
const { ConsentError } = require('../../src/services/consent.service');
const consentService = require('../../src/services/consent.service');
const templateService = require('../../src/services/consent-template.service');
const consentController = require('../../src/controllers/consent.controller');
const authorize = require('../../src/middleware/role.middleware');
const { defaults } = require('../../src/security/permissions');

// ---------------------------------------------------------------------------
// Certificados X.509 de prueba (PEM + clave privada) con node-forge.
// ---------------------------------------------------------------------------
function createTestCertificate({
  cn = 'TEST-ADSIB-CA',
  serialNumber = 'FE01',
  daysValid = 365,
  alreadyExpired = false
} = {}) {
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = serialNumber;
  const now = Date.now();
  cert.validity.notBefore = alreadyExpired
    ? new Date(now - 2 * 86400000)
    : new Date(now - 86400000);
  cert.validity.notAfter = alreadyExpired
    ? new Date(now - 86400000)
    : new Date(now + daysValid * 86400000);
  const attrs = [{ name: 'commonName', value: cn }, { name: 'organizationName', value: 'MedicalSys Test' }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey);
  return {
    certificatePem: forge.pki.certificateToPem(cert),
    privateKeyPem: forge.pki.privateKeyToPem(keys.privateKey),
    nodeSerialNumber: new (require('crypto').X509Certificate)(
      forge.pki.certificateToPem(cert)
    ).serialNumber
  };
}

const patientSigner = createTestCertificate({ cn: 'TEST-ADSIB-CA', serialNumber: 'FE01' });

// ---------------------------------------------------------------------------
// Contexto semilla y helpers de generación/firma.
// ---------------------------------------------------------------------------
function seedContext() {
  fakeDb.tables['usuario'].set(2n, {
    id_usuario: 2n,
    nombres: 'Juan',
    apellidos: 'Rodríguez',
    email: 'juan@medicalsys.test'
  });
  fakeDb.tables['medico'].set(1n, {
    id_medico: 1n,
    id_usuario: 2n,
    especialidad: 'Cardiología',
    matricula_profesional: 'MAT-002',
    usuario: { id_usuario: 2n, nombres: 'Juan', apellidos: 'Rodríguez' }
  });
  fakeDb.tables['paciente'].set(1n, {
    id_paciente: 1n,
    nombres: 'Ana',
    apellidos: 'Pérez',
    documento_identidad: '4892104',
    complemento: '',
    fecha_nacimiento: new Date('1990-05-10T00:00:00.000Z')
  });
}

const TEMPLATE_V1 = 'El paciente {{paciente_nombre}} con C.I. {{paciente_ci}} declara haber sido informado sobre el procedimiento {{procedimiento}}.\nEl médico {{medico_nombre}} de {{medico_especialidad}} atenderá sus dudas.\nFecha: {{fecha}}.';

const TEMPLATE_V2 = 'El paciente {{paciente_nombre}} con C.I. {{paciente_ci}} declara haber sido informado (versión 2) sobre el procedimiento {{procedimiento}}.\nMédico: {{medico_nombre}}.';

function expectedRender(template) {
  const date = new Date().toISOString().slice(0, 10);
  return template
    .replace(/\{\{\s*paciente_nombre\s*\}\}/g, 'Ana Pérez')
    .replace(/\{\{\s*paciente_ci\s*\}\}/g, '4892104')
    .replace(/\{\{\s*paciente_complemento\s*\}\}/g, '')
    .replace(/\{\{\s*medico_nombre\s*\}\}/g, 'Juan Rodríguez')
    .replace(/\{\{\s*medico_especialidad\s*\}\}/g, 'Cardiología')
    .replace(/\{\{\s*procedimiento\s*\}\}/g, 'Consentimiento para Cateterismo')
    .replace(/\{\{\s*fecha\s*\}\}/g, date);
}

async function generateConsent() {
  return templateService.generateConsent('2', { templateId: '1', patientId: '1' });
}

function rawConsent(id) {
  return fakeDb.tables['consentimiento_informado'].get(BigInt(id));
}

function pdfKey(consentId) {
  return rawConsent(consentId).pdf_path;
}

function firmaRowsFor(consentId) {
  return [...fakeDb.tables['firma_digital_consentimiento'].values()].filter(
    (row) => row.id_consentimiento === BigInt(consentId)
  );
}

async function signConsentViaService(consentId, signer = patientSigner, overrides = {}) {
  const pdf = await consentService.getConsentPdf('2', String(consentId));
  const hash = crypto.createHash('sha256').update(pdf.buffer).digest('hex');
  const signature = digitalSignature.signDigest(signer.privateKeyPem, hash);
  return consentService.signConsent('2', String(consentId), {
    certificate: signer.certificatePem,
    signature,
    signerType: overrides.signerType || 'PACIENTE',
    signerName: overrides.signerName || 'Ana Pérez',
    signerCi: overrides.signerCi || '4892104',
    tutorRelationship: overrides.tutorRelationship
  });
}

function tamperStoredPdf(consentId) {
  const key = pdfKey(consentId);
  const plain = cryptoService.decryptBuffer(storedFiles.get(key));
  const modified = Buffer.from(plain);
  modified[modified.length - 1] = modified[modified.length - 1] === 0x41 ? 0x42 : 0x41;
  storedFiles.set(key, cryptoService.encryptBuffer(modified));
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((request, _response, next) => {
    request.user = {
      id: '2',
      idUsuario: '2',
      rol: 'MEDICO',
      permissions: defaults('MEDICO')
    };
    next();
  });
  app.use(authorize());
  app.get('/api/consents/:consentId/preview', consentController.previewConsent);
  app.get('/api/consents/:consentId/download', consentController.downloadConsent);
  app.post('/api/consents/:consentId/verify', consentController.verifyConsent);
  app.post('/api/consents/:consentId/annul', consentController.annulConsent);
  app.post('/api/consents/:consentId/sign', consentController.signConsent);
  app.put('/api/consents/:consentId', consentController.updateConsent);
  app.patch('/api/consents/:consentId', consentController.updateConsent);
  app.use((error, _req, res, _next) =>
    res.status(error.statusCode || 500).json({ message: error.message }));
  return app;
}

async function listen(app) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

async function close(server) {
  await new Promise((resolve) => server.close(resolve));
}

const post = (origin, url, body) => fetch(`${origin}${url}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

// ---------------------------------------------------------------------------
// PA-01 & PA-02: generación desde plantilla conserva la versión exacta.
// ---------------------------------------------------------------------------
let template, firstConsent, secondConsent;

test('PA-01 & PA-02: generación desde plantilla registra la versión exacta e inmutable', async () => {
  seedContext();

  template = await templateService.createTemplate({
    code: 'CARD-001',
    title: 'Consentimiento para Cateterismo',
    procedureType: 'PROCEDIMIENTO',
    content: TEMPLATE_V1
  });
  assert.equal(template.version, 1);
  assert.equal(template.code, 'CARD-001');

  firstConsent = await generateConsent();
  assert.equal(firstConsent.templateVersion, 1);
  assert.equal(firstConsent.template.code, 'CARD-001');
  assert.equal(firstConsent.patient.fullName, 'Ana Pérez');
  assert.equal(firstConsent.doctor.fullName, 'Juan Rodríguez');
  assert.ok(firstConsent.pdfHash && /^[0-9a-f]{64}$/.test(firstConsent.pdfHash));
  assert.equal(firstConsent.hasPdf, true);

  const rawAfterCreate = rawConsent(firstConsent.id);
  assert.equal(rawAfterCreate.version_plantilla, 1);
  // PA-01: el contenido inmutable queda cifrado AES-256-GCM (HU-31).
  assert.match(String(rawAfterCreate.contenido), /^v1:[0-9a-f]{24}:/);
  assert.equal(cryptoService.decrypt(rawAfterCreate.contenido), expectedRender(TEMPLATE_V1));

  // PA-07/HU-31: el PDF se persiste cifrado (cabecera MSEC), no como PDF visible.
  assert.match(storedFiles.get(rawAfterCreate.pdf_path).toString('utf8', 0, 4), /MSEC/);

  // PA-02: modificar la plantilla incrementa la versión; un nuevo documento la usa.
  const updated = await templateService.updateTemplate(String(template.id), { content: TEMPLATE_V2 });
  assert.equal(updated.version, 2);

  secondConsent = await generateConsent();
  assert.equal(secondConsent.templateVersion, 2);

  // PA-02: el documento v1 conserva contenido y versión originales, sin mutar.
  const rawFirst = rawConsent(firstConsent.id);
  assert.equal(rawFirst.version_plantilla, 1);
  assert.equal(cryptoService.decrypt(rawFirst.contenido), expectedRender(TEMPLATE_V1));
});

// ---------------------------------------------------------------------------
// PA-03: vista previa del PDF antes de la firma.
// ---------------------------------------------------------------------------
test('PA-03: la vista previa entrega el PDF antes de la firma (endpoint HTTP)', async () => {
  const viaService = await consentService.getConsentPdf('2', String(firstConsent.id));
  assert.equal(viaService.buffer.slice(0, 5).toString('utf8'), '%PDF-');
  assert.match(viaService.fileName, /^CI-.*\.pdf$/);
  assert.equal(viaService.mimeType, 'application/pdf');
  assert.equal(viaService.status, 'GENERADO');

  const app = createApp();
  const { server, origin } = await listen(app);
  try {
    const response = await fetch(`${origin}/api/consents/${firstConsent.id}/preview`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'application/pdf');
    const buffer = Buffer.from(await response.arrayBuffer());
    assert.equal(buffer.slice(0, 5).toString('utf8'), '%PDF-');
  } finally {
    await close(server);
  }
});

// ---------------------------------------------------------------------------
// PA-04 (PARTE 1) + PA-06 + PA-10: firma PKI, certificados inválidos y
// proveedor indisponible.
// ---------------------------------------------------------------------------
let signedConsent;

test('PA-04: la firma se vincula al SHA-256 del PDF (firma PKI exitosa)', async () => {
  const generated = await generateConsent();
  signedConsent = generated;

  // La firma se computa sobre el hash del PDF completo y se envía con el
  // certificado; el servidor verifica con la clave pública del certificado.
  const app = createApp();
  const { server, origin } = await listen(app);
  try {
    const response = await post(origin, `/api/consents/${signedConsent.id}/sign`, {
      certificate: patientSigner.certificatePem,
      signature: digitalSignature.signDigest(
        patientSigner.privateKeyPem,
        signedConsent.pdfHash
      ),
      signerType: 'PACIENTE',
      signerName: 'Ana Pérez',
      signerCi: '4892104'
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.consent.status, 'FIRMADO');
    assert.ok(body.consent.signedAt);
  } finally {
    await close(server);
  }

  const firmaRow = firmaRowsFor(signedConsent.id)[0];
  assert.ok(firmaRow, 'Debe existir el registro de firma digital');
  assert.equal(firmaRow.tipo_firmante, 'PACIENTE');
  assert.equal(firmaRow.emisor_ca, 'TEST-ADSIB-CA');
  assert.equal(firmaRow.serial_number, patientSigner.nodeSerialNumber);
  assert.equal(firmaRow.algoritmo, 'SHA256withRSA');
  assert.equal(firmaRow.hash_documento, rawConsent(signedConsent.id).pdf_hash);
  assert.match(firmaRow.certificado_pem, /BEGIN CERTIFICATE/);
  assert.match(firmaRow.firma_bruta, /^[0-9a-f]+$/);

  // Verificación independiente: hash del PDF + firma criptográfica válidas.
  const verification = await consentService.verifyConsent('2', String(signedConsent.id));
  assert.equal(verification.valid, true);
  assert.equal(verification.integrity, true);
  assert.equal(verification.signatureVerified, true);
  assert.equal(verification.signature.algorithm, 'SHA256withRSA');
  assert.equal(verification.signature.signerType, 'PACIENTE');
  assert.equal(verification.signature.issuer, 'TEST-ADSIB-CA');
});

test('PA-06: un certificado vencido aborta la firma y el documento queda pendiente', async () => {
  const generated = await generateConsent();
  const expired = createTestCertificate({ cn: 'TEST-ADSIB-CA', serialNumber: 'EE00', alreadyExpired: true });

  const pdf = await consentService.getConsentPdf('2', String(generated.id));
  const hash = crypto.createHash('sha256').update(pdf.buffer).digest('hex');
  const signature = digitalSignature.signDigest(expired.privateKeyPem, hash);

  await assert.rejects(
    consentService.signConsent('2', String(generated.id), {
      certificate: expired.certificatePem,
      signature,
      signerType: 'PACIENTE',
      signerName: 'Ana Pérez',
      signerCi: '4892104'
    }),
    (error) => error instanceof ConsentError &&
      error.statusCode === 400 &&
      /vencido/i.test(error.message)
  );

  assert.equal(rawConsent(generated.id).estado, 'GENERADO');
  assert.equal(firmaRowsFor(generated.id).length, 0, 'No debe persistirse una firma con certificado vencido');
});

test('PA-10: proveedor/CA no disponible aborta la operación con error explícito y mantiene el estado', async () => {
  const generated = await generateConsent();
  const rogue = createTestCertificate({ cn: 'UNTRUSTED-CA', serialNumber: 'ZZ00' });

  const pdf = await consentService.getConsentPdf('2', String(generated.id));
  const hash = crypto.createHash('sha256').update(pdf.buffer).digest('hex');
  const signature = digitalSignature.signDigest(rogue.privateKeyPem, hash);

  await assert.rejects(
    consentService.signConsent('2', String(generated.id), {
      certificate: rogue.certificatePem,
      signature,
      signerType: 'TUTOR',
      signerName: 'María Pérez',
      signerCi: '2019001',
      tutorRelationship: 'Madre'
    }),
    (error) => error instanceof ConsentError &&
      error.statusCode === 400 &&
      /no está autorizado/i.test(error.message)
  );

  // El documento permanece en su estado (PENDING/GENERADO) y sin firma.
  assert.equal(rawConsent(generated.id).estado, 'GENERADO');
  assert.equal(firmaRowsFor(generated.id).length, 0);
});

// ---------------------------------------------------------------------------
// PA-05: alterar un byte del PDF invalida la verificación.
// ---------------------------------------------------------------------------
test('PA-05: modificar un byte del PDF hace fallar la verificación de integridad', async () => {
  assert.equal(rawConsent(signedConsent.id).estado, 'FIRMADO');

  const ok = await consentService.verifyConsent('2', String(signedConsent.id));
  assert.equal(ok.valid, true);

  // Simula la modificación externa de un byte del PDF en disco.
  tamperStoredPdf(signedConsent.id);

  const verification = await consentService.verifyConsent('2', String(signedConsent.id));
  assert.equal(verification.valid, false, 'La validación debe fallar explícitamente');
  assert.equal(verification.integrity, false);
  // La firma criptográfica sigue siendo válida sobre el hash registrado; lo
  // alterado es la integridad del documento (hash recalculado != hash firmado).
  assert.equal(verification.signatureVerified, true);
  assert.notEqual(verification.pdfHash, verification.expectedHash, 'El hash recalculado no debe coincidir');
});

// ---------------------------------------------------------------------------
// PA-07: PUT/PATCH a un consentimiento firmado se bloquea (400/409).
// ---------------------------------------------------------------------------
test('PA-07: editar (PUT/PATCH) un consentimiento firmado devuelve 409', async () => {
  const generated = await generateConsent();
  await signConsentViaService(generated.id);

  const app = createApp();
  const { server, origin } = await listen(app);
  try {
    const put = await fetch(`${origin}/api/consents/${generated.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ procedure: 'Procedimiento alterado' })
    });
    assert.equal(put.status, 409);

    const patch = await fetch(`${origin}/api/consents/${generated.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ procedure: 'Procedimiento alterado' })
    });
    assert.equal(patch.status, 409);
  } finally {
    await close(server);
  }

  // Control: antes de firmar sí se puede corregir metadatos.
  const pending = await generateConsent();
  const preSigned = await consentService.updateConsent('2', String(pending.id), {
    procedure: 'Corrección pre-firma'
  });
  assert.equal(preSigned.status, 'GENERADO');
  assert.equal(preSigned.procedure, 'Corrección pre-firma');
});

// ---------------------------------------------------------------------------
// PA-08: la anulación conserva el documento, la firma y registra el evento.
// ---------------------------------------------------------------------------
test('PA-08: anular crea la anulación sin borrar ni el PDF ni la firma', async () => {
  const generated = await generateConsent();
  await signConsentViaService(generated.id);
  const firmaId = firmaRowsFor(generated.id)[0].id_firma;
  const pdfStorageKey = pdfKey(generated.id);

  const result = await consentService.annulConsent('2', String(generated.id), {
    reason: 'El paciente retiró voluntariamente su consentimiento.'
  });
  assert.equal(result.status, 'ANULADO');
  assert.equal(result.annulment.reason, 'El paciente retiró voluntariamente su consentimiento.');
  assert.equal(result.annulment.cancelledByUserId, 2);

  const annulmentRow = [...fakeDb.tables['anulacion_consentimiento'].values()].find(
    (row) => row.id_consentimiento === BigInt(generated.id)
  );
  assert.ok(annulmentRow, 'Debe registrarse el evento de anulación');
  assert.equal(annulmentRow.motivo, 'El paciente retiró voluntariamente su consentimiento.');
  assert.equal(Number(annulmentRow.anulado_por_usuario), 2);

  // El PDF y la firma se conservan intactos.
  assert.ok(storedFiles.has(pdfStorageKey), 'El PDF no debe eliminarse al anular');
  assert.ok(fakeDb.tables['firma_digital_consentimiento'].has(firmaId), 'La firma no debe eliminarse al anular');

  // La firma previa sigue siendo criptográficamente válida.
  const verification = await consentService.verifyConsent('2', String(generated.id));
  assert.equal(verification.annulled, true);
  assert.equal(verification.valid, true);

  // Anular dos veces es rechazado.
  await assert.rejects(
    consentService.annulConsent('2', String(generated.id), { reason: 'otro' }),
    { statusCode: 400 }
  );
});

// ---------------------------------------------------------------------------
// PA-09: descarga del PDF firmado e informe de verificación (endpoint público).
// ---------------------------------------------------------------------------
test('PA-09: descarga del PDF firmado y metadatos de certificación auditables', async () => {
  const generated = await generateConsent();
  await signConsentViaService(generated.id);

  const app = createApp();
  const { server, origin } = await listen(app);
  try {
    const download = await fetch(`${origin}/api/consents/${generated.id}/download`);
    assert.equal(download.status, 200);
    assert.equal(download.headers.get('Content-Type'), 'application/pdf');
    const pdfBuffer = Buffer.from(await download.arrayBuffer());
    assert.equal(pdfBuffer.slice(0, 5).toString('utf8'), '%PDF-');

    const report = await post(origin, `/api/consents/${generated.id}/verify`, {});
    assert.equal(report.status, 200);
    const body = await report.json();
    assert.equal(body.valid, true);
    assert.equal(body.integrity, true);
    assert.equal(body.signatureVerified, true);
    assert.ok(body.pdfHash && /^[0-9a-f]{64}$/.test(body.pdfHash));
    // Metadatos de certificación auditable (PA-09).
    assert.equal(body.signature.issuer, 'TEST-ADSIB-CA');
    assert.equal(body.signature.serialNumber, patientSigner.nodeSerialNumber);
    assert.equal(body.signature.algorithm, 'SHA256withRSA');
    assert.equal(body.signature.signerType, 'PACIENTE');
    assert.equal(body.signature.signerName, 'Ana Pérez');
    assert.ok(body.signature.validFrom && body.signature.validTo);
    assert.ok(new Date(body.signature.validTo) > new Date());
  } finally {
    await close(server);
  }
});