import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { DocumentUploadModal } from '../components/DocumentUploadModal';
import { useAuth } from '../contexts/AuthContext';
import { deleteClinicalDocument, getClinicalDocumentFile, getClinicalDocuments } from '../services/api';
import '../styles/documents.css';

const typeLabels = {
  EXAMEN: 'Examen de Laboratorio',
  RADIOGRAFIA: 'Radiografía / Imagen',
  CONSENTIMIENTO: 'Consentimiento',
  RECETA: 'Receta',
  INFORME: 'Informe Clínico',
  OTRO: 'Otro'
};

function formatDate(value) {
  return new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'long',
    timeStyle: 'short'
  }).format(new Date(value));
}

function formatSize(bytes) {
  if (bytes === null || bytes === undefined) return 'Tamaño no registrado';
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function documentLabel(patient) {
  return `${patient.documentoIdentidad}${patient.complemento ? ` ${patient.complemento}` : ''}`;
}

export function DocumentsPage() {
  const { patientId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState(null);
  const [error, setError] = useState('');
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const isDoctorOrAdmin = user?.rol === 'MEDICO' || user?.rol === 'ADMINISTRADOR';

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getClinicalDocuments(patientId);
      setData(response);
      setError('');
    } catch (requestError) {
      if (requestError.status === 403) {
        setError('No tiene permisos para consultar documentos clínicos.');
      } else if (requestError.status === 404) {
        setError('Paciente no encontrado.');
      } else {
        setError('No fue posible cargar los documentos clínicos.');
      }
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  async function openDocument(document) {
    setOpeningId(document.id);
    setError('');
    const previewWindow = window.open('', '_blank');
    if (previewWindow) previewWindow.opener = null;

    try {
      const blob = await getClinicalDocumentFile(document.id);
      const objectUrl = URL.createObjectURL(blob);
      if (previewWindow) {
        previewWindow.location.replace(objectUrl);
      } else {
        const link = window.document.createElement('a');
        link.href = objectUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (requestError) {
      if (previewWindow) previewWindow.close();
      setError(
        requestError.status === 404
          ? requestError.message
          : 'No fue posible abrir el documento clínico.'
      );
    } finally {
      setOpeningId(null);
    }
  }

  async function handleDelete(documentId, documentTitle) {
    if (!window.confirm(`¿Está seguro de eliminar el documento "${documentTitle}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    try {
      await deleteClinicalDocument(documentId);
      loadDocuments();
    } catch (err) {
      setError(err.message || 'No fue posible eliminar el documento clínico.');
    }
  }

  if (loading && !data) {
    return <main className="documents-page"><p className="documents-state">Cargando documentos clínicos...</p></main>;
  }

  if (!data) {
    return (
      <main className="documents-page">
        <section className="documents-state documents-error" role="alert">
          <p>{error}</p>
          <Button onClick={() => navigate('/pacientes')}>Volver al directorio</Button>
        </section>
      </main>
    );
  }

  const { patient, documents } = data;

  return (
    <main className="documents-page">
      <header className="documents-header">
        <div>
          <span className="login-kicker">Expediente documental</span>
          <h1>Documentos Clínicos</h1>
          <p>Exámenes e informes asociados al paciente</p>
        </div>
        <div className="documents-header-actions" style={{ display: 'flex', gap: '10px' }}>
          {isDoctorOrAdmin && (
            <Button onClick={() => setIsUploadOpen(true)}>
              + Adjuntar Documento
            </Button>
          )}
          <Button variant="secondary" onClick={() => navigate(`/historial-clinico/${patientId}`)}>
            Historial clínico
          </Button>
          <Button variant="secondary" onClick={() => navigate('/pacientes')}>
            ← Volver
          </Button>
        </div>
      </header>

      <section className="documents-patient-card" aria-label="Información del paciente">
        <div className="documents-avatar" aria-hidden="true">{patient.nombres.charAt(0)}{patient.apellidos.charAt(0)}</div>
        <div>
          <span>Paciente</span>
          <h2>{patient.nombres} {patient.apellidos}</h2>
          <p>CI {documentLabel(patient)}</p>
        </div>
        <span className="documents-total">{documents.length} {documents.length === 1 ? 'documento' : 'documentos'}</span>
      </section>

      {error && <p className="notice error-notice documents-notice" role="alert">{error}</p>}

      <section className="documents-list-card" aria-labelledby="documents-list-title">
        <div className="documents-section-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="login-kicker">Archivo clínico</span>
            <h2 id="documents-list-title">Documentos registrados</h2>
          </div>
          {isDoctorOrAdmin && (
            <Button onClick={() => setIsUploadOpen(true)}>
              + Adjuntar Documento
            </Button>
          )}
        </div>

        {documents.length === 0 ? (
          <p className="documents-empty">No hay documentos clínicos registrados para este paciente.</p>
        ) : (
          <div className="documents-list">
            {documents.map((document) => (
              <article className="document-row" key={document.id}>
                <span className={`document-type-icon type-${document.tipo.toLowerCase()}`} aria-hidden="true">D</span>
                <div className="document-main">
                  <div className="document-title-line">
                    <h3>{document.titulo}</h3>
                    <span className="document-type-badge">{typeLabels[document.tipo] || document.tipo}</span>
                  </div>
                  <p>{document.nombreArchivo}</p>
                  <div className="document-metadata">
                    <span>{formatDate(document.fechaRegistro)}</span>
                    <span>{document.mimeType || 'Tipo de archivo no registrado'}</span>
                    <span>{formatSize(document.tamanoBytes)}</span>
                  </div>
                  {document.atencion && (
                    <small>Atención: {document.atencion.motivoConsulta} · {formatDate(document.atencion.fechaAtencion)}</small>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <Button
                    className="document-open-button"
                    disabled={openingId === document.id}
                    onClick={() => openDocument(document)}
                  >
                    {openingId === document.id ? 'Abriendo...' : 'Abrir / Descargar'}
                  </Button>
                  {isDoctorOrAdmin && (
                    <button
                      type="button"
                      className="text-action"
                      style={{ color: 'var(--color-danger, #ef4444)', fontWeight: '500', padding: '6px 10px' }}
                      onClick={() => handleDelete(document.id, document.titulo)}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <DocumentUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        patientId={patientId}
        onDocumentUploaded={loadDocuments}
      />
    </main>
  );
}
