const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const patientA = {
  id_paciente: 10n,
  nombres: 'Alejandro',
  apellidos: 'Morales Quiroga',
  documento_identidad: '4892104',
  complemento: ''
};
const dates = {
  confirmation: new Date('2026-09-01T13:00:00.000Z'),
  reminder: new Date('2026-09-01T14:00:00.000Z'),
  failed: new Date('2026-09-01T15:00:00.000Z')
};
const appointment = { id_cita: 20n, id_paciente: 10n, fecha_hora_inicio: new Date('2026-09-08T12:00:00.000Z'), estado: 'CONFIRMADA' };
const historyRows = [
  {
    id_notificacion: 3n, tipo: 'RECORDATORIO_CITA', estado: 'FALLIDA', canal: 'WHATSAPP',
    telefono_destino: '+59172010001', mensaje: 'Intento fallido', fecha_programada: dates.failed,
    fecha_envio: null, fecha_entrega: null, fecha_lectura: null, fecha_creacion: dates.failed, cita: appointment
  },
  {
    id_notificacion: 2n, tipo: 'RECORDATORIO_CITA', estado: 'LEIDA', canal: 'WHATSAPP',
    telefono_destino: '+59172010001', mensaje: 'Recordatorio leído', fecha_programada: null,
    fecha_envio: dates.reminder, fecha_entrega: dates.reminder, fecha_lectura: dates.reminder,
    fecha_creacion: dates.reminder, cita: appointment
  },
  {
    id_notificacion: 1n, tipo: 'CONFIRMACION_CITA', estado: 'ENTREGADA', canal: 'WHATSAPP',
    telefono_destino: '+59172010001', mensaje: 'Confirmación entregada', fecha_programada: null,
    fecha_envio: dates.confirmation, fecha_entrega: dates.confirmation, fecha_lectura: null,
    fecha_creacion: dates.confirmation, cita: appointment
  }
];
let notificationArgs;
let requestedAppointment = appointment;
const db = {
  paciente: { findUnique: async ({ where }) => where.id_paciente === 10n ? patientA : null },
  cita: { findUnique: async () => requestedAppointment },
  notificacion: { findMany: async (args) => { notificationArgs = args; return historyRows; } }
};
require.cache[require.resolve('../src/config/prisma')] = { exports: db };
const service = require('../src/services/notification.service');

beforeEach(() => { notificationArgs = null; requestedAppointment = appointment; });

test('consulta por paciente, limita tipos de cita y ordena en Prisma', async () => {
  const result = await service.listPatientNotificationHistory({ patientId: '10' });
  assert.equal(notificationArgs.where.id_paciente, 10n);
  assert.deepEqual(notificationArgs.where.tipo.in, ['CONFIRMACION_CITA', 'RECORDATORIO_CITA']);
  assert.deepEqual(notificationArgs.orderBy, [{ fecha_creacion: 'desc' }, { id_notificacion: 'desc' }]);
  assert.deepEqual(result.notifications.map((item) => item.estado), ['FALLIDA', 'LEIDA', 'ENTREGADA']);
  assert.deepEqual(result.notifications.map((item) => item.tipo), ['RECORDATORIO_CITA', 'RECORDATORIO_CITA', 'CONFIRMACION_CITA']);
  assert.equal(result.notifications[0].fechaEnvio, null);
  assert.equal(result.notifications[0].fechaCreacion, dates.failed.toISOString());
  assert.equal(result.notifications[0].telefonoDestino, '********0001');
});
test('filtra por cita validada del paciente', async () => {
  const result = await service.listPatientNotificationHistory({ patientId: '10', appointmentId: '20' });
  assert.equal(notificationArgs.where.id_cita, 20n);
  assert.equal(result.notifications.every((item) => item.cita.id === 20), true);
});

test('valida paciente, cita inexistente y aislamiento entre pacientes', async () => {
  await assert.rejects(service.listPatientNotificationHistory({}), { statusCode: 400 });
  await assert.rejects(service.listPatientNotificationHistory({ patientId: 'abc' }), { statusCode: 400 });
  await assert.rejects(service.listPatientNotificationHistory({ patientId: '999' }), { statusCode: 404 });
  requestedAppointment = null;
  await assert.rejects(service.listPatientNotificationHistory({ patientId: '10', appointmentId: '999' }), { statusCode: 404 });
  requestedAppointment = { ...appointment, id_paciente: 11n };
  await assert.rejects(service.listPatientNotificationHistory({ patientId: '10', appointmentId: '20' }), {
    statusCode: 400,
    message: 'La cita seleccionada no pertenece al paciente.'
  });
});
