const app = require('./src/app');
const prisma = require('./src/config/prisma');

async function runTests() {
  console.log('=== INICIANDO PRUEBAS DE INTEGRACIÓN FACTURACIÓN HU-22 (MED-184 A MED-197) ===\n');

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api`;

  let receptionistCookie = '';
  let patientCookie = '';

  try {
    // 1. Autenticación como Recepcionista
    console.log('[1] Autenticando como Recepcionista...');
    const loginRecRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'recepcionista@medicalsys.test', password: 'MedicalSys2026!' })
    });
    if (!loginRecRes.ok) throw new Error(`Login recepcionista falló: ${loginRecRes.status}`);
    const setCookieRec = loginRecRes.headers.get('set-cookie');
    receptionistCookie = setCookieRec.split(';')[0];
    console.log('  -> Recepcionista autenticado correctamente.');

    // 2. Autenticación como Paciente
    console.log('[2] Autenticando como Paciente...');
    const loginPacRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'paciente@medicalsys.test', password: 'MedicalSys2026!' })
    });
    if (!loginPacRes.ok) throw new Error(`Login paciente falló: ${loginPacRes.status}`);
    const setCookiePac = loginPacRes.headers.get('set-cookie');
    patientCookie = setCookiePac.split(';')[0];
    console.log('  -> Paciente autenticado correctamente.');

    // Obtener un paciente y servicios de prueba de la base de datos
    const paciente = await prisma.paciente.findFirst({ where: { activo: true } });
    const servicio = await prisma.servicio_medico.findFirst({ where: { activo: true } });
    if (!paciente || !servicio) throw new Error('No hay pacientes o servicios en base de datos');

    // 3. Crear factura borrador con método QR Simple
    console.log('\n[3] Creando factura borrador con método QR_SIMPLE...');
    const createRes = await fetch(`${baseUrl}/facturas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: receptionistCookie
      },
      body: JSON.stringify({
        idPaciente: paciente.id_paciente.toString(),
        nitCi: paciente.documento_identidad,
        razonSocial: `${paciente.nombres} ${paciente.apellidos}`,
        emailReceptor: paciente.email || 'paciente.test@medicalsys.bo',
        metodoPago: 'QR_SIMPLE',
        items: [
          {
            idServicio: servicio.id_servicio.toString(),
            descripcion: servicio.nombre,
            cantidad: 1,
            precioUnitario: Number(servicio.precio_base)
          }
        ]
      })
    });

    if (!createRes.ok) {
      const err = await createRes.json();
      throw new Error(`Creación de factura falló: ${createRes.status} - ${JSON.stringify(err)}`);
    }

    const facturaBorrador = await createRes.json();
    console.log(`  -> Factura creada con ID: ${facturaBorrador.id}, N°: ${facturaBorrador.numeroFactura}, Estado: ${facturaBorrador.estado}, Total: Bs. ${facturaBorrador.total}`);
    if (facturaBorrador.estado !== 'BORRADOR') throw new Error('El estado inicial debe ser BORRADOR');

    // 4. Emisión Computarizada ante el SIN (MED-184, MED-185, MED-186, MED-187, MED-188)
    console.log('\n[4] Emitiendo factura computarizada (POST /api/facturas/:id/emitir)...');
    const emitRes = await fetch(`${baseUrl}/facturas/${facturaBorrador.id}/emitir`, {
      method: 'POST',
      headers: {
        Cookie: receptionistCookie
      }
    });

    if (!emitRes.ok) {
      const err = await emitRes.json();
      throw new Error(`Emisión falló: ${emitRes.status} - ${JSON.stringify(err)}`);
    }

    const facturaEmitida = await emitRes.json();
    console.log('  -> Factura emitida con éxito:');
    console.log(`     - Estado: ${facturaEmitida.estado}`);
    console.log(`     - CUF (${facturaEmitida.cuf.length} caracteres): ${facturaEmitida.cuf}`);
    console.log(`     - Referencia SIN: ${facturaEmitida.referenciaSin}`);
    console.log(`     - Fecha Emisión: ${facturaEmitida.fechaEmision}`);
    console.log(`     - QR Payload: ${facturaEmitida.qrPayload}`);

    if (facturaEmitida.estado !== 'EMITIDA') throw new Error('El estado debe ser EMITIDA');
    if (!facturaEmitida.cuf || facturaEmitida.cuf.length !== 64) {
      throw new Error(`El CUF debe tener exactamente 64 caracteres. Obtenido: ${facturaEmitida.cuf?.length}`);
    }
    if (!facturaEmitida.referenciaSin) throw new Error('Debe contener referencia_sin');
    if (!facturaEmitida.qrPayload || !facturaEmitida.qrPayload.includes('https://siat.impuestos.gob.bo')) {
      throw new Error('Debe contener un QR Payload con formato reglamentario SIAT');
    }

    // 5. Garantía de Idempotencia y Control de Re-emisión (MED-189, MED-196 / PA-06)
    console.log('\n[5] Prueba de Idempotencia: Intentando re-emitir la misma factura ya emitida...');
    const reemitRes = await fetch(`${baseUrl}/facturas/${facturaBorrador.id}/emitir`, {
      method: 'POST',
      headers: {
        Cookie: receptionistCookie
      }
    });

    console.log(`  -> Código de respuesta HTTP recibido: ${reemitRes.status}`);
    const reemitData = await reemitRes.json();
    console.log(`  -> Mensaje de rechazo: "${reemitData.message}"`);

    if (reemitRes.status !== 400) {
      throw new Error(`Se esperaba código HTTP 400 ante re-emisión, se obtuvo ${reemitRes.status}`);
    }
    if (!reemitData.message.includes('ya fue emitida previamente')) {
      throw new Error(`El mensaje debe indicar que ya fue emitida previamente: ${reemitData.message}`);
    }
    console.log('  -> Idempotencia validada con éxito: Re-emisión rechazada.');

    // 6. Prueba de Control de Acceso RBAC (MED-197 / PA-07)
    console.log('\n[6] Prueba de RBAC: Intentando emitir factura con rol PACIENTE...');
    const rbacRes = await fetch(`${baseUrl}/facturas/${facturaBorrador.id}/emitir`, {
      method: 'POST',
      headers: {
        Cookie: patientCookie
      }
    });

    console.log(`  -> Código de respuesta HTTP recibido para rol Paciente: ${rbacRes.status}`);
    if (rbacRes.status !== 403) {
      throw new Error(`Se esperaba código HTTP 403 para rol no autorizado, se obtuvo ${rbacRes.status}`);
    }
    console.log('  -> RBAC validado con éxito: Acceso bloqueado para rol Paciente.');

    // 7. Prueba de Consulta por ID (MED-184)
    console.log('\n[7] Consultando factura emitida por ID (GET /api/facturas/:id)...');
    const getRes = await fetch(`${baseUrl}/facturas/${facturaBorrador.id}`, {
      headers: { Cookie: receptionistCookie }
    });

    if (!getRes.ok) throw new Error(`Consulta de factura falló: ${getRes.status}`);
    const facturaConsultada = await getRes.json();
    if (facturaConsultada.cuf !== facturaEmitida.cuf) {
      throw new Error('El CUF persistido no coincide con el devuelto al emitir');
    }
    console.log('  -> Factura recuperada correctamente con todos sus atributos persistidos y preservados.');

    // 8. Prueba de Validación: Factura sin ítems (MED-191 / PA-01)
    console.log('\n[8] Prueba de Validación: Intentar crear factura sin ítems...');
    const invalRes = await fetch(`${baseUrl}/facturas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: receptionistCookie
      },
      body: JSON.stringify({
        idPaciente: paciente.id_paciente.toString(),
        nitCi: '1234567',
        razonSocial: 'Prueba Sin Items',
        metodoPago: 'EFECTIVO',
        items: []
      })
    });

    console.log(`  -> Código de respuesta HTTP para factura sin ítems: ${invalRes.status}`);
    if (invalRes.status !== 400) {
      throw new Error(`Se esperaba HTTP 400 para factura sin ítems, se obtuvo ${invalRes.status}`);
    }
    console.log('  -> Validación de ítems exitosa.');

    console.log('\n=== TODAS LAS PRUEBAS DE INTEGRACIÓN DE BACKEND PASARON SATISFACTORIAMENTE ===\n');
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error('\n❌ ERROR EN PRUEBAS:', err);
  process.exit(1);
});
