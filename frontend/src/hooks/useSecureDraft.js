import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { loadDraft, saveDraft, removeDraft } from '../services/secure-drafts';
export function useSecureDraft(name, initial) {
  const { user } = useAuth();
  const tenant = user?.tenantCode || localStorage.getItem('medicalsys_active_tenant') || window.location.hostname;
  const scope = `${tenant}:${user?.id}:${name}`;
  const [value, setValue] = useState(initial);
  const [draftNotice, setDraftNotice] = useState('');
  const dirty = useRef(false);
  const cleared = useRef(false);
  const latest = useRef(value);
  latest.current = value;
  const previousScope = useRef(scope);
  useEffect(() => {
    if (previousScope.current === scope) return;
    previousScope.current = scope;
    dirty.current = false;
    cleared.current = true;
    setValue(initial);
  }, [scope]);
  useEffect(() => {
    let active = true;
    loadDraft(scope).then((saved) => {
      if (active && !dirty.current && saved !== null) { setValue(saved); setDraftNotice('Se recuperó tu borrador. Revísalo antes de guardar.'); }
    }).catch(() => {});
    return () => { active = false; };
  }, [scope]);
  useEffect(() => {
    if (!dirty.current || cleared.current) return;
    const timer = setTimeout(() => { void saveDraft(scope, value).catch(() => setDraftNotice('El contenido permanece en esta pantalla. Evita cerrarla hasta guardar, porque el borrador protegido no está disponible.')); }, 250);
    return () => clearTimeout(timer);
  }, [scope, value]);
  useEffect(() => {
    const flush = () => { if (dirty.current && !cleared.current) void saveDraft(scope, latest.current).catch(() => {}); };
    window.addEventListener('offline', flush);
    return () => { window.removeEventListener('offline', flush); flush(); };
  }, [scope]);
  const update = (next) => { dirty.current = true; cleared.current = false; setValue(next); };
  const clear = () => { cleared.current = true; removeDraft(scope); };
  return [value, update, clear, draftNotice];
}
