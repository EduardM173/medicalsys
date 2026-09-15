const LocalStorageProvider = require('./local.provider');
const R2StorageProvider = require('./r2.provider');

class StorageService {
  constructor() {
    this.localProvider = new LocalStorageProvider();
    this.r2Provider = new R2StorageProvider();
  }

  getActiveProvider(forcedProvider = null) {
    const configuredProvider = forcedProvider || (process.env.STORAGE_PROVIDER || 'LOCAL').toUpperCase();
    if (configuredProvider === 'R2' && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY) {
      return this.r2Provider;
    }
    return this.localProvider;
  }

  async saveFile({ buffer, filename, mimeType, tenantCode = null }) {
    const provider = this.getActiveProvider();
    return provider.saveFile({ buffer, filename, mimeType, tenantCode });
  }

  async getFileStream(storageKey, storageProvider = null, tenantCode = null) {
    const provider = this.getActiveProvider(storageProvider);
    return provider.getFileStream(storageKey, tenantCode);
  }

  async deleteFile(storageKey, storageProvider = null) {
    const provider = this.getActiveProvider(storageProvider);
    return provider.deleteFile(storageKey);
  }
}

module.exports = new StorageService();
