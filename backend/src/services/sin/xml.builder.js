const crypto = require('crypto');
const zlib = require('zlib');
const { formatearFechaIsoSin } = require('./cuf.helper');


function escapeXml(unsafe) {
  if (unsafe === undefined || unsafe === null) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function tag(name, value, isNil = false) {
  if (isNil || value === undefined || value === null || value === '') {
    return `<${name} xsi:nil="true"/>`;
  }
  return `<${name}>${escapeXml(value)}</${name}>`;
}

function resolveMetodoPagoCodigo(metodo) {
  const norm = String(metodo || 'EFECTIVO').toUpperCase();
  switch (norm) {
    case 'EFECTIVO': return 1;
    case 'TARJETA': return 2;
    case 'TRANSFERENCIA': return 7;
    case 'QR': return 32;
    default: return 1;
  }
}

function resolveTipoDocumentoIdentidad(nitCi, complemento) {
  const clean = String(nitCi || '').trim();
  // Si tiene más de 9 dígitos suele tratarse de NIT (5), si no CI (1)
  if (clean.length >= 9) return 5;
  return 1;
}

const LEYENDA_OFICIAL_DEFECTO =
  'Ley N° 453: El proveedor debe exhibir certificaciones de habilitación o documentos que acrediten las capacidades u ofertas de servicios especializados.';

function construirXmlFactura({
  cabecera: {
    nitEmisor,
    razonSocialEmisor,
    municipio = 'LA PAZ',
    telefono = '22440000',
    numeroFactura,
    cuf,
    cufd,
    codigoSucursal = 0,
    direccion = 'Av. Arce Nro. 2300',
    codigoPuntoVenta = 0,
    fechaEmision,
    nombreRazonSocial,
    codigoTipoDocumentoIdentidad,
    numeroDocumento,
    complemento = null,
    codigoCliente,
    codigoMetodoPago,
    numeroTarjeta = null,
    montoTotal,
    montoTotalSujetoIva,
    codigoMoneda = 1,
    tipoCambio = 1,
    montoTotalMoneda,
    montoGiftCard = null,
    descuentoAdicional = 0,
    codigoExcepcion = null,
    cafc = null,
    leyenda = LEYENDA_OFICIAL_DEFECTO,
    usuario = 'admin_medsys',
    codigoDocumentoSector = 1
  },
  detalles = []
}) {
  const fechaIso = formatearFechaIsoSin(fechaEmision);
  const totalNum = Number(montoTotal || 0).toFixed(2);
  const sujetoIvaNum = Number(montoTotalSujetoIva || totalNum).toFixed(2);
  const totalMonedaNum = Number(montoTotalMoneda || totalNum).toFixed(2);
  const descuentoNum = Number(descuentoAdicional || 0).toFixed(2);

  const cabeceraXml = [
    '<cabecera>',
    tag('nitEmisor', nitEmisor),
    tag('razonSocialEmisor', razonSocialEmisor),
    tag('municipio', municipio),
    tag('telefono', telefono),
    tag('numeroFactura', numeroFactura),
    tag('cuf', cuf),
    tag('cufd', cufd),
    tag('codigoSucursal', codigoSucursal),
    tag('direccion', direccion),
    tag('codigoPuntoVenta', codigoPuntoVenta),
    tag('fechaEmision', fechaIso),
    tag('nombreRazonSocial', nombreRazonSocial),
    tag('codigoTipoDocumentoIdentidad', codigoTipoDocumentoIdentidad || resolveTipoDocumentoIdentidad(numeroDocumento, complemento)),
    tag('numeroDocumento', numeroDocumento),
    complemento ? tag('complemento', complemento) : tag('complemento', null, true),
    tag('codigoCliente', codigoCliente || numeroDocumento),
    tag('codigoMetodoPago', codigoMetodoPago || resolveMetodoPagoCodigo('EFECTIVO')),
    numeroTarjeta ? tag('numeroTarjeta', numeroTarjeta) : tag('numeroTarjeta', null, true),
    tag('montoTotal', totalNum),
    tag('montoTotalSujetoIva', sujetoIvaNum),
    tag('codigoMoneda', codigoMoneda),
    tag('tipoCambio', tipoCambio),
    tag('montoTotalMoneda', totalMonedaNum),
    montoGiftCard ? tag('montoGiftCard', montoGiftCard) : tag('montoGiftCard', null, true),
    tag('descuentoAdicional', descuentoNum),
    codigoExcepcion ? tag('codigoExcepcion', codigoExcepcion) : tag('codigoExcepcion', null, true),
    cafc ? tag('cafc', cafc) : tag('cafc', null, true),
    tag('leyenda', leyenda),
    tag('usuario', usuario),
    tag('codigoDocumentoSector', codigoDocumentoSector),
    '</cabecera>'
  ].join('');

  const items = detalles.length > 0 ? detalles : [
    {
      actividadEconomica: '862000',
      codigoProductoSin: '99100',
      codigoProducto: 'MED-01',
      descripcion: 'Atención médica y consulta clínica especializada',
      cantidad: 1,
      unidadMedida: 57,
      precioUnitario: totalNum,
      montoDescuento: '0.00',
      subTotal: totalNum
    }
  ];

  const detallesXml = items.map((item) => {
    const cant = Number(item.cantidad || 1);
    const pu = Number(item.precioUnitario || item.subtotal || totalNum).toFixed(2);
    const desc = Number(item.montoDescuento || 0).toFixed(2);
    const sub = Number(item.subTotal || (cant * pu) - desc).toFixed(2);

    return [
      '<detalle>',
      tag('actividadEconomica', item.actividadEconomica || '862000'),
      tag('codigoProductoSin', item.codigoProductoSin || '99100'),
      tag('codigoProducto', item.codigoProducto || 'MED-CONS'),
      tag('descripcion', item.descripcion || 'Servicio médico asistencial'),
      tag('cantidad', cant),
      tag('unidadMedida', item.unidadMedida || 57),
      tag('precioUnitario', pu),
      tag('montoDescuento', desc),
      tag('subTotal', sub),
      item.numeroSerie ? tag('numeroSerie', item.numeroSerie) : tag('numeroSerie', null, true),
      item.numeroImei ? tag('numeroImei', item.numeroImei) : tag('numeroImei', null, true),
      '</detalle>'
    ].join('');
  }).join('');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<facturaComputarizadaCompraVenta xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="facturaComputarizadaCompraVenta.xsd">',
    cabeceraXml,
    detallesXml,
    '</facturaComputarizadaCompraVenta>'
  ].join('');

  const hashSha256 = crypto.createHash('sha256').update(xml, 'utf8').digest('hex');
  const gzipBuffer = zlib.gzipSync(Buffer.from(xml, 'utf8'), { level: 9 });
  const gzipBase64 = gzipBuffer.toString('base64');

  return {
    xml,
    hashSha256,
    gzipBuffer,
    gzipBase64,
    fechaIso
  };
}

module.exports = {
  construirXmlFactura,
  resolveMetodoPagoCodigo,
  resolveTipoDocumentoIdentidad,
  escapeXml
};
