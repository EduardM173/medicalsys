import React from 'react';
import { Button } from './Button';

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = '¿Está seguro de realizar esta acción?',
  message = 'Esta acción no se puede deshacer.',
  confirmText = 'Eliminar',
  cancelText = 'Cancelar',
  variant = 'danger',
  loading = false
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
      <div className="modal-card" style={{ maxWidth: '440px' }}>
        <header className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: variant === 'danger' ? '#fef2f2' : '#eff6ff',
                color: variant === 'danger' ? '#dc2626' : '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem',
                flexShrink: 0
              }}
            >
              {variant === 'danger' ? '⚠️' : 'ℹ️'}
            </div>
            <h2 id="confirm-modal-title" style={{ margin: 0, fontSize: '1.15rem' }}>
              {title}
            </h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose} disabled={loading} aria-label="Cerrar">
            ✕
          </button>
        </header>

        <div style={{ padding: '16px 20px', color: '#475569', fontSize: '0.9rem', lineHeight: '1.5' }}>
          {message}
        </div>

        <footer
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            padding: '14px 20px',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
            borderBottomLeftRadius: '1rem',
            borderBottomRightRadius: '1rem'
          }}
        >
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <button
            type="button"
            className="button"
            style={{
              background: variant === 'danger' ? '#dc2626' : 'var(--color-primary, #2563eb)',
              color: '#ffffff',
              border: 'none',
              fontWeight: 600,
              padding: '0.55rem 1.15rem',
              borderRadius: '0.5rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
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
