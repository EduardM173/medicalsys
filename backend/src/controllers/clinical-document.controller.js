const clinicalDocumentService = require('../services/clinical-document.service');

async function uploadDocument(req, res, next) {
  try {
    const { patientId } = req.params;
    const { attentionId, tipo, titulo } = req.body;
    const file = req.file;
    const userId = req.user?.idUsuario;

    const document = await clinicalDocumentService.uploadDocument({
      patientId,
      attentionId,
      userId,
      file,
      tipo,
      titulo
    });

    return res.status(201).json({
      message: 'Documento clínico adjuntado exitosamente.',
      document
    });
  } catch (error) {
    return next(error);
  }
}

async function getPatientDocuments(req, res, next) {
  try {
    const { patientId } = req.params;
    const { tipo } = req.query;

    const documents = await clinicalDocumentService.getPatientDocuments(patientId, { tipo });
    return res.status(200).json(documents);
  } catch (error) {
    return next(error);
  }
}

async function downloadDocument(req, res, next) {
  try {
    const { documentId } = req.params;
    const { stream, mimeType, filename, hashSha256 } = await clinicalDocumentService.getDocumentDownloadStream(documentId);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('X-Document-SHA256', hashSha256 || '');

    stream.pipe(res);
  } catch (error) {
    return next(error);
  }
}

async function deleteDocument(req, res, next) {
  try {
    const { documentId } = req.params;
    const result = await clinicalDocumentService.deleteDocument(documentId);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  uploadDocument,
  getPatientDocuments,
  downloadDocument,
  deleteDocument
};
