const documentService = require('../services/document.service');

async function listPatientDocuments(request, response, next) {
  try {
    const result = await documentService.listDocumentsByPatientId(request.params.patientId);
    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function openDocumentFile(request, response, next) {
  try {
    const file = await documentService.getDocumentFileById(request.params.documentId);
    response.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    response.setHeader('Content-Length', String(file.size));
    response.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`
    );
    file.stream.on('error', () => {
      if (!response.headersSent) {
        const error = new Error('El archivo asociado al documento no está disponible.');
        error.statusCode = 404;
        next(error);
      } else {
        response.end();
      }
    });
    file.stream.pipe(response);
  } catch (error) {
    next(error);
  }
}

module.exports = { listPatientDocuments, openDocumentFile };
