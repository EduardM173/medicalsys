import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import '../styles/layout.css';

export function AppLayout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-content">
        <Outlet />
      </div>
    </div>
  );
}
