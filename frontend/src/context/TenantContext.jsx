import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getCurrentTenant, getTenantCatalog } from '../services/api';

const TenantContext = createContext(null);

export function TenantProvider({ children }) {
  const [currentTenant, setCurrentTenant] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);

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
    window.location.reload();
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
        setIsSubscriptionModalOpen
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
