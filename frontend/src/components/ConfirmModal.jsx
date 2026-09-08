import React from 'react';
import { Button } from './Button';

export function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Eliminar', confirmVariant = 'danger', loading = false }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
      <div className="modal-card" style={{ maxWidth: '440px' }}>
        <header className="modal-header">
          <h2 id="confirm-modal-title" style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>
            {title || '¿Confirmar acción?'}
          </h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </header>

        <div style={{ padding: '16px 20px', color: '#475569', fontSize: '0.9rem', lineHeight: 1.5 }}>
          {message}
        </div>

        <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '14px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '0 0 1rem 1rem' }}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <button
            type="button"
            className="button"
            style={{
              background: confirmVariant === 'danger' ? '#dc2626' : '#2563eb',
              color: '#ffffff',
              border: 'none',
              padding: '0.6rem 1.2rem',
              borderRadius: '0.5rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Procesando...' : confirmText}
          </button>
        </footer>
      </div>
    </div>
  );
}
