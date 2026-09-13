const POND_LIMIT = 9;

function calcularModulo11(strVal, numDig = 1, limMult = POND_LIMIT, x10 = false) {
  let s = String(strVal || '');
  for (let n = 0; n < numDig; n++) {
    let acc = 0;
    let m = 2;
    for (let i = s.length - 1; i >= 0; i--) {
      acc += m * (s.charCodeAt(i) - 48);
      m = m < limMult ? m + 1 : 2;
    }
    const d = x10 ? ((acc * 10) % 11) % 10 : acc % 11;
    s += d === 10 ? '1' : d === 11 ? '0' : String(d);
  }
  return s.slice(-numDig);
}

function convertirBase16(numStr) {
  const digits = String(numStr || '').replace(/\D/g, '');
  return digits ? BigInt(digits).toString(16).toUpperCase() : '0';
}

function _pad(num, len) {
  return String(num).padStart(len, '0');
}

function formatearFechaSin(date) {
  const d = date instanceof Date ? date : new Date(date || Date.now());
  return [
    d.getFullYear(),
    _pad(d.getMonth() + 1, 2),
    _pad(d.getDate(), 2),
    _pad(d.getHours(), 2),
    _pad(d.getMinutes(), 2),
    _pad(d.getSeconds(), 2),
    _pad(d.getMilliseconds(), 3)
  ].join('');
}

function formatearFechaIsoSin(date) {
  const d = date instanceof Date ? date : new Date(date || Date.now());
  return `${d.getFullYear()}-${_pad(d.getMonth() + 1, 2)}-${_pad(d.getDate(), 2)}T${_pad(d.getHours(), 2)}:${_pad(d.getMinutes(), 2)}:${_pad(d.getSeconds(), 2)}.${_pad(d.getMilliseconds(), 3)}`;
}

function generarCuf(params = {}) {
  const {
    nit = '',
    fechaEmision,
    sucursal = 0,
    modalidad = 2,
    tipoEmision = 1,
    tipoFactura = 1,
    tipoDocSector = 1,
    numeroFactura = 1,
    puntoVenta = 0,
    codigoControlCufd = ''
  } = params;

  const rawFields = [
    String(nit || '').replace(/\D/g, '').padStart(13, '0'),
    formatearFechaSin(fechaEmision),
    _pad(sucursal, 4),
    String(modalidad),
    String(tipoEmision),
    String(tipoFactura),
    _pad(tipoDocSector, 2),
    String(numeroFactura).replace(/\D/g, '').padStart(10, '0'),
    _pad(puntoVenta, 4)
  ].join('');

  const mod11 = calcularModulo11(rawFields, 1, 9, false);
  const fullSeq = rawFields + mod11;
  const hex = convertirBase16(fullSeq);
  const cuf = hex + (codigoControlCufd || '');

  return {
    cuf,
    cadenaBase: fullSeq,
    digitoMod11: mod11,
    base16: hex,
    fechaEmisionStr: rawFields.slice(13, 30),
    tipoEmision: Number(tipoEmision)
  };
}

function generarQrUrl({ nit, cuf, numeroFactura, ambiente = 2 }) {
  const endpoint = ambiente === 1
    ? 'https://siat.impuestos.gob.bo/consulta/QR'
    : 'https://pilotosiat.impuestos.gob.bo/consulta/QR';
  return `${endpoint}?nit=${encodeURIComponent(nit)}&cuf=${encodeURIComponent(cuf)}&numero=${encodeURIComponent(numeroFactura)}&t=${ambiente}`;
}

module.exports = {
  calcularModulo11,
  convertirBase16,
  formatearFechaSin,
  formatearFechaIsoSin,
  generarCuf,
  generarQrUrl
};
