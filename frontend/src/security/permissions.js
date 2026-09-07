export function can(user, permission) {
  return Boolean(user?.permissions?.includes(permission));
}
export const modules = [
  ['users.manage', '/admin/usuarios', 'Gestión de Usuarios', 'Usuarios, roles y estados', 'U'],
  ['security.manage', '/admin/seguridad', 'Roles y Seguridad', 'Matriz de permisos y auditoría', 'S'],
  ['doctors.write', '/admin/medicos', 'Gestión de Médicos', 'Perfiles profesionales', 'M'],
  ['schedules.write', '/admin/horarios-medicos', 'Horarios Médicos', 'Disponibilidad semanal', 'H'],
  ['appointments.manage', '/citas', 'Agenda de Citas', 'Programar y consultar citas', 'C'],
  ['billing.prepare', '/facturacion/preparar', 'Preparar Factura', 'Receptor, conceptos y total', 'F'],
  ['notifications.manage', '/whatsapp', 'WhatsApp de Citas', 'Confirmaciones y recordatorios', 'W'],
  ['agenda.read', '/agenda', 'Agenda Médica', 'Mis citas programadas', 'A'],
  ['consents.manage', '/consentimientos', 'Consentimientos', 'Historial, generación y firma', 'C'],
  ['patients.read', '/pacientes', 'Pacientes', 'Registro y consulta', 'P'],
  ['rooms.read', '/salas', 'Salas y Quirófanos', 'Consulta de disponibilidad', 'S']
];
