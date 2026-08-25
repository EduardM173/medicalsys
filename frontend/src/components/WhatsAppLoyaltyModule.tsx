import React, { useState, useMemo } from 'react';
import { WhatsAppNotification, HealthCampaign, Patient } from '../types';
import { Button, Input, Select, Modal } from './UIComponents';
import {
  MessageSquare,
  Send,
  CheckCheck,
  Clock,
  Sparkles,
  Phone,
  Users,
  Target,
  Megaphone,
  CheckCircle2,
  Share2,
  Smartphone,
  Calendar,
  Heart,
  TrendingUp,
} from 'lucide-react';

interface WhatsAppLoyaltyModuleProps {
  notifications: WhatsAppNotification[];
  campaigns: HealthCampaign[];
  patients: Patient[];
  onSendNotification: (notif: WhatsAppNotification) => void;
  onLaunchCampaign: (campaign: HealthCampaign) => void;
}

export const WhatsAppLoyaltyModule: React.FC<WhatsAppLoyaltyModuleProps> = ({
  notifications,
  campaigns,
  patients,
  onSendNotification,
  onLaunchCampaign,
}) => {
  const [activeTab, setActiveTab] = useState<'notifications' | 'campaigns'>('notifications');
  const [selectedChat, setSelectedChat] = useState<WhatsAppNotification | null>(null);
  const [isNewNotificationModalOpen, setIsNewNotificationModalOpen] = useState(false);

  // New Single Notification Form State
  const [targetPatientId, setTargetPatientId] = useState(patients[0]?.id || '');
  const [notifType, setNotifType] = useState<WhatsAppNotification['type']>('Confirmación de Cita');
  const [customMsg, setCustomMsg] = useState(
    '🏥 *MedicalSys:* Estimado paciente, le confirmamos su cita para el día de mañana a las 10:00 AM con el Dr. Carlos Mendoza.'
  );

  // Campaign Form State
  const [campaignTitle, setCampaignTitle] = useState('Jornada Preventiva de Salud Cardiovascular & Hipertensión');
  const [targetAudience, setTargetAudience] = useState('Pacientes mayores de 40 años o con diagnóstico de Hipertensión');
  const [benefitText, setBenefitText] = useState('25% de descuento en Chequeo Cardiológico Completo');
  const [campaignTemplate, setCampaignTemplate] = useState(
    '🩺 *MedicalSys Salud:* ¡Hola {{nombre}}! Durante este mes accede a un 25% de descuento en tu Chequeo Cardiológico Preventivo (Electrocardiograma + Consulta Especializada + Perfil Lipídico). Responde *1* para reservar tu horario preferencial.'
  );
  const [isSendingCampaign, setIsSendingCampaign] = useState(false);
  const [campaignProgress, setCampaignProgress] = useState(0);

  // Filtered notifications stats
  const notifStats = useMemo(() => {
    const total = notifications.length;
    const delivered = notifications.filter((n) => n.status === 'Entregado' || n.status === 'Leído' || n.status === 'Respondido').length;
    const read = notifications.filter((n) => n.status === 'Leído' || n.status === 'Respondido').length;
    const responded = notifications.filter((n) => n.status === 'Respondido').length;
    return { total, delivered, read, responded };
  }, [notifications]);

  // Target audience count estimate
  const estimatedAudienceCount = useMemo(() => {
    if (targetAudience.includes('40 años')) return 148;
    if (targetAudience.includes('diabét')) return 95;
    if (targetAudience.includes('sin visita')) return 210;
    return 350; // Todos los pacientes
  }, [targetAudience]);

  // Live preview template replacement
  const renderedCampaignPreview = useMemo(() => {
    return campaignTemplate
      .replace(/{{nombre}}/g, 'Alejandro Morales')
      .replace(/{{descuento}}/g, '25%')
      .replace(/{{fecha}}/g, '26 de Agosto');
  }, [campaignTemplate]);

  const handleSendSingleNotification = (e: React.FormEvent) => {
    e.preventDefault();
    const pat = patients.find((p) => p.id === targetPatientId) || patients[0];

    const newNotif: WhatsAppNotification = {
      id: `WA-${Math.floor(100 + Math.random() * 900)}`,
      patientName: pat.name,
      phone: pat.phone,
      type: notifType,
      message: customMsg,
      timestamp: 'Justo ahora',
      status: 'Entregado',
    };

    onSendNotification(newNotif);
    setIsNewNotificationModalOpen(false);
  };

  const handleLaunchCampaign = () => {
    setIsSendingCampaign(true);
    setCampaignProgress(15);

    setTimeout(() => setCampaignProgress(45), 400);
    setTimeout(() => setCampaignProgress(80), 800);
    setTimeout(() => {
      setCampaignProgress(100);
      setIsSendingCampaign(false);

      const newCamp: HealthCampaign = {
        id: `CAMP-0${campaigns.length + 1}`,
        name: campaignTitle,
        targetAudience,
        recipientCount: estimatedAudienceCount,
        messageTemplate: campaignTemplate,
        discountOrBenefit: benefitText,
        sentDate: new Date().toISOString().substring(0, 10),
        status: 'Enviada',
        readRate: '94.2%',
        bookedCount: 14,
      };

      onLaunchCampaign(newCamp);
    }, 1200);
  };

  const getStatusCheck = (status: WhatsAppNotification['status']) => {
    switch (status) {
      case 'Enviado':
        return <span className="text-[10px] text-slate-400">✓ Enviado</span>;
      case 'Entregado':
        return (
          <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
            <CheckCheck className="w-3.5 h-3.5 text-slate-400" /> Entregado
          </span>
        );
      case 'Leído':
        return (
          <span className="text-[10px] text-blue-600 font-bold flex items-center gap-0.5">
            <CheckCheck className="w-3.5 h-3.5 text-blue-500" /> Leído
          </span>
        );
      case 'Respondido':
        return (
          <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-0.5">
            <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> Respondido
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Metrics Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Notificaciones Enviadas
            </p>
            <h4 className="text-2xl font-extrabold text-[#1A365D] mt-0.5">{notifStats.total}</h4>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2B6CB0] flex items-center justify-center">
            <MessageSquare className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Tasa de Entrega
            </p>
            <h4 className="text-2xl font-extrabold text-emerald-600 mt-0.5">99.2%</h4>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Tasa de Lectura WhatsApp
            </p>
            <h4 className="text-2xl font-extrabold text-blue-600 mt-0.5">91.5%</h4>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Campañas Masivas
            </p>
            <h4 className="text-2xl font-extrabold text-[#1A365D] mt-0.5">{campaigns.length}</h4>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Megaphone className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Tabs Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl self-start">
            <button
              id="tab-notifs-history"
              onClick={() => setActiveTab('notifications')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'notifications'
                  ? 'bg-white text-[#1A365D] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <span>Historial de Mensajes y Recordatorios ({notifications.length})</span>
            </button>
            <button
              id="tab-campaigns-builder"
              onClick={() => setActiveTab('campaigns')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'campaigns'
                  ? 'bg-white text-[#1A365D] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Megaphone className="w-4 h-4 text-purple-600" />
              <span>Lanzador de Campañas de Salud Masivas</span>
            </button>
          </div>

          <Button
            id="btn-nueva-notif-wa"
            variant="success"
            icon={Send}
            onClick={() => setIsNewNotificationModalOpen(true)}
          >
            Enviar Mensaje WhatsApp Directo
          </Button>
        </div>
      </div>

      {/* VIEW 1: Historial de Mensajes por WhatsApp */}
      {activeTab === 'notifications' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* List (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/60">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A365D]">
                Notificaciones Automatizadas Recientes
              </h3>
              <span className="text-[11px] text-slate-500">API WhatsApp Business Conectada</span>
            </div>

            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => setSelectedChat(notif)}
                  className={`p-4 hover:bg-slate-50 cursor-pointer transition-colors space-y-2 ${
                    selectedChat?.id === notif.id ? 'bg-blue-50/70 border-l-4 border-[#2B6CB0]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                        {notif.patientName.charAt(0)}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{notif.patientName}</h4>
                        <p className="text-[10px] text-slate-500 font-mono">{notif.phone}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md border border-slate-200 block mb-1">
                        {notif.type}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">{notif.timestamp}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 line-clamp-2 bg-slate-50/80 p-2 rounded-lg border border-slate-100">
                    {notif.message}
                  </p>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-slate-400 font-medium">Estado de entrega:</span>
                    {getStatusCheck(notif.status)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Mockup Smartphone Live Preview of Selected Conversation (5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col items-center justify-center">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#1A365D] mb-4 self-start flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-600" />
              Vista Previa en Dispositivo Móvil del Paciente
            </h4>

            {/* Phone Screen Mockup */}
            <div className="w-[300px] bg-slate-900 rounded-[36px] p-3 shadow-2xl ring-1 ring-slate-800">
              {/* Screen Inside */}
              <div className="w-full bg-[#E5DDD5] rounded-[26px] overflow-hidden flex flex-col h-[460px] border border-slate-700">
                {/* WhatsApp Top Bar */}
                <div className="bg-[#075E54] text-white px-3 py-3 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-emerald-400 flex items-center justify-center font-bold text-xs text-slate-900">
                    +
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate">MedicalSys Clínica</p>
                    <p className="text-[9px] text-emerald-200">Cuenta Oficial Verificada</p>
                  </div>
                  <Phone className="w-3.5 h-3.5" />
                </div>

                {/* Message Bubble Body */}
                <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-[radial-gradient(#d3c9be_1px,transparent_1px)] [background-size:16px_16px]">
                  <div className="text-center">
                    <span className="text-[9px] bg-white/70 text-slate-600 px-2 py-0.5 rounded shadow-xs">
                      Hoy
                    </span>
                  </div>

                  {selectedChat ? (
                    <div className="bg-white rounded-xl rounded-tl-none p-3 shadow-xs max-w-[240px] text-xs space-y-1 text-slate-800">
                      <p className="text-[11px] leading-relaxed whitespace-pre-wrap">
                        {selectedChat.message}
                      </p>
                      <div className="flex justify-end items-center gap-1 text-[9px] text-slate-400 pt-1">
                        <span>12:54 PM</span>
                        <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl rounded-tl-none p-3 shadow-xs max-w-[240px] text-xs space-y-1 text-slate-800">
                      <p className="text-[11px] leading-relaxed">
                        🏥 *MedicalSys:* Estimado Roberto Daza, confirmamos su cita quirúrgica programada para el 26 de Agosto a las 08:30.
                      </p>
                      <div className="flex justify-end items-center gap-1 text-[9px] text-slate-400 pt-1">
                        <span>11:25 AM</span>
                        <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                      </div>
                    </div>
                  )}

                  {selectedChat?.status === 'Respondido' && (
                    <div className="bg-[#DCF8C6] self-end ml-auto rounded-xl rounded-tr-none p-2.5 shadow-xs max-w-[200px] text-xs text-slate-800">
                      <p className="text-[11px]">SI, confirmo mi asistencia. Muchas gracias.</p>
                      <div className="flex justify-end text-[9px] text-slate-400">11:32 AM</div>
                    </div>
                  )}
                </div>

                {/* Bottom Input Simulation */}
                <div className="bg-[#F0F0F0] p-2 flex items-center gap-2 border-t border-slate-300">
                  <div className="flex-1 bg-white py-1.5 px-3 rounded-full text-[10px] text-slate-400 border border-slate-200">
                    Escribe un mensaje...
                  </div>
                  <div className="w-7 h-7 rounded-full bg-[#075E54] flex items-center justify-center text-white">
                    <Send className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: Lanzador de Campañas y Promociones de Salud Masivas */}
      {activeTab === 'campaigns' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Campaign Builder (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#1A365D]">
                  Crear y Lanzar Campaña Preventiva de Salud
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Envíe promociones, chequeos preventivos y beneficios a grupos segmentados de pacientes.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <Input
                label="Nombre / Título de la Campaña"
                value={campaignTitle}
                onChange={(e) => setCampaignTitle(e.target.value)}
                placeholder="Ej. Chequeo Cardiológico Preventivo"
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Segmentación de Audiencia Objetivo"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  options={[
                    { value: 'Pacientes mayores de 40 años o con diagnóstico de Hipertensión', label: '🫀 Mayores de 40 años / Hipertensión' },
                    { value: 'Pacientes con antecedentes metabólicos / diabetes', label: '🩸 Pacientes con Diabetes / Glucosa' },
                    { value: 'Pacientes sin visita médica en más de 6 meses', label: '🗓️ Pacientes sin visita > 6 meses' },
                    { value: 'Todos los pacientes de la clínica', label: '👥 Todos los Pacientes Registrados' },
                  ]}
                  required
                />

                <Input
                  label="Beneficio / Descuento Ofrecido"
                  value={benefitText}
                  onChange={(e) => setBenefitText(e.target.value)}
                  placeholder="Ej. 25% de Descuento en Consulta"
                />
              </div>

              {/* Template Editor */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Plantilla del Mensaje de WhatsApp
                  </label>
                  <span className="text-[10px] text-blue-600 font-semibold">
                    Variables: <code>{"{{nombre}}"}</code>, <code>{"{{descuento}}"}</code>
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={campaignTemplate}
                  onChange={(e) => setCampaignTemplate(e.target.value)}
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
                  required
                />
              </div>

              {/* Campaign Estimated Reach Card */}
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl flex items-center justify-between text-xs text-purple-900">
                <div className="flex items-center gap-3">
                  <Target className="w-5 h-5 text-purple-600" />
                  <div>
                    <strong className="block text-purple-950 font-bold">
                      Alcance Estimado: {estimatedAudienceCount} Pacientes
                    </strong>
                    <span className="text-[11px] text-purple-700">
                      Segmento: {targetAudience}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-bold bg-white text-purple-700 px-3 py-1 rounded-lg border border-purple-200">
                  Costo: Bs. 0.00 (Incluido)
                </span>
              </div>

              {/* Sending Progress Bar */}
              {isSendingCampaign && (
                <div className="space-y-1.5 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span>Enviando mensajes a través de WhatsApp API...</span>
                    <span>{campaignProgress}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${campaignProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="success"
                  size="lg"
                  icon={Megaphone}
                  isLoading={isSendingCampaign}
                  onClick={handleLaunchCampaign}
                >
                  Lanzar Campaña Masiva Ahora
                </Button>
              </div>
            </div>
          </div>

          {/* Right: Live Preview of Campaign Message in Phone (5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col items-center justify-center">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#1A365D] mb-4 self-start flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-purple-600" />
              Vista Previa en Tiempo Real de la Campaña
            </h4>

            {/* Phone Screen Mockup */}
            <div className="w-[300px] bg-slate-900 rounded-[36px] p-3 shadow-2xl ring-1 ring-slate-800">
              <div className="w-full bg-[#E5DDD5] rounded-[26px] overflow-hidden flex flex-col h-[440px] border border-slate-700">
                <div className="bg-[#075E54] text-white px-3 py-3 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-purple-400 flex items-center justify-center font-bold text-xs text-slate-900">
                    +
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate">MedicalSys Promociones</p>
                    <p className="text-[9px] text-emerald-200">Campañas Preventivas</p>
                  </div>
                </div>

                <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-[radial-gradient(#d3c9be_1px,transparent_1px)] [background-size:16px_16px]">
                  <div className="text-center">
                    <span className="text-[9px] bg-white/70 text-slate-600 px-2 py-0.5 rounded">
                      Campaña de Salud
                    </span>
                  </div>

                  <div className="bg-white rounded-xl rounded-tl-none p-3 shadow-xs max-w-[240px] text-xs space-y-2 text-slate-800">
                    <p className="text-[11px] leading-relaxed whitespace-pre-wrap">
                      {renderedCampaignPreview}
                    </p>
                    <div className="pt-2 border-t border-slate-100 flex flex-col gap-1">
                      <button className="w-full py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded border border-emerald-200">
                        1. Reservar Horario Ahora
                      </button>
                      <button className="w-full py-1 bg-slate-50 text-slate-600 text-[10px] rounded border border-slate-200">
                        2. Más Información
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Enviar Notificación Directa a Paciente */}
      <Modal
        isOpen={isNewNotificationModalOpen}
        onClose={() => setIsNewNotificationModalOpen(false)}
        title="Enviar Notificación WhatsApp Directa"
        subtitle="Envíe confirmaciones de cita, recetas médicas o recordatorios individualizados."
        maxWidth="lg"
      >
        <form onSubmit={handleSendSingleNotification} className="space-y-4">
          <Select
            label="Seleccionar Paciente Destinatario"
            value={targetPatientId}
            onChange={(e) => setTargetPatientId(e.target.value)}
            options={patients.map((p) => ({
              value: p.id,
              label: `${p.name} (${p.phone})`,
            }))}
            required
          />

          <Select
            label="Tipo de Notificación"
            value={notifType}
            onChange={(e) => {
              const val = e.target.value as WhatsAppNotification['type'];
              setNotifType(val);
              if (val === 'Receta Digital') {
                setCustomMsg('📋 *MedicalSys:* Hola estimado(a) paciente, su receta médica digital ya se encuentra lista para descarga: https://medsys.app/rx/rec-2026-089');
              } else if (val === 'Resultados Listos') {
                setCustomMsg('🔬 *MedicalSys Laboratorio:* Sus resultados de análisis clínicos ya se encuentran disponibles en su portal del paciente.');
              } else if (val === 'Recordatorio 24h') {
                setCustomMsg('⏰ *Recordatorio MedicalSys:* Le recordamos su cita médica programada para mañana a las 10:00 AM. Por favor llegar 10 minutos antes.');
              } else {
                setCustomMsg('🏥 *MedicalSys:* Estimado paciente, le confirmamos su cita con el Dr. Carlos Mendoza para el día programado.');
              }
            }}
            options={[
              { value: 'Confirmación de Cita', label: 'Confirmación de Cita' },
              { value: 'Recordatorio 24h', label: 'Recordatorio 24 horas antes' },
              { value: 'Receta Digital', label: 'Envío de Receta Digital' },
              { value: 'Resultados Listos', label: 'Aviso de Resultados de Laboratorio' },
            ]}
            required
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Contenido del Mensaje
            </label>
            <textarea
              rows={3}
              value={customMsg}
              onChange={(e) => setCustomMsg(e.target.value)}
              className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsNewNotificationModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="success" icon={Send}>
              Enviar Mensaje por WhatsApp
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
