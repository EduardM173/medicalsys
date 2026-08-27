const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(path, options = {}) {
  let response;

  try {
    response = await fetch(`${apiUrl}${path}`, {
      credentials: 'include',
      ...options,
      headers: {
        'Content-Type': 'application/json',
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

export function getDoctors() {
  return request('/doctors');
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
