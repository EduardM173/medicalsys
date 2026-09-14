const database = require('../config/prisma');
const { createRepository } = require('./repository.factory');
const {
  decrypt,
  encrypt,
  generateBlindIndex,
  isEncrypted,
  reencryptValue
} = require('../services/crypto.service');

/**
 * Capa de repositorios con cifrado transparente (HU-31 / MED-298).
 *
 * La transformación cifrado/descifrado ocurre EXCLUSIVAMENTE aquí: los
 * servicios y controladores continúan operando con texto plano en memoria
 * mientras que lo persistido en PostgreSQL es ciphertext autenticado.
 *
 * Campos sensibles clasificados:
 *  - historia_clinica           antecedentes, alergias, condiciones_cronicas, observaciones_generales
 *  - atencion_medica            motivo_consulta, anamnesis, diagnostico_codigo,
 *                               diagnostico_descripcion, tratamiento, observaciones
 *  - receta                     indicaciones
 *  - consentimiento_informado   contenido (documento del consentimiento)
 *  - mensaje_clinico            contenido (mensaje clínico)
 */

const ENCRYPTED_FIELDS = {
  historia_clinica: [
    'antecedentes',
    'alergias',
    'condiciones_cronicas',
    'observaciones_generales'
  ],
  atencion_medica: [
    'motivo_consulta',
    'anamnesis',
    'diagnostico_codigo',
    'diagnostico_descripcion',
    'tratamiento',
    'observaciones'
  ],
  receta: ['indicaciones'],
  consentimiento_informado: ['contenido'],
  mensaje_clinico: ['contenido']
};

/**
 * Columna compañera para el índice ciego HMAC de cada campo cifrado que
 * admite búsquedas exactas sin descifrar la base completa (MED-299).
 */
const BLIND_INDEX_FIELDS = {
  atencion_medica: {
    diagnostico_codigo: 'diagnostico_codigo_blind_index'
  }
};

const WRITE_KEYS = ['create', 'createMany', 'update', 'updateMany', 'upsert'];
const READ_KEYS = ['findFirst', 'findMany', 'findUnique'];

function modelEncryptedFields(modelName) {
  return ENCRYPTED_FIELDS[modelName] || [];
}

function encryptAssignment(modelName, assignment) {
  if (!assignment || typeof assignment !== 'object') return assignment;
  const result = { ...assignment };
  const blindMap = BLIND_INDEX_FIELDS[modelName] || {};
  for (const field of modelEncryptedFields(modelName)) {
    if (!Object.prototype.hasOwnProperty.call(result, field)) continue;
    const value = result[field];
    if (typeof value === 'string' && isEncrypted(value)) continue;
    result[field] = encrypt(value);
    if (typeof value === 'string' && value.trim() && blindMap[field]) {
      result[blindMap[field]] = generateBlindIndex(value);
    }
  }
  return result;
}

function decryptTree(node) {
  if (node instanceof Date) return node;
  if (Array.isArray(node)) return node.map(decryptTree);
  if (node && typeof node === 'object') {
    const output = {};
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === 'string' && isEncrypted(value)) {
        output[key] = decrypt(value);
      } else {
        output[key] = decryptTree(value);
      }
    }
    return output;
  }
  return node;
}

function wrapEncryptedModel(methodGateway, modelName) {
  const wrapper = {};
  for (const operation of Object.keys(methodGateway)) {
    if (WRITE_KEYS.includes(operation)) {
      wrapper[operation] = (...args) => {
        const arg = args[0] ? { ...args[0] } : args[0];
        if (operation === 'createMany') {
          arg.data = arg.data.map((item) => encryptAssignment(modelName, item));
        } else if (operation === 'upsert') {
          arg.create = encryptAssignment(modelName, arg.create);
          arg.update = encryptAssignment(modelName, arg.update);
        } else {
          arg.data = encryptAssignment(modelName, arg.data);
        }
        // create/update/upsert devuelven la fila creada/actualizada: el
        // resultado se descifra para que los servicios solo vean texto plano.
        return Promise.resolve(methodGateway[operation](arg)).then(decryptTree);
      };
    } else if (READ_KEYS.includes(operation)) {
      wrapper[operation] = (...args) =>
        Promise.resolve(methodGateway[operation](...args)).then(decryptTree);
    } else {
      wrapper[operation] = methodGateway[operation];
    }
  }
  return wrapper;
}

/**
 * Crea un repositorio con cifrado transparente de campos sensibles, soporte
 * de índices ciegos (MED-299) y reencripción para rotación de claves (MED-300).
 */
function createEncryptedRepository(modelNames, client = database, decorate = null) {
  const base = createRepository(modelNames, client, decorate);
  const repo = { ...base };

  for (const modelName of modelNames) {
    // Se envuelven TODOS los modelos: aunque la escritura solo cifra campos
    // del propio modelo, los resultados de lectura pueden contener campos
    // cifrados anidados (ej. paciente -> historia_clinica -> atencion_medica).
    repo[modelName] = wrapEncryptedModel(base[modelName], modelName);
  }

  repo.transaction = (work, options) => client.$transaction(
    (transactionClient) => work(createEncryptedRepository(modelNames, transactionClient, decorate)),
    options
  );

  /**
   * Rotación de claves: relee una fila, descifra con su versión original y
   * reescribe todos sus campos sensibles con la clave activa actual (PA-08).
   */
  repo.reencryptRecord = async (modelName, where) => {
    if (!modelEncryptedFields(modelName).length) {
      throw new Error(`El modelo ${modelName} no posee campos cifrados.`);
    }
    const raw = await base[modelName].findUnique({ where });
    if (!raw) return null;
    const data = {};
    for (const field of modelEncryptedFields(modelName)) {
      if (typeof raw[field] === 'string' && isEncrypted(raw[field])) {
        data[field] = reencryptValue(raw[field]);
      }
    }
    if (Object.keys(data).length > 0) {
      await base[modelName].update({ where, data });
    }
    return { ...raw, ...data };
  };

  /**
   * Búsqueda exacta por índice ciego HMAC-SHA256 sin descifrar la tabla
   * completa (MED-299). Devuelve las filas ya descifradas.
   */
  repo.findByBlindIndex = async (modelName, field, value) => {
    const blindMap = BLIND_INDEX_FIELDS[modelName] || {};
    const blindColumn = blindMap[field];
    if (!blindColumn) {
      throw new Error(`El campo ${modelName}.${field} no tiene índice ciego configurado.`);
    }
    const index = generateBlindIndex(value);
    const rows = await base[modelName].findMany({ where: { [blindColumn]: index } });
    return decryptTree(rows);
  };

  return Object.freeze(repo);
}

module.exports = {
  BLIND_INDEX_FIELDS,
  ENCRYPTED_FIELDS,
  createEncryptedRepository
};