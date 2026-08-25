import React from 'react';

export function Button({ children, className = '', disabled = false, onClick, type = 'button', variant = 'primary' }) {
  return (
    <button
      className={`button button-${variant} ${className}`.trim()}
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  );
}
