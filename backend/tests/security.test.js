const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { roles, defaults, permissionForRequest } = require('../src/security/permissions');

const accounts = new Map(roles.map((role, index) => [String(index + 1), {
  id_usuario: BigInt(index + 1), estado: 'ACTIVO', rol: { codigo: role, activo: true }
}]));
const policies = new Map();
const db = {
  usuario: { findUnique: async ({ where }) => accounts.get(String(where.id_usuario)) || null },
  $queryRaw: async (_strings, role) => policies.has(role) ? [{ permissions: policies.get(role) }] : [],
  $executeRaw: async () => 1,
  $transaction: async (callback) => callback(db)
};
require.cache[require.resolve('../src/config/prisma')] = { exports: db };
const auth = require('../src/middleware/auth.middleware');
const authorize = require('../src/middleware/role.middleware');
const security = require('../src/services/security.service');
const users = require('../src/services/user.service');
process.env.JWT_SECRET = 'security-test-secret-not-used-outside-tests';

const endpoints = [
  ['GET', '/api/users', 'users.manage'], ['POST', '/api/users', 'users.manage'],
  ['GET', '/api/security', 'security.manage'], ['PUT', '/api/security/roles/MEDICO', 'security.manage'],
  ['GET', '/api/patients', 'patients.read'], ['POST', '/api/patients', 'patients.write'],
  ['PATCH', '/api/patients/1', 'patients.write'],
  ['GET', '/api/patients/1/medical-history', 'history.read'],
  ['POST', '/api/atenciones', 'attention.write'], ['POST', '/api/attentions/atenciones', 'attention.write'],
  ['GET', '/api/historias/1/atenciones', 'history.read'],
  ['GET', '/api/patients/1/documents', 'documents.read'],
  ['GET', '/api/documents/1/download', 'documents.read'], ['GET', '/api/documents/1/file', 'documents.read'],
  ['POST', '/api/patients/1/documents', 'documents.write'], ['DELETE', '/api/documents/1', 'documents.write'],
  ['GET', '/api/appointments', 'appointments.manage'], ['PATCH', '/api/appointments/1', 'appointments.manage'],
  ['GET', '/api/agenda/me', 'agenda.read'], ['POST', '/api/consents', 'consents.manage'],
  ['POST', '/api/consentimientos/1/firmar', 'consents.manage'],
  ['GET', '/api/rooms', 'rooms.read'], ['GET', '/api/rooms/reservations', 'rooms.read'],
  ['GET', '/api/rooms/pending-appointments', 'rooms.write'],
  ['POST', '/api/rooms/reservations', 'rooms.write'], ['PATCH', '/api/rooms/reservations/1', 'rooms.write'],
  ['DELETE', '/api/rooms/reservations/1', 'rooms.write'],
  ['GET', '/api/doctors', 'doctors.read'], ['POST', '/api/doctors', 'doctors.write'],
  ['GET', '/api/doctors/1/schedules/active', 'schedules.read'],
  ['PATCH', '/api/schedules/1', 'schedules.write'], ['GET', '/api/services', 'services.read'],
  ['POST', '/api/billing/prepare', 'billing.prepare']
];

test('matriz por HTTP, revocación y sesiones vigentes', async () => {
  const app = express();
  app.use(cookieParser(), auth, authorize(), (_req, res) => res.sendStatus(204));
  app.use((error, _req, res, _next) => res.status(500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const token = (id, role = 'ADMINISTRADOR') => jwt.sign({ rol: role }, process.env.JWT_SECRET, { subject: id });
  const request = (method, path, session) => fetch(origin + path, {
    method, headers: session ? { cookie: 'medicalsys_session=' + session } : {}
  });
  try {
    assert.equal((await request('GET', '/api/users')).status, 401);
    for (const [method, path, permission] of endpoints) {
      assert.equal(permissionForRequest({ method, originalUrl: path }), permission);
      for (let i = 0; i < roles.length; i++) {
        // Deliberately spoof the stale JWT role: authorization must use the database.
        const result = await request(method, path, token(String(i + 1)));
        assert.equal(result.status, defaults(roles[i]).includes(permission) ? 204 : 403, roles[i] + ' ' + method + ' ' + path);
      }
    }
    const receptionistToken = token('4');
    policies.set('RECEPCIONISTA', defaults('RECEPCIONISTA').filter((p) => p !== 'rooms.write'));
    assert.equal((await request('POST', '/api/rooms/reservations', receptionistToken)).status, 403);
    assert.equal((await request('GET', '/api/rooms', receptionistToken)).status, 204);
    accounts.get('4').estado = 'SUSPENDIDO';
    assert.equal((await request('GET', '/api/rooms', receptionistToken)).status, 401);
    accounts.get('4').estado = 'ACTIVO';
    accounts.get('4').rol.activo = false;
    assert.equal((await request('GET', '/api/rooms', receptionistToken)).status, 401);
    accounts.get('4').rol.activo = true;
    assert.equal((await request('GET', '/api/unregistered', token('1'))).status, 403);
  } finally {
    policies.clear();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('rechaza escalamiento, dependencias incompletas y retiro del acceso propio', async () => {
  const actor = { id: '2', rol: 'OSI' };
  await assert.rejects(security.updatePolicy('OSI', ['patients.read'], actor), { statusCode: 400 });
  await assert.rejects(security.updatePolicy('MEDICO', ['attention.write'], actor), { statusCode: 400 });
  await assert.rejects(security.updatePolicy('OSI', [], actor), { statusCode: 400 });
  assert.deepEqual(await security.permissionsForRole('DESCONOCIDO'), []);
  await assert.rejects(users.mutateUser('DEACTIVATE', '2', {}, actor), { statusCode: 400 });
  await assert.rejects(users.mutateUser('UPDATE', '2', { rol: 'ADMINISTRADOR' }, actor), { statusCode: 400 });
  await assert.rejects(users.mutateUser('CREATE', null, {
    nombres: 'Prueba', apellidos: 'Seguridad', email: 'prueba@medicalsys.test',
    password: 'MedicalSys2026!', passwordConfirmation: 'OtroValor2026!', rol: 'PACIENTE'
  }, actor), /contraseñas no coinciden/);
});

test('un gestor sin seguridad no puede editar accesos superiores', async () => {
  policies.set('OSI', ['users.manage']);
  try {
    await assert.rejects(users.mutateUser('UPDATE', '1', { estado: 'INACTIVO' }, { id: '2', rol: 'OSI' }), { statusCode: 403 });
    await assert.rejects(security.updatePolicy('MEDICO', defaults('MEDICO'), { id: '2', rol: 'OSI' }), { statusCode: 403 });
  } finally { policies.clear(); }
});
