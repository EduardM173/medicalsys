const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { defaults, permissionForRequest } = require('../../src/security/permissions');

const servicePath = path.resolve(__dirname, '../../src/services/patient-portal.service.js');
const repoPath = require.resolve('../../src/repositories/patient.repository');
const historyPath = require.resolve('../../src/services/medical-history.service');
const documentPath = require.resolve('../../src/services/document.service');
const appointmentPath = require.resolve('../../src/services/appointment.service');
const notificationPath = require.resolve('../../src/services/notification.service');
const auditPath = require.resolve('../../src/services/audit.service');

function installMocks() {
  const audit = [];
  const patient = { id_paciente: 10n, activo: true };
  require.cache[repoPath] = { id: repoPath, filename: repoPath, loaded: true, exports: {
    paciente: { findUnique: async () => patient }
  }};
  require.cache[historyPath] = { id: historyPath, filename: historyPath, loaded: true, exports: {
    getMedicalHistoryByPatientId: async (id) => ({ patient: { id: Number(id) }, history: null, attentions: [] })
  }};
  require.cache[documentPath] = { id: documentPath, filename: documentPath, loaded: true, exports: {
    listDocumentsByPatientId: async (id) => ({ patient: { id: Number(id) }, documents: [] }),
    getDocumentFileById: async () => ({ size: 0, stream: null, fileName: 'x.pdf', mimeType: 'application/pdf' })
  }};
  require.cache[appointmentPath] = { id: appointmentPath, filename: appointmentPath, loaded: true, exports: {
    listAppointments: async () => []
  }};
  require.cache[notificationPath] = { id: notificationPath, filename: notificationPath, loaded: true, exports: {
    listPatientNotificationHistory: async () => ({ patient: { id: 10 }, notifications: [] })
  }};
  require.cache[auditPath] = { id: auditPath, filename: auditPath, loaded: true, exports: {
    recordClinicalRead: async (_u, action, target) => audit.push(['read', action, String(target)]),
    recordUnauthorizedAccess: async (_u, permission, target) => audit.push(['denied', permission, target])
  }};
  delete require.cache[servicePath];
  return { portal: require(servicePath), audit };
}

test('HU-32: PACIENTE solo recibe permiso de portal y no permisos administrativos', () => {
  assert.deepEqual(defaults('PACIENTE'), ['patient.portal.read']);
  assert.equal(permissionForRequest({ method: 'GET', originalUrl: '/api/patient/10/history' }), 'patient.portal.read');
  assert.equal(permissionForRequest({ method: 'GET', originalUrl: '/api/patient/10/documents' }), 'patient.portal.read');
  assert.equal(permissionForRequest({ method: 'GET', originalUrl: '/api/patient/10/documents/7/file' }), 'patient.portal.read');
  assert.equal(permissionForRequest({ method: 'GET', originalUrl: '/api/patient/10/appointments' }), 'patient.portal.read');
  assert.equal(permissionForRequest({ method: 'GET', originalUrl: '/api/patient/10/notifications' }), 'patient.portal.read');
  assert.equal(permissionForRequest({ method: 'POST', originalUrl: '/api/atenciones' }), 'attention.write');
  assert.equal(permissionForRequest({ method: 'PATCH', originalUrl: '/api/patients/10' }), 'patients.write');
  assert.equal(permissionForRequest({ method: 'PATCH', originalUrl: '/api/appointments/10' }), 'appointments.manage');
});

test('HU-32: cambiar patientId produce 404 y se audita', async () => {
  const { portal, audit } = installMocks();
  const user = { id: '55', rol: 'PACIENTE', permissions: ['patient.portal.read'] };
  await assert.rejects(portal.getHistory(user, '11'), { statusCode: 404 });
  assert.deepEqual(audit[0], ['denied', 'patient.portal.read', '/api/patient/11']);
});

test('HU-32: consultas propias de historial, documentos, citas y notificaciones quedan auditadas', async () => {
  const { portal, audit } = installMocks();
  const user = { id: '55', rol: 'PACIENTE', permissions: ['patient.portal.read'] };
  await portal.getHistory(user, '10');
  await portal.listDocuments(user, '10');
  await portal.listAppointments(user, '10');
  await portal.listNotifications(user, '10');
  assert.deepEqual(audit.map((row) => row[1]), [
    'PATIENT_HISTORY_READ', 'PATIENT_DOCUMENTS_READ', 'PATIENT_APPOINTMENTS_READ', 'PATIENT_NOTIFICATIONS_READ'
  ]);
});

test('HU-32: el servicio de archivo recibe el paciente propietario para validar el documento', async () => {
  const { portal } = installMocks();
  const user = { id: '55', rol: 'PACIENTE', permissions: ['patient.portal.read'] };
  const file = await portal.openDocument(user, '10', '7');
  assert.equal(file.fileName, 'x.pdf');
});


test('HU-32: la sesión del PACIENTE conserva patientId y solo el permiso del portal', () => {
  const authSource = require('node:fs').readFileSync(
    path.resolve(__dirname, '../../src/services/auth.service.js'),
    'utf8'
  );
  const securitySource = require('node:fs').readFileSync(
    path.resolve(__dirname, '../../src/services/security.service.js'),
    'utf8'
  );
  assert.match(authSource, /patientId:\s*user\.paciente\s*\?\s*Number\(user\.paciente\.id_paciente\)\s*:\s*null/);
  assert.match(securitySource, /if \(role === 'PACIENTE'\)\s*\{[\s\S]*return \['patient\.portal\.read'\];/);
});
