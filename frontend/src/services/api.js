const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(path, options = {}) {
  let response;

  const isFormData = options.body instanceof FormData;
  const defaultHeaders = isFormData ? {} : { 'Content-Type': 'application/json' };

  try {
    response = await fetch(`${apiUrl}${path}`, {
      credentials: 'include',
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    });
  } catch (_error) {
    throw new ApiError(0, 'No fue posible conectar con el servidor.');
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(response.status, data.message || 'No fue posible procesar la solicitud.');
  }

  return data;
}

export function getHealth() {
  return request('/health');
}

export function loginRequest(credentials) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials)
  });
}

export function getMe() {
  return request('/auth/me');
}

export function logoutRequest() {
  return request('/auth/logout', { method: 'POST' });
}

export function getUsers() {
  return request('/users');
}

export function createUser(user) {
  return request('/users', {
    method: 'POST',
    body: JSON.stringify(user)
  });
}

export function updateUser(id, user) {
  return request(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(user)
  });
}

export function deactivateUser(id) {
  return request(`/users/${id}`, { method: 'DELETE' });
}

export function getDoctors(search = '') {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return request(`/doctors${query}`);
}

export function getDoctor(id) {
  return request(`/doctors/${id}`);
}

export function createDoctor(doctor) {
  return request('/doctors', { method: 'POST', body: JSON.stringify(doctor) });
}

export function updateDoctor(id, doctor) {
  return request(`/doctors/${id}`, { method: 'PATCH', body: JSON.stringify(doctor) });
}

export function getDoctorSchedules(doctorId, { activeOnly = false } = {}) {
  return request(`/doctors/${doctorId}/schedules${activeOnly ? '/active' : ''}`);
}

export function createSchedule(doctorId, schedule) {
  return request(`/doctors/${doctorId}/schedules`, {
    method: 'POST',
    body: JSON.stringify(schedule)
  });
}

export function updateSchedule(scheduleId, schedule) {
  return request(`/schedules/${scheduleId}`, {
    method: 'PATCH',
    body: JSON.stringify(schedule)
  });
}

export function getPatients(search = '') {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return request(`/patients${query}`);
}

export function getPatient(id) {
  return request(`/patients/${id}`);
}

export function createPatient(patient) {
  return request('/patients', { method: 'POST', body: JSON.stringify(patient) });
}

export function updatePatient(id, patient) {
  return request(`/patients/${id}`, { method: 'PATCH', body: JSON.stringify(patient) });
}

export function getMedicalHistory(patientId) {
  return request(`/patients/${patientId}/medical-history`);
}

export function getMyAgenda(date) {
  return request(`/agenda/me?date=${encodeURIComponent(date)}`);
}

export function getConsentOptions() {
  return request('/consents/options');
}

export function createConsent(consent) {
  return request('/consents', {
    method: 'POST',
    body: JSON.stringify(consent)
  });
}

export function getConsent(id) {
  return request(`/consents/${id}`);
}

export function signConsent(consentId, signatureData) {
  return request(`/consents/${consentId}/sign`, {
    method: 'POST',
    body: JSON.stringify({ signatureData })
  });
}

// ==========================================
// Atención Médica e Historial Clínico (HU-12)
// ==========================================

export function createAttention(attention) {
  return request('/atenciones', {
    method: 'POST',
    body: JSON.stringify(attention)
  });
}

export function getAttentionsByHistory(historyId) {
  return request(`/historias/${historyId}/atenciones`);
}

export function getAttentionOptions() {
  return request('/atenciones/options');
}

export function getServices() {
  return request('/services');
}

export function getAppointments(filters = {}) {
  const params = new URLSearchParams();
  if (filters.fecha) params.set('fecha', filters.fecha);
  if (filters.medicoId) params.set('medicoId', filters.medicoId);
  if (filters.pacienteId) params.set('pacienteId', filters.pacienteId);
  if (filters.estado) params.set('estado', filters.estado);
  const query = params.toString();
  return request(`/appointments${query ? `?${query}` : ''}`);
}

export function getAppointment(id) {
  return request(`/appointments/${id}`);
}

export function createAppointment(appointment) {
  return request('/appointments', { method: 'POST', body: JSON.stringify(appointment) });
}

// ==========================================
// Documentos Clínicos y Exámenes (HU-13 / HU-18)
// ==========================================

export function getClinicalDocuments(patientId) {
  return request(`/patients/${patientId}/documents`);
}

export async function getClinicalDocumentFile(documentId) {
  let response;
  try {
    response = await fetch(`${apiUrl}/documents/${documentId}/file`, {
      credentials: 'include'
    });
  } catch (_error) {
    throw new ApiError(0, 'No fue posible conectar con el servidor.');
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      data.message || 'No fue posible abrir el documento clínico.'
    );
  }

  return response.blob();
}

export function getPatientDocuments(patientId, { tipo } = {}) {
  const query = tipo ? `?tipo=${encodeURIComponent(tipo)}` : '';
  return request(`/patients/${patientId}/documents${query}`);
}

export function uploadPatientDocument(patientId, formData) {
  return request(`/patients/${patientId}/documents`, {
    method: 'POST',
    body: formData
  });
}

export function deleteClinicalDocument(documentId) {
  return request(`/documents/${documentId}`, {
    method: 'DELETE'
  });
}

export function getDocumentDownloadUrl(documentId) {
  return `${apiUrl}/documents/${documentId}/download`;
}

// ==========================================
// HU-17: Salas y Reservas
// ==========================================

export function getRooms(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/rooms${query ? `?${query}` : ''}`);
}

export function getAvailableRooms({ fechaHoraInicio, fechaHoraFin, tipo } = {}) {
  const params = new URLSearchParams();
  if (fechaHoraInicio) params.append('fechaHoraInicio', fechaHoraInicio);
  if (fechaHoraFin) params.append('fechaHoraFin', fechaHoraFin);
  if (tipo) params.append('tipo', tipo);
  return request(`/rooms/available?${params.toString()}`);
}

export function getPendingAppointments() {
  return request('/rooms/pending-appointments');
}

export function getRoomReservations(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/rooms/reservations${query ? `?${query}` : ''}`);
}

export function createRoomReservation(reservation) {
  return request('/rooms/reservations', {
    method: 'POST',
    body: JSON.stringify(reservation)
  });
}

export function updateRoomReservation(id, data) {
  return request(`/rooms/reservations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  });
}

export function cancelRoomReservation(id) {
  return request(`/rooms/reservations/${id}`, {
    method: 'DELETE'
  });
}
