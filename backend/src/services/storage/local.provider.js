const fs = require('fs');
const path = require('path');

class LocalStorageProvider {
  constructor() {
    this.uploadDir = path.resolve(__dirname, '../../../uploads/clinical-documents');
    this.devDir = path.resolve(__dirname, '../../../storage/dev');
    this.ensureDirectoryExists();
  }

  ensureDirectoryExists() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async saveFile({ buffer, filename }) {
    this.ensureDirectoryExists();
    const cleanFilename = path.basename(filename);
    const targetPath = path.join(this.uploadDir, cleanFilename);
    await fs.promises.writeFile(targetPath, buffer);
    return {
      storageProvider: 'LOCAL',
      storageKey: cleanFilename
    };
  }

  async getFileStream(storageKey) {
    const cleanKey = path.basename(storageKey);

    // 1. Buscar en uploads/clinical-documents
    let targetPath = path.join(this.uploadDir, cleanKey);
    if (!fs.existsSync(targetPath)) {
      // 2. Buscar en storage/dev
      targetPath = path.join(this.devDir, cleanKey);
    }

    if (!fs.existsSync(targetPath)) {
      const error = new Error('El archivo asociado al documento no está disponible.');
      error.statusCode = 404;
      throw error;
    }

    const stats = await fs.promises.stat(targetPath);
    return {
      stream: fs.createReadStream(targetPath),
      size: stats.size
    };
  }

  async deleteFile(storageKey) {
    const cleanKey = path.basename(storageKey);
    const targetPath = path.join(this.uploadDir, cleanKey);
    if (fs.existsSync(targetPath)) {
      await fs.promises.unlink(targetPath);
    }
    return true;
  }
}

module.exports = LocalStorageProvider;
