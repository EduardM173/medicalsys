const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('zlib');
const cufHelper = require('../../src/services/sin/cuf.helper');
const xmlBuilder = require('../../src/services/sin/xml.builder');
const SinFiscalProvider = require('../../src/services/sin/sinFiscal.provider');
const billingService = require('../../src/services/billing.service');
const repository = require('../../src/repositories/billing.repository');

describe('HU-34: Integración SIN/SIAT v2 - Facturación Computarizada en Línea', () => {

  test('HU-34.1: Algoritmo Módulo 11 oficial del SIN (ponderación cíclica 2-9)', () => {
    const numeroPrueba = '10239420272026091312000000000002110100000000010000';
    const digito = cufHelper.calcularModulo11(numeroPrueba, 1, 9, false);
    assert.match(digito, /^[0-9]$/, 'El dígito verificador debe ser un dígito entre 0 y 9');

    const mod10 = cufHelper.calcularModulo11('11', 1, 9, false);
    assert.ok(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(mod10));
  });

  test('HU-34.2: Conversión a Base 16 sin desbordamiento de enteros de 64 bits', () => {
    const granCadena = '102394202720260913120000000000021101000000000100005';
    const base16 = cufHelper.convertirBase16(granCadena);

    assert.ok(base16.length > 20, 'La cadena en base 16 debe tener longitud suficiente');
    assert.match(base16, /^[0-9A-F]+$/, 'La representación Base 16 debe estar en mayúsculas alfanuméricas');

    const reconstituido = BigInt('0x' + base16).toString(10);
    assert.equal(reconstituido, granCadena, 'La conversión Base 16 debe ser reversible con precisión arbitraria');
  });

  test('HU-34.3: Generación del CUF concatenando los 9 campos normativos y el código de control CUFD', () => {
    const cufInfo = cufHelper.generarCuf({
      nit: '4247012018',
      fechaEmision: new Date('2026-09-13T12:30:00.123Z'),
      sucursal: 0,
      modalidad: 2,
      tipoEmision: 1,
      tipoFactura: 1,
      tipoDocSector: 1,
      numeroFactura: 45,
      puntoVenta: 0,
      codigoControlCufd: 'BQT5CTcKhWUVBNzzc1QjNFMzlENzY='
    });

    assert.ok(cufInfo.cuf, 'Debe generar un CUF');
    assert.ok(cufInfo.cuf.endsWith('BQT5CTcKhWUVBNzzc1QjNFMzlENzY='), 'El CUF debe concluir con el código de control del CUFD');
    assert.ok(cufInfo.cuf.length >= 50, 'El CUF oficial debe tener una longitud mínima de 50 caracteres');
    assert.equal(cufInfo.tipoEmision, 1);
  });

  test('HU-34.4: Generación de la URL del QR fiscal oficial del SIN', () => {
    const qrUrl = cufHelper.generarQrUrl({
      nit: '4247012018',
      cuf: '12297A48A81D24940487064D05B6DB1A',
      numeroFactura: '1001',
      ambiente: 2
    });

    assert.ok(qrUrl.startsWith('https://pilotosiat.impuestos.gob.bo/consulta/QR?'), 'La URL debe apuntar al endpoint oficial del SIN');
    assert.ok(qrUrl.includes('nit=4247012018'));
    assert.ok(qrUrl.includes('cuf=12297A48A81D24940487064D05B6DB1A'));
    assert.ok(qrUrl.includes('numero=1001'));
    assert.ok(qrUrl.includes('t=2'));
  });

  test('HU-34.5: Construcción del XML conforme a XSD, hash SHA-256 y compresión GZIP nivel 9', () => {
    const xmlResult = xmlBuilder.construirXmlFactura({
      cabecera: {
        nitEmisor: '4247012018',
        razonSocialEmisor: 'MEDICALSYS CLINIC S.R.L.',
        numeroFactura: 12,
        cuf: 'CUF-TEST-SIN-12345',
        cufd: 'CUFD-TEST-67890',
        fechaEmision: new Date('2026-09-13T10:00:00.000Z'),
        nombreRazonSocial: 'Carlos Rodrigo Mendoza',
        numeroDocumento: '7891234',
        montoTotal: '250.00',
        montoTotalSujetoIva: '250.00',
        montoTotalMoneda: '250.00'
      },
      detalles: [
        {
          actividadEconomica: '862000',
          codigoProductoSin: '99100',
          codigoProducto: 'CONS-01',
          descripcion: 'Consulta Médica Traumatológica',
          cantidad: 1,
          unidadMedida: 57,
          precioUnitario: '250.00',
          montoDescuento: '0.00',
          subTotal: '250.00'
        }
      ]
    });

    assert.ok(xmlResult.xml.startsWith('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'), 'El XML debe tener prólogo oficial');
    assert.ok(xmlResult.xml.includes('<facturaComputarizadaCompraVenta'), 'Debe usar el elemento raíz oficial');
    assert.ok(xmlResult.xml.includes('<nitEmisor>4247012018</nitEmisor>'), 'Debe incluir datos de cabecera');
    assert.ok(xmlResult.xml.includes('<descripcion>Consulta Médica Traumatológica</descripcion>'), 'Debe incluir datos de detalle');

    assert.equal(xmlResult.hashSha256.length, 64, 'El hash SHA-256 del XML debe tener 64 caracteres hex');

    const decompressed = zlib.gunzipSync(xmlResult.gzipBuffer).toString('utf8');
    assert.equal(decompressed, xmlResult.xml, 'El buffer GZIP nivel 9 debe descomprimirse exactamente en el XML original');
  });

  test('HU-34.6: Proveedor fiscal y conmutación automática a Modo Contingencia (RND 102100000011)', async () => {
    const sinProvider = new SinFiscalProvider();

    const resultado = await sinProvider.emitir({
      factura: {
        numero_factura: '1023942027-2026-0001',
        total: 350.00,
        razon_social: 'Paciente Prueba Contingencia',
        nit_ci: '4578968',
        complemento: '',
        metodo_pago: 'EFECTIVO',
        fecha_emision: new Date()
      },
      configuracion: {
        nit: '4247012018',
        razon_social: 'MEDICALSYS S.R.L.',
        ciudad: 'La Paz'
      }
    });

    assert.equal(resultado.success, true);
    assert.ok(resultado.cuf, 'Debe generar el CUF oficial');
    assert.equal(resultado.sinEstado, 'PENDIENTE', 'Ante falta de token activo debe conmutar a contingencia (estado pendiente de paquete)');
    assert.equal(resultado.tipoEmision, 2, 'El tipo de emisión debe ser 2 (Fuera de Línea)');
    assert.ok(resultado.codigoRecepcion.startsWith('CONT-'), 'Debe asignar código de recepción en contingencia');
    assert.ok(resultado.xml, 'Debe incluir el XML generado');
    assert.ok(resultado.qrPayload.includes('nit=4247012018'), 'El QR debe incluir el NIT emisor');
  });

  test('HU-34.7: Integración completa de emisión y anulación de factura en BillingService', async () => {
    let paciente = await repository.paciente.findFirst({ where: { activo: true } });
    if (!paciente) {
      paciente = await repository.paciente.create({
        data: {
          nombres: 'Prueba',
          apellidos: 'SIAT',
          documento_identidad: '9988776',
          fecha_nacimiento: new Date('1990-01-01'),
          genero: 'M'
        }
      });
    }

    const preview = await billingService.prepareInvoice({
      pacienteId: Number(paciente.id_paciente),
      receptor: {
        razonSocial: 'Juan Pérez SIAT',
        nitCi: '8877665',
        complemento: ''
      },
      metodoPago: 'EFECTIVO',
      conceptos: [
        { servicioId: 1, descripcion: 'Consulta General SIAT', cantidad: 1, precioUnitario: 180.00 }
      ]
    });

    assert.equal(preview.estado, 'BORRADOR');

    const emitResult = await billingService.emitirFacturaComputarizada(preview.id, 1);
    assert.equal(emitResult.estado, 'EMITIDA');
    assert.ok(emitResult.cuf, 'La factura emitida debe tener CUF oficial asignado');
    assert.ok(emitResult.cuf.length >= 50, 'El CUF debe tener longitud oficial');
    assert.ok(emitResult.qrPayload.includes('https://'), 'El QR payload debe ser una URL HTTPS del SIN');

    const xmlData = await billingService.getInvoiceXml(preview.id);
    assert.ok(xmlData.xml.includes('<facturaComputarizadaCompraVenta'), 'Debe entregar el XML oficial de la factura');
    assert.equal(xmlData.filename, `factura-${emitResult.numeroFactura}.xml`);

    const anulacion = await billingService.anularFactura(preview.id, { motivo: 1 });
    assert.equal(anulacion.estado, 'ANULADA');

    const facturaDb = await billingService.getIssuedInvoiceById(preview.id);
    assert.equal(facturaDb.invoice.estado, 'ANULADA');
  });

});
