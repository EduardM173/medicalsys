import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getCurrentTenant, getTenantCatalog, getStoredToken } from '../services/api';

const TenantContext = createContext(null);

export function TenantProvider({ children }) {
  const [currentTenant, setCurrentTenant] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [renewalVoucher, setRenewalVoucher] = useState(null);

  const loadTenantData = useCallback(async () => {
    try {
      setLoading(true);
      const [currRes, catRes] = await Promise.all([
        getCurrentTenant().catch(() => ({ tenant: null })),
        getTenantCatalog().catch(() => ({ organizations: [] }))
      ]);

      if (currRes && currRes.tenant) {
        setCurrentTenant(currRes.tenant);
        localStorage.setItem('medicalsys_active_tenant', currRes.tenant.codigo);
      }
      if (catRes && catRes.organizations) {
        setOrganizations(catRes.organizations);
      }
    } catch (err) {
      console.error('Error cargando información de tenant:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTenantData();
  }, [loadTenantData]);

  const switchTenant = (tenantCode) => {
    if (!tenantCode) return;
    localStorage.setItem('medicalsys_active_tenant', tenantCode);

    const host = window.location.hostname.toLowerCase();
    const port = window.location.port ? `:${window.location.port}` : '';
    const token = getStoredToken();
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';

    // Si el host es un subdominio .localhost (ej: cumed.localhost:5173 -> sanrafael.localhost:5173)
    if (host.endsWith('.localhost')) {
      window.location.href = `${window.location.protocol}//${tenantCode}.localhost${port}${window.location.pathname}${tokenParam}`;
      return;
    }

    // Si estamos en localhost normal, actualizamos el parámetro de URL ?tenant=...
    const url = new URL(window.location.href);
    url.searchParams.set('tenant', tenantCode);
    if (token) url.searchParams.set('token', token);
    window.location.href = url.toString();
  };

  return (
    <TenantContext.Provider
      value={{
        currentTenant,
        organizations,
        loading,
        switchTenant,
        refreshTenant: loadTenantData,
        isSubscriptionModalOpen,
        setIsSubscriptionModalOpen,
        renewalVoucher,
        setRenewalVoucher
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant debe ser utilizado dentro de un TenantProvider');
  }
  return context;
}
