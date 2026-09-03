import React, { useState } from 'react';
import { Button } from './Button';
import { uploadPatientDocument } from '../services/api';

const DOCUMENT_TYPES = [
  { value: 'EXAMEN', label: '🧪 Examen de Laboratorio' },
  { value: 'RADIOGRAFIA', label: '🩻 Radiografía / Imagen Médica' },
  { value: 'INFORME', label: '📋 Informe Clínico / Epicrisis' },
  { value: 'CONSENTIMIENTO', label: '✍ Consentimiento Informado' },
  { value: 'RECETA', label: '💊 Receta / Prescripción' },
  { value: 'OTRO', label: '📁 Otro Documento' }
];

export function DocumentUploadModal({ isOpen, onClose, patientId, attentions = [], onDocumentUploaded }) {
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState('EXAMEN');
  const [attentionId, setAttentionId] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  function handleFileChange(e) {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.size > 15 * 1024 * 1024) {
        setError('El archivo excede el tamaño máximo permitido de 15 MB.');
        return;
      }
      setFile(selected);
      setError('');
      if (!titulo) {
        // Prellenar título con el nombre del archivo sin extensión
        const nameWithoutExt = selected.name.replace(/\.[^/.]+$/, '');
        setTitulo(nameWithoutExt);
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!file) {
      setError('Debe seleccionar un archivo (PDF, imagen médica, etc.).');
      return;
    }
    if (!titulo.trim()) {
      setError('Debe ingresar un título descriptivo para el documento.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('titulo', titulo.trim());
    formData.append('tipo', tipo);
    if (attentionId) {
      formData.append('attentionId', attentionId);
    }

    setLoading(true);
    try {
      await uploadPatientDocument(patientId, formData);
      onDocumentUploaded();
      onClose();
    } catch (err) {
      setError(err.message || 'No fue posible subir el documento clínico.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="modal-header">
          <div>
            <span className="login-kicker">Expediente Clínico Digital</span>
            <h2>Adjuntar Documento / Examen</h2>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Cerrar">
            &times;
          </button>
        </header>

        {error && <div className="modal-error" role="alert">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="modal-field">
              <label htmlFor="fileInput">Seleccionar Archivo (PDF, JPG, PNG, DICOM) *</label>
              <input
                id="fileInput"
                type="file"
                required
                onChange={handleFileChange}
                accept=".pdf,.jpg,.jpeg,.png,.webp,.dcm,.doc,.docx"
                className="rooms-input"
                style={{ padding: '8px', height: 'auto' }}
              />
              {file && (
                <small style={{ color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                  Archivo: <strong>{file.name}</strong> ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </small>
              )}
            </div>

            <div className="modal-field">
              <label htmlFor="tituloInput">Título del Documento *</label>
              <input
                id="tituloInput"
                type="text"
                required
                placeholder="Ej. Hemograma Completo - Control 2026"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className="rooms-input"
              />
            </div>

            <div className="modal-field">
              <label htmlFor="tipoSelect">Tipo de Documento *</label>
              <select
                id="tipoSelect"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="rooms-select"
              >
                {DOCUMENT_TYPES.map((dt) => (
                  <option key={dt.value} value={dt.value}>{dt.label}</option>
                ))}
              </select>
            </div>

            {attentions.length > 0 && (
              <div className="modal-field">
                <label htmlFor="attentionSelect">Vincular a Atención Médica (Opcional)</label>
                <select
                  id="attentionSelect"
                  value={attentionId}
                  onChange={(e) => setAttentionId(e.target.value)}
                  className="rooms-select"
                >
                  <option value="">Sin vincular a atención específica</option>
                  {attentions.map((att) => (
                    <option key={att.id} value={att.id}>
                      {new Date(att.fechaAtencion).toLocaleDateString('es-BO')} - {att.motivoConsulta}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <footer className="modal-footer">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Subiendo y Cifrando...' : 'Adjuntar Documento'}
            </Button>
          </footer>
        </form>
      </div>
    </div>
  );
}
