/**
 * MED-205 (Caso de éxito): Proveedor real del SIN (SIAT / Impuestos
 * Nacionales de Bolivia) basado en la Facturación Electrónica en Línea (FEV).
 *
 * Variables de entorno requeridas (backend/.env):
 *   SIN_PROVIDER=SIN_REAL
 *   SIN_NIT=123456789            (NIT del emisor)
 *   SIN_TOKEN=...                (token de acceso al SIAT)
 *   SIN_HOST=https://pilotosiatservicios.impuestos.gob.bo
 *
 * Implementa la misma interfaz que MockSinProvider. Si no está configurado,
 * sin.service.js recurre automáticamente al proveedor simulado.
 */
class SinFiscalProvider {
  constructor() {
    this.nit = process.env.SIN_NIT || '';
    this.token = process.env.SIN_TOKEN || '';
    this.host = process.env.SIN_HOST || 'https://pilotosiatservicios.impuestos.gob.bo';
  }

  isConfigured() {
    return Boolean(this.nit && this.token);
  }

  async emitir({ factura, configuracion }) {
    if (!this.isConfigured()) {
      return {
        success: false,
        errorMessage: 'El proveedor del SIN no está configurado (faltan credenciales SIAT).'
      };
    }

    // Pendiente: integración con el servicio de recepción de factura del SIAT.
    // Este es el punto de extensión donde se enviaría el paquete XML firmado.
    throw new Error('SinFiscalProvider.emitir todavía no está implementado.');
  }
}

module.exports = SinFiscalProvider;
