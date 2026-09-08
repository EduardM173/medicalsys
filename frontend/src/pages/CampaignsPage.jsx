import { Button } from '../components/Button';
import { PageContext } from '../components/PageContext';
import { CampaignModal } from '../components/CampaignModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { getCampaigns, createCampaign, updateCampaign, deleteCampaign } from '../services/api';
import '../styles/campaigns-loyalty.css';

const STATUS_LABELS = {
  ACTIVA: 'Activa',
  PROGRAMADA: 'Programada',
  BORRADOR: 'Borrador',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada'
};

const PROMO_LABELS = {
  GENERAL: 'General',
  DESCUENTO_CONSULTA: 'Desc. Consulta',
  PAQUETE_PREVENTIVO: 'Paquete Chequeo',
  JORNADA_GRATUITA: 'Jornada Preventiva'
};

function formatDate(isoString) {
  if (!isoString) return 'Sin fecha definida';
  return new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'medium',
    timeZone: 'America/La_Paz'
  }).format(new Date(isoString));
}

export function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    activas: 0,
    programadas: 0,
    borrador: 0,
    finalizadas: 0,
    canceladas: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filtros
  const [search, setSearch] = useState('');
  const [selectedEstado, setSelectedEstado] = useState('');

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getCampaigns({
        search,
        estado: selectedEstado
      });
      setCampaigns(response.campaigns || []);
      if (response.stats) {
        setStats(response.stats);
      }
      setError('');
    } catch (err) {
      setError(err.message || 'No fue posible cargar las campañas de salud.');
    } finally {
      setLoading(false);
    }
  }, [search, selectedEstado]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleOpenCreate() {
    setEditingCampaign(null);
    setIsModalOpen(true);
  }

  function handleOpenEdit(campaign) {
    setEditingCampaign(campaign);
    setIsModalOpen(true);
  }

  async function handleSaveCampaign(campaignData) {
    if (editingCampaign) {
      await updateCampaign(editingCampaign.id, campaignData);
      setSuccessMsg('Campaña actualizada exitosamente.');
    } else {
      await createCampaign(campaignData);
      setSuccessMsg('Campaña creada exitosamente.');
    }
    setTimeout(() => setSuccessMsg(''), 4000);
    await loadData();
  }

  async function handleQuickStateChange(campaign, nuevoEstado) {
    try {
      await updateCampaign(campaign.id, { estado: nuevoEstado });
      setSuccessMsg(`Campaña marcada como ${STATUS_LABELS[nuevoEstado]}.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      await loadData();
    } catch (err) {
      setError(err.message || 'No fue posible actualizar el estado.');
    }
  }

  function handleRequestDelete(campaign) {
    setCampaignToDelete(campaign);
    setIsConfirmOpen(true);
  }

  async function handleConfirmDelete() {
    if (!campaignToDelete) return;
    setDeleting(true);
    try {
      const res = await deleteCampaign(campaignToDelete.id);
      setSuccessMsg(res.message || 'Campaña procesada.');
      setTimeout(() => setSuccessMsg(''), 4000);
      setIsConfirmOpen(false);
      setCampaignToDelete(null);
      await loadData();
    } catch (err) {
      setError(err.message || 'No fue posible eliminar la campaña.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="campaigns-page">
      <PageContext
        breadcrumbs={[
          { label: 'Inicio', to: '/dashboard' },
          { label: 'Campañas de Salud' }
        ]}
        title="Campañas y Promociones de Salud"
        subtitle="Planificación, beneficios y difusión médica preventiva"
        actions={
          <Button onClick={handleOpenCreate}>
            + Nueva Campaña
          </Button>
        }
      />

      {/* KPI Cards */}
      <section className="kpi-grid" aria-label="Resumen de campañas">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Total Campañas</span>
            <div className="kpi-icon" style={{ background: '#f1f5f9', color: '#475569' }}>📋</div>
          </div>
          <div className="kpi-value">{stats.total}</div>
          <div className="kpi-subtext">Histórico registrado</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Activas en Curso</span>
            <div className="kpi-icon" style={{ background: '#ecfdf5', color: '#059669' }}>🟢</div>
          </div>
          <div className="kpi-value" style={{ color: '#059669' }}>{stats.activas}</div>
          <div className="kpi-subtext">Vigentes y comunicables</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Programadas</span>
            <div className="kpi-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>📅</div>
          </div>
          <div className="kpi-value" style={{ color: '#2563eb' }}>{stats.programadas}</div>
          <div className="kpi-subtext">Lanzamiento futuro</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">En Borrador</span>
            <div className="kpi-icon" style={{ background: '#fefce8', color: '#d97706' }}>📝</div>
          </div>
          <div className="kpi-value" style={{ color: '#d97706' }}>{stats.borrador}</div>
          <div className="kpi-subtext">En preparación técnica</div>
        </div>
      </section>

      {successMsg && <div className="notice success-notice" style={{ marginBottom: '1rem' }} role="status">{successMsg}</div>}
      {error && <div className="notice error-notice" style={{ marginBottom: '1rem' }} role="alert">{error}</div>}

      {/* Barra de Filtros */}
      <section className="filters-toolbar" aria-label="Filtros de búsqueda">
        <div className="filter-group">
          <div className="search-input-wrapper">
            <span className="search-icon-symbol" aria-hidden="true">🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, descripción o público..."
            />
          </div>

          <select
            className="filter-select"
            value={selectedEstado}
            onChange={(e) => setSelectedEstado(e.target.value)}
          >
            <option value="">Todos los Estados</option>
            <option value="ACTIVA">Activas</option>
            <option value="PROGRAMADA">Programadas</option>
            <option value="BORRADOR">Borradores</option>
            <option value="FINALIZADA">Finalizadas</option>
            <option value="CANCELADA">Canceladas</option>
          </select>
        </div>

        <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
          {campaigns.length} {campaigns.length === 1 ? 'campaña encontrada' : 'campañas encontradas'}
        </span>
      </section>

      {/* Tabla de Campañas */}
      <section className="table-card">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            Cargando campañas de salud...
          </div>
        ) : campaigns.length === 0 ? (
          <div className="empty-state">
            <h3>No se encontraron campañas</h3>
            <p>No existen registros que coincidan con los filtros aplicados o aún no ha creado ninguna campaña.</p>
            <Button onClick={handleOpenCreate} style={{ marginTop: '1rem' }}>
              + Crear Primera Campaña
            </Button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="ui-data-table">
              <thead>
                <tr>
                  <th>Campaña / Promoción</th>
                  <th>Tipo y Beneficio</th>
                  <th>Público Objetivo</th>
                  <th>Vigencia</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td style={{ maxWidth: '280px' }}>
                      <strong style={{ display: 'block', color: '#0f172a', marginBottom: '2px' }}>{c.nombre}</strong>
                      {c.descripcion && (
                        <span style={{ fontSize: '0.78rem', color: '#64748b', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {c.descripcion}
                        </span>
                      )}
                    </td>
                    <td>
                      <span style={{ display: 'block', fontWeight: 600 }}>{PROMO_LABELS[c.tipoPromocion] || c.tipoPromocion}</span>
                      {c.descuentoPorcentaje > 0 && (
                        <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700 }}>
                          {c.descuentoPorcentaje}% de descuento
                        </span>
                      )}
                    </td>
                    <td style={{ maxWidth: '200px', fontSize: '0.8rem', color: '#475569' }}>
                      {c.publicoObjetivo || 'Público general'}
                    </td>
                    <td style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                      <div><strong>Inicio:</strong> {formatDate(c.fechaInicio)}</div>
                      <div><strong>Fin:</strong> {formatDate(c.fechaFin)}</div>
                    </td>
                    <td>
                      <span className={`badge-status badge-${c.estado.toLowerCase()}`}>
                        <span className="badge-dot" />
                        {STATUS_LABELS[c.estado] || c.estado}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                        {c.estado === 'BORRADOR' && (
                          <button
                            type="button"
                            className="btn-action-text btn-edit"
                            onClick={() => handleQuickStateChange(c, 'ACTIVA')}
                            title="Activar campaña inmediatamente"
                          >
                            Activar
                          </button>
                        )}
                        {c.estado === 'ACTIVA' && (
                          <button
                            type="button"
                            className="btn-action-text"
                            style={{ color: '#d97706' }}
                            onClick={() => handleQuickStateChange(c, 'FINALIZADA')}
                            title="Concluir campaña"
                          >
                            Finalizar
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-action-text btn-edit"
                          onClick={() => handleOpenEdit(c)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn-action-text btn-danger"
                          onClick={() => handleRequestDelete(c)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <CampaignModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        campaign={editingCampaign}
        onSave={handleSaveCampaign}
      />

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => {
          if (!deleting) {
            setIsConfirmOpen(false);
            setCampaignToDelete(null);
          }
        }}
        onConfirm={handleConfirmDelete}
        title="¿Eliminar o cancelar campaña de salud?"
        message={`¿Está seguro de que desea eliminar o cancelar la campaña "${campaignToDelete?.nombre}"? Si ya cuenta con mensajes o pacientes asociados pasará a estado Cancelada para preservar la auditoría.`}
        confirmText="Eliminar Campaña"
        loading={deleting}
      />
    </main>
  );
}
