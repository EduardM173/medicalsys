import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSecurityMatrix, updateSecurityRole, getSecurityAudit } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import '../styles/users.css';

const roleNames = { ADMINISTRADOR: 'Administrador', OSI: 'OSI', MEDICO: 'Médico', RECEPCIONISTA: 'Recepcionista', PACIENTE: 'Paciente' };
function samePermissions(a, b) {
  return a.length === b.length && a.every((permission) => b.includes(permission));
}
export function SecurityPage() {
  const { user, refreshUser } = useAuth();
  const [matrix, setMatrix] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyRole, setBusyRole] = useState(null);
  useEffect(() => {
    let active = true;
    Promise.all([getSecurityMatrix(), getSecurityAudit()]).then(([data, audit]) => {
      if (!active) return;
      setMatrix(data);
      setDrafts(Object.fromEntries(data.roles.map((role) => [role.code, role.permissions])));
      setEvents(audit.events);
    }).catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
  function toggle(role, code) {
    setNotice(''); setError('');
    setDrafts((current) => {
      const selected = new Set(current[role]);
      if (selected.has(code)) {
        selected.delete(code);
        // Removing a prerequisite also removes its dependent actions.
        let changed = true;
        while (changed) {
          changed = false;
          for (const permission of matrix.permissions) {
            if (selected.has(permission.code) && permission.requires.some((required) => !selected.has(required))) {
              selected.delete(permission.code); changed = true;
            }
          }
        }
      } else {
        const add = (permissionCode) => {
          if (selected.has(permissionCode)) return;
          selected.add(permissionCode);
          matrix.permissions.find((p) => p.code === permissionCode).requires.forEach(add);
        };
        add(code);
      }
      return { ...current, [role]: [...selected] };
    });
  }
  async function save(role) {
    setBusyRole(role); setError(''); setNotice('');
    try {
      const result = await updateSecurityRole(role, drafts[role]);
      setMatrix((current) => ({ ...current, roles: current.roles.map((r) =>
        r.code === role ? { ...r, permissions: result.permissions } : r) }));
      setDrafts((current) => ({ ...current, [role]: result.permissions }));
      setNotice('Permisos de ' + roleNames[role] + ' guardados. Se aplican a todos los usuarios de ese rol.');
      await refreshUser();
      try { setEvents((await getSecurityAudit()).events); }
      catch (_error) { setError('Los permisos se guardaron, pero no fue posible actualizar la auditoría.'); }
    } catch (e) { setError(e.message); } finally { setBusyRole(null); }
  }
  const dirtyCount = matrix?.roles.filter((r) => !samePermissions(drafts[r.code] || [], r.permissions)).length || 0;
  return <main className="users-page security-page">
    <header className="admin-header">
      <div><h1>Roles y seguridad</h1><p>Controle qué puede consultar y modificar cada rol.</p></div>
      <Link to="/admin/usuarios">Gestionar usuarios</Link>
    </header>
    {error && <p className="notice error-notice" role="alert">{error}</p>}
    {notice && <p className="notice success-notice" role="status">{notice}</p>}
    {!matrix ? <p>{error ? 'La matriz no está disponible.' : 'Cargando matriz...'}</p> : <>
      <section className="users-card security-matrix">
        <div className="security-matrix-heading">
          <div><h2>Matriz de permisos</h2><p>Marca o desmarca las casillas y guarda en la columna del rol correspondiente.</p></div>
          <span className={dirtyCount ? 'security-pending' : 'security-saved'}>{dirtyCount ? dirtyCount + ' rol(es) con cambios pendientes' : 'Sin cambios pendientes'}</span>
        </div>
        <p className="security-legend">✓ Activado · Casilla vacía: desactivado · — No corresponde al rol. Los cambios afectan a todos los usuarios del rol; los permisos necesarios se ajustan juntos.</p>
        <div className="table-wrapper" tabIndex={0} aria-label="Matriz editable de funciones por rol">
          <table>
            <thead><tr>
              <th scope="col">Función</th>
              {matrix.roles.map((role) => {
                const dirty = !samePermissions(drafts[role.code] || [], role.permissions);
                return <th scope="col" key={role.code}>
                  <span className="security-role-name">{roleNames[role.code]}</span>
                  <small>{(drafts[role.code] || []).length} permisos</small>
                  <button type="button" className="security-save" aria-label={'Guardar permisos de ' + roleNames[role.code]} disabled={Boolean(busyRole) || !dirty} onClick={() => save(role.code)}>
                    {busyRole === role.code ? 'Guardando…' : dirty ? 'Guardar cambios' : 'Guardado'}
                  </button>
                </th>;
              })}
            </tr></thead>
            <tbody>{matrix.permissions.map((permission) => <tr key={permission.code}>
              <th scope="row">{permission.label}</th>
              {matrix.roles.map((role) => {
                const eligible = permission.eligibleRoles.includes(role.code);
                const checked = (drafts[role.code] || []).includes(permission.code);
                const changed = checked !== role.permissions.includes(permission.code);
                const ownAccess = role.code === user?.rol && ['users.manage', 'security.manage'].includes(permission.code);
                return <td key={role.code} className={changed ? 'security-cell-changed' : ''}>
                  {eligible ? <label className="security-checkbox" title={ownAccess ? 'Su propio acceso de seguridad está protegido.' : permission.label + ' · ' + roleNames[role.code]}>
                    <input type="checkbox" aria-label={permission.label + ' para ' + roleNames[role.code]} checked={checked} disabled={Boolean(busyRole) || ownAccess} onChange={() => toggle(role.code, permission.code)} />
                    <span className="sr-only">{checked ? 'Activado' : 'Desactivado'}</span>
                  </label> : <span className="security-unavailable" aria-label={'No corresponde a ' + roleNames[role.code]}>—</span>}
                </td>;
              })}
            </tr>)}</tbody>
          </table>
        </div>
        <p className="security-legend">Las celdas resaltadas tienen cambios pendientes. Su propio acceso a seguridad está protegido para evitar un bloqueo accidental.</p>
        {dirtyCount > 0 && <button className="text-action" type="button" disabled={Boolean(busyRole)} onClick={() => {
          setDrafts(Object.fromEntries(matrix.roles.map((role) => [role.code, role.permissions]))); setError(''); setNotice('');
        }}>Descartar cambios pendientes</button>}
      </section>
      <section className="users-card"><h2>Auditoría de seguridad</h2><p>Últimos 100 cambios de usuarios y permisos. No se registran contraseñas.</p>
        <div className="table-wrapper"><table><thead><tr><th>Fecha</th><th>Usuario responsable</th><th>Acción</th><th>Destino</th></tr></thead><tbody>
          {events.map((event) => <tr key={event.id}><td>{new Date(event.created_at).toLocaleString('es-BO')}</td><td>#{event.actor_id}</td><td>{event.action}</td><td>{event.target}</td></tr>)}
        </tbody></table>{!events.length && <p>Todavía no hay cambios registrados.</p>}</div>
      </section>
    </>}
  </main>;
}
