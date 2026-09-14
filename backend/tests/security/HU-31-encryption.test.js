const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

/**
 * HU-31 - Cifrado autenticado de datos médicos sensibles.
 *
 * Valida PA-01 a PA-09 descritos en la historia de usuario. La criptografía es
 * REAL (AES-256-GCM + HMAC-SHA256, librería nativa crypto de Node.js); la única
 * capa simulada es el adaptador de persistencia Prisma, igual que en el resto
 * de las suites del repositorio, para poder ejecutarse sin PostgreSQL.
 */

// ---------------------------------------------------------------------------
// Claves de prueba (NO deben usarse en producción).
// ---------------------------------------------------------------------------
const KEY_V1 = '3a9f8b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a';
const KEY_V2 = 'a1b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e60718293a4b5c6d7e8f901';
const BLIND_SECRET = 'f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7';

const cryptoService = require('../../src/services/crypto.service');
cryptoService.configure({
  encryptionKeys: { v1: KEY_V1, v2: KEY_V2 },
  currentKeyVersion: 'v1',
  blindIndexSecret: BLIND_SECRET
});

// ---------------------------------------------------------------------------
// Adaptador de persistencia simulado (estilo del resto de la suite).
// ---------------------------------------------------------------------------
const PK_NAMES = {
  usuario: 'id_usuario', rol: 'id_rol', paciente: 'id_paciente',
  historia_clinica: 'id_historia', atencion_medica: 'id_atencion',
  medico: 'id_medico', cita: 'id_cita', consentimiento_informado: 'id_consentimiento',
  receta: 'id_receta', documento_clinico: 'id_documento', mensaje_clinico: 'id_mensaje'
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
      } else {
        if (String(record[key]) !== String(cond)) return false;
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

function contractFor(table, tableName, auditLog) {
  const pk = PK_NAMES[tableName];
  return {
    findUnique: async ({ where, select } = {}) => {
      for (const record of table.values()) {
        if (matchesWhere(record, where)) return project(cloneRecord(record), select);
      }
      return null;
    },
    findFirst: async ({ where, select } = {}) => {
      for (const record of table.values()) {
        if (matchesWhere(record, where)) return project(cloneRecord(record), select);
      }
      return null;
    },
    findMany: async ({ where, take, select } = {}) => {
      const rows = [...table.values()].filter((record) => matchesWhere(record, where));
      const limited = typeof take === 'number' ? rows.slice(0, take) : rows;
      return limited.map((record) => project(cloneRecord(record), select));
    },
    create: async ({ data, select } = {}) => {
      const record = cloneRecord(data);
      const id = BigInt(table.size + 1);
      record[pk] = id;
      table.set(id, record);
      return project(cloneRecord(record), select);
    },
    update: async ({ where, data, select } = {}) => {
      for (const record of table.values()) {
        if (matchesWhere(record, where)) {
          Object.assign(record, data);
          return project(cloneRecord(record), select);
        }
      }
      return null;
    },
    upsert: async ({ where, create, update, select } = {}) => {
      for (const record of table.values()) {
        if (matchesWhere(record, where)) {
          Object.assign(record, update);
          return project(cloneRecord(record), select);
        }
      }
      const created = cloneRecord(create);
      const id = BigInt(table.size + 1);
      created[pk] = id;
      table.set(id, created);
      return project(cloneRecord(created), select);
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
      for (const item of data || []) await contractFor(table, tableName, auditLog).create({ data: item });
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
  const auditLog = [];

  const db = { tables, auditLog };
  for (const model of REQUIRED_MODELS) {
    db[model] = contractFor(tables[model], model, auditLog);
  }

  db.$transaction = async (callback, options) => callback(db, options);
  db.$executeRaw = (strings, ...values) => {
    const sql = strings.join('?');
    if (sql.includes('security_audit') && sql.includes('INSERT')) {
      auditLog.push({
        actorId: String(values[0]),
        action: values[1],
        target: values[2],
        details: values[3]
      });
    }
    return Promise.resolve(1);
  };
  db.$queryRaw = async () => [];
  db.$disconnect = async () => {};
  return db;
}

const fakeDb = createFakePrisma();
require.cache[require.resolve('../../src/config/prisma')] = { exports: fakeDb };

// ---------------------------------------------------------------------------
// Importar capas reales (tras inyectar el adaptador de persistencia).
// ---------------------------------------------------------------------------
const { createEncryptedRepository } = require('../../src/repositories/encrypted.repository');
const historyRepository = require('../../src/repositories/history.repository');
const medicalHistoryService = require('../../src/services/medical-history.service');
const medicalHistoryController = require('../../src/controllers/medical-history.controller');
const authorize = require('../../src/middleware/role.middleware');
const { REDACTED, sanitize } = require('../../src/config/logger');

const historyRepo = historyRepository;

const encryptedPattern = /^v1:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/;

// ---------------------------------------------------------------------------
// PA-01: en base de datos (Prisma/SQL directo) solo hay ciphertext no legible.
// ---------------------------------------------------------------------------
test('PA-01: las consultas directas devuelven ciphertext v1:iv:tag:data no legible', async () => {
  await historyRepo.historia_clinica.create({
    data: {
      id_paciente: 1n,
      antecedentes: 'Asma bronquial',
      alergias: 'Penicilina',
      condiciones_cronicas: 'Hipertensión arterial',
      observaciones_generales: 'Control semestral'
    }
  });

  await historyRepo.atencion_medica.create({
    data: {
      id_historia: 1n,
      id_medico: 1n,
      motivo_consulta: 'Dolor abdominal',
      anamnesis: 'Cuadro de 3 días de evolución',
      diagnostico_codigo: 'R10.4',
      diagnostico_descripcion: 'Otros dolores abdominales y los no especificados',
      tratamiento: 'Analgésicos y reposo',
      observaciones: 'Control en 7 días'
    }
  });

  await historyRepo.receta.create({
    data: {
      id_atencion: 1n,
      indicaciones: 'Ibuprofeno 400 mg cada 8 horas por 5 días'
    }
  });

  const rawHistory = fakeDb.tables['historia_clinica'].get(1n);
  for (const field of ['antecedentes', 'alergias', 'condiciones_cronicas', 'observaciones_generales']) {
    assert.match(String(rawHistory[field]), encryptedPattern, `${field} no quedó cifrado`);
    assert.notEqual(rawHistory[field], 'Asma bronquial');
    assert.ok(!String(rawHistory[field]).includes('Asma'));
  }

  const rawAttention = fakeDb.tables['atencion_medica'].get(1n);
  for (const field of ['motivo_consulta', 'anamnesis', 'diagnostico_codigo', 'diagnostico_descripcion', 'tratamiento', 'observaciones']) {
    assert.match(String(rawAttention[field]), encryptedPattern, `atencion.${field} no quedó cifrado`);
  }

  const rawRecipe = fakeDb.tables['receta'].get(1n);
  assert.match(rawRecipe.indicaciones, encryptedPattern);
});

// ---------------------------------------------------------------------------
// PA-02: dos cifrados del mismo texto producen IV/outputs diferentes.
// ---------------------------------------------------------------------------
test('PA-02: cifrar dos veces el mismo texto genera outputs distintos (IV impredecible)', () => {
  const first = cryptoService.encrypt('Alergia a la penicilina');
  const second = cryptoService.encrypt('Alergia a la penicilina');
  assert.notEqual(first, second);
  assert.notEqual(first.split(':')[1], second.split(':')[1], 'Los IV no deben repetirse');
  assert.equal(cryptoService.decrypt(first), 'Alergia a la penicilina');
  assert.equal(cryptoService.decrypt(second), 'Alergia a la penicilina');
});

// ---------------------------------------------------------------------------
// PA-03: alterar un carácter del ciphertext o del authTag rompe la integridad.
// ---------------------------------------------------------------------------
test('PA-03: alterar ciphertext o authTag lanza error de integridad', () => {
  const ciphertext = cryptoService.encrypt('Diagnóstico confidencial');

  let parts = ciphertext.split(':');
  const tag = parts[2];
  const tamperedTag = tag.startsWith('0') ? `1${tag.slice(1)}` : `0${tag.slice(1)}`;
  parts[2] = tamperedTag;
  assert.throws(
    () => cryptoService.decrypt(parts.join(':')),
    (error) => error.name === 'CryptoIntegrityError' && error.code === 'CRYPTO_INTEGRITY'
  );

  const payload = parts.length > 3 ? parts[2] : '';
  const cipherHex = ciphertext.split(':')[3];
  const flipped = cipherHex[0] === '0' ? `1${cipherHex.slice(1)}` : `0${cipherHex.slice(1)}`;
  const tamperedPayload = ciphertext.split(':').slice(0, 3).join(':') + ':' + flipped;
  assert.throws(
    () => cryptoService.decrypt(tamperedPayload),
    (error) => error.name === 'CryptoIntegrityError'
  );
  assert.throws(() => cryptoService.decrypt(payload || undefined), (error) => error.name === 'CryptoIntegrityError');
});

// ---------------------------------------------------------------------------
// PA-04: un médico/admin autorizado consulta y ve la información en claro.
// ---------------------------------------------------------------------------
test('PA-04: médico autorizado recibe datos descifrados a través de la API', async () => {
  const e = (value) => cryptoService.encrypt(value);

  fakeDb.tables['paciente'].set(1n, {
    id_paciente: 1n,
    nombres: 'Ana',
    apellidos: 'Pérez',
    documento_identidad: '4892104',
    complemento: '',
    fecha_nacimiento: new Date('1990-05-10T00:00:00.000Z'),
    telefono: '74511122',
    grupo_sanguineo: 'O+',
    historia_clinica: {
      id_historia: 1n,
      id_paciente: 1n,
      fecha_apertura: new Date('2024-01-01T00:00:00.000Z'),
      antecedentes: e('Asma bronquial'),
      alergias: e('Penicilina'),
      condiciones_cronicas: e('Hipertensión arterial'),
      observaciones_generales: e('Sin observaciones'),
      atencion_medica: [
        {
          id_atencion: 1n,
          fecha_atencion: new Date('2024-02-01T10:00:00.000Z'),
          motivo_consulta: e('Dolor abdominal'),
          anamnesis: e('Cuadro de 3 días'),
          diagnostico_codigo: e('R10.4'),
          diagnostico_descripcion: e('Otros dolores abdominales'),
          tratamiento: e('Analgésicos'),
          observaciones: e('Control en 7 días'),
          presion_sistolica: 120,
          presion_diastolica: 80,
          frecuencia_cardiaca: 80,
          temperatura: null,
          saturacion_oxigeno: 98,
          peso_kg: null,
          talla_cm: null,
          medico: {
            id_medico: 1n,
            especialidad: 'Medicina General',
            usuario: { nombres: 'Juan', apellidos: 'Rodríguez' }
          }
        }
      ]
    }
  });

  const { defaults } = require('../../src/security/permissions');
  const app = express();
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
  app.get('/api/patients/:patientId/medical-history', medicalHistoryController.getMedicalHistory);
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ message: error.message }));

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(`${origin}/api/patients/1/medical-history`);
    assert.equal(response.status, 200);
    const body = await response.json();

    assert.equal(body.patient.nombres, 'Ana');
    assert.equal(body.history.antecedentes, 'Asma bronquial');
    assert.equal(body.history.alergias, 'Penicilina');
    assert.equal(body.attentions.length, 1);
    assert.equal(body.attentions[0].diagnosticoDescripcion, 'Otros dolores abdominales');
    assert.equal(body.attentions[0].tratamiento, 'Analgésicos');

    // PA-07: las claves no viajan en la respuesta.
    assert.ok(!JSON.stringify(body).includes(KEY_V1.slice(0, 16)));
    assert.ok(!JSON.stringify(body).includes(KEY_V2.slice(0, 16)));
    assert.ok(!JSON.stringify(body).includes('BI_INDEX_SECRET'));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fakeDb.tables['paciente'].clear();
  }
});

// ---------------------------------------------------------------------------
// PA-05: un usuario no autorizado recibe 403 y el intento queda en AuditLog.
// ---------------------------------------------------------------------------
test('PA-05: rol no permitido recibe 403 y registra la entrada en AuditLog', async () => {
  fakeDb.auditLog.length = 0;

  const app = express();
  app.use((request, _response, next) => {
    request.user = { id: '5', idUsuario: '5', rol: 'PACIENTE', permissions: [] };
    next();
  });
  app.use(authorize());
  app.get('/api/patients/:patientId/medical-history', (_req, res) => res.sendStatus(200));
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ message: error.message }));

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(`${origin}/api/patients/1/medical-history`);
    assert.equal(response.status, 403);

    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.ok(fakeDb.auditLog.length >= 1, 'No se registró el intento en AuditLog');
    const entry = fakeDb.auditLog[0];
    assert.equal(entry.action, 'CLINICAL_ACCESS_DENIED');
    assert.equal(entry.target, 'history.read');
    assert.equal(entry.actorId, '5');
    assert.match(String(entry.details), /medical-history/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fakeDb.auditLog.length = 0;
  }
});

// ---------------------------------------------------------------------------
// PA-06: los archivos quedan cifrados en disco y no se abren como PDF/imagen.
// ---------------------------------------------------------------------------
test('PA-06: archivos cifrados en disco no abren como PDF/imagen estándar', () => {
  const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n%%EOF\n');
  const encryptedPdf = cryptoService.encryptBuffer(pdf);

  assert.ok(encryptedPdf.toString('utf8', 0, 4).startsWith('MSEC'));
  assert.notEqual(encryptedPdf.toString('utf8', 0, 4), '%PDF', 'El archivo no debe conservar la cabecera PDF');
  assert.ok(!encryptedPdf.toString('latin1').includes('%PDF'));

  const raw = cryptoService.decryptBuffer(encryptedPdf);
  assert.deepEqual(raw, pdf, 'El descifrado debe recuperar el PDF original');

  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('image-data')]);
  const encryptedPng = cryptoService.encryptBuffer(png);
  assert.notEqual(encryptedPng[0], 0x89, 'El archivo no debe conservar la firma PNG');
  assert.deepEqual(cryptoService.decryptBuffer(encryptedPng), png);
});

// ---------------------------------------------------------------------------
// PA-07: las claves no aparecen en logs ni en respuestas JSON de la API.
// ---------------------------------------------------------------------------
test('PA-07: sanitización de logs enmascara claves y datos sensibles', () => {
  const payload = {
    password: 'MedicalSys2026!',
    authorization: 'Bearer abc123',
    ENCRYPTION_KEYS: { v1: KEY_V1, v2: KEY_V2 },
    BLIND_INDEX_SECRET: BLIND_SECRET,
    antecedentes: 'Confidencial',
    alergias: 'Penicilina',
    normal: 'esto sí se ve'
  };

  const safe = sanitize(payload);
  assert.equal(safe.password, REDACTED);
  assert.equal(safe.authorization, REDACTED);
  assert.equal(safe.ENCRYPTION_KEYS, REDACTED);
  assert.equal(safe.BLIND_INDEX_SECRET, REDACTED);
  assert.equal(safe.antecedentes, REDACTED);
  assert.equal(safe.normal, 'esto sí se ve');

  const json = JSON.stringify(sanitize(safe));
  assert.ok(!json.includes(KEY_V1));
  assert.ok(!json.includes(BLIND_SECRET));
  assert.ok(!json.includes('MedicalSys2026!'));

  const captured = [];
  const originalError = console.error;
  console.error = (...args) => captured.push(args.map(String).join(' '));
  try {
    const { logger } = require('../../src/config/logger');
    logger.error({ err: payload, key: KEY_V1 });
  } finally {
    console.error = originalError;
  }
  const output = captured.join('\n');
  assert.ok(!output.includes(KEY_V1));
  assert.ok(!output.includes(BLIND_SECRET));
});

// ---------------------------------------------------------------------------
// PA-08: incorporación de la clave v2; registros v1 legibles y reescritura v2.
// ---------------------------------------------------------------------------
test('PA-08: rotación de claves mantiene v1 legible y reescribe con v2', async () => {
  cryptoService.configure({ currentKeyVersion: 'v1' });

  await historyRepo.atencion_medica.create({
    data: {
      id_historia: 1n,
      id_medico: 1n,
      motivo_consulta: 'Dolor torácico',
      diagnostico_codigo: 'I20.9',
      diagnostico_descripcion: 'Angina de pecho'
    }
  });

  let stored = fakeDb.tables['atencion_medica'].get(2n);
  assert.ok(stored.motivo_consulta.startsWith('v1:'), 'El registro se escribió con v1');

  // Simular la incorporación de la clave v2 como versión activa.
  cryptoService.configure({
    encryptionKeys: { v1: KEY_V1, v2: KEY_V2 },
    currentKeyVersion: 'v2'
  });

  const stillReadable = await historyRepo.atencion_medica.findUnique({
    where: { id_atencion: 2n }
  });
  assert.equal(stillReadable.motivo_consulta, 'Dolor torácico', 'Un registro v1 debe leerse con la clave v1 retenida');

  const reencrypted = await historyRepo.reencryptRecord('atencion_medica', { id_atencion: 2n });
  assert.ok(reencrypted.motivo_consulta.startsWith('v2:'), 'La reescritura se guarda con v2');

  stored = fakeDb.tables['atencion_medica'].get(2n);
  assert.ok(stored.motivo_consulta.startsWith('v2:'));
  assert.ok(stored.diagnostico_codigo.startsWith('v2:'));

  const readAfterRotation = await historyRepo.atencion_medica.findUnique({
    where: { id_atencion: 2n }
  });
  assert.equal(readAfterRotation.motivo_consulta, 'Dolor torácico');
  assert.equal(readAfterRotation.diagnostico_codigo, 'I20.9');

  // Índice ciego HMAC de diagnóstico sigue permitiendo la búsqueda exacta.
  const found = await historyRepo.findByBlindIndex('atencion_medica', 'diagnostico_codigo', 'I20.9');
  assert.equal(found.length, 1);
  assert.equal(found[0].diagnostico_codigo, 'I20.9');

  // Restaurar v1 como versión activa para no afectar al resto de pruebas.
  cryptoService.configure({ currentKeyVersion: 'v1' });
  fakeDb.tables['atencion_medica'].delete(2n);
});

// ---------------------------------------------------------------------------
// Complementos: consentimientos y mensajes clínicos cifrados de forma
// transparente (contenido_documento y contenido_mensaje).
// ---------------------------------------------------------------------------
test('PA-01 complementario: consentimientos y mensajes clínicos también se cifran', async () => {
  const consentRepo = createEncryptedRepository(
    ['medico', 'paciente', 'cita', 'consentimiento_informado'],
    fakeDb
  );
  await consentRepo.consentimiento_informado.create({
    data: {
      id_paciente: 1n,
      id_medico: 1n,
      folio: 'CI-HU31-0001',
      procedimiento: 'Cirugía de rodilla',
      contenido: 'El paciente autoriza el procedimiento quirúrgico de forma voluntaria.'
    }
  });

  const rawConsent = fakeDb.tables['consentimiento_informado'].get(1n);
  assert.match(rawConsent.contenido, encryptedPattern);
  const readConsent = await consentRepo.consentimiento_informado.findUnique({
    where: { id_consentimiento: 1n }
  });
  assert.equal(readConsent.contenido, 'El paciente autoriza el procedimiento quirúrgico de forma voluntaria.');

  const messageRepo = createEncryptedRepository(
    ['historia_clinica', 'medico', 'mensaje_clinico'],
    fakeDb
  );
  await messageRepo.mensaje_clinico.create({
    data: {
      id_historia: 1n,
      id_medico: 1n,
      destinatario_role: 'CARDIOLOGO',
      contenido: 'Paciente con dolor torácico; sugiere derivación a cardiología.'
    }
  });
  const rawMessage = fakeDb.tables['mensaje_clinico'].get(1n);
  assert.match(rawMessage.contenido, encryptedPattern);
  const readMessage = await messageRepo.mensaje_clinico.findUnique({
    where: { id_mensaje: 1n }
  });
  assert.equal(readMessage.contenido, 'Paciente con dolor torácico; sugiere derivación a cardiología.');
});