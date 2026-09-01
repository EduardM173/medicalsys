const multer = require('multer');

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/dicom',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error('Formato de archivo no permitido. Solo se aceptan PDFs, imágenes médicas (JPEG/PNG/WEBP), DICOM o documentos Word.');
    error.statusCode = 400;
    cb(error, false);
  }
};

const uploadClinicalDocument = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES
  },
  fileFilter
});

module.exports = {
  uploadClinicalDocument,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES
};
