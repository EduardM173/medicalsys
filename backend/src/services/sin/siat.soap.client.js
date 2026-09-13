/**
 * MED-205 / HU-34: Cliente SOAP ligero para interoperar con los Web Services WSDL
 * del SIN (SIAT v2 - Facturación Computarizada en Línea / Piloto).
 */

class SiatSoapClient {
  constructor({ host, token, timeoutMs = 4000 } = {}) {
    this.host = host || process.env.SIN_HOST || 'https://pilotosiatservicios.impuestos.gob.bo';
    this.token = token || process.env.SIN_TOKEN || '';
    this.timeoutMs = timeoutMs;
  }

  async sendSoapRequest(servicePath, soapAction, soapBody) {
    const url = `${this.host}${servicePath}`;
    const envelope = [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:siat="https://siat.impuestos.gob.bo/">',
      '<soapenv:Header/>',
      '<soapenv:Body>',
      soapBody,
      '</soapenv:Body>',
      '</soapenv:Envelope>'
    ].join('');

    const headers = {
      'Content-Type': 'text/xml;charset=UTF-8',
      'SOAPAction': soapAction || ''
    };

    if (this.token) {
      headers['apikey'] = `TokenApi ${this.token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: envelope,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const text = await response.text();

      if (!response.ok) {
        return {
          success: false,
          isCommunicationError: true,
          status: response.status,
          error: `Error HTTP ${response.status} en servicio SIN: ${text.slice(0, 200)}`
        };
      }

      return {
        success: true,
        status: response.status,
        rawXml: text
      };
    } catch (err) {
      clearTimeout(timeoutId);
      return {
        success: false,
        isCommunicationError: true,
        error: err.name === 'AbortError'
          ? 'Timeout de conexión con el servidor SIAT de Impuestos Nacionales.'
          : `Falla de comunicación con el SIAT: ${err.message}`
      };
    }
  }

  async verificarComunicacion() {
    const body = '<siat:verificarComunicacion/>';
    return this.sendSoapRequest('/v2/FacturacionCodigos', 'verificarComunicacion', body);
  }

  async solicitarCuis({ nit, codigoSistema, codigoSucursal = 0, codigoModalidad = 2, codigoPuntoVenta = 0 }) {
    const body = `
      <siat:solicitudCuis>
        <codigoAmbiente>2</codigoAmbiente>
        <codigoModalidad>${codigoModalidad}</codigoModalidad>
        <codigoPuntoVenta>${codigoPuntoVenta}</codigoPuntoVenta>
        <codigoSistema>${codigoSistema}</codigoSistema>
        <codigoSucursal>${codigoSucursal}</codigoSucursal>
        <nit>${nit}</nit>
      </siat:solicitudCuis>
    `;
    return this.sendSoapRequest('/v2/FacturacionCodigos', 'cuis', body);
  }

  async solicitarCufd({ nit, codigoSistema, codigoSucursal = 0, codigoModalidad = 2, codigoPuntoVenta = 0, cuis }) {
    const body = `
      <siat:solicitudCufd>
        <codigoAmbiente>2</codigoAmbiente>
        <codigoModalidad>${codigoModalidad}</codigoModalidad>
        <codigoPuntoVenta>${codigoPuntoVenta}</codigoPuntoVenta>
        <codigoSistema>${codigoSistema}</codigoSistema>
        <codigoSucursal>${codigoSucursal}</codigoSucursal>
        <cuis>${cuis}</cuis>
        <nit>${nit}</nit>
      </siat:solicitudCufd>
    `;
    return this.sendSoapRequest('/v2/FacturacionCodigos', 'cufd', body);
  }

  async recepcionFactura({ archivoGzipBase64, fechaEmision, hashArchivo }) {
    const body = `
      <siat:solicitudRecepcionFactura>
        <archivo>${archivoGzipBase64}</archivo>
        <fechaEnvio>${fechaEmision}</fechaEnvio>
        <hashArchivo>${hashArchivo}</hashArchivo>
      </siat:solicitudRecepcionFactura>
    `;
    return this.sendSoapRequest('/v2/ServicioFacturacionCompraVenta', 'recepcionFactura', body);
  }

  async anulacionFactura({ cuf, motivoAnulacion = 1, nit, codigoSucursal = 0, codigoPuntoVenta = 0 }) {
    const body = `
      <siat:solicitudAnulacionFactura>
        <codigoMotivo>${motivoAnulacion}</codigoMotivo>
        <cuf>${cuf}</cuf>
        <nit>${nit}</nit>
        <codigoSucursal>${codigoSucursal}</codigoSucursal>
        <codigoPuntoVenta>${codigoPuntoVenta}</codigoPuntoVenta>
      </siat:solicitudAnulacionFactura>
    `;
    return this.sendSoapRequest('/v2/ServicioFacturacionCompraVenta', 'anulacionFactura', body);
  }
}

module.exports = SiatSoapClient;
