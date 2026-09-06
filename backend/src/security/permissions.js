const roles = ['ADMINISTRADOR', 'OSI', 'MEDICO', 'RECEPCIONISTA', 'PACIENTE'];
const defaultAssignments = {
  ADMINISTRADOR: ['users.manage', 'security.manage', 'patients.read', 'patients.write', 'history.read', 'attention.write', 'documents.read', 'documents.write', 'appointments.manage', 'rooms.read', 'rooms.write', 'doctors.read', 'doctors.write', 'schedules.read', 'schedules.write', 'services.read', 'billing.prepare'],
  OSI: ['users.manage', 'security.manage'],
  MEDICO: ['patients.read', 'history.read', 'attention.write', 'documents.read', 'documents.write', 'agenda.read', 'consents.manage', 'rooms.read', 'schedules.read'],
  RECEPCIONISTA: ['patients.read', 'patients.write', 'documents.read', 'appointments.manage', 'rooms.read', 'rooms.write', 'doctors.read', 'schedules.read', 'services.read', 'billing.prepare'],
  PACIENTE: []
};
const catalog = [
  ['users.manage', 'Administrar usuarios y asignar roles', []],
  ['security.manage', 'Administrar matriz y consultar auditoría', ['users.manage']],
  ['patients.read', 'Consultar pacientes', []],
  ['patients.write', 'Registrar y editar pacientes', ['patients.read']],
  ['history.read', 'Consultar historial clínico', ['patients.read']],
  ['attention.write', 'Registrar atenciones médicas', ['history.read']],
  ['documents.read', 'Consultar y descargar documentos', ['patients.read']],
  ['documents.write', 'Subir y eliminar documentos', ['documents.read']],
  ['appointments.manage', 'Gestionar citas', ['patients.read', 'doctors.read', 'services.read', 'schedules.read']],
  ['agenda.read', 'Consultar agenda propia', []],
  ['consents.manage', 'Generar y firmar consentimientos propios', []],
  ['rooms.read', 'Consultar salas y reservas', []],
  ['rooms.write', 'Reservar, reasignar y cancelar salas', ['rooms.read']],
  ['doctors.read', 'Consultar directorio médico', []],
  ['doctors.write', 'Gestionar perfiles médicos', ['doctors.read', 'users.manage']],
  ['schedules.read', 'Consultar horarios médicos', []],
  ['schedules.write', 'Gestionar horarios médicos', ['schedules.read', 'doctors.read']],
  ['services.read', 'Consultar catálogo de servicios', []],
  ['billing.prepare', 'Preparar factura', ['patients.read', 'services.read', 'appointments.manage']]
].map(([code, label, requires]) => ({ code, label, requires }));
function defaults(role) { return [...(defaultAssignments[role] || [])]; }
function permissionForRequest(request) {
  const path = request.originalUrl.split('?')[0].replace(/\/$/, '');
  const read = ['GET', 'HEAD'].includes(request.method);
  if (/^\/api\/security(?:\/|$)/.test(path)) return 'security.manage';
  if (/^\/api\/users(?:\/|$)/.test(path)) return 'users.manage';
  if (/^\/api\/patients\/[^/]+\/medical-history$/.test(path)) return 'history.read';
  if (/^\/api\/patients\/[^/]+\/documents$/.test(path) || /^\/api\/documents\//.test(path)) return read ? 'documents.read' : 'documents.write';
  if (/^\/api\/patients(?:\/|$)/.test(path)) return read ? 'patients.read' : 'patients.write';
  if (/^\/api\/(?:atenciones|attentions|historias)(?:\/|$)/.test(path)) return read && !path.endsWith('/options') ? 'history.read' : 'attention.write';
  if (/^\/api\/doctors\/[^/]+\/schedules(?:\/active)?$/.test(path) || /^\/api\/schedules\//.test(path)) return read ? 'schedules.read' : 'schedules.write';
  if (/^\/api\/doctors(?:\/|$)/.test(path)) return read ? 'doctors.read' : 'doctors.write';
  if (/^\/api\/rooms(?:\/|$)/.test(path)) return read && !path.endsWith('/pending-appointments') ? 'rooms.read' : 'rooms.write';
  if (/^\/api\/appointments(?:\/|$)/.test(path)) return 'appointments.manage';
  if (/^\/api\/agenda(?:\/|$)/.test(path)) return 'agenda.read';
  if (/^\/api\/(?:consents|consentimientos)(?:\/|$)/.test(path)) return 'consents.manage';
  if (/^\/api\/services(?:\/|$)/.test(path)) return 'services.read';
  if (/^\/api\/billing(?:\/|$)/.test(path)) return 'billing.prepare';
  return null;
}
module.exports = { roles, catalog, defaults, permissionForRequest };
