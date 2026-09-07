import React, { useEffect, useRef, useState } from 'react';

export function HashBox({ hash, label = 'Copiar' }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  async function handleCopy() {
    if (!hash) return;
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (_error) {
      // El portapapeles puede no estar disponible; se ignora.
    }
  }

  return (
    <span className="hash-box">
      <code title={hash}>{hash}</code>
      <button aria-label="Copiar huella" className="hash-copy" onClick={handleCopy} type="button">
        {copied ? '✓ Copiado' : label}
      </button>
    </span>
  );
}