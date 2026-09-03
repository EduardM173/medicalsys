const fs = require('fs');
const path = require('path');

const devStorageRoot = path.resolve(__dirname, '../../storage/dev');
const uploadsStorageRoot = path.resolve(__dirname, '../../uploads/clinical-documents');

class StorageError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 404;
  }
}

function resolveLocalPath(storageKey) {
  if (typeof storageKey !== 'string' || !storageKey.trim() || path.isAbsolute(storageKey)) {
    throw new StorageError('El archivo asociado al documento no está disponible.');
  }

  const cleanKey = path.basename(storageKey);

  // 1. Revisar en uploads/clinical-documents (subidos en tiempo de ejecución por HU-18)
  const uploadPath = path.resolve(uploadsStorageRoot, cleanKey);
  if (fs.existsSync(uploadPath)) {
    return uploadPath;
  }

  // 2. Revisar en storage/dev (archivos iniciales de prueba HU-13)
  const devPath = path.resolve(devStorageRoot, cleanKey);
  if (fs.existsSync(devPath)) {
    return devPath;
  }

  throw new StorageError('El archivo asociado al documento no está disponible.');
}

async function openFile(storageProvider, storageKey) {
  if (storageProvider !== 'LOCAL') {
    throw new StorageError('El archivo asociado al documento no está disponible.');
  }

  const filePath = resolveLocalPath(storageKey);
  let stats;
  try {
    stats = await fs.promises.stat(filePath);
  } catch (_error) {
    throw new StorageError('El archivo asociado al documento no está disponible.');
  }

  if (!stats.isFile()) {
    throw new StorageError('El archivo asociado al documento no está disponible.');
  }

  return {
    size: stats.size,
    stream: fs.createReadStream(filePath)
  };
}

module.exports = { openFile, StorageError };
