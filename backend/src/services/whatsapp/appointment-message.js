const CLINIC_TIME_ZONE = 'America/La_Paz';

function fullName(nombres, apellidos) {
  return `${nombres} ${apellidos}`.trim();
}

function formatAppointmentDateTime(date) {
  const fecha = new Intl.DateTimeFormat('es-BO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: CLINIC_TIME_ZONE
  }).format(date);
  const hora = new Intl.DateTimeFormat('es-BO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: CLINIC_TIME_ZONE
  }).format(date);
  return { fecha, hora, texto: `${fecha} a las ${hora}` };
}

function buildConfirmationMessage(cita) {
  const pacienteNombre = fullName(cita.paciente.nombres, cita.paciente.apellidos);
  const medicoNombre = fullName(cita.medico.usuario.nombres, cita.medico.usuario.apellidos);
  const { texto } = formatAppointmentDateTime(cita.fecha_hora_inicio);
  return `*MedicalSys:* Estimado(a) ${pacienteNombre}, le confirmamos su cita para el ${texto} `
    + `con el Dr(a). ${medicoNombre} (${cita.servicio_medico.nombre}). `
    + 'Responda *SI* para confirmar su asistencia o *NO* si necesita reprogramarla.';
}

function buildReminderMessage(cita) {
  const pacienteNombre = fullName(cita.paciente.nombres, cita.paciente.apellidos);
  const medicoNombre = fullName(cita.medico.usuario.nombres, cita.medico.usuario.apellidos);
  const { texto } = formatAppointmentDateTime(cita.fecha_hora_inicio);
  return `*Recordatorio MedicalSys:* Hola ${pacienteNombre}, le recordamos su cita el ${texto} `
    + `con el Dr(a). ${medicoNombre} (${cita.servicio_medico.nombre}). `
    + 'Por favor responda *SI* para confirmar o *NO* si necesita reprogramarla.';
}

module.exports = {
  CLINIC_TIME_ZONE,
  fullName,
  formatAppointmentDateTime,
  buildConfirmationMessage,
  buildReminderMessage
};
