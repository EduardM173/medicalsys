const patientRepository = require('../repositories/patient.repository');
const medicalHistoryService = require('./medical-history.service');
const documentService = require('./document.service');
const appointmentService = require('./appointment.service');
const notificationService = require('./notification.service');
const { recordClinicalRead, recordUnauthorizedAccess } = require('./audit.service');

class PatientPortalError extends Error {
  constructor(statusCode, message) { super(message); this.statusCode = statusCode; }
}
function parseId(value, entity = 'identificador') {
  if (!/^\d+$/.test(String(value)) || BigInt(value) < 1n) throw new PatientPortalError(404, `${entity} no encontrado.`);
  return BigInt(value);
}
async function getPatientForUser(userId) {
  const patient = await patientRepository.paciente.findUnique({
    where: { id_usuario: BigInt(userId) }, select: { id_paciente: true, activo: true }
  });
  if (!patient || !patient.activo) throw new PatientPortalError(404, 'Paciente no encontrado.');
  return patient;
}
async function assertOwnPatient(user, requestedPatientId) {
  const requestedId = parseId(requestedPatientId, 'Paciente');
  const ownPatient = await getPatientForUser(user.id);
  if (ownPatient.id_paciente !== requestedId) {
    await recordUnauthorizedAccess(user, 'patient.portal.read', `/api/patient/${requestedPatientId}`, {
      reason: 'CROSS_PATIENT_ACCESS', requestedPatientId: String(requestedPatientId), ownerPatientId: String(ownPatient.id_paciente)
    });
    throw new PatientPortalError(404, 'Paciente no encontrado.');
  }
  return ownPatient.id_paciente;
}
async function getHistory(user, patientId) {
  const ownPatientId = await assertOwnPatient(user, patientId);
  const result = await medicalHistoryService.getMedicalHistoryByPatientId(ownPatientId);
  await recordClinicalRead(user, 'PATIENT_HISTORY_READ', ownPatientId, { resource: 'medical_history', patientId: String(ownPatientId) });
  return result;
}
async function listDocuments(user, patientId) {
  const ownPatientId = await assertOwnPatient(user, patientId);
  const result = await documentService.listDocumentsByPatientId(ownPatientId);
  await recordClinicalRead(user, 'PATIENT_DOCUMENTS_READ', ownPatientId, { resource: 'clinical_documents', patientId: String(ownPatientId) });
  return result;
}
async function openDocument(user, patientId, documentId) {
  const ownPatientId = await assertOwnPatient(user, patientId);

  // PA-08: registrar también el intento de descarga antes de resolver el
  // archivo. Así queda trazabilidad incluso si el documento no existe o no
  // pertenece al paciente autenticado.
  await recordClinicalRead(user, 'PATIENT_DOCUMENT_READ_ATTEMPT', documentId, {
    resource: 'clinical_document_file',
    patientId: String(ownPatientId),
    documentId: String(documentId)
  });

  try {
    const file = await documentService.getDocumentFileById(
      documentId,
      { id: user.id, rol: user.rol },
      ownPatientId
    );

    await recordClinicalRead(user, 'PATIENT_DOCUMENT_READ', documentId, {
      resource: 'clinical_document_file',
      patientId: String(ownPatientId),
      documentId: String(documentId)
    });
    return file;
  } catch (error) {
    if (error?.statusCode === 404) {
      await recordUnauthorizedAccess(user, 'patient.portal.read', `/api/patient/${patientId}/documents/${documentId}/file`, {
        reason: 'DOCUMENT_NOT_FOUND_OR_NOT_OWNED',
        patientId: String(ownPatientId),
        documentId: String(documentId)
      });
    }
    throw error;
  }
}
async function listAppointments(user, patientId) {
  const ownPatientId = await assertOwnPatient(user, patientId);
  const appointments = await appointmentService.listAppointments({ pacienteId: ownPatientId });
  await recordClinicalRead(user, 'PATIENT_APPOINTMENTS_READ', ownPatientId, { resource: 'appointments', patientId: String(ownPatientId) });
  return { appointments };
}
async function listNotifications(user, patientId) {
  const ownPatientId = await assertOwnPatient(user, patientId);
  const result = await notificationService.listPatientNotificationHistory({ patientId: ownPatientId });
  await recordClinicalRead(user, 'PATIENT_NOTIFICATIONS_READ', ownPatientId, { resource: 'notifications', patientId: String(ownPatientId) });
  return result;
}
module.exports = { PatientPortalError, assertOwnPatient, getHistory, listDocuments, openDocument, listAppointments, listNotifications };
