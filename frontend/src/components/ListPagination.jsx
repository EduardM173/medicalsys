import React, { useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
const metadata = new Map();
const labels = { paciente: 'Pacientes', medico: 'Médicos', usuario: 'Usuarios', cita: 'Citas', campania: 'Campañas', sala: 'Salas', reserva_sala: 'Reservas', atencion_medica: 'Atenciones', documento_clinico: 'Documentos', consentimiento_informado: 'Consentimientos', plantilla_consentimiento: 'Plantillas', notificacion: 'Notificaciones', servicio_medico: 'Servicios', security_audit: 'Auditoría', security_user_grant: 'Permisos temporales', cola_notificacion: 'Trabajos de WhatsApp', organizacion: 'Clínicas', usuario_organizacion: 'Mis clínicas' };

// Each list has its own URL parameter, including lists used by form pickers.
export function listKey(path) { return 'page_' + path.split('?')[0].replace(/[^a-z0-9]/gi, '_'); }
export function useListPagination() {
  const { search } = useLocation();
  return search;
}
export function ListPagination() {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [lists, setLists] = useState(metadata.get(location.pathname) || {});
  useEffect(() => {
    setLists(metadata.get(location.pathname) || {});
  }, [location.pathname]);
  useEffect(() => {
    const receive = (event) => {
      if (event.detail.view !== location.pathname) return;
      setLists((previous) => {
        const next = { ...previous, [event.detail.path]: event.detail.pagination };
        metadata.set(location.pathname, next);
        return next;
      });
    };
    window.addEventListener('list-pagination', receive);
    return () => window.removeEventListener('list-pagination', receive);
  }, [location.pathname]);
  return <div className="list-pagination-group">{Object.entries(lists).flatMap(([path, models]) => Object.entries(models).map(([model, pageInfo]) => {
    if (!pageInfo || (pageInfo.pages <= 1 && pageInfo.page <= 1)) return null;
    const change = (page) => { const next = new URLSearchParams(params); next.set(listKey(path) + '_' + model, String(page)); setParams(next, { replace: true }); };
    return <nav className="list-pagination" key={path + model} aria-label={'Paginación ' + model}>
      <span>{labels[model] || 'Registros'} · {pageInfo.total} registros</span>
      <button type="button" disabled={pageInfo.page <= 1} onClick={() => change(pageInfo.page - 1)}>Anterior</button>
      <span>Página {pageInfo.page} de {pageInfo.pages}</span>
      <button type="button" disabled={pageInfo.page >= pageInfo.pages} onClick={() => change(pageInfo.page + 1)}>Siguiente</button>
    </nav>;
  }))}</div>;
}
