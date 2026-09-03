import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AdminRoute, AuthorizedRoute } from './components/AdminRoute';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { AgendaPage } from './pages/AgendaPage';
import { ConsentDetailPage } from './pages/ConsentDetailPage';
import { ConsentFormPage } from './pages/ConsentFormPage';
import { DashboardPage } from './pages/DashboardPage';
import { DoctorsPage } from './pages/DoctorsPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { FacturacionPage } from './pages/FacturacionPage';
import { LoginPage } from './pages/LoginPage';
import { MedicalHistoryPage } from './pages/MedicalHistoryPage';
import { PatientsPage } from './pages/PatientsPage';
import { RoomsPage } from './pages/RoomsPage';
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

              {/* Pacientes y Clínica: Recepcionista, Médico y Administrador */}
              <Route element={<AuthorizedRoute allowedRoles={['RECEPCIONISTA', 'ADMINISTRADOR', 'MEDICO']} />}>
                <Route path="/pacientes" element={<PatientsPage />} />
                <Route path="/historial-clinico/:patientId" element={<MedicalHistoryPage />} />
                <Route path="/pacientes/:patientId/documentos" element={<DocumentsPage />} />
                <Route path="/salas" element={<RoomsPage />} />
              </Route>

              {/* Citas, Recepción y Facturación */}
              <Route element={<AuthorizedRoute allowedRoles={['RECEPCIONISTA', 'ADMINISTRADOR']} />}>
                <Route path="/citas" element={<AppointmentsPage />} />
                <Route path="/facturacion" element={<FacturacionPage />} />
              </Route>

              {/* Agenda y Consentimientos Médicos */}
              <Route element={<AuthorizedRoute allowedRoles={['MEDICO', 'ADMINISTRADOR']} />}>
                <Route path="/agenda" element={<AgendaPage />} />
                <Route path="/consentimientos/nuevo" element={<ConsentFormPage />} />
                <Route path="/consentimientos/:consentId" element={<ConsentDetailPage />} />
              </Route>

              {/* Módulos Administrativos */}
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
