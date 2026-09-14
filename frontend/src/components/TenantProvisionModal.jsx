import React, { useState } from 'react';
import { provisionTenant } from '../services/api';

export function TenantProvisionModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    tipo: 'CLINICA',
    subdominio: '',
    nit: '',
    direccion: '',
    telefono: '',
    email: '',
    adminEmail: '',
    adminNombres: '',
    adminApellidos: '',
    adminPassword: 'MedicalSys2026!'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdResult, setCreatedResult] = useState(null);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'codigo') {
      const slug = value.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      setFormData((prev) => ({
        ...prev,
        codigo: slug,
        subdominio: prev.subdominio === prev.codigo ? slug : prev.subdominio || slug
      }));
    } else if (name === 'subdominio') {
      const slug = value.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      setFormData((prev) => ({ ...prev, subdominio: slug }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = {
        ...formData,
        subdominio: formData.subdominio || formData.codigo
      };
      const response = await provisionTenant(payload);
      setCreatedResult(response);
    } catch (err) {
      setError(err.message || 'No fue posible aprovisionar el nuevo centro médico.');
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    setCreatedResult(null);
    setFormData({
      codigo: '',
      nombre: '',
      tipo: 'CLINICA',
      subdominio: '',
      nit: '',
      direccion: '',
      telefono: '',
      email: '',
      adminEmail: '',
      adminNombres: '',
      adminApellidos: '',
      adminPassword: 'MedicalSys2026!'
    });
    onClose();
    if (onSuccess) onSuccess();
  };

  const port = window.location.port ? `:${window.location.port}` : '';
  const previewSubdomain = formData.subdominio || formData.codigo || 'nueva-clinica';
  const previewUrl = `${window.location.protocol}//${previewSubdomain}.localhost${port}`;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="provision-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(16, 41, 76, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
        overflowY: 'auto'
      }}
    >
      <div
        className="modal-card"
        style={{
          maxWidth: '680px',
          width: '100%',
          background: '#ffffff',
          borderRadius: '14px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Cabecera */}
        <header
          style={{
            padding: '20px 24px',
            background: 'var(--color-navy, #10294c)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#93c5fd', fontWeight: 700 }}>
              SaaS Infrastructure Provisioning
            </span>
            <h2 id="provision-modal-title" style={{ margin: '4px 0 0', fontSize: '1.3rem', fontWeight: 700, color: '#ffffff' }}>
              {createdResult ? '¡Centro Médico Aprovisionado!' : 'Aprovisionar Nueva Clínica / Tenant'}
            </h2>
          </div>
          <button
            type="button"
            onClick={createdResult ? handleFinish : onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.6rem',
              cursor: 'pointer',
              lineHeight: 1
            }}
          >
            ×
          </button>
        </header>

        {/* Contenido */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.88rem' }}>
              ⚠️ {error}
            </div>
          )}

          {createdResult ? (
            /* Vista de Éxito */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '16px 20px', borderRadius: '10px', display: 'flex', gap: '14px', alignItems: 'center' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#059669', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                  ✓
                </div>
                <div>
                  <h3 style={{ margin: 0, color: '#065f46', fontSize: '1.08rem' }}>
                    Infraestructura física creada exitosamente
                  </h3>
                  <p style={{ margin: '3px 0 0', color: '#047857', fontSize: '0.84rem' }}>
                    El esquema PostgreSQL, tablas clínicas y configuración institucional están listos para operar.
                  </p>
                </div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '0.92rem', color: '#10294c', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Ficha de Despliegue Multi-Tenant
                </h4>
                <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
                  <div>
                    <dt style={{ color: '#64748b', fontSize: '0.76rem' }}>Clínica / Razón Social</dt>
                    <dd style={{ margin: 0, fontWeight: 700, color: '#1e293b' }}>{createdResult.tenant?.nombre}</dd>
                  </div>
                  <div>
                    <dt style={{ color: '#64748b', fontSize: '0.76rem' }}>NIT Institucional</dt>
                    <dd style={{ margin: 0, fontFamily: 'monospace' }}>{createdResult.tenant?.nit}</dd>
                  </div>
                  <div>
                    <dt style={{ color: '#64748b', fontSize: '0.76rem' }}>Aislamiento PostgreSQL</dt>
                    <dd style={{ margin: 0, fontFamily: 'monospace', color: '#0369a1' }}>Esquema: {createdResult.tenant?.schemaName}</dd>
                  </div>
                  <div>
                    <dt style={{ color: '#64748b', fontSize: '0.76rem' }}>Plan Inicial</dt>
                    <dd style={{ margin: 0, color: '#059669', fontWeight: 600 }}>🟢 30 Días de Cortesía</dd>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <dt style={{ color: '#64748b', fontSize: '0.76rem' }}>URL Dedicada del Tenant</dt>
                    <dd style={{ margin: 0 }}>
                      <a
                        href={`${window.location.protocol}//${createdResult.tenant?.subdominio}.localhost${port}/login`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'underline' }}
                      >
                        {`${window.location.protocol}//${createdResult.tenant?.subdominio}.localhost${port}/login`} ↗
                      </a>
                    </dd>
                  </div>
                </dl>
              </div>

              {createdResult.admin && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '16px' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '0.9rem', color: '#166534' }}>
                    👤 Administrador de la Clínica
                  </h4>
                  <div style={{ fontSize: '0.84rem', color: '#14532d', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div><strong>Usuario:</strong> {createdResult.admin.email}</div>
                    <div><strong>Nombre:</strong> {createdResult.admin.nombres} {createdResult.admin.apellidos}</div>
                    <div><strong>Rol Asignado:</strong> <code>{createdResult.admin.rol}</code> (Exclusivo en {createdResult.tenant?.nombre})</div>
                  </div>
                </div>
              )}

              <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={handleFinish}
                  style={{
                    background: 'var(--color-navy, #10294c)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 20px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Finalizar y Actualizar Catálogo
                </button>
              </footer>
            </div>
          ) : (
            /* Formulario de Alta */
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Sección 1: Identificación */}
              <div>
                <h3 style={{ margin: '0 0 12px', fontSize: '0.95rem', color: 'var(--color-navy, #10294c)', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                  1. Identificación y Subdominio SaaS
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label htmlFor="codigo" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Código Slug *
                    </label>
                    <input
                      id="codigo"
                      name="codigo"
                      type="text"
                      required
                      value={formData.codigo}
                      onChange={handleChange}
                      placeholder="ej: univalle"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                    />
                    <small style={{ color: '#64748b', fontSize: '0.72rem' }}>Define el esquema PostgreSQL: tenant_{formData.codigo || '...'}</small>
                  </div>
                  <div>
                    <label htmlFor="nombre" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Nombre de la Clínica *
                    </label>
                    <input
                      id="nombre"
                      name="nombre"
                      type="text"
                      required
                      value={formData.nombre}
                      onChange={handleChange}
                      placeholder="ej: Hospital Universitario Univalle"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                    />
                  </div>
                  <div>
                    <label htmlFor="tipo" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Tipo de Centro
                    </label>
                    <select
                      id="tipo"
                      name="tipo"
                      value={formData.tipo}
                      onChange={handleChange}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', background: '#fff' }}
                    >
                      <option value="CLINICA">Clínica Privada</option>
                      <option value="HOSPITAL">Hospital</option>
                      <option value="CONSULTORIO">Consultorio Médico</option>
                      <option value="CENTRO_SALUD">Centro de Salud Especializado</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="subdominio" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Subdominio URL Dedicado
                    </label>
                    <input
                      id="subdominio"
                      name="subdominio"
                      type="text"
                      value={formData.subdominio}
                      onChange={handleChange}
                      placeholder="ej: univalle"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                    />
                    <small style={{ color: '#0284c7', fontSize: '0.74rem', fontWeight: 600 }}>URL: {previewUrl}</small>
                  </div>
                </div>
              </div>

              {/* Sección 2: Datos Fiscales */}
              <div>
                <h3 style={{ margin: '10px 0 12px', fontSize: '0.95rem', color: 'var(--color-navy, #10294c)', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                  2. Configuración Fiscal e Institucional
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label htmlFor="nit" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      NIT Institucional *
                    </label>
                    <input
                      id="nit"
                      name="nit"
                      type="text"
                      required
                      value={formData.nit}
                      onChange={handleChange}
                      placeholder="ej: 5039201019"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                    />
                  </div>
                  <div>
                    <label htmlFor="email" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Correo Institucional
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="contacto@univalle.edu.bo"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                    />
                  </div>
                  <div>
                    <label htmlFor="direccion" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Dirección Legal
                    </label>
                    <input
                      id="direccion"
                      name="direccion"
                      type="text"
                      value={formData.direccion}
                      onChange={handleChange}
                      placeholder="Av. América Este #123, Cochabamba"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                    />
                  </div>
                  <div>
                    <label htmlFor="telefono" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Teléfono de Contacto
                    </label>
                    <input
                      id="telefono"
                      name="telefono"
                      type="text"
                      value={formData.telefono}
                      onChange={handleChange}
                      placeholder="+591 4 4280123"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                    />
                  </div>
                </div>
              </div>

              {/* Sección 3: Cuenta de Administrador */}
              <div>
                <h3 style={{ margin: '10px 0 12px', fontSize: '0.95rem', color: 'var(--color-navy, #10294c)', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                  3. Cuenta de Administrador de la Clínica
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label htmlFor="adminEmail" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Correo Electrónico del Administrador *
                    </label>
                    <input
                      id="adminEmail"
                      name="adminEmail"
                      type="email"
                      required
                      value={formData.adminEmail}
                      onChange={handleChange}
                      placeholder="admin@univalle.test"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                    />
                  </div>
                  <div>
                    <label htmlFor="adminNombres" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Nombres
                    </label>
                    <input
                      id="adminNombres"
                      name="adminNombres"
                      type="text"
                      value={formData.adminNombres}
                      onChange={handleChange}
                      placeholder="Dr. Marcelo"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                    />
                  </div>
                  <div>
                    <label htmlFor="adminApellidos" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Apellidos
                    </label>
                    <input
                      id="adminApellidos"
                      name="adminApellidos"
                      type="text"
                      value={formData.adminApellidos}
                      onChange={handleChange}
                      placeholder="Quiroga"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                    />
                  </div>
                </div>
              </div>

              {/* Botones */}
              <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '14px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  style={{
                    background: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '9px 18px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    background: 'var(--color-navy, #10294c)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '9px 22px',
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {loading ? 'Aprovisionando Esquema...' : '+ Crear y Desplegar Clínica'}
                </button>
              </footer>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
