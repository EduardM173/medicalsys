const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const { extractTenantIdentifier } = require('../../src/middleware/tenant.middleware');
const tenantService = require('../../src/services/tenant.service');
const tenantRepository = require('../../src/repositories/tenant.repository');
const storageService = require('../../src/services/storage/storage.service');

test('HU-30: Resolución de identificador de tenant por header, subdominio y fallback', () => {
  // 1. Por header explícito
  const reqHeader = { headers: { 'x-tenant-code': 'sanrafael' } };
  assert.deepEqual(extractTenantIdentifier(reqHeader), { type: 'code', value: 'sanrafael' });

  // 2. Por subdominio localhost (RFC 6761)
  const reqSubdomain = { headers: { host: 'cumed.localhost:5173' } };
  assert.deepEqual(extractTenantIdentifier(reqSubdomain), { type: 'subdomain', value: 'cumed' });

  // 3. Por subdominio de producción
  const reqProd = { headers: { host: 'sanrafael.medicalsys.bo' } };
  assert.deepEqual(extractTenantIdentifier(reqProd), { type: 'subdomain', value: 'sanrafael' });

  // 4. Fallback seguro a cumed cuando no hay subdominio ni header
  const reqFallback = { headers: { host: 'localhost:3000' } };
  assert.deepEqual(extractTenantIdentifier(reqFallback), { type: 'code', value: 'cumed' });
});

test('HU-30: Consulta del catálogo de organizaciones SaaS y datos de Cumed y San Rafael', async () => {
  const orgs = await tenantService.listOrganizations({ activeOnly: true });
  assert.ok(orgs.length >= 2, 'Debe haber al menos 2 organizaciones inicializadas');

  const cumed = orgs.find((o) => o.codigo === 'cumed');
  assert.ok(cumed, 'Clínica Cumed debe existir');
  assert.equal(cumed.schemaName, 'tenant_cumed');
  assert.equal(cumed.subdominio, 'cumed');
  assert.equal(cumed.estado, 'ACTIVA');

  const sanrafael = orgs.find((o) => o.codigo === 'sanrafael');
  assert.ok(sanrafael, 'Centro Médico San Rafael debe existir');
  assert.equal(sanrafael.schemaName, 'tenant_sanrafael');
  assert.equal(sanrafael.subdominio, 'sanrafael');
});

test('HU-30: Aislamiento Físico en Base de Datos (Schema-per-tenant en PostgreSQL)', async () => {
  const prismaCumed = tenantRepository.getTenantClient('tenant_cumed');
  const prismaSanRafael = tenantRepository.getTenantClient('tenant_sanrafael');

  // Pacientes en Cumed
  const pacientesCumed = await prismaCumed.paciente.findMany({
    select: { id_paciente: true, nombres: true, apellidos: true }
  });
  assert.ok(pacientesCumed.length > 0, 'Cumed debe tener pacientes registrados');
  const nombresCumed = pacientesCumed.map((p) => p.nombres);
  assert.ok(!nombresCumed.includes('Carlos Rodrigo'), 'Carlos Rodrigo NO debe existir en el esquema de Cumed');

  // Pacientes en San Rafael
  const pacientesSanRafael = await prismaSanRafael.paciente.findMany({
    select: { id_paciente: true, nombres: true, apellidos: true }
  });
  assert.ok(pacientesSanRafael.length > 0, 'San Rafael debe tener pacientes registrados');
  const nombresSanRafael = pacientesSanRafael.map((p) => p.nombres);
  assert.ok(nombresSanRafael.includes('Carlos Rodrigo'), 'Carlos Rodrigo DEBE existir exclusivamente en San Rafael');
  assert.ok(!nombresSanRafael.includes('Alejandro'), 'Alejandro de Cumed NO debe existir en San Rafael');
});

test('HU-30: Configuración fiscal completamente independiente por tenant', async () => {
  const prismaCumed = tenantRepository.getTenantClient('tenant_cumed');
  const prismaSanRafael = tenantRepository.getTenantClient('tenant_sanrafael');

  const configCumed = await prismaCumed.configuracion_clinica.findFirst({
    where: { activa: true }
  });
  assert.ok(configCumed, 'Cumed debe tener configuracion clinica activa');
  assert.equal(configCumed.nit, '1023942027');

  const configSanRafael = await prismaSanRafael.configuracion_clinica.findFirst({
    where: { activa: true }
  });
  assert.ok(configSanRafael, 'San Rafael debe tener configuracion clinica activa');
  assert.equal(configSanRafael.nit, '4247012018');
  assert.notEqual(configCumed.nit, configSanRafael.nit, 'Los NITs deben ser distintos entre organizaciones');
});

test('HU-30: Aislamiento de Storage Documental en Disco por Tenant', async () => {
  const testBuffer = Buffer.from('CONTENIDO_MEDICO_CONFIDENCIAL_CUMED_TEST');
  const testFilename = `test-isolation-${Date.now()}.txt`;

  // 1. Guardar archivo en el espacio de Cumed
  const savedCumed = await storageService.saveFile({
    buffer: testBuffer,
    filename: testFilename,
    mimeType: 'text/plain',
    tenantCode: 'cumed'
  });

  assert.ok(savedCumed.storageKey.startsWith('tenants/cumed/clinical-documents/'));

  // 2. Verificar que el archivo existe físicamente en el directorio del tenant
  const expectedDiskPath = path.resolve(
    __dirname,
    '../../uploads/tenants/cumed/clinical-documents',
    testFilename
  );
  assert.ok(fs.existsSync(expectedDiskPath), 'El archivo debe residir en la carpeta física de Cumed');

  // 3. Intentar acceder al archivo desde el contexto de Cumed (exitoso)
  const streamCumed = await storageService.getFileStream(savedCumed.storageKey, 'LOCAL', 'cumed');
  assert.ok(streamCumed.size > 0);
  for await (const _chunk of streamCumed.stream) {
    // consumir stream completamente
  }

  // 4. Intentar acceder al archivo de Cumed desde San Rafael (DEBE ser denegado con 403)
  await assert.rejects(
    async () => {
      await storageService.getFileStream(savedCumed.storageKey, 'LOCAL', 'sanrafael');
    },
    (err) => {
      assert.equal(err.statusCode, 403);
      assert.match(err.message, /Acceso denegado/);
      return true;
    }
  );

  // Limpieza
  await storageService.deleteFile(savedCumed.storageKey);
});

test('HU-30 (Bonus): Ciclo de renovación de suscripción por QR y confirmación de pago', async () => {
  // 1. Generar QR de renovación para San Rafael por 3 meses
  const qrResult = await tenantService.generateRenewalQr({
    tenantCode: 'sanrafael',
    meses: 3
  });

  assert.ok(qrResult.referenciaPago.startsWith('REN-SANRAFAEL-'));
  assert.equal(qrResult.monto, 1050.00);
  assert.equal(qrResult.meses, 3);
  assert.ok(qrResult.codigoQr.length > 20);

  // 2. Confirmar el pago simulando webhook de la pasarela QR
  const confirmResult = await tenantService.confirmPayment({
    referenciaPago: qrResult.referenciaPago
  });

  assert.equal(confirmResult.success, true);
  assert.equal(confirmResult.estado, 'ACTIVA');
  assert.equal(confirmResult.mesesRenovados, 3);
  assert.ok(new Date(confirmResult.nuevaFechaFin) > new Date());
});
