const crypto = require('crypto');

/**
 * MED-188: Proveedor simulado del SIN (SIAT/Impuestos Nacionales) para
 * desarrollo y pruebas. Implementa la misma interfaz que el proveedor real
 * (sinFiscal.provider.js) para que billing.service.js sea independiente del
 * proveedor concreto que se use en cada entorno.
 *
 * En ausencia de credenciales reales del SIN, este adaptador genera un CUF
 * de 64 caracteres, una cadena de consulta QR oficial y una respuesta de
 * autorización simulada, sin realizar llamadas reales a Impuestos Nacionales.
 */
class MockSinProvider {
  isConfigured() {
    return true;
  }

  async emitir({ factura, configuracion }) {
    await new Promise((resolve) => setTimeout(resolve, 120));

    const cuf = this.buildCuf(configuracion.nit, factura.numero_factura);
    const fechaEmision = factura.fecha_emision || new Date();
    const qrPayload = this.buildQrPayload({ cuf, factura, configuracion, fechaEmision });

    return {
      success: true,
      cuf,
      qrPayload,
      sinEstado: 'SIMULADA',
      codigoAutorizacion: `AUT-${crypto.randomBytes(8).toString('hex').toUpperCase()}`,
      sinReferencia: `SIN-MOCK-${crypto.randomUUID()}`,
      fechaEmision
    };
  }

  buildCuf(nit, numeroFactura) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(24).toString('hex').toUpperCase();
    const cuf = `CUF-${nit}-${numeroFactura}-${timestamp}-${random}`;
    return Buffer.from(cuf).toString('hex').slice(0, 64).padEnd(64, '0').toUpperCase();
  }

  buildQrPayload({ cuf, factura, configuracion, fechaEmision }) {
    const isoDate = fechaEmision.toISOString().replace(/\.\d{3}Z$/, '');
    return [
      cuf,
      factura.codigo_autorizacion || '',
      String(configuracion.nit),
      isoDate,
      String(factura.monto_credito_fiscal || 0),
      String(factura.subtotal || 0),
      String(factura.total || 0),
      String(factura.metodo_pago || 'EFECTIVO'),
      String(factura.numero_factura)
    ].join('|');
  }
}

module.exports = MockSinProvider;
