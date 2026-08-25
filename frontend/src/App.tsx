import React, { useState } from 'react';
import { TabType, Patient, ClinicalRecord, Appointment, MedicalRoom, DocumentItem, ConsentForm, InvoiceSIN, WhatsAppNotification, HealthCampaign } from './types';
import {
  INITIAL_PATIENTS,
  INITIAL_CLINICAL_RECORDS,
  INITIAL_APPOINTMENTS,
  INITIAL_ROOMS,
  INITIAL_DOCUMENTS,
  INITIAL_CONSENT_FORM,
  INITIAL_INVOICES,
  INITIAL_NOTIFICATIONS,
  INITIAL_CAMPAIGNS,
  CIE10_DATABASE,
} from './mockData';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ToastContainer, ToastMessage } from './components/Toast';
import { ClinicalHistoryModule } from './components/ClinicalHistoryModule';
import { AgendaSurgeryModule } from './components/AgendaSurgeryModule';
import { DocumentManagementModule } from './components/DocumentManagementModule';
import { BillingSINModule } from './components/BillingSINModule';
import { WhatsAppLoyaltyModule } from './components/WhatsAppLoyaltyModule';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('historial');
  const [searchTerm, setSearchTerm] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // State Management for Mock Data
  const [patients, setPatients] = useState<Patient[]>(INITIAL_PATIENTS);
  const [records, setRecords] = useState<ClinicalRecord[]>(INITIAL_CLINICAL_RECORDS);
  const [appointments, setAppointments] = useState<Appointment[]>(INITIAL_APPOINTMENTS);
  const [rooms, setRooms] = useState<MedicalRoom[]>(INITIAL_ROOMS);
  const [documents, setDocuments] = useState<DocumentItem[]>(INITIAL_DOCUMENTS);
  const [consentForm, setConsentForm] = useState<ConsentForm>(INITIAL_CONSENT_FORM);
  const [invoices, setInvoices] = useState<InvoiceSIN[]>(INITIAL_INVOICES);
  const [notifications, setNotifications] = useState<WhatsAppNotification[]>(INITIAL_NOTIFICATIONS);
  const [campaigns, setCampaigns] = useState<HealthCampaign[]>(INITIAL_CAMPAIGNS);

  const [selectedPatientId, setSelectedPatientId] = useState<string>(INITIAL_PATIENTS[0].id);

  // Toast Helper
  const showToast = (type: 'success' | 'error' | 'info', title: string, message: string) => {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Handlers for Clinical History
  const handleSaveRecord = (newRecord: ClinicalRecord) => {
    setRecords((prev) => [newRecord, ...prev]);
    showToast(
      'success',
      'Atención Médica Registrada',
      `Se ha guardado exitosamente la atención médica y la receta para ${patients.find(p => p.id === newRecord.patientId)?.name || 'el paciente'}.`
    );
  };

  // Handlers for Agenda & Surgeries
  const handleAddAppointment = (newAppt: Appointment) => {
    setAppointments((prev) => [newAppt, ...prev]);
    // Automatically trigger a WhatsApp notification
    const newNotif: WhatsAppNotification = {
      id: `WA-${Date.now()}`,
      patientName: newAppt.patientName,
      phone: newAppt.patientPhone,
      type: 'Confirmación de Cita',
      message: `🏥 *MedicalSys Clínica:* Estimado(a) ${newAppt.patientName}, confirmamos su cita para el ${newAppt.date} a las ${newAppt.time} con ${newAppt.doctorName} en ${newAppt.room}.`,
      timestamp: 'Ahora mismo',
      status: 'Entregado',
    };
    setNotifications((prev) => [newNotif, ...prev]);

    showToast(
      'success',
      'Cita Médica Agendada',
      `Cita reservada para ${newAppt.patientName} (${newAppt.date} a las ${newAppt.time}). Se envió confirmación por WhatsApp.`
    );
  };

  const handleUpdateAppointmentStatus = (id: string, newStatus: Appointment['status']) => {
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a))
    );
    showToast('info', 'Estado Actualizado', `La cita fue marcada como "${newStatus}".`);
  };

  const handleUpdateRoomStatus = (id: string, newStatus: MedicalRoom['status']) => {
    setRooms((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
    );
    showToast('info', 'Sala Actualizada', `El estado de la sala se actualizó a "${newStatus}".`);
  };

  // Handlers for Documents
  const handleUploadDocument = (doc: DocumentItem) => {
    setDocuments((prev) => [doc, ...prev]);
    showToast(
      'success',
      'Documento Adjuntado',
      `Se ha subido el archivo "${doc.title}" al expediente de ${doc.patientName}.`
    );
  };

  const handleSignConsent = (signedConsent: ConsentForm) => {
    setConsentForm(signedConsent);
    // Also add to documents
    const consentDoc: DocumentItem = {
      id: `DOC-CONF-${Date.now()}`,
      patientId: signedConsent.patientId,
      patientName: signedConsent.patientName,
      patientCi: signedConsent.patientCi,
      title: `Consentimiento Firmado: ${signedConsent.procedureName}`,
      category: 'Consentimiento',
      date: new Date().toISOString().substring(0, 10),
      doctor: signedConsent.doctorName,
      fileType: 'PDF Certificado',
      fileSize: '950 KB',
      isSigned: true,
      signatureHash: signedConsent.hash,
    };
    setDocuments((prev) => [consentDoc, ...prev]);

    showToast(
      'success',
      'Consentimiento Firmado Digitalmente',
      `Firma validada con huella SHA-256 e incorporada al expediente legal del paciente.`
    );
  };

  // Handlers for Billing SIN
  const handleEmitInvoice = (invoice: InvoiceSIN) => {
    setInvoices((prev) => [invoice, ...prev]);
    showToast(
      'success',
      'Factura SIN Emitida Exitosamente',
      `Factura N° ${invoice.invoiceNumber} autorizada con CUF y código QR oficial por Bs. ${invoice.total.toFixed(2)}.`
    );
  };

  // Handlers for WhatsApp & Loyalty
  const handleSendNotification = (notif: WhatsAppNotification) => {
    setNotifications((prev) => [notif, ...prev]);
    showToast(
      'success',
      'Mensaje WhatsApp Enviado',
      `Notificación enviada a ${notif.patientName} (${notif.phone}) con entrega confirmada.`
    );
  };

  const handleLaunchCampaign = (campaign: HealthCampaign) => {
    setCampaigns((prev) => [campaign, ...prev]);
    showToast(
      'success',
      'Campaña Masiva Iniciada',
      `La campaña "${campaign.name}" fue transmitida a ${campaign.recipientCount} pacientes vía WhatsApp Business API.`
    );
  };

  // Quick Action Routing from Header
  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'new_consultation':
        setActiveTab('historial');
        break;
      case 'new_appointment':
        setActiveTab('agenda');
        break;
      case 'upload_document':
        setActiveTab('documentos');
        break;
      case 'new_invoice':
        setActiveTab('facturacion');
        break;
      case 'new_campaign':
        setActiveTab('fidelizacion');
        break;
      case 'view_notifications':
        setActiveTab('fidelizacion');
        break;
      default:
        break;
    }
  };

  const pendingAppointmentsCount = appointments.filter((a) => a.status === 'Pendiente').length;
  const pendingDocumentsCount = documents.filter((d) => !d.isSigned).length;
  const unreadNotificationsCount = notifications.filter((n) => n.status === 'Respondido').length;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F7FAFC] font-['Plus_Jakarta_Sans',sans-serif] text-slate-800">
      {/* 1. Navigable Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingAppointmentsCount={pendingAppointmentsCount}
        pendingDocumentsCount={pendingDocumentsCount}
        unreadNotificationsCount={unreadNotificationsCount}
      />

      {/* 2. Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Superior Header with search and user status */}
        <Header
          activeTab={activeTab}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          onQuickAction={handleQuickAction}
          systemNotificationsCount={unreadNotificationsCount + pendingAppointmentsCount}
        />

        {/* Central Work Area */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50/50">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Tab 1: Historial Clínico (MED-UI-01) */}
            {activeTab === 'historial' && (
              <ClinicalHistoryModule
                patients={patients}
                records={records}
                cie10List={CIE10_DATABASE}
                selectedPatientId={selectedPatientId}
                setSelectedPatientId={setSelectedPatientId}
                onSaveRecord={handleSaveRecord}
              />
            )}

            {/* Tab 2: Agenda y Quirófanos (MED-UI-02) */}
            {activeTab === 'agenda' && (
              <AgendaSurgeryModule
                appointments={appointments}
                rooms={rooms}
                patients={patients}
                onAddAppointment={handleAddAppointment}
                onUpdateAppointmentStatus={handleUpdateAppointmentStatus}
                onUpdateRoomStatus={handleUpdateRoomStatus}
              />
            )}

            {/* Tab 3: Gestión Documental (MED-UI-03) */}
            {activeTab === 'documentos' && (
              <DocumentManagementModule
                documents={documents}
                consentForm={consentForm}
                patients={patients}
                onUploadDocument={handleUploadDocument}
                onSignConsent={handleSignConsent}
              />
            )}

            {/* Tab 4: Facturación SIN (MED-UI-04) */}
            {activeTab === 'facturacion' && (
              <BillingSINModule
                invoices={invoices}
                patients={patients}
                onEmitInvoice={handleEmitInvoice}
              />
            )}

            {/* Tab 5: WhatsApp y Fidelización (MED-UI-05) */}
            {activeTab === 'fidelizacion' && (
              <WhatsAppLoyaltyModule
                notifications={notifications}
                campaigns={campaigns}
                patients={patients}
                onSendNotification={handleSendNotification}
                onLaunchCampaign={handleLaunchCampaign}
              />
            )}
          </div>
        </main>
      </div>

      {/* Floating Toast Notification System */}
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
}
