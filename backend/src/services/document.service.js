const prisma = require('../config/prisma');
const storageService = require('./storage.service');

class DocumentError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function parseId(value, entity) {
  if (!/^\d+$/.test(String(value)) || BigInt(value) < 1n) {
    throw new DocumentError(400, `Identificador de ${entity} no válido.`);
  }
  return BigInt(value);
}

function toPatient(patient) {
  return {
    id: Number(patient.id_paciente),
    nombres: patient.nombres,
    apellidos: patient.apellidos,
    documentoIdentidad: patient.documento_identidad,
    complemento: patient.complemento
  };
}

function toDocument(document) {
  return {
    id: Number(document.id_documento),
    tipo: document.tipo,
    titulo: document.titulo,
    nombreArchivo: document.nombre_archivo,
    mimeType: document.mime_type,
    tamanoBytes: document.tamano_bytes === null ? null : Number(document.tamano_bytes),
    fechaRegistro: document.fecha_registro.toISOString(),
    atencion: document.atencion_medica ? {
      id: Number(document.atencion_medica.id_atencion),
      fechaAtencion: document.atencion_medica.fecha_atencion.toISOString(),
      motivoConsulta: document.atencion_medica.motivo_consulta
    } : null
  };
}

async function listDocumentsByPatientId(patientIdInput) {
  const patientId = parseId(patientIdInput, 'paciente');
  const patient = await prisma.paciente.findUnique({
    where: { id_paciente: patientId },
    select: {
      id_paciente: true,
      nombres: true,
      apellidos: true,
      documento_identidad: true,
      complemento: true,
      historia_clinica: {
        select: {
          documento_clinico: {
            orderBy: { fecha_registro: 'desc' },
            select: {
              id_documento: true,
              tipo: true,
              titulo: true,
              nombre_archivo: true,
              mime_type: true,
              tamano_bytes: true,
              fecha_registro: true,
              atencion_medica: {
                select: {
                  id_atencion: true,
                  fecha_atencion: true,
                  motivo_consulta: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!patient) {
    throw new DocumentError(404, 'Paciente no encontrado.');
  }

  return {
    patient: toPatient(patient),
    documents: patient.historia_clinica?.documento_clinico.map(toDocument) || []
  };
}

async function getDocumentFileById(documentIdInput) {
  const documentId = parseId(documentIdInput, 'documento');
  const document = await prisma.documento_clinico.findUnique({
    where: { id_documento: documentId },
    select: {
      nombre_archivo: true,
      storage_provider: true,
      storage_key: true,
      mime_type: true
    }
  });

  if (!document) {
    throw new DocumentError(404, 'Documento clínico no encontrado.');
  }

  const storedFile = await storageService.openFile(
    document.storage_provider,
    document.storage_key
  );
  return {
    ...storedFile,
    fileName: document.nombre_archivo,
    mimeType: document.mime_type
  };
}

module.exports = {
  DocumentError,
  getDocumentFileById,
  listDocumentsByPatientId
};
