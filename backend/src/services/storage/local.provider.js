const fs = require('fs');
const path = require('path');

class LocalStorageProvider {
  constructor() {
    this.baseUploadsDir = path.resolve(__dirname, '../../../uploads');
    this.uploadDir = path.resolve(__dirname, '../../../uploads/clinical-documents');
    this.devDir = path.resolve(__dirname, '../../../storage/dev');
    this.ensureDirectoryExists();
  }

  ensureDirectoryExists(customDir = null) {
    const dir = customDir || this.uploadDir;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  getTenantUploadDir(tenantCode) {
    if (!tenantCode) return this.uploadDir;
    const cleanTenant = path.basename(tenantCode.toLowerCase());
    const tenantDir = path.join(this.baseUploadsDir, 'tenants', cleanTenant, 'clinical-documents');
    this.ensureDirectoryExists(tenantDir);
    return {
      dir: tenantDir,
      keyPrefix: `tenants/${cleanTenant}/clinical-documents/`
    };
  }

  async saveFile({ buffer, filename, tenantCode = null }) {
    const cleanFilename = path.basename(filename);
    if (tenantCode) {
      const { dir, keyPrefix } = this.getTenantUploadDir(tenantCode);
      const targetPath = path.join(dir, cleanFilename);
      await fs.promises.writeFile(targetPath, buffer);
      return {
        storageProvider: 'LOCAL',
        storageKey: `${keyPrefix}${cleanFilename}`
      };
    }

    this.ensureDirectoryExists();
    const targetPath = path.join(this.uploadDir, cleanFilename);
    await fs.promises.writeFile(targetPath, buffer);
    return {
      storageProvider: 'LOCAL',
      storageKey: cleanFilename
    };
  }

  async getFileStream(storageKey, tenantCode = null) {
    let targetPath = null;

    if (typeof storageKey === 'string' && storageKey.startsWith('tenants/')) {
      // Si el storageKey es particionado por tenant
      const normalizedKey = path.normalize(storageKey).replace(/^(\.\.[\/\\])+/, '');
      if (tenantCode) {
        const cleanTenant = path.basename(tenantCode.toLowerCase());
        const expectedPrefix = `tenants${path.sep}${cleanTenant}${path.sep}`;
        if (!normalizedKey.startsWith(expectedPrefix) && !normalizedKey.startsWith(`tenants/${cleanTenant}/`)) {
          const error = new Error('Acceso denegado: El documento pertenece a otra organización.');
          error.statusCode = 403;
          throw error;
        }
      }
      targetPath = path.resolve(this.baseUploadsDir, normalizedKey);
    } else {
      const cleanKey = path.basename(storageKey);
      // 1. Buscar en uploads/clinical-documents
      targetPath = path.join(this.uploadDir, cleanKey);
      if (!fs.existsSync(targetPath)) {
        // 2. Buscar en storage/dev
        targetPath = path.join(this.devDir, cleanKey);
      }
    }

    if (!targetPath || !fs.existsSync(targetPath)) {
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
    let targetPath = null;
    if (typeof storageKey === 'string' && storageKey.startsWith('tenants/')) {
      const normalizedKey = path.normalize(storageKey).replace(/^(\.\.[\/\\])+/, '');
      targetPath = path.resolve(this.baseUploadsDir, normalizedKey);
    } else {
      const cleanKey = path.basename(storageKey);
      targetPath = path.join(this.uploadDir, cleanKey);
    }

    if (targetPath && fs.existsSync(targetPath)) {
      await fs.promises.unlink(targetPath);
    }
    return true;
  }
}

module.exports = LocalStorageProvider;
