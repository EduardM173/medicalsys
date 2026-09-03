/**
 * Puerto / Interfaz de Facturación SIN Bolivia (MED-186)
 * Define el contrato que debe implementar cualquier proveedor de facturación
 * (Mock para desarrollo, SIAT SOAP/REST para producción).
 */
class ISinFacturacionProvider {
  /**
   * Emite una factura computarizada ante el Servicio de Impuestos Nacionales (SIN).
   * 
   * @param {Object} data
   * @param {string} data.numeroFactura - Número secuencial de la factura
   * @param {string} data.nitCi - NIT o documento de identidad del receptor
   * @param {string} [data.complemento] - Complemento de documento (opcional)
   * @param {string} data.razonSocial - Razón social o nombre completo del receptor
   * @param {string} [data.emailReceptor] - Correo electrónico del receptor
   * @param {string} data.metodoPago - Método de pago utilizado (EFECTIVO, QR, TARJETA, etc.)
   * @param {number} data.subtotal - Subtotal de la factura
   * @param {number} data.total - Monto total a cobrar
   * @param {Array<Object>} data.items - Lista de ítems/prestaciones médicas
   * @param {Object} data.clinica - Datos de la clínica emisora (NIT, Razón Social, etc.)
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
  async emitirFactura(_data) {
    throw new Error('Método emitirFactura() debe ser implementado por el proveedor de facturación.');
  }
}

module.exports = ISinFacturacionProvider;
