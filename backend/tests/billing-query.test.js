const { test } = require('node:test');
const assert = require('node:assert/strict');

const invoiceA = {
  id_factura: 1n,
  id_cita: null,
  numero_factura: 'TEST-FACT-HU23-001',
  fecha_emision: new Date('2026-09-05T18:30:00.000Z'),
  nit_ci: '4892104',
  complemento: '',
  razon_social: 'Alejandro Morales Quiroga',
  email_receptor: 'alejandro.facturacion@medicalsys.test',
  metodo_pago: 'EFECTIVO',
  subtotal: '270.00',
  total: '270.00',
  estado: 'EMITIDA',
  sin_estado: 'SIMULADA',
  sin_referencia: null,
  codigo_autorizacion: null,
  cuf: null,
  paciente: { id_paciente: 10n, nombres: 'Alejandro', apellidos: 'Morales Quiroga', documento_identidad: '4892104', complemento: '' },
  usuario: { nombres: 'Recepcionista', apellidos: 'MedicalSys' },
  detalle_factura: [
    { id_detalle: 11n, id_servicio: 101n, descripcion: 'Consulta Especializada', cantidad: 1, precio_unitario: '150.00', subtotal: '150.00' },
    { id_detalle: 12n, id_servicio: 102n, descripcion: 'Chequeo Ecográfico Pélvico', cantidad: 1, precio_unitario: '120.00', subtotal: '120.00' }
  ]
};
const invoiceB = {
  ...invoiceA,
  id_factura: 2n,
  numero_factura: 'TEST-FACT-HU23-002',
  detalle_factura: [{ id_detalle: 21n, id_servicio: 103n, descripcion: 'Cirugía General', cantidad: 1, precio_unitario: '800.00', subtotal: '800.00' }]
};
let listArgs;
const db = {
  factura: {
    findMany: async (args) => { listArgs = args; return [invoiceA]; },
    findFirst: async ({ where }) => where.id_factura === 1n ? invoiceA : where.id_factura === 2n ? invoiceB : null
  }
};
require.cache[require.resolve('../src/config/prisma')] = { exports: db };
const billing = require('../src/services/billing.service');

test('lista solamente emitidas y combina filtros en Prisma', async () => {
  const result = await billing.listIssuedInvoices({ search: 'Alejandro', patientId: '10', date: '2026-09-05' });
  assert.equal(listArgs.where.estado, 'EMITIDA');
  assert.equal(listArgs.where.id_paciente, 10n);
  assert.equal(listArgs.where.OR.length, 3);
  assert.equal(listArgs.where.fecha_emision.gte.toISOString(), '2026-09-05T04:00:00.000Z');
  assert.equal(listArgs.take, 100);
  assert.equal(result.invoices[0].numeroFactura, 'TEST-FACT-HU23-001');
  assert.equal(result.invoices[0].total, '270.00');
});

test('detalle usa snapshots y aísla los conceptos de cada factura', async () => {
  const a = (await billing.getIssuedInvoiceById('1')).invoice;
  const b = (await billing.getIssuedInvoiceById('2')).invoice;
  assert.deepEqual(a.conceptos.map((item) => item.id), [11, 12]);
  assert.deepEqual(b.conceptos.map((item) => item.id), [21]);
  assert.equal(a.conceptos[0].precioUnitario, '150.00');
  assert.equal(a.receptor.razonSocial, 'Alejandro Morales Quiroga');
  assert.equal(Object.hasOwn(a, 'password_hash'), false);
});

test('valida identificador, fecha y factura inexistente', async () => {
  await assert.rejects(billing.getIssuedInvoiceById('abc'), { statusCode: 400 });
  await assert.rejects(billing.getIssuedInvoiceById('999'), { statusCode: 404, message: 'Factura no encontrada.' });
  await assert.rejects(billing.listIssuedInvoices({ date: '2026-02-30' }), { statusCode: 400 });
});
