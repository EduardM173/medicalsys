const fs = require('fs');
const path = require('path');

const developmentStorageRoot = path.resolve(__dirname, '../../storage/dev');

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

  const filePath = path.resolve(developmentStorageRoot, storageKey);
  if (!filePath.startsWith(`${developmentStorageRoot}${path.sep}`)) {
    throw new StorageError('El archivo asociado al documento no está disponible.');
  }
  return filePath;
}

async function openFile(storageProvider, storageKey) {
  if (storageProvider !== 'LOCAL') {
    throw new StorageError('El archivo asociado al documento no está disponible.');
  }

  const filePath = resolveLocalPath(storageKey);
  let stats;
  try {
    stats = await fs.promises.stat(filePath);
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error(`Archivo clínico local no disponible para la referencia ${storageKey}.`);
    }
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
