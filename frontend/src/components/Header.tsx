import React from 'react';
import {
  Search,
  Bell,
  PlusCircle,
  Clock,
  Sparkles,
  CalendarCheck,
  FileSpreadsheet,
} from 'lucide-react';
import { TabType } from '../types';

interface HeaderProps {
  activeTab: TabType;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onQuickAction: (action: string) => void;
  systemNotificationsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  searchTerm,
  setSearchTerm,
  onQuickAction,
  systemNotificationsCount,
}) => {
  const getTabDetails = (tab: TabType) => {
    switch (tab) {
      case 'historial':
        return {
          title: 'Historial Clínico Digital',
          code: 'MED-UI-01',
          desc: 'Expedientes de pacientes, diagnósticos CIE-10 y prescripción médica',
          quickLabel: 'Nueva Atención',
          quickAction: 'new_consultation',
        };
      case 'agenda':
        return {
          title: 'Agenda Médica y Gestión de Quirófanos',
          code: 'MED-UI-02',
          desc: 'Programación de cirugías, disponibilidad de salas y control de citas',
          quickLabel: 'Reservar Cita',
          quickAction: 'new_appointment',
        };
      case 'documentos':
        return {
          title: 'Gestión Documental y Consentimiento Informado',
          code: 'MED-UI-03',
          desc: 'Exámenes complementarios, digitalización y firma digital de pacientes',
          quickLabel: 'Subir Examen',
          quickAction: 'upload_document',
        };
      case 'facturacion':
        return {
          title: 'Facturación Computarizada en Línea (SIN Bolivia)',
          code: 'MED-UI-04',
          desc: 'Emisión de facturas con código CUF, QR oficial e impuestos de ley',
          quickLabel: 'Nueva Factura',
          quickAction: 'new_invoice',
        };
      case 'fidelizacion':
        return {
          title: 'WhatsApp Business & Fidelización de Pacientes',
          code: 'MED-UI-05',
          desc: 'Notificaciones automáticas, recordatorios 24h y campañas preventivas',
          quickLabel: 'Lanzar Campaña',
          quickAction: 'new_campaign',
        };
    }
  };

  const currentTabInfo = getTabDetails(activeTab);

  return (
    <header className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-10 shadow-xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Tab Title & Context */}
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 bg-blue-100 text-[#1A365D] rounded-md border border-blue-200">
              {currentTabInfo.code}
            </span>
            <h2 className="text-xl font-extrabold text-[#1A365D] tracking-tight">
              {currentTabInfo.title}
            </h2>
          </div>
          <p className="text-xs text-slate-500">{currentTabInfo.desc}</p>
        </div>

        {/* Right: Search, Status & Quick Action Button */}
        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
          {/* Universal Search Bar */}
          <div className="relative w-full sm:w-64 md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="global-search-input"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar paciente, CI o folio..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 bg-slate-200 rounded-full w-4 h-4 flex items-center justify-center"
              >
                ×
              </button>
            )}
          </div>

          {/* Current Date Badge */}
          <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs border border-slate-200 font-medium shrink-0">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>24 Ago 2026</span>
          </div>

          {/* Notification Icon */}
          <button
            id="btn-header-notifications"
            className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl border border-slate-200 transition-colors relative"
            title="Notificaciones del sistema"
            onClick={() => onQuickAction('view_notifications')}
          >
            <Bell className="w-4 h-4" />
            {systemNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                {systemNotificationsCount}
              </span>
            )}
          </button>

          {/* Quick Primary Action Button */}
          <button
            id="btn-header-quick-action"
            onClick={() => onQuickAction(currentTabInfo.quickAction)}
            className="flex items-center gap-2 px-4 py-2 bg-[#2B6CB0] hover:bg-[#1A365D] text-white rounded-xl text-xs font-semibold shadow-sm hover:shadow transition-all duration-200 shrink-0 cursor-pointer active:scale-95"
          >
            <PlusCircle className="w-4 h-4 text-blue-200" />
            <span>{currentTabInfo.quickLabel}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
