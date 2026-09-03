/**
 * Convierte un importe numérico a su representación en palabras en español (Bolivia)
 * Ejemplo: 150.50 -> "CIENTO CINCUENTA 50/100 BOLIVIANOS"
 */

const UNIDADES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
const DIEZ_A_DIECINUEVE = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
const DECENAS = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

function convertirGrupo(n) {
  let output = '';

  if (n === 100) {
    return 'CIEN ';
  }

  const c = Math.floor(n / 100);
  const d = Math.floor((n % 100) / 10);
  const u = n % 10;

  if (c > 0) {
    output += CENTENAS[c] + ' ';
  }

  if (d === 1) {
    output += DIEZ_A_DIECINUEVE[u] + ' ';
  } else if (d === 2 && u > 0) {
    output += 'VEINTI' + UNIDADES[u] + ' ';
  } else {
    if (d > 0) {
      output += DECENAS[d] + (u > 0 ? ' Y ' : ' ');
    }
    if (u > 0) {
      output += UNIDADES[u] + ' ';
    }
  }

  return output;
}

export function numeroALetras(monto) {
  const num = parseFloat(monto) || 0;
  if (num === 0) return 'CERO 00/100 BOLIVIANOS';

  const parteEntera = Math.floor(num);
  const centavos = Math.round((num - parteEntera) * 100);
  const centavosStr = String(centavos).padStart(2, '0');

  let resultado = '';

  if (parteEntera === 0) {
    resultado = 'CERO ';
  } else {
    const millones = Math.floor(parteEntera / 1000000);
    const miles = Math.floor((parteEntera % 1000000) / 1000);
    const unidades = parteEntera % 1000;

    if (millones > 0) {
      resultado += millones === 1 ? 'UN MILLON ' : convertirGrupo(millones) + 'MILLONES ';
    }

    if (miles > 0) {
      resultado += miles === 1 ? 'UN MIL ' : convertirGrupo(miles) + 'MIL ';
    }

    if (unidades > 0) {
      resultado += convertirGrupo(unidades);
    }
  }

  return `${resultado.trim()} ${centavosStr}/100 BOLIVIANOS`;
}
