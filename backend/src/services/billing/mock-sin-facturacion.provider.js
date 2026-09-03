const crypto = require('crypto');
const ISinFacturacionProvider = require('./sin-facturacion.provider');

/**
 * Adaptador Mock para Facturación Computarizada SIN Bolivia (MED-186, MED-187)
 * Simula el comportamiento del Servicio de Impuestos Nacionales (SIAT).
 */
class MockSinFacturacionProvider extends ISinFacturacionProvider {
  /**
   * Genera un Código Único de Facturación (CUF) algorítmico de 64 caracteres alfanuméricos.
   * 
   * @param {string} nitEmisor - NIT de la clínica
   * @param {Date} fechaEmision - Fecha y hora oficial
   * @param {string} numeroFactura - Número secuencial de factura
   * @param {string} nitCiReceptor - Documento del receptor
   * @returns {string} CUF de 64 caracteres hexadecimales en mayúsculas
   */
  generarCUF(nitEmisor, fechaEmision, numeroFactura, nitCiReceptor) {
    const rawData = `${nitEmisor || '1028472021'}-${fechaEmision.toISOString()}-${numeroFactura}-${nitCiReceptor || '0'}-${crypto.randomBytes(8).toString('hex')}`;
    // SHA-256 produce exactamente 64 caracteres hexadecimales
    return crypto.createHash('sha256').update(rawData).digest('hex').toUpperCase();
  }

  /**
   * Genera el payload reglamentario del Código QR según normativa del SIN.
   * Enlace oficial de consulta pública SIAT o cadena concatenada según corresponda.
   * 
   * @param {Object} params
   * @param {string} params.nitEmisor
   * @param {string} params.cuf
   * @param {string} params.numeroFactura
   * @param {number} params.total
   * @param {Date} params.fechaEmision
   * @param {string} params.nitCiReceptor
   * @returns {string} URL / payload normativo para QR
   */
  generarQRPayload({ nitEmisor, cuf, numeroFactura, total, fechaEmision, nitCiReceptor }) {
    const nit = nitEmisor || '1028472021';
    const totalFormateado = Number(total || 0).toFixed(2);
    // Formato oficial de consulta pública del SIAT
    return `https://siat.impuestos.gob.bo/consulta/QR?nit=${nit}&cuf=${cuf}&numero=${numeroFactura}&t=${totalFormateado}`;
  }

  /**
   * Emite una factura computarizada simulada.
   * 
   * @param {Object} data
   * @returns {Promise<{
   *   exito: boolean,
   *   cuf: string,
   *   referenciaSin: string,
   *   codigoAutorizacion: string,
   *   fechaEmision: Date,
   *   qrPayload: string,
   *   mensaje: string
   * }>}
   */
  async emitirFactura(data) {
    const fechaEmision = new Date();
    const nitEmisor = data.clinica?.nit || '1028472021';
    const cuf = this.generarCUF(nitEmisor, fechaEmision, data.numeroFactura, data.nitCi);
    const referenciaSin = `SIN-AUT-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const codigoAutorizacion = referenciaSin;
    const qrPayload = this.generarQRPayload({
      nitEmisor,
      cuf,
      numeroFactura: data.numeroFactura,
      total: data.total,
      fechaEmision,
      nitCiReceptor: data.nitCi
    });

    return {
      exito: true,
      cuf,
      referenciaSin,
      codigoAutorizacion,
      fechaEmision,
      qrPayload,
      mensaje: 'Factura validada y autorizada exitosamente por el Servicio de Impuestos Nacionales.'
    };
  }
}

module.exports = MockSinFacturacionProvider;
