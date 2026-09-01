const fs = require('fs');
const path = require('path');

class LocalStorageProvider {
  constructor() {
    this.uploadDir = path.join(process.cwd(), 'uploads', 'clinical-documents');
    this.ensureDirectoryExists();
  }

  ensureDirectoryExists() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async saveFile({ buffer, filename }) {
    this.ensureDirectoryExists();
    const targetPath = path.join(this.uploadDir, filename);
    await fs.promises.writeFile(targetPath, buffer);
    return {
      storageProvider: 'LOCAL',
      storageKey: filename
    };
  }

  async getFileStream(storageKey) {
    const targetPath = path.join(this.uploadDir, path.basename(storageKey));
    if (!fs.existsSync(targetPath)) {
      const error = new Error('El archivo físico no fue encontrado en el almacenamiento local.');
      error.statusCode = 404;
      throw error;
    }
    return {
      stream: fs.createReadStream(targetPath),
      size: (await fs.promises.stat(targetPath)).size
    };
  }

  async deleteFile(storageKey) {
    const targetPath = path.join(this.uploadDir, path.basename(storageKey));
    if (fs.existsSync(targetPath)) {
      await fs.promises.unlink(targetPath);
    }
    return true;
  }
}

module.exports = LocalStorageProvider;
