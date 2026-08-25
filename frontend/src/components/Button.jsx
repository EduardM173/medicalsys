import React from 'react';

export function Button({ children, disabled = false, type = 'button' }) {
  return (
    <button className="button button-primary" disabled={disabled} type={type}>
      {children}
    </button>
  );
}
