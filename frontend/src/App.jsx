import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AdminRoute, AuthorizedRoute } from './components/AdminRoute';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import { DashboardPage } from './pages/DashboardPage';
import { DoctorsPage } from './pages/DoctorsPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { LoginPage } from './pages/LoginPage';
import { MedicalHistoryPage } from './pages/MedicalHistoryPage';
import { PatientsPage } from './pages/PatientsPage';
import { SchedulesPage } from './pages/SchedulesPage';
import { UsersPage } from './pages/UsersPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route element={<AuthorizedRoute allowedRoles={['RECEPCIONISTA', 'ADMINISTRADOR', 'MEDICO']} />}>
                <Route path="/pacientes" element={<PatientsPage />} />
              </Route>
              <Route element={<AuthorizedRoute allowedRoles={['MEDICO']} />}>
                <Route path="/historial-clinico/:patientId" element={<MedicalHistoryPage />} />
                <Route path="/pacientes/:patientId/documentos" element={<DocumentsPage />} />
              </Route>
              <Route element={<AdminRoute />}>
                <Route path="/admin/medicos" element={<DoctorsPage />} />
                <Route path="/admin/usuarios" element={<UsersPage />} />
                <Route path="/admin/horarios-medicos" element={<SchedulesPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate replace to="/dashboard" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
