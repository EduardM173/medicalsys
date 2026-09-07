const MockSinProvider = require('./mockSin.provider');
const SinFiscalProvider = require('./sinFiscal.provider');

/**
 * MED-184: Servicio adaptador del SIN (impuestos bolivianos). Aplica el
 * patrón "provider" ya usado por services/whatsapp y services/storage para
 * mantener aislada la lógica fiscal de la implementación concreta del SIAT.
 *
 * Proveedores disponibles vía SIN_PROVIDER:
 *   MOCK     -> no contacta el SIAT real, genera CUF/QR de prueba (por defecto)
 *   SIN_REAL -> integración real con el SIAT (requiere SIN_NIT y SIN_TOKEN)
 */
class SinFacturacionProvider {
  constructor() {
    this.mockProvider = new MockSinProvider();
    this.realProvider = new SinFiscalProvider();
  }

  getActiveProvider() {
    const configuredProvider = (process.env.SIN_PROVIDER || 'MOCK').toUpperCase();
    if (configuredProvider === 'SIN_REAL' && this.realProvider.isConfigured()) {
      return this.realProvider;
    }
    return this.mockProvider;
  }

  async emitir(facturaContext) {
    return this.getActiveProvider().emitir(facturaContext);
  }
}

module.exports = new SinFacturacionProvider();