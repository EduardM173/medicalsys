const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const now = new Date('2026-09-14T16:00:00.000Z');
const job = {
  id_cola: 1n,
  id_notificacion: 12n,
  id_cita: 8n,
  clave_idempotencia: 'CITA:8:CONFIRMACION_CITA:2026-09-15T16:00:00.000Z',
  fecha_cita_programada: new Date('2026-09-15T16:00:00.000Z'),
  fecha_disponible: new Date('2026-09-14T15:00:00.000Z'),
  estado: 'PENDIENTE',
  intentos: 0,
  max_intentos: 5,
  bloqueado_por: null,
  bloqueado_hasta: null,
  ultimo_error: null,
  fecha_procesada: null,
  fecha_creacion: now,
  fecha_actualizacion: now,
  notificacion: {
    id_notificacion: 12n, id_paciente: 4n, id_cita: 8n, tipo: 'CONFIRMACION_CITA',
    telefono_destino: '+59172010001', mensaje: 'Mensaje de prueba', fecha_programada: now,
    fecha_envio: null, fecha_entrega: null, fecha_lectura: null, estado: 'PENDIENTE', proveedor_referencia: null
  },
  cita: {
    id_cita: 8n, estado: 'PROGRAMADA', fecha_hora_inicio: new Date('2026-09-15T16:00:00.000Z'),
    paciente: { id_paciente: 4n, nombres: 'Ana', apellidos: 'Prueba', telefono: '72010001' },
    medico: { id_medico: 2n, especialidad: 'General', usuario: { nombres: 'Luis', apellidos: 'Médico' } },
    servicio_medico: { nombre: 'Consulta' }
  }
};

const db = {
  cola_notificacion: {
    updateMany: async ({ where, data }) => {
      if (!where.id_cola) return { count: 0 }; // liberación de bloqueos vencidos
      if (job.id_cola !== where.id_cola || job.estado !== where.estado) return { count: 0 };
      if (where.fecha_disponible?.lte && job.fecha_disponible > where.fecha_disponible.lte) return { count: 0 };
      job.estado = data.estado;
      job.bloqueado_por = data.bloqueado_por;
      job.bloqueado_hasta = data.bloqueado_hasta;
      job.fecha_actualizacion = data.fecha_actualizacion;
      if (data.intentos?.increment) job.intentos += data.intentos.increment;
      return { count: 1 };
    },
    findMany: async ({ where }) => (
      job.estado === where.estado && job.fecha_disponible <= where.fecha_disponible.lte
        ? [{ id_cola: job.id_cola }]
        : []
    ),
    findUnique: async () => ({ ...job })
  }
};

require.cache[require.resolve('../src/config/prisma')] = { exports: db };
const { claimNextNotificationJob, retryDelayMs } = require('../src/services/whatsapp/whatsapp-notification-queue.service');

beforeEach(() => {
  job.estado = 'PENDIENTE';
  job.intentos = 0;
  job.bloqueado_por = null;
  job.bloqueado_hasta = null;
  job.fecha_disponible = new Date('2026-09-14T15:00:00.000Z');
});

test('dos workers reclaman una sola vez el mismo trabajo listo', async () => {
  const [first, second] = await Promise.all([
    claimNextNotificationJob('worker-a', now),
    claimNextNotificationJob('worker-b', now)
  ]);

  const claims = [first, second].filter(Boolean);
  assert.equal(claims.length, 1);
  assert.equal(claims[0].bloqueado_por, 'worker-a');
  assert.equal(job.estado, 'PROCESANDO');
  assert.equal(job.intentos, 1);
});

test('el backoff es incremental y tiene límite superior', () => {
  assert.equal(retryDelayMs(1), 60_000);
  assert.equal(retryDelayMs(2), 120_000);
  assert.equal(retryDelayMs(10), 3_600_000);
});
