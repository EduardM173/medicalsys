const crypto = require('crypto');
const path = require('path');
const prisma = require('../config/prisma');
const storageService = require('./storage/storage.service');

const VALID_DOCUMENT_TYPES = ['EXAMEN', 'RADIOGRAFIA', 'CONSENTIMIENTO', 'RECETA', 'INFORME', 'OTRO'];

function serializeDocument(doc) {
  if (!doc) return null;
  return {
    id: doc.id_documento.toString(),
    idHistoria: doc.id_historia.toString(),
    idAtencion: doc.id_atencion ? doc.id_atencion.toString() : null,
    subidoPor: doc.subido_por ? doc.subido_por.toString() : null,
    uploader: doc.usuario ? {
      id: doc.usuario.id_usuario.toString(),
      nombreCompleto: `${doc.usuario.nombres} ${doc.usuario.apellidos}`.trim(),
      email: doc.usuario.email
    } : null,
    tipo: doc.tipo,
    titulo: doc.titulo,
    nombreArchivo: doc.nombre_archivo,
    storageProvider: doc.storage_provider,
    storageKey: doc.storage_key,
    mimeType: doc.mime_type,
    tamanoBytes: doc.tamano_bytes ? Number(doc.tamano_bytes) : 0,
    hashSha256: doc.hash_sha256,
    fechaRegistro: doc.fecha_registro.toISOString(),
    atencion: doc.atencion_medica ? {
      id: doc.atencion_medica.id_atencion.toString(),
      motivoConsulta: doc.atencion_medica.motivo_consulta,
      fechaAtencion: doc.atencion_medica.fecha_atencion.toISOString()
    } : null
  };
}

class ClinicalDocumentService {
  async getOrCreateHistory(patientId) {
    const pId = BigInt(patientId);
    let history = await prisma.historia_clinica.findUnique({
      where: { id_paciente: pId }
    });

    if (!history) {
      history = await prisma.historia_clinica.create({
        data: {
          id_paciente: pId,
          fecha_apertura: new Date()
        }
      });
    }

    return history;
  }

  async uploadDocument({ patientId, attentionId, userId, file, tipo, titulo }) {
    if (!file || !file.buffer) {
      const error = new Error('Debe adjuntar un archivo válido.');
      error.statusCode = 400;
      throw error;
    }

    if (!titulo || !titulo.trim()) {
      const error = new Error('El título del documento es obligatorio.');
      error.statusCode = 400;
      throw error;
    }

    const upperTipo = (tipo || 'OTRO').toUpperCase();
    if (!VALID_DOCUMENT_TYPES.includes(upperTipo)) {
      const error = new Error(`Tipo de documento no válido. Tipos aceptados: ${VALID_DOCUMENT_TYPES.join(', ')}`);
      error.statusCode = 400;
      throw error;
    }

    // Verificar que el paciente exista
    const pId = BigInt(patientId);
    const patient = await prisma.paciente.findUnique({
      where: { id_paciente: pId }
    });

    if (!patient) {
      const error = new Error('El paciente especificado no existe.');
      error.statusCode = 404;
      throw error;
    }

    // Obtener o crear la historia clínica
    const history = await this.getOrCreateHistory(patientId);

    // Si viene attentionId, verificar que exista y pertenezca a la historia clínica
    let attId = null;
    if (attentionId) {
      attId = BigInt(attentionId);
      const attention = await prisma.atencion_medica.findFirst({
        where: {
          id_atencion: attId,
          id_historia: history.id_historia
        }
      });
      if (!attention) {
        const error = new Error('La atención médica especificada no pertenece a la historia clínica del paciente.');
        error.statusCode = 400;
        throw error;
      }
    }

    // Calcular hash SHA-256 para integridad clínica y auditoría
    const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');

    // Generar nombre de archivo único
    const ext = path.extname(file.originalname) || '';
    const safeUUID = crypto.randomUUID();
    const storedFilename = `${Date.now()}-${safeUUID}${ext}`;

    // Guardar en Storage Provider activo (Local o R2)
    const storageResult = await storageService.saveFile({
      buffer: file.buffer,
      filename: storedFilename,
      mimeType: file.mimetype
    });

    // Guardar en Base de Datos
    const createdDoc = await prisma.documento_clinico.create({
      data: {
        id_historia: history.id_historia,
        id_atencion: attId,
        subido_por: userId ? BigInt(userId) : null,
        tipo: upperTipo,
        titulo: titulo.trim(),
        nombre_archivo: file.originalname,
        storage_provider: storageResult.storageProvider,
        storage_key: storageResult.storageKey,
        mime_type: file.mimetype,
        tamano_bytes: BigInt(file.size),
        hash_sha256: sha256
      },
      include: {
        usuario: true,
        atencion_medica: true
      }
    });

    return serializeDocument(createdDoc);
  }

  async getPatientDocuments(patientId, filters = {}) {
    const pId = BigInt(patientId);
    const history = await prisma.historia_clinica.findUnique({
      where: { id_paciente: pId }
    });

    if (!history) {
      return [];
    }

    const where = {
      id_historia: history.id_historia
    };

    if (filters.tipo && VALID_DOCUMENT_TYPES.includes(filters.tipo.toUpperCase())) {
      where.tipo = filters.tipo.toUpperCase();
    }

    const docs = await prisma.documento_clinico.findMany({
      where,
      orderBy: { fecha_registro: 'desc' },
      include: {
        usuario: true,
        atencion_medica: true
      }
    });

    return docs.map(serializeDocument);
  }

  async getDocumentById(documentId) {
    const docId = BigInt(documentId);
    const doc = await prisma.documento_clinico.findUnique({
      where: { id_documento: docId },
      include: {
        usuario: true,
        atencion_medica: true,
        historia_clinica: {
          include: { paciente: true }
        }
      }
    });

    if (!doc) {
      const error = new Error('Documento clínico no encontrado.');
      error.statusCode = 404;
      throw error;
    }

    return doc;
  }

  async getDocumentDownloadStream(documentId) {
    const doc = await this.getDocumentById(documentId);
    const { stream, size } = await storageService.getFileStream(doc.storage_key, doc.storage_provider);

    return {
      stream,
      size,
      mimeType: doc.mime_type || 'application/octet-stream',
      filename: doc.nombre_archivo,
      hashSha256: doc.hash_sha256
    };
  }

  async deleteDocument(documentId) {
    const doc = await this.getDocumentById(documentId);

    // Eliminar archivo del storage provider
    try {
      await storageService.deleteFile(doc.storage_key, doc.storage_provider);
    } catch (err) {
      console.warn(`No se pudo eliminar archivo físico ${doc.storage_key}:`, err.message);
    }

    // Eliminar registro en base de datos
    await prisma.documento_clinico.delete({
      where: { id_documento: doc.id_documento }
    });

    return { success: true, message: 'Documento eliminado exitosamente.' };
  }
}

module.exports = new ClinicalDocumentService();
