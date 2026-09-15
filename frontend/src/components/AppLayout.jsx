import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TenantHeader } from './TenantHeader';
import { TenantSubscriptionModal } from './TenantSubscriptionModal';
import { TenantRenewalSuccessModal } from './TenantRenewalSuccessModal';
import { ConnectionStatus } from './ConnectionStatus';
import { ListPagination } from './ListPagination';
import '../styles/connectivity.css';
import '../styles/layout.css';

export function AppLayout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main-container" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TenantHeader />
        <ConnectionStatus />
        <div className="app-content">
          <Outlet />
          <ListPagination />
        </div>
      </div>
      <TenantSubscriptionModal />
      <TenantRenewalSuccessModal />
    </div>
  );
}

