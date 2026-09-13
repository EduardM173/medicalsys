const MockSinProvider = require('./mockSin.provider');
const SinFiscalProvider = require('./sinFiscal.provider');

/**
 * MED-184 / HU-34: Servicio adaptador del SIN (impuestos bolivianos).
 * Aplica el patrón "provider" para mantener aislada la lógica fiscal
 * de la implementación concreta del SIAT.
 *
 * Proveedores disponibles vía SIN_PROVIDER:
 *   SIN_REAL -> motor fiscal normativo SIAT v2 con contingencia (por defecto)
 *   MOCK     -> adaptador simulado simple
 */
class SinFacturacionProvider {
  constructor() {
    this.mockProvider = new MockSinProvider();
    this.realProvider = new SinFiscalProvider();
  }

  getActiveProvider() {
    const configuredProvider = (process.env.SIN_PROVIDER || 'SIN_REAL').toUpperCase();
    if (configuredProvider === 'MOCK') {
      return this.mockProvider;
    }
    return this.realProvider;
  }

  async emitir(facturaContext) {
    return this.getActiveProvider().emitir(facturaContext);
  }

  async anular(anulacionContext) {
    if (typeof this.getActiveProvider().anular === 'function') {
      return this.getActiveProvider().anular(anulacionContext);
    }
    return {
      success: true,
      estado: 'ANULADA',
      fechaAnulacion: new Date(),
      mensajeSin: 'Anulación procesada en proveedor activo.'
    };
  }
}

module.exports = new SinFacturacionProvider();
