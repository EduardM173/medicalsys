import React, { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { UserForm } from '../components/UserForm';
import { createUser, deactivateUser, getUsers, updateUser } from '../services/api';
import '../styles/users.css';

export function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formMode, setFormMode] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [notice, setNotice] = useState('');

  async function loadUsers() {
    try {
      const response = await getUsers();
      setUsers(response.users);
      setError('');
    } catch (requestError) {
      setError(requestError.message || 'No fue posible cargar los usuarios.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  function openCreateForm() {
    setEditingUser(null);
    setFormMode('create');
    setNotice('');
  }

  function openEditForm(user) {
    setEditingUser(user);
    setFormMode('edit');
    setNotice('');
  }

  async function saveUser(payload) {
    if (formMode === 'edit') {
      await updateUser(editingUser.id, payload);
      setNotice('Usuario actualizado correctamente.');
    } else {
      await createUser(payload);
      setNotice('Usuario creado correctamente.');
    }
    setFormMode(null);
    setEditingUser(null);
    await loadUsers();
  }

  async function handleDeactivate(user) {
    setError('');
    try {
      await deactivateUser(user.id);
      setNotice('Usuario desactivado correctamente.');
      await loadUsers();
    } catch (requestError) {
      setError(requestError.message || 'No fue posible desactivar el usuario.');
    }
  }

  return (
    <main className="users-page">
      <header className="admin-header">
        <div>
          <h1>Gestión de Usuarios</h1>
          <p>Administración de accesos y roles de MedicalSys</p>
        </div>
        <Button className="new-user-button" onClick={openCreateForm}>+ Nuevo usuario</Button>
      </header>

      {notice && <p className="notice success-notice">{notice}</p>}
      {error && <p className="notice error-notice" role="alert">{error}</p>}

      {formMode && (
        <section className="form-panel" aria-label={formMode === 'edit' ? 'Editar usuario' : 'Nuevo usuario'}>
          <div className="panel-heading">
            <div>
              <span className="login-kicker">{formMode === 'edit' ? 'Edición' : 'Registro'}</span>
              <h2>{formMode === 'edit' ? 'Editar usuario' : 'Nuevo usuario'}</h2>
            </div>
          </div>
          <UserForm
            key={editingUser?.id || 'new'}
            initialUser={editingUser}
            onCancel={() => setFormMode(null)}
            onSave={saveUser}
          />
        </section>
      )}

      <section className="users-card">
        <div className="table-heading">
          <div>
            <h2>Usuarios registrados</h2>
            <p>{users.length} usuarios en MedicalSys</p>
          </div>
        </div>

        {loading ? (
          <p className="empty-state">Cargando usuarios...</p>
        ) : users.length === 0 ? (
          <p className="empty-state">No existen usuarios registrados.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Teléfono</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td><strong>{user.nombres} {user.apellidos}</strong></td>
                    <td>{user.email}</td>
                    <td>{user.telefono || '—'}</td>
                    <td><span className="role-badge">{user.rol}</span></td>
                    <td><span className={`status-badge status-${user.estado.toLowerCase()}`}>{user.estado}</span></td>
                    <td>
                      <div className="row-actions">
                        <button className="text-action" onClick={() => openEditForm(user)} type="button">Editar</button>
                        {user.estado !== 'INACTIVO' && (
                          <button className="text-action danger-action" onClick={() => handleDeactivate(user)} type="button">Desactivar</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
