const roles = ['ADMINISTRADOR', 'OSI', 'MEDICO', 'RECEPCIONISTA', 'PACIENTE'];
const admin = ['ADMINISTRADOR'];
const reception = ['ADMINISTRADOR', 'RECEPCIONISTA'];
const clinical = ['ADMINISTRADOR', 'MEDICO'];
const staff = ['ADMINISTRADOR', 'RECEPCIONISTA', 'MEDICO'];
// Eligible roles cap delegation: non-clinical roles cannot become physicians through permissions.
const catalog = [
  ['users.manage', 'Administrar usuarios y asignar roles', ['ADMINISTRADOR', 'OSI'], []],
  ['security.manage', 'Administrar matriz y consultar auditoría', ['ADMINISTRADOR', 'OSI'], ['users.manage']],
  ['patients.read', 'Consultar pacientes', staff, []],
  ['patients.write', 'Registrar y editar pacientes', reception, ['patients.read']],
  ['history.read', 'Consultar historial clínico', clinical, ['patients.read']],
  ['attention.write', 'Registrar atenciones médicas', clinical, ['history.read']],
  ['documents.read', 'Consultar y descargar documentos', staff, ['patients.read']],
  ['documents.write', 'Subir y eliminar documentos', clinical, ['documents.read']],
  ['appointments.manage', 'Gestionar citas', reception, ['patients.read', 'doctors.read', 'services.read', 'schedules.read']],
  ['agenda.read', 'Consultar agenda propia', ['MEDICO'], []],
  ['consents.manage', 'Generar y firmar consentimientos propios', ['MEDICO'], []],
  ['rooms.read', 'Consultar salas y reservas', staff, []],
  ['rooms.write', 'Reservar, reasignar y cancelar salas', reception, ['rooms.read']],
  ['doctors.read', 'Consultar directorio médico', reception, []],
  ['doctors.write', 'Gestionar perfiles médicos', admin, ['doctors.read', 'users.manage']],
  ['schedules.read', 'Consultar horarios médicos', staff, []],
  ['schedules.write', 'Gestionar horarios médicos', admin, ['schedules.read', 'doctors.read']],
  ['services.read', 'Consultar catálogo de servicios', reception, []],
  ['billing.prepare', 'Preparar factura', reception, ['patients.read', 'services.read', 'appointments.manage']]
].map(([code, label, eligibleRoles, requires]) => ({ code, label, eligibleRoles, requires }));
function defaults(role) {
  return catalog.filter((p) => p.eligibleRoles.includes(role)).map((p) => p.code);
}
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
