import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createSecurityRole, getSecurityAudit, getSecurityMatrix, getTemporaryGrants, getUsers,
  grantTemporaryPermission, revokeTemporaryGrant, updateSecurityRole
} from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import '../styles/users.css';

function samePermissions(a, b) {
  return a.length === b.length && a.every((permission) => b.includes(permission));
}
function localInputValue(date) {
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}
function tomorrowLocal() { return localInputValue(new Date(Date.now() + 24 * 60 * 60 * 1000)); }

export function SecurityPage() {
  const { refreshUser } = useAuth();
  const [matrix, setMatrix] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [events, setEvents] = useState([]);
  const [users, setUsers] = useState([]);
  const [grants, setGrants] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [newRole, setNewRole] = useState({ name: '', code: '', description: '' });
  const [grant, setGrant] = useState({ userId: '', permission: '', expiresAt: tomorrowLocal() });

  const load = useCallback(async () => {
    const [data, audit, userData, grantData] = await Promise.all([
      getSecurityMatrix(), getSecurityAudit(), getUsers(), getTemporaryGrants()
    ]);
    setMatrix(data);
    setDrafts(Object.fromEntries(data.roles.map((role) => [role.code, role.permissions])));
    setEvents(audit.events); setUsers(userData.users); setGrants(grantData.grants);
  }, []);

  useEffect(() => {
    let active = true;
    load().catch((requestError) => { if (active) setError(requestError.message); });
    return () => { active = false; };
  }, [load]);

  function toggle(role, code) {
    setNotice(''); setError('');
    setDrafts((current) => {
      const selected = new Set(current[role] || []);
      if (selected.has(code)) {
        selected.delete(code);
        let changed = true;
        while (changed) {
          changed = false;
          matrix.permissions.forEach((permission) => {
            if (selected.has(permission.code) && permission.requires.some((required) => !selected.has(required))) {
              selected.delete(permission.code); changed = true;
            }
          });
        }
      } else {
        const add = (permissionCode) => {
          if (selected.has(permissionCode)) return;
          selected.add(permissionCode);
          matrix.permissions.find((item) => item.code === permissionCode)?.requires.forEach(add);
        };
        add(code);
      }
      return { ...current, [role]: [...selected] };
    });
  }

  async function save(role) {
    setBusy('role-' + role); setError(''); setNotice('');
    try {
      const result = await updateSecurityRole(role, drafts[role]);
      setMatrix((current) => ({ ...current, roles: current.roles.map((item) =>
        item.code === role ? { ...item, permissions: result.permissions } : item) }));
      setDrafts((current) => ({ ...current, [role]: result.permissions }));
      setNotice('Permisos de ' + role + ' guardados.');
      await refreshUser(); setEvents((await getSecurityAudit()).events);
    } catch (requestError) { setError(requestError.message); } finally { setBusy(''); }
  }

  async function handleCreateRole(event) {
    event.preventDefault(); setBusy('new-role'); setError(''); setNotice('');
    try {
      await createSecurityRole({ ...newRole, permissions: [] });
      setNewRole({ name: '', code: '', description: '' });
      await load(); setNotice('Rol creado. Ya puede configurarlo en la matriz y asignarlo a usuarios.');
    } catch (requestError) { setError(requestError.message); } finally { setBusy(''); }
  }

  async function handleGrant(event) {
    event.preventDefault(); setBusy('grant'); setError(''); setNotice('');
    try {
      await grantTemporaryPermission({ ...grant, expiresAt: new Date(grant.expiresAt).toISOString() });
      setGrant((current) => ({ ...current, permission: '', expiresAt: tomorrowLocal() }));
      await load(); setNotice('Permiso temporal concedido y auditado.');
    } catch (requestError) { setError(requestError.message); } finally { setBusy(''); }
  }

  async function revoke(id) {
    setBusy('grant-' + id); setError('');
    try { await revokeTemporaryGrant(id); await load(); await refreshUser(); setNotice('Permiso temporal revocado.'); }
    catch (requestError) { setError(requestError.message); } finally { setBusy(''); }
  }

  const dirtyCount = matrix?.roles.filter((role) => !samePermissions(drafts[role.code] || [], role.permissions)).length || 0;
  return <main className="users-page security-page">
    <header className="admin-header">
      <div><h1>Roles y seguridad</h1><p>RBAC, roles personalizados y accesos temporales por usuario.</p></div>
      <Link to="/admin/usuarios">Gestionar usuarios</Link>
    </header>
    {error && <p className="notice error-notice" role="alert">{error}</p>}
    {notice && <p className="notice success-notice" role="status">{notice}</p>}
    {!matrix ? <p>{error ? 'La matriz no está disponible.' : 'Cargando matriz...'}</p> : <>
      <section className="users-card security-role-create">
        <h2>Crear rol</h2><p>El rol se crea sin permisos; después actívelos en su columna de la matriz.</p>
        <form className="security-inline-form" onSubmit={handleCreateRole}>
          <label>Nombre *<input required minLength="3" maxLength="80" value={newRole.name} onChange={(event) => setNewRole({ ...newRole, name: event.target.value })} /></label>
          <label>Código <input maxLength="30" placeholder="Se genera automáticamente" value={newRole.code} onChange={(event) => setNewRole({ ...newRole, code: event.target.value })} /></label>
          <label>Descripción <input maxLength="255" value={newRole.description} onChange={(event) => setNewRole({ ...newRole, description: event.target.value })} /></label>
          <button className="new-user-button" disabled={Boolean(busy)} type="submit">{busy === 'new-role' ? 'Creando…' : 'Crear rol'}</button>
        </form>
      </section>

      <section className="users-card security-matrix">
        <div className="security-matrix-heading">
          <div><h2>Matriz de permisos</h2><p>Todas las casillas pueden configurarse. Cada columna representa un rol.</p></div>
          <span className={dirtyCount ? 'security-pending' : 'security-saved'}>{dirtyCount ? dirtyCount + ' rol(es) con cambios pendientes' : 'Sin cambios pendientes'}</span>
        </div>
        <p className="security-legend">Al activar una acción también se activan sus requisitos. Al quitar un requisito se desactivan las acciones dependientes.</p>
        <div className="table-wrapper" tabIndex={0} aria-label="Matriz editable de funciones por rol">
          <table><thead><tr><th scope="col">Función</th>{matrix.roles.map((role) => {
            const dirty = !samePermissions(drafts[role.code] || [], role.permissions);
            return <th scope="col" key={role.code}><span className="security-role-name">{role.name}</span><small>{role.code}<br />{(drafts[role.code] || []).length} permisos</small>
              <button type="button" className="security-save" aria-label={'Guardar permisos de ' + role.name} disabled={Boolean(busy) || !dirty} onClick={() => save(role.code)}>{busy === 'role-' + role.code ? 'Guardando…' : dirty ? 'Guardar cambios' : 'Guardado'}</button>
            </th>;
          })}</tr></thead>
          <tbody>{matrix.permissions.map((permission) => <tr key={permission.code}><th scope="row">{permission.label}</th>{matrix.roles.map((role) => {
            const checked = (drafts[role.code] || []).includes(permission.code);
            const changed = checked !== role.permissions.includes(permission.code);
            return <td key={role.code} className={changed ? 'security-cell-changed' : ''}><label className="security-checkbox" title={permission.label + ' · ' + role.name}>
              <input type="checkbox" aria-label={permission.label + ' para ' + role.name} checked={checked} disabled={Boolean(busy)} onChange={() => toggle(role.code, permission.code)} /><span className="sr-only">{checked ? 'Activado' : 'Desactivado'}</span>
            </label></td>;
          })}</tr>)}</tbody></table>
        </div>
        {dirtyCount > 0 && <button className="text-action" type="button" disabled={Boolean(busy)} onClick={() => setDrafts(Object.fromEntries(matrix.roles.map((role) => [role.code, role.permissions])))}>Descartar cambios pendientes</button>}
      </section>

      <section className="users-card">
        <h2>Permisos temporales por usuario</h2><p>Conceda una excepción individual. El acceso desaparece automáticamente al vencer.</p>
        <form className="security-inline-form" onSubmit={handleGrant}>
          <label>Usuario *<select required value={grant.userId} onChange={(event) => setGrant({ ...grant, userId: event.target.value })}><option value="">Seleccione</option>{users.filter((item) => item.estado === 'ACTIVO').map((item) => <option key={item.id} value={item.id}>{item.nombres} {item.apellidos} — {item.email}</option>)}</select></label>
          <label>Permiso *<select required value={grant.permission} onChange={(event) => setGrant({ ...grant, permission: event.target.value })}><option value="">Seleccione</option>{matrix.permissions.map((permission) => <option key={permission.code} value={permission.code}>{permission.label}</option>)}</select></label>
          <label>Vence *<input required type="datetime-local" min={localInputValue(new Date())} value={grant.expiresAt} onChange={(event) => setGrant({ ...grant, expiresAt: event.target.value })} /></label>
          <button className="new-user-button" disabled={Boolean(busy)} type="submit">{busy === 'grant' ? 'Concediendo…' : 'Conceder temporalmente'}</button>
        </form>
        <div className="table-wrapper"><table><thead><tr><th>Usuario</th><th>Permiso</th><th>Vence</th><th>Acción</th></tr></thead><tbody>{grants.map((item) => <tr key={item.id}><td>{item.nombres} {item.apellidos}<small className="security-block">{item.email}</small></td><td>{matrix.permissions.find((permission) => permission.code === item.permission_code)?.label || item.permission_code}</td><td>{new Date(item.expires_at).toLocaleString('es-BO')}</td><td><button className="text-action danger-action" disabled={Boolean(busy)} onClick={() => revoke(item.id)} type="button">Revocar</button></td></tr>)}</tbody></table>{!grants.length && <p className="empty-state">No hay permisos temporales activos.</p>}</div>
      </section>

      <section className="users-card"><h2>Auditoría de seguridad</h2><p>Últimos 100 cambios de usuarios, roles y permisos.</p>
        <div className="table-wrapper"><table><thead><tr><th>Fecha</th><th>Responsable</th><th>Acción</th><th>Destino</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td>{new Date(event.created_at).toLocaleString('es-BO')}</td><td>#{event.actor_id}</td><td>{event.action}</td><td>{event.target}</td></tr>)}</tbody></table></div>
      </section>
    </>}
  </main>;
}
