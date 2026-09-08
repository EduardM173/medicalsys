const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const patient = { id_paciente: 8n };
const outbound = { id_notificacion: 50n, id_cita: 11n };
const created = [];
const appointmentUpdates = [];
const notificationUpdates = [];
let alreadySeen = false;

const db = {
  paciente: {
    findMany: async () => [patient]
  },
  cita: {
    updateMany: async (args) => {
      appointmentUpdates.push(args);
      return { count: 1 };
    }
  },
  notificacion: {
    findFirst: async ({ where }) => {
      if (where.proveedor_referencia?.startsWith('GREENAPI-IN:')) {
        return alreadySeen ? { id_notificacion: 99n } : null;
      }
      return where.tipo === 'CONFIRMACION_CITA' ? outbound : null;
    },
    create: async ({ data }) => { created.push(data); return data; },
    update: async (args) => { notificationUpdates.push(args); return args.data; }
  },
  $transaction: async (callback) => callback(db)
};
require.cache[require.resolve('../src/config/prisma')] = { exports: db };
const { processGreenApiIncomingNotification } = require('../src/services/notification.service');

function incoming(text, id = 'GREEN-MSG-1') {
  return {
    typeWebhook: 'incomingMessageReceived',
    idMessage: id,
    timestamp: 1780000000,
    senderData: { sender: '59165119078@c.us' },
    messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: text } }
  };
}

beforeEach(() => {
  created.length = 0;
  appointmentUpdates.length = 0;
  notificationUpdates.length = 0;
  alreadySeen = false;
  delete process.env.GREENAPI_ID_INSTANCE;
});

test('una respuesta SI de un paciente confirma su cita pendiente y se audita', async () => {
  const result = await processGreenApiIncomingNotification(incoming('Sí'));
  assert.deepEqual(result, { processed: true, duplicate: false, confirmed: true, appointmentId: 11 });
  assert.equal(created.length, 1);
  assert.equal(created[0].direccion, 'ENTRANTE');
  assert.equal(created[0].tipo, 'MENSAJE_DIRECTO');
  assert.equal(created[0].id_cita, 11n);
  assert.equal(appointmentUpdates[0].where.estado, 'PROGRAMADA');
  assert.equal(appointmentUpdates[0].data.estado, 'CONFIRMADA');
  assert.equal(notificationUpdates[0].data.estado, 'LEIDA');
});

test('un mensaje distinto de SI se registra pero no modifica la cita', async () => {
  const result = await processGreenApiIncomingNotification(incoming('No puedo asistir', 'GREEN-MSG-2'));
  assert.deepEqual(result, { processed: true, duplicate: false, confirmed: false, appointmentId: null });
  assert.equal(created.length, 1);
  assert.equal(created[0].id_cita, null);
  assert.equal(appointmentUpdates.length, 0);
});

test('un evento repetido no vuelve a confirmar ni registrar', async () => {
  alreadySeen = true;
  const result = await processGreenApiIncomingNotification(incoming('SI', 'GREEN-MSG-3'));
  assert.deepEqual(result, { processed: true, duplicate: true, confirmed: false });
  assert.equal(created.length, 0);
  assert.equal(appointmentUpdates.length, 0);
});

test('un mensaje de grupo o de un teléfono no registrado no cambia citas', async () => {
  const group = await processGreenApiIncomingNotification({ ...incoming('SI'), senderData: { sender: '120000@g.us' } });
  assert.equal(group.reason, 'non_personal_chat');
});
