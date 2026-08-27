import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/Button';
import { DoctorForm } from '../components/DoctorForm';
import { createDoctor, getDoctor, getDoctors, getUsers, updateDoctor } from '../services/api';
import '../styles/doctors.css';

export function DoctorsPage() {
  const [doctors, setDoctors] = useState([]);
  const [users, setUsers] = useState([]);
  const [associatedUserIds, setAssociatedUserIds] = useState(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [formMode, setFormMode] = useState(null);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const availableUsers = useMemo(() => {
    return users.filter((user) => user.rol === 'MEDICO' && !associatedUserIds.has(user.id));
  }, [associatedUserIds, users]);

  async function loadReferenceData() {
    try {
      const [userResponse, doctorResponse] = await Promise.all([getUsers(), getDoctors()]);
      setUsers(userResponse.users);
      setAssociatedUserIds(new Set(doctorResponse.doctors.map((doctor) => doctor.usuarioId)));
    } catch (requestError) {
      setError(requestError.message || 'No fue posible cargar los usuarios.');
    }
  }

  async function loadDoctors(searchTerm = search) {
    setLoading(true);
    try {
      const response = await getDoctors(searchTerm.trim());
      setDoctors(response.doctors);
      setError('');
    } catch (requestError) {
      setError(requestError.message || 'No fue posible cargar los médicos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReferenceData();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => loadDoctors(search), 400);
    return () => clearTimeout(timeout);
  }, [search]);

  async function fetchDoctor(id) {
    setDetailLoading(true);
    try {
      const response = await getDoctor(id);
      setSelectedDoctor(response.doctor);
      setError('');
      return response.doctor;
    } catch (requestError) {
      setError(requestError.message || 'No fue posible completar la operación.');
      return null;
    } finally {
      setDetailLoading(false);
    }
  }

  async function openCreateForm() {
    await loadReferenceData();
    setEditingDoctor(null);
    setFormMode('create');
    setNotice('');
  }

  async function openEditForm(id) {
    const doctor = await fetchDoctor(id);
    if (doctor) {
      setEditingDoctor(doctor);
      setFormMode('edit');
      setNotice('');
    }
  }

  async function saveDoctor(payload) {
    let doctorId;
    if (formMode === 'edit') {
      const response = await updateDoctor(editingDoctor.id, payload);
      doctorId = response.doctor.id;
      setNotice('Información profesional actualizada correctamente.');
    } else {
      const response = await createDoctor(payload);
      doctorId = response.doctor.id;
      setNotice('Médico registrado correctamente.');
    }
    setFormMode(null);
    setEditingDoctor(null);
    await Promise.all([loadDoctors(), loadReferenceData(), fetchDoctor(doctorId)]);
  }

  return (
    <main className="doctors-page">
      <header className="doctors-header">
        <div>
          <span className="login-kicker">Administración</span>
          <h1>Gestión de Médicos</h1>
          <p>Información profesional de los médicos de MedicalSys</p>
        </div>
        <Button className="new-doctor-button" onClick={openCreateForm}>+ Registrar médico</Button>
      </header>

      <section className="doctor-toolbar" aria-label="Búsqueda de médicos">
        <label htmlFor="doctor-search">Buscar médicos</label>
        <input id="doctor-search" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, matrícula o especialidad..." type="search" value={search} />
      </section>

      {notice && <p className="notice success-notice">{notice}</p>}
      {error && <p className="notice error-notice" role="alert">{error}</p>}

      {formMode && (
        <section className="doctor-form-panel" aria-label={formMode === 'edit' ? 'Editar médico' : 'Registrar médico'}>
          <div className="doctor-panel-heading">
            <div>
              <span className="login-kicker">{formMode === 'edit' ? 'Edición' : 'Nuevo perfil'}</span>
              <h2>{formMode === 'edit' ? 'Editar información profesional' : 'Registrar médico'}</h2>
              <p>Los datos personales pertenecen al usuario y no se duplican en el perfil médico.</p>
            </div>
            <button aria-label="Cerrar formulario" className="panel-close" onClick={() => setFormMode(null)} type="button">×</button>
          </div>
          <DoctorForm key={editingDoctor?.id || 'new'} availableUsers={availableUsers} initialDoctor={editingDoctor} onCancel={() => setFormMode(null)} onSave={saveDoctor} />
        </section>
      )}

      {(selectedDoctor || detailLoading) && (
        <section className="doctor-detail-card" aria-label="Información del médico">
          {detailLoading && !selectedDoctor ? <p className="doctor-empty">Cargando información...</p> : selectedDoctor && (
            <>
              <div className="doctor-panel-heading">
                <div><span className="login-kicker">Perfil médico</span><h2>{selectedDoctor.nombreCompleto}</h2></div>
                <button aria-label="Cerrar información" className="panel-close" onClick={() => setSelectedDoctor(null)} type="button">×</button>
              </div>
              <div className="doctor-detail-sections">
                <section>
                  <h3>Información básica</h3>
                  <dl>
                    <div><dt>Nombre</dt><dd>{selectedDoctor.nombreCompleto}</dd></div>
                    <div><dt>Correo</dt><dd>{selectedDoctor.usuario.email}</dd></div>
                    <div><dt>Teléfono</dt><dd>{selectedDoctor.usuario.telefono || 'No registrado'}</dd></div>
                    <div><dt>Rol</dt><dd>{selectedDoctor.usuario.rol}</dd></div>
                  </dl>
                </section>
                <section>
                  <h3>Información profesional</h3>
                  <dl>
                    <div><dt>Matrícula profesional</dt><dd>{selectedDoctor.matriculaProfesional}</dd></div>
                    <div><dt>Especialidad</dt><dd>{selectedDoctor.especialidad}</dd></div>
                    <div><dt>Estado</dt><dd><span className={`status-badge status-${selectedDoctor.estado.toLowerCase()}`}>{selectedDoctor.estado}</span></dd></div>
                  </dl>
                </section>
              </div>
              <div className="doctor-detail-actions"><Button onClick={() => openEditForm(selectedDoctor.id)}>Editar médico</Button></div>
            </>
          )}
        </section>
      )}

      <section className="doctor-directory-card">
        <div className="doctor-directory-heading"><div><h2>Listado de médicos</h2><p>{doctors.length} {doctors.length === 1 ? 'médico' : 'médicos'}</p></div></div>
        {loading ? (
          <p className="doctor-empty">Cargando médicos...</p>
        ) : doctors.length === 0 ? (
          <p className="doctor-empty">{search.trim() ? 'No se encontraron médicos.' : 'No hay médicos registrados.'}</p>
        ) : (
          <div className="doctor-list">
            {doctors.map((doctor) => (
              <article className="doctor-list-item" key={doctor.id}>
                <div className="doctor-avatar" aria-hidden="true">{doctor.usuario.nombres.charAt(0)}{doctor.usuario.apellidos.charAt(0)}</div>
                <div className="doctor-main"><strong>{doctor.nombreCompleto}</strong><span>{doctor.matriculaProfesional}</span></div>
                <div className="doctor-specialty">{doctor.especialidad}</div>
                <span className={`status-badge status-${doctor.estado.toLowerCase()}`}>{doctor.estado}</span>
                <div className="doctor-row-actions">
                  <button className="text-action" onClick={() => fetchDoctor(doctor.id)} type="button">Ver</button>
                  <button className="text-action" onClick={() => openEditForm(doctor.id)} type="button">Editar</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
