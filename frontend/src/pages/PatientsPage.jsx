import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { PatientForm } from '../components/PatientForm';
import { useAuth } from '../contexts/AuthContext';
import { createPatient, getPatient, getPatients, updatePatient } from '../services/api';
import '../styles/patients.css';

function calculateAge(birthDate) {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(`${birthDate}T00:00:00`);
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthday = today.getMonth() < birth.getMonth()
    || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

function documentLabel(patient) {
  return `${patient.documentoIdentidad}${patient.complemento ? ` ${patient.complemento}` : ''}`;
}

export function PatientsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isDoctor = user?.rol === 'MEDICO';
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [formMode, setFormMode] = useState(null);
  const [editingPatient, setEditingPatient] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await getPatients(search.trim());
        if (active) {
          setPatients(response.patients);
          setError('');
        }
      } catch (requestError) {
        if (active) setError(requestError.message || 'No fue posible completar la operación.');
      } finally {
        if (active) setLoading(false);
      }
    }, 400);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [search, refreshKey]);

  async function fetchPatient(id) {
    setDetailLoading(true);
    try {
      const response = await getPatient(id);
      setSelectedPatient(response.patient);
      setError('');
      return response.patient;
    } catch (requestError) {
      setError(requestError.message || 'No fue posible completar la operación.');
      return null;
    } finally {
      setDetailLoading(false);
    }
  }

  function openCreateForm() {
    setEditingPatient(null);
    setFormMode('create');
    setNotice('');
  }

  async function openEditForm(patientId) {
    const patient = await fetchPatient(patientId);
    if (patient) {
      setEditingPatient(patient);
      setFormMode('edit');
      setNotice('');
    }
  }

  async function savePatient(payload) {
    let patientId;
    if (formMode === 'edit') {
      const response = await updatePatient(editingPatient.id, payload);
      patientId = response.patient.id;
      setNotice('Paciente actualizado correctamente.');
    } else {
      const response = await createPatient(payload);
      patientId = response.patient.id;
      setNotice('Paciente registrado correctamente.');
    }
    setFormMode(null);
    setEditingPatient(null);
    setRefreshKey((current) => current + 1);
    await fetchPatient(patientId);
  }

  return (
    <main className="patients-page">
      <header className="patients-header">
        <div>
          <span className="login-kicker">{isDoctor ? 'Consulta clínica' : 'Directorio'}</span>
          <h1>{isDoctor ? 'Historial Clínico' : 'Gestión de Pacientes'}</h1>
          <p>{isDoctor ? 'Seleccione un paciente para consultar su historial' : 'Registro y consulta de pacientes de MedicalSys'}</p>
        </div>
        {!isDoctor && <Button className="new-patient-button" onClick={openCreateForm}>+ Nuevo paciente</Button>}
      </header>

      <section className="patient-toolbar" aria-label="Búsqueda de pacientes">
        <label htmlFor="patient-search">Buscar pacientes</label>
        <div className="patient-search-box">
          <span aria-hidden="true">⌕</span>
          <input id="patient-search" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre o documento..." type="search" value={search} />
        </div>
      </section>

      {notice && <p className="notice success-notice">{notice}</p>}
      {error && <p className="notice error-notice" role="alert">{error}</p>}

      {formMode && (
        <section className="patient-form-panel" aria-label={formMode === 'edit' ? 'Editar paciente' : 'Nuevo paciente'}>
          <div className="patient-panel-heading">
            <div>
              <span className="login-kicker">{formMode === 'edit' ? 'Edición' : 'Nuevo registro'}</span>
              <h2>{formMode === 'edit' ? 'Editar paciente' : 'Registrar paciente'}</h2>
              <p>Los campos marcados con * son obligatorios. No se creará una cuenta de usuario.</p>
            </div>
            <button aria-label="Cerrar formulario" className="panel-close" onClick={() => setFormMode(null)} type="button">×</button>
          </div>
          <PatientForm key={editingPatient?.id || 'new'} initialPatient={editingPatient} onCancel={() => setFormMode(null)} onSave={savePatient} />
        </section>
      )}

      {(selectedPatient || detailLoading) && (
        <section className="patient-detail-card" aria-label="Información del paciente">
          {detailLoading && !selectedPatient ? (
            <p className="patient-empty">Cargando información...</p>
          ) : selectedPatient && (
            <>
              <div className="patient-panel-heading">
                <div>
                  <span className="login-kicker">Información básica</span>
                  <h2>{selectedPatient.nombres} {selectedPatient.apellidos}</h2>
                </div>
                <button aria-label="Cerrar información" className="panel-close" onClick={() => setSelectedPatient(null)} type="button">×</button>
              </div>
              <dl className="patient-detail-grid">
                <div><dt>Documento</dt><dd>{documentLabel(selectedPatient)}</dd></div>
                <div><dt>Fecha de nacimiento</dt><dd>{selectedPatient.fechaNacimiento}</dd></div>
                <div><dt>Edad</dt><dd>{calculateAge(selectedPatient.fechaNacimiento)} años</dd></div>
                <div><dt>Teléfono</dt><dd>{selectedPatient.telefono}</dd></div>
                {selectedPatient.email && <div><dt>Correo</dt><dd>{selectedPatient.email}</dd></div>}
                {selectedPatient.direccion && <div><dt>Dirección</dt><dd>{selectedPatient.direccion}</dd></div>}
                {selectedPatient.sexo && <div><dt>Sexo</dt><dd>{selectedPatient.sexo}</dd></div>}
                {selectedPatient.grupoSanguineo && <div><dt>Grupo sanguíneo</dt><dd>{selectedPatient.grupoSanguineo}</dd></div>}
                {selectedPatient.contactoEmergencia && <div><dt>Contacto de emergencia</dt><dd>{selectedPatient.contactoEmergencia}</dd></div>}
                {selectedPatient.telefonoEmergencia && <div><dt>Teléfono de emergencia</dt><dd>{selectedPatient.telefonoEmergencia}</dd></div>}
              </dl>
              <div className="patient-detail-actions">
                {isDoctor
                  ? <Button onClick={() => navigate(`/historial-clinico/${selectedPatient.id}`)}>Ver historial clínico</Button>
                  : <Button onClick={() => openEditForm(selectedPatient.id)}>Editar paciente</Button>}
              </div>
            </>
          )}
        </section>
      )}

      <section className="patient-directory-card">
        <div className="patient-directory-heading">
          <div>
            <h2>Directorio de pacientes</h2>
            <p>{patients.length} {patients.length === 1 ? 'paciente' : 'pacientes'}</p>
          </div>
        </div>

        {loading ? (
          <p className="patient-empty">Cargando pacientes...</p>
        ) : patients.length === 0 ? (
          <p className="patient-empty">{search.trim() ? 'No se encontraron pacientes.' : 'No hay pacientes registrados.'}</p>
        ) : (
          <div className="patient-list">
            {patients.map((patient) => (
              <article className="patient-list-item" key={patient.id}>
                <div className="patient-avatar" aria-hidden="true">{patient.nombres.charAt(0)}{patient.apellidos.charAt(0)}</div>
                <div className="patient-primary">
                  <strong>{patient.nombres} {patient.apellidos}</strong>
                  <span>CI {documentLabel(patient)}</span>
                </div>
                <div className="patient-secondary">
                  <span>{patient.telefono}</span>
                  <small>{calculateAge(patient.fechaNacimiento)} años</small>
                </div>
                <div className="patient-row-actions">
                  <button className="text-action" onClick={() => fetchPatient(patient.id)} type="button">Ver</button>
                  {isDoctor ? (
                    <button className="text-action" onClick={() => navigate(`/historial-clinico/${patient.id}`)} type="button">Historial</button>
                  ) : (
                    <button className="text-action" onClick={() => openEditForm(patient.id)} type="button">Editar</button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
