class R2StorageProvider {
  constructor() {
    this.accountId = process.env.R2_ACCOUNT_ID;
    this.accessKeyId = process.env.R2_ACCESS_KEY_ID;
    this.secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    this.bucketName = process.env.R2_BUCKET_NAME;
    this.endpoint = process.env.R2_ENDPOINT || (this.accountId ? `https://${this.accountId}.r2.cloudflarestorage.com` : '');
    this.client = null;
  }

  getClient() {
    if (!this.client) {
      const { S3Client } = require('@aws-sdk/client-s3');
      this.client = new S3Client({
        region: 'auto',
        endpoint: this.endpoint,
        credentials: {
          accessKeyId: this.accessKeyId,
          secretAccessKey: this.secretAccessKey
        }
      });
    }
    return this.client;
  }

  async saveFile({ buffer, filename, mimeType }) {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    const client = this.getClient();
    const key = `clinical-documents/${filename}`;

    await client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: mimeType
    }));

    return {
      storageProvider: 'R2',
      storageKey: key
    };
  }

  async getFileStream(storageKey) {
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const client = this.getClient();

    try {
      const response = await client.send(new GetObjectCommand({
        Bucket: this.bucketName,
        Key: storageKey
      }));

      return {
        stream: response.Body,
        size: response.ContentLength
      };
    } catch (error) {
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        const notFoundError = new Error('El archivo no existe en el bucket de Cloudflare R2.');
        notFoundError.statusCode = 404;
        throw notFoundError;
      }
      throw error;
    }
  }

  async deleteFile(storageKey) {
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    const client = this.getClient();

    await client.send(new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey
    }));

    return true;
  }
}

module.exports = R2StorageProvider;
