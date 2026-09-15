import { fetchWithPolicy } from './transport';
import { clearDrafts } from './secure-drafts';
import { listKey } from '../components/ListPagination';
const pendingSearches = new Map();
const apiUrl = import.meta.env.VITE_API_URL
  || (import.meta.env.PROD ? '/api' : `${window.location.protocol}//${window.location.hostname}:3000/api`);

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const AUTH_TOKEN_KEY = 'medicalsys_token';

export function getStoredToken() {
  try {
    return sessionStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(AUTH_TOKEN_KEY) || '';
  } catch (_e) {
    return '';
  }
}

export function setStoredToken(token) {
  try {
    if (token) {
      sessionStorage.removeItem('medicalsys_signed_out');
      sessionStorage.setItem(AUTH_TOKEN_KEY, token);
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch (_e) {}
}

async function request(path, options = {}) {
  let response;
  const view = window.location.pathname;
  const cleanPath = path.split('?')[0];
  const query = new URLSearchParams(path.split('?')[1] || '');
  if (!options.method || options.method === 'GET') {
    query.set('page', new URLSearchParams(window.location.search).get(listKey(cleanPath)) || '1');
    query.set('pageSize', '20');
    const prefix = listKey(cleanPath) + '_';
    for (const [key, value] of new URLSearchParams(window.location.search)) if (key.startsWith(prefix)) query.set('page_' + key.slice(prefix.length), value);
    path = cleanPath + '?' + query.toString();
  }
  let searchController;
  if ((!options.method || options.method === 'GET') && query.has('search')) {
    pendingSearches.get(cleanPath)?.abort();
    searchController = new AbortController();
    pendingSearches.set(cleanPath, searchController);
  }

  const isFormData = options.body instanceof FormData;
  
  // Resolución profesional de tenant por URL: subdominio (*.localhost) o query param (?tenant=...)
  let urlTenant = null;
  try {
    const host = window.location.hostname.toLowerCase();
    if (host.endsWith('.localhost')) {
      const sub = host.replace('.localhost', '');
      if (sub && sub !== 'www') urlTenant = sub;
    }
    if (!urlTenant) {
      const q = new URLSearchParams(window.location.search).get('tenant');
      if (q) urlTenant = q.trim().toLowerCase();
    }
  } catch (_e) {}

  const isLoginPath = cleanPath === '/auth/login';
  // En el portal central (localhost sin subdominio), no enviar un tenant heredado de localStorage para el login
  const activeTenant = urlTenant || (!isLoginPath ? localStorage.getItem('medicalsys_active_tenant') : null);
  const token = getStoredToken();
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  const tenantHeaders = activeTenant ? { 'X-Tenant-Code': activeTenant } : {};

  const defaultHeaders = isFormData
    ? { ...tenantHeaders, ...authHeaders }
    : { 'Content-Type': 'application/json', ...tenantHeaders, ...authHeaders };

  try {
    response = await fetchWithPolicy(`${apiUrl}${path}`, {
      credentials: 'include',
      signal: searchController?.signal,
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    });
  } catch (_error) {
    if (_error.name === 'AbortError') throw _error;
    throw new ApiError(0, _error.message || 'No fue posible conectar con el servidor.');
  } finally {
    if (searchController && pendingSearches.get(cleanPath) === searchController) pendingSearches.delete(cleanPath);
  }

  if (options.responseType === 'blob') {
    if (!response.ok) throw new ApiError(response.status, 'No fue posible descargar el documento.');
    return response.blob();
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (cleanPath !== '/auth/me' && [401, 403].includes(response.status)) window.dispatchEvent(new Event('permissions-changed'));
    throw new ApiError(response.status, data.message || 'No fue posible procesar la solicitud.');
  }

  const pagination = data.pagination || JSON.parse(response.headers.get('X-Pagination') || 'null');
  if (pagination) window.dispatchEvent(new CustomEvent('list-pagination', { detail: { path: cleanPath, view, pagination } }));
  return data;
}
export function getReadiness(signal) { return request('/ready', { signal, timeoutMs: 3000 }); }

export function getHealth() {
  return request('/health');
}

export async function loginRequest(credentials) {
  const data = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials)
  });
  if (data && data.token) {
    sessionStorage.removeItem('medicalsys_signed_out');
    const host = window.location.hostname.toLowerCase();
    const isRootPortal = host === 'localhost' || host === '127.0.0.1';
    if (!isRootPortal) {
      setStoredToken(data.token);
    }
  }
  return data;
}

export function forgotPasswordRequest(email) {
  return request('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
}

export async function getMe() {
  if (sessionStorage.getItem('medicalsys_signed_out') === 'true') throw new ApiError(401, 'Sesión cerrada.');
  return request('/auth/me');
}

export async function logoutRequest() {
  sessionStorage.setItem('medicalsys_signed_out', 'true');
  await clearDrafts();
  setStoredToken(null);
  try {
    localStorage.removeItem('medicalsys_active_tenant');
  } catch (_e) {}
  return request('/auth/logout', { method: 'POST' });
}

export function getUsers(filters = {}) {
  return request('/users?' + new URLSearchParams(filters));
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

export function getDoctors(search = '', options = {}) {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return request(`/doctors${query}`, options);
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

export function getPatients(search = '', options = {}) {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return request(`/patients${query}`, options);
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

export function getPatientPortalHistory(patientId) { return request(`/patient/${patientId}/history`); }
export function getPatientPortalDocuments(patientId) { return request(`/patient/${patientId}/documents`); }
export async function downloadPatientPortalDocument(patientId, documentId) {
  return request(`/patient/${patientId}/documents/${documentId}/file`, { responseType: 'blob', timeoutMs: 60000 });
}
export function getPatientPortalAppointments(patientId) { return request(`/patient/${patientId}/appointments`); }
export function getPatientPortalNotifications(patientId) { return request(`/patient/${patientId}/notifications`); }
export function getPatientAnnouncements(patientId) { return request(`/patient/${patientId}/announcements`); }
export function updatePatientMarketingPreferences(patientId, preferences) {
  return request(`/patient/${patientId}/marketing-preferences`, { method: 'PATCH', body: JSON.stringify(preferences) });
}
export function usePatientPromotion(patientId, campaignId, data) {
  return request(`/patient/${patientId}/announcements/${campaignId}/use`, { method: 'POST', body: JSON.stringify(data) });
}

export function getMyAgenda(date) {
  return request(`/agenda/me?date=${encodeURIComponent(date)}`);
}

export function getConsentOptions() {
  return request('/consents/options');
}

// HU-33: el documento debe nacer desde una plantilla versionada; este flujo
// genera y persiste el PDF previo a la firma.
export function getConsentTemplates({ activeOnly = true } = {}) {
  return request(`/consent-templates${activeOnly ? '?active=true' : ''}`);
}

export function generateConsentFromTemplate(templateId, data) {
  return request(`/consent-templates/${encodeURIComponent(templateId)}/generate`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
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

export function getConsents() {
  return request('/consents');
}

export function signConsent(consentId, signatureData) {
  return request(`/consents/${consentId}/sign`, {
    method: 'POST',
    body: JSON.stringify({ signatureData })
  });
}

export function signConsentWithCertificate(consentId, signature) {
  return request(`/consents/${encodeURIComponent(consentId)}/sign`, {
    method: 'POST',
    body: JSON.stringify(signature)
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

// HU-15: actualización de una cita (reprogramación y/o cambio de estado, incluida cancelación lógica).
export function updateAppointment(id, changes) {
  return request(`/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(changes) });
}

// HU-21: valida y persiste la factura como borrador (BORRADOR); no la emite.
export function prepareBilling(data) {
  return request('/billing/prepare', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

// KPIs de facturación: total registradas, pendientes de emisión y emitidas hoy.
export function getBillingSummary() {
  return request('/billing/summary');
}

// HU-22: emite una factura computarizada previamente preparada (BORRADOR).
export function emitBilling(id) {
  return request(`/billing/${id}/emit`, {
    method: 'POST'
  });
}

export function getIssuedInvoices(filters = {}) {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.patientId) params.set('patientId', filters.patientId);
  if (filters.date) params.set('date', filters.date);
  const query = params.toString();
  return request(`/billing/invoices${query ? `?${query}` : ''}`);
}

export function getIssuedInvoice(id) {
  return request(`/billing/invoices/${encodeURIComponent(id)}`);
}

export function getInvoiceXmlUrl(id) {
  return `${apiUrl}/billing/invoices/${encodeURIComponent(id)}/xml`;
}

export function cancelInvoice(id, data = {}) {
  return request(`/billing/invoices/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}


// ==========================================
// Documentos Clínicos y Exámenes (HU-13 / HU-18)
// ==========================================

export function getClinicalDocuments(patientId) {
  return request(`/patients/${patientId}/documents`);
}

export async function getClinicalDocumentFile(documentId) {
  return request(`/documents/${documentId}/file`, { responseType: 'blob', timeoutMs: 60000 });
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
export function getSecurityMatrix() { return request('/security'); }
export function getSecurityAudit() { return request('/security/audit'); }
export function createSecurityRole(data) {
  return request('/security/roles', { method: 'POST', body: JSON.stringify(data) });
}
export function updateSecurityRole(role, permissions) {
  return request('/security/roles/' + encodeURIComponent(role), { method: 'PUT', body: JSON.stringify({ permissions }) });
}
export function getTemporaryGrants() { return request('/security/temporary-grants'); }
export function grantTemporaryPermission(data) {
  return request('/security/temporary-grants', { method: 'POST', body: JSON.stringify(data) });
}
export function revokeTemporaryGrant(id) {
  return request('/security/temporary-grants/' + encodeURIComponent(id), { method: 'DELETE' });
}
export function getUserRoles() { return request('/users/roles/catalog'); }

// ==========================================
// HU-24 / HU-25: Notificaciones de citas por WhatsApp
// ==========================================

export function getConfirmationCandidates() {
  return request('/notifications/confirmations/candidates');
}

export function sendAppointmentConfirmation(citaId) {
  return request('/notifications/confirmations', {
    method: 'POST',
    body: JSON.stringify({ citaId })
  });
}

export function getReminderCandidates() {
  return request('/notifications/reminders/candidates');
}

export function sendAppointmentReminder(citaId) {
  return request('/notifications/reminders', {
    method: 'POST',
    body: JSON.stringify({ citaId })
  });
}

export function runAppointmentReminders(citaIds) {
  return request('/notifications/reminders/run', {
    method: 'POST',
    body: JSON.stringify({ citaIds })
  });
}

export function getNotificationHistory({ patientId, appointmentId } = {}) {
  const params = new URLSearchParams();
  if (patientId) params.set('patientId', patientId);
  if (appointmentId) params.set('appointmentId', appointmentId);
  const query = params.toString();
  return request(`/notifications${query ? `?${query}` : ''}`);
}

// HU-35 / MED-324: alertas de trabajos que agotaron sus reintentos.
export function getWhatsAppNotificationFailures() {
  return request('/notifications/failures');
}

export function retryWhatsAppNotificationFailure(jobId) {
  return request(`/notifications/failures/${encodeURIComponent(jobId)}/retry`, { method: 'POST' });
}

// ==========================================
// HU-27: Campañas y Promociones de Salud
// ==========================================

export function getCampaigns({ search, estado } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (estado) params.set('estado', estado);
  const query = params.toString();
  return request(`/campaigns${query ? `?${query}` : ''}`);
}

export function getCampaign(id) {
  return request(`/campaigns/${id}`);
}

export function createCampaign(campaign) {
  return request('/campaigns', {
    method: 'POST',
    body: JSON.stringify(campaign)
  });
}

export function updateCampaign(id, campaign) {
  return request(`/campaigns/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(campaign)
  });
}

export function deleteCampaign(id) {
  return request(`/campaigns/${id}`, {
    method: 'DELETE'
  });
}

export function sendCampaignWhatsApp(id) {
  return request(`/campaigns/${id}/send`, { method: 'POST' });
}

export function getCampaignMetrics(id) {
  return request(`/campaigns/${id}/metrics`);
}

// ==========================================
// HU-28: Fidelización de Pacientes
// ==========================================

export function getLoyaltyPatients({ search, estado, nivel, soloMiembros } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (estado) params.set('estado', estado);
  if (nivel) params.set('nivel', nivel);
  if (soloMiembros) params.set('soloMiembros', 'true');
  const query = params.toString();
  return request(`/loyalty/patients${query ? `?${query}` : ''}`);
}

export function getLoyaltyStats() {
  return request('/loyalty/stats');
}

export function enrollLoyaltyPatient(data) {
  return request('/loyalty/enroll', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export function updateLoyaltyPatient(patientId, data) {
  return request(`/loyalty/patients/${patientId}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  });
}

export function removeLoyaltyPatient(patientId) {
  return request(`/loyalty/patients/${patientId}`, {
    method: 'DELETE'
  });
}

// ==========================================
// HU-30: Multitenencia SaaS y Suscripciones
// ==========================================

export function getCurrentTenant() {
  return request('/tenants/current');
}

export function getTenantCatalog() {
  return request('/tenants/catalog');
}

export function getMyOrganizations() {
  return request('/tenants/my-organizations');
}

export function provisionTenant(data) {
  return request('/tenants/provision', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export function generateTenantRenewalQr(data) {
  return request('/tenants/subscription/renew-qr', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export function confirmTenantPayment(data) {
  return request('/tenants/subscription/confirm-payment', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export function generateBnbRenewalQr(data) {
  return request('/tenants/subscription/renew-bnb-qr', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export function checkBnbQrStatus(qrId) {
  return request(`/tenants/subscription/bnb-status/${encodeURIComponent(qrId)}`);
}

