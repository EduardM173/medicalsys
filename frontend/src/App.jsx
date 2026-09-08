import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthorizedRoute } from './components/AdminRoute';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { BillingPreparationPage } from './pages/BillingPreparationPage';
import { BillingInvoicesPage } from './pages/BillingInvoicesPage';
import { AgendaPage } from './pages/AgendaPage';
import { ConsentDetailPage } from './pages/ConsentDetailPage';
import { ConsentFormPage } from './pages/ConsentFormPage';
import { ConsentHistoryPage } from './pages/ConsentHistoryPage';
import { DashboardPage } from './pages/DashboardPage';
import { DoctorsPage } from './pages/DoctorsPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { LoginPage } from './pages/LoginPage';
import { MedicalHistoryPage } from './pages/MedicalHistoryPage';
import { PatientsPage } from './pages/PatientsPage';
import { RoomsPage } from './pages/RoomsPage';
import { SchedulesPage } from './pages/SchedulesPage';
import { UsersPage } from './pages/UsersPage';
import { WhatsAppNotificationsPage } from './pages/WhatsAppNotificationsPage';
import { NotificationHistoryPage } from './pages/NotificationHistoryPage';
import { SecurityPage } from './pages/SecurityPage';

function App() {
  return <BrowserRouter><AuthProvider><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedRoute />}><Route element={<AppLayout />}>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route element={<AuthorizedRoute permission="patients.read" />}><Route path="/pacientes" element={<PatientsPage />} /></Route>
      <Route element={<AuthorizedRoute permission="history.read" />}><Route path="/historial-clinico/:patientId" element={<MedicalHistoryPage />} /></Route>
      <Route element={<AuthorizedRoute permission="documents.read" />}><Route path="/pacientes/:patientId/documentos" element={<DocumentsPage />} /></Route>
      <Route element={<AuthorizedRoute permission="rooms.read" />}><Route path="/salas" element={<RoomsPage />} /></Route>
      <Route element={<AuthorizedRoute permission="appointments.manage" />}><Route path="/citas" element={<AppointmentsPage />} /></Route>
      <Route element={<AuthorizedRoute permission="billing.prepare" />}><Route path="/facturacion/preparar" element={<BillingPreparationPage />} /></Route>
      <Route element={<AuthorizedRoute permission="billing.read" />}>
        <Route path="/facturacion" element={<BillingInvoicesPage />} />
        <Route path="/facturacion/:invoiceId" element={<BillingInvoicesPage />} />
      </Route>
      <Route element={<AuthorizedRoute permission="notifications.manage" />}><Route path="/whatsapp" element={<WhatsAppNotificationsPage />} /></Route>
      <Route element={<AuthorizedRoute permission="notifications.manage" />}><Route path="/notificaciones" element={<NotificationHistoryPage />} /></Route>
      <Route element={<AuthorizedRoute permission="agenda.read" />}><Route path="/agenda" element={<AgendaPage />} /></Route>
      <Route element={<AuthorizedRoute permission="consents.manage" />}><Route path="/consentimientos" element={<ConsentHistoryPage />} /></Route>
      <Route element={<AuthorizedRoute permission="consents.manage" />}><Route path="/consentimientos/nuevo" element={<ConsentFormPage />} /></Route>
      <Route element={<AuthorizedRoute permission="consents.manage" />}><Route path="/consentimientos/:consentId" element={<ConsentDetailPage />} /></Route>
      <Route element={<AuthorizedRoute permission="doctors.write" />}><Route path="/admin/medicos" element={<DoctorsPage />} /></Route>
      <Route element={<AuthorizedRoute permission="users.manage" />}><Route path="/admin/usuarios" element={<UsersPage />} /></Route>
      <Route element={<AuthorizedRoute permission="schedules.write" />}><Route path="/admin/horarios-medicos" element={<SchedulesPage />} /></Route>
      <Route element={<AuthorizedRoute permission="security.manage" />}><Route path="/admin/seguridad" element={<SecurityPage />} /></Route>
    </Route></Route>
    <Route path="*" element={<Navigate replace to="/dashboard" />} />
  </Routes></AuthProvider></BrowserRouter>;
}
export default App;
