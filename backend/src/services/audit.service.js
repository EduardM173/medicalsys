const { recordAudit } = require('../repositories/security.repository');

/**
 * HU-31 / PA-05: registra en security_audit los intentos de acceso no
 * autorizado a datos clínicos (403). Nunca interrumpe la petición.
 */
const CLINICAL_PERMISSIONS = new Set([
  'history.read',
  'attention.write',
  'consents.manage',
  'documents.read',
  'documents.write'
]);

function isClinicalPermission(permission) {
  return CLINICAL_PERMISSIONS.has(permission);
}

async function recordUnauthorizedAccess(actor, permission, target, details = {}) {
  const actorId = actor?.id || actor?.idUsuario || actor?.id_usuario;
  if (!actorId) return;
  try {
    await recordAudit(
      String(actorId),
      'CLINICAL_ACCESS_DENIED',
      permission,
      { path: target, ...details }
    );
  } catch (_error) {
    // La auditoría nunca debe romper el flujo de la petición.
  }
}

module.exports = {
  CLINICAL_PERMISSIONS,
  isClinicalPermission,
  recordUnauthorizedAccess
};