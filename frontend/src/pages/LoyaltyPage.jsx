import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { PageContext } from '../components/PageContext';
import { LoyaltyModal } from '../components/LoyaltyModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { getLoyaltyPatients, enrollLoyaltyPatient, updateLoyaltyPatient, removeLoyaltyPatient } from '../services/api';
import '../styles/campaigns-loyalty.css';

const TIER_LABELS = {
  ESTANDAR: 'Bronce (Estándar)',
  FRECUENTE: 'Plata (Frecuente)',
  PREMIUM: 'Oro (Premium)'
};

const STATUS_LABELS = {
  ACTIVO: 'Activo',
  INACTIVO: 'Inactivo',
  SUSPENDIDO: 'Suspendido'
};

function formatDate(isoString) {
  if (!isoString) return '—';
  return new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'medium',
    timeZone: 'America/La_Paz'
  }).format(new Date(isoString));
}

export function LoyaltyPage() {
  const [patients, setPatients] = useState([]);
  const [stats, setStats] = useState({
    totalPacientes: 0,
    totalAfiliados: 0,
    noAfiliados: 0,
    activos: 0,
    suspendidos: 0,
    inactivos: 0,
    tasaAfiliacion: 0,
    porNivel: { ESTANDAR: 0, FRECUENTE: 0, PREMIUM: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filtros
  const [search, setSearch] = useState('');
  const [selectedEstado, setSelectedEstado] = useState('');
  const [selectedNivel, setSelectedNivel] = useState('');

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [patientToRetire, setPatientToRetire] = useState(null);
  const [retiring, setRetiring] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getLoyaltyPatients({
        search,
        estado: selectedEstado,
        nivel: selectedNivel
      });
      setPatients(response.patients || []);
      if (response.stats) {
        setStats(response.stats);
      }
      setError('');
    } catch (err) {
      setError(err.message || 'No fue posible cargar el padrón de fidelización.');
    } finally {
      setLoading(false);
    }
  }, [search, selectedEstado, selectedNivel]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleOpenEnroll(patient) {
    setSelectedPatient(patient);
    setIsModalOpen(true);
  }

  function handleOpenManage(patient) {
    setSelectedPatient(patient);
    setIsModalOpen(true);
  }

  async function handleSaveLoyalty(data) {
    if (selectedPatient?.fidelizacion) {
      await updateLoyaltyPatient(selectedPatient.id, {
        estado: data.estado,
        nivel: data.nivel,
        puntosAcumulados: data.puntosAcumulados,
        notas: data.notas
      });
      setSuccessMsg(`Membresía de ${selectedPatient.nombres} actualizada exitosamente.`);
    } else {
      await enrollLoyaltyPatient({
        patientId: selectedPatient.id,
        nivel: data.nivel,
        puntos: data.puntos,
        notas: data.notas
      });
      setSuccessMsg(`Paciente ${selectedPatient.nombres} afiliado exitosamente al programa.`);
    }
    setTimeout(() => setSuccessMsg(''), 4000);
    await loadData();
  }

  function handleRequestRemove(patient) {
    setPatientToRetire(patient);
    setIsConfirmOpen(true);
  }

  async function handleConfirmRemove() {
    if (!patientToRetire) return;
    setRetiring(true);
    try {
      await removeLoyaltyPatient(patientToRetire.id);
      setSuccessMsg(`El paciente ${patientToRetire.nombres} ${patientToRetire.apellidos} fue retirado del programa.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      setIsConfirmOpen(false);
      setPatientToRetire(null);
      await loadData();
    } catch (err) {
      setError(err.message || 'No fue posible retirar al paciente.');
    } finally {
      setRetiring(false);
    }
  }

  return (
    <main className="loyalty-page">
      <PageContext
        breadcrumbs={[
          { label: 'Inicio', to: '/dashboard' },
          { label: 'Fidelización' }
        ]}
        title="Programa de Fidelización de Pacientes"
        subtitle="Identificación de miembros, categorías y actualización de estados"
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
            <Link to="/pacientes" className="button button-secondary">
              Directorio Clínico de Pacientes
            </Link>
          </div>
        }
      />

      {/* KPI Cards */}
      <section className="kpi-grid" aria-label="Métricas de fidelización">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Afiliados al Programa</span>
            <div className="kpi-icon" style={{ background: '#f5f3ff', color: '#7c3aed' }}>⭐</div>
          </div>
          <div className="kpi-value">{stats.totalAfiliados}</div>
          <div className="kpi-subtext">De {stats.totalPacientes} pacientes registrados ({stats.tasaAfiliacion}%)</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Miembros Activos</span>
            <div className="kpi-icon" style={{ background: '#ecfdf5', color: '#059669' }}>🟢</div>
          </div>
          <div className="kpi-value" style={{ color: '#059669' }}>{stats.activos}</div>
          <div className="kpi-subtext">Con acceso a beneficios vigentes</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">En Pausa / Suspendidos</span>
            <div className="kpi-icon" style={{ background: '#fef2f2', color: '#dc2626' }}>⏸️</div>
          </div>
          <div className="kpi-value" style={{ color: '#dc2626' }}>{stats.suspendidos}</div>
          <div className="kpi-subtext">Membresías temporalmente en pausa</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Distribución por Nivel</span>
            <div className="kpi-icon" style={{ background: '#fffbeb', color: '#d97706' }}>🏆</div>
          </div>
          <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
            <div>🥇 Oro: <strong>{stats.porNivel.PREMIUM}</strong></div>
            <div>🥈 Plata: <strong>{stats.porNivel.FRECUENTE}</strong></div>
            <div>🥉 Bronce: <strong>{stats.porNivel.ESTANDAR}</strong></div>
          </div>
        </div>
      </section>

      {successMsg && <div className="notice success-notice" style={{ marginBottom: '1rem' }} role="status">{successMsg}</div>}
      {error && <div className="notice error-notice" style={{ marginBottom: '1rem' }} role="alert">{error}</div>}

      {/* Filtros */}
      <section className="filters-toolbar" aria-label="Filtros del padrón">
        <div className="filter-group">
          <div className="search-input-wrapper">
            <span className="search-icon-symbol" aria-hidden="true">🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por paciente, CI, email o teléfono..."
            />
          </div>

          <select
            className="filter-select"
            value={selectedEstado}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedEstado(val);
              if (val === 'SIN_PROGRAMA') {
                setSelectedNivel('');
              }
            }}
          >
            <option value="">Todos los Estados</option>
            <option value="ACTIVO">Solo Miembros Activos</option>
            <option value="SUSPENDIDO">Solo Suspendidos / Pausados</option>
            <option value="INACTIVO">Solo Inactivos</option>
            <option value="SIN_PROGRAMA">Pacientes No Afiliados</option>
          </select>

          <select
            className="filter-select"
            value={selectedNivel}
            disabled={selectedEstado === 'SIN_PROGRAMA'}
            onChange={(e) => setSelectedNivel(e.target.value)}
          >
            <option value="">{selectedEstado === 'SIN_PROGRAMA' ? 'Sin Nivel (No Afiliado)' : 'Todos los Niveles'}</option>
            <option value="PREMIUM">Oro (Premium)</option>
            <option value="FRECUENTE">Plata (Frecuente)</option>
            <option value="ESTANDAR">Bronce (Estándar)</option>
          </select>
        </div>

        <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
          {patients.length} {patients.length === 1 ? 'paciente listado' : 'pacientes listados'}
        </span>
      </section>

      {/* Tabla del Padrón */}
      <section className="table-card">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            Cargando padrón de fidelización...
          </div>
        ) : patients.length === 0 ? (
          <div className="empty-state">
            <h3>No se encontraron pacientes</h3>
            <p>
              {selectedEstado === 'SIN_PROGRAMA'
                ? 'Todos los pacientes registrados en el directorio clínico ya forman parte del programa de fidelización, o no hay pacientes que coincidan con la búsqueda.'
                : 'No existen registros que coincidan con los criterios de búsqueda aplicados.'}
            </p>
            <Link to="/pacientes" className="button" style={{ display: 'inline-block', marginTop: '1rem' }}>
              + Ver Directorio Clínico de Pacientes
            </Link>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="ui-data-table">
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Contacto</th>
                  <th>Estado en Programa</th>
                  <th>Categoría / Nivel</th>
                  <th>Puntos / Visitas</th>
                  <th>Fecha Afiliación</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => {
                  const fid = p.fidelizacion;
                  const isMember = Boolean(fid);

                  return (
                    <tr key={p.id}>
                      <td>
                        <strong style={{ display: 'block', color: '#0f172a' }}>{p.nombres} {p.apellidos}</strong>
                        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                          CI: {p.documentoIdentidad}{p.complemento ? ` ${p.complemento}` : ''}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: '#475569' }}>
                        <div>{p.telefono || 'Sin teléfono'}</div>
                        <div style={{ color: '#94a3b8' }}>{p.email || 'Sin correo'}</div>
                      </td>
                      <td>
                        {isMember ? (
                          <span className={`badge-status badge-${fid.estado.toLowerCase()}`}>
                            <span className="badge-dot" />
                            {STATUS_LABELS[fid.estado] || fid.estado}
                          </span>
                        ) : (
                          <span className="badge-status badge-no-miembro">
                            No Afiliado
                          </span>
                        )}
                      </td>
                      <td>
                        {isMember ? (
                          <span className={`tier-badge tier-${fid.nivel === 'PREMIUM' ? 'oro' : fid.nivel === 'FRECUENTE' ? 'plata' : 'bronce'}`}>
                            {TIER_LABELS[fid.nivel] || fid.nivel}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>—</span>
                        )}
                      </td>
                      <td>
                        {isMember ? (
                          <strong style={{ color: '#0f172a' }}>{fid.puntosAcumulados} pts</strong>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {isMember ? formatDate(fid.fechaInscripcion) : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                          {isMember ? (
                            <>
                              <button
                                type="button"
                                className="btn-action-text btn-edit"
                                onClick={() => handleOpenManage(p)}
                              >
                                Gestionar
                              </button>
                              <button
                                type="button"
                                className="btn-action-text btn-danger"
                                onClick={() => handleRequestRemove(p)}
                              >
                                Retirar
                              </button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleOpenEnroll(p)}
                            >
                              + Afiliar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <LoyaltyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        patient={selectedPatient}
        onSave={handleSaveLoyalty}
      />

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => {
          if (!retiring) {
            setIsConfirmOpen(false);
            setPatientToRetire(null);
          }
        }}
        onConfirm={handleConfirmRemove}
        title="¿Retirar Paciente del Programa?"
        message={`¿Está seguro de que desea retirar a ${patientToRetire?.nombres} ${patientToRetire?.apellidos} del programa de fidelización? Esta acción no borrará su historial clínico en MedicalSys, únicamente su membresía de fidelización.`}
        confirmText="Retirar del Programa"
        loading={retiring}
      />
    </main>
  );
}
