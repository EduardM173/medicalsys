import React, { useEffect, useState } from 'react';
import { getReadiness } from '../services/api';
export function ConnectionStatus() {
  const [status, setStatus] = useState(navigator.onLine ? 'checking' : 'offline');
  useEffect(() => {
    let active = true;
    let controller;
    const check = async () => {
      controller?.abort();
      if (!navigator.onLine) { setStatus('offline'); return; }
      controller = new AbortController();
      try { await getReadiness(controller.signal); if (active) setStatus('online'); }
      catch (error) { if (active && error.name !== 'AbortError') setStatus('unavailable'); }
    };
    const offline = () => { controller?.abort(); setStatus('offline'); };
    void check();
    const timer = setInterval(check, 30000);
    window.addEventListener('online', check);
    window.addEventListener('offline', offline);
    return () => { active = false; controller?.abort(); clearInterval(timer); window.removeEventListener('online', check); window.removeEventListener('offline', offline); };
  }, []);
  return status === 'online' ? null : <div className="connection-status" role="status" aria-live="polite">
    {status === 'checking' ? 'Comprobando conexión…' : status === 'offline'
      ? 'Sin conexión. Puedes seguir escribiendo; guarda cuando vuelva la conexión. No se enviarán operaciones automáticamente.'
      : 'El servidor no está disponible. Conserva el formulario y vuelve a intentar cuando se recupere.'}
  </div>;
}
