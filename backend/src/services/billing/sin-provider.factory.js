const MockSinFacturacionProvider = require('./mock-sin-facturacion.provider');

/**
 * Factory para obtener el proveedor de facturación activo (MED-186, MED-187).
 * Permite cambiar sin esfuerzo entre Mock y el proveedor real del SIN.
 */
class SinProviderFactory {
  static getProvider() {
    const providerType = process.env.SIN_PROVIDER || 'MOCK';

    switch (providerType.toUpperCase()) {
      case 'MOCK':
      default:
        return new MockSinFacturacionProvider();
    }
  }
}

module.exports = SinProviderFactory;
