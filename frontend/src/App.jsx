import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthorizedRoute } from './components/AdminRoute';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
const AppointmentsPage = lazy(() => import('./pages/AppointmentsPage').then(module => ({ default: module.AppointmentsPage })));
const BillingPreparationPage = lazy(() => import('./pages/BillingPreparationPage').then(module => ({ default: module.BillingPreparationPage })));
const BillingInvoicesPage = lazy(() => import('./pages/BillingInvoicesPage').then(module => ({ default: module.BillingInvoicesPage })));
const AgendaPage = lazy(() => import('./pages/AgendaPage').then(module => ({ default: module.AgendaPage })));
const ConsentDetailPage = lazy(() => import('./pages/ConsentDetailPage').then(module => ({ default: module.ConsentDetailPage })));
const ConsentFormPage = lazy(() => import('./pages/ConsentFormPage').then(module => ({ default: module.ConsentFormPage })));
const ConsentHistoryPage = lazy(() => import('./pages/ConsentHistoryPage').then(module => ({ default: module.ConsentHistoryPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(module => ({ default: module.DashboardPage })));
const DoctorsPage = lazy(() => import('./pages/DoctorsPage').then(module => ({ default: module.DoctorsPage })));
const DocumentsPage = lazy(() => import('./pages/DocumentsPage').then(module => ({ default: module.DocumentsPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then(module => ({ default: module.LoginPage })));
const MedicalHistoryPage = lazy(() => import('./pages/MedicalHistoryPage').then(module => ({ default: module.MedicalHistoryPage })));
const PatientsPage = lazy(() => import('./pages/PatientsPage').then(module => ({ default: module.PatientsPage })));
const PatientPortalPage = lazy(() => import('./pages/PatientPortalPage').then(module => ({ default: module.PatientPortalPage })));
const RoomsPage = lazy(() => import('./pages/RoomsPage').then(module => ({ default: module.RoomsPage })));
const SchedulesPage = lazy(() => import('./pages/SchedulesPage').then(module => ({ default: module.SchedulesPage })));
const UsersPage = lazy(() => import('./pages/UsersPage').then(module => ({ default: module.UsersPage })));
const WhatsAppNotificationsPage = lazy(() => import('./pages/WhatsAppNotificationsPage').then(module => ({ default: module.WhatsAppNotificationsPage })));
const NotificationHistoryPage = lazy(() => import('./pages/NotificationHistoryPage').then(module => ({ default: module.NotificationHistoryPage })));
const SecurityPage = lazy(() => import('./pages/SecurityPage').then(module => ({ default: module.SecurityPage })));
const CampaignsPage = lazy(() => import('./pages/CampaignsPage').then(module => ({ default: module.CampaignsPage })));
const LoyaltyPage = lazy(() => import('./pages/LoyaltyPage').then(module => ({ default: module.LoyaltyPage })));
const AnnouncementsPage = lazy(() => import('./pages/AnnouncementsPage').then(module => ({ default: module.AnnouncementsPage })));
import { TenantProvider } from './context/TenantContext';

function App() {
  return <BrowserRouter><TenantProvider><AuthProvider><Suspense fallback={<div className='page-loading' role='status'>Cargando sección…</div>}><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedRoute />}><Route element={<AppLayout />}>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route element={<AuthorizedRoute permission="patient.portal.read" />}><Route path="/mi-portal" element={<PatientPortalPage />} /></Route>
      <Route element={<AuthorizedRoute permission="patient.portal.read" />}><Route path="/anuncios" element={<AnnouncementsPage />} /></Route>
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
      <Route element={<AuthorizedRoute permission="campaigns.manage" />}><Route path="/campanias" element={<CampaignsPage />} /></Route>
      <Route element={<AuthorizedRoute permission="loyalty.manage" />}><Route path="/fidelizacion" element={<LoyaltyPage />} /></Route>
    </Route></Route>
    <Route path="*" element={<Navigate replace to="/dashboard" />} />
  </Routes></Suspense></AuthProvider></TenantProvider></BrowserRouter>;
}
export default App;
