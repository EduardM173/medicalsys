import React from 'react';
import {
  Activity,
  Calendar,
  FileText,
  Receipt,
  MessageSquare,
  ShieldCheck,
  Stethoscope,
  ChevronRight,
  Database,
  Wifi,
} from 'lucide-react';
import { TabType } from '../types';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  pendingAppointmentsCount: number;
  pendingDocumentsCount: number;
  unreadNotificationsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  pendingAppointmentsCount,
  pendingDocumentsCount,
  unreadNotificationsCount,
}) => {
  const menuItems = [
    {
      id: 'historial' as TabType,
      code: 'MED-UI-01',
      title: 'Historial Clínico',
      subtitle: 'Expediente, CIE-10 & Recetas',
      icon: Activity,
      badge: null,
    },
    {
      id: 'agenda' as TabType,
      code: 'MED-UI-02',
      title: 'Agenda y Quirófanos',
      subtitle: 'Citas, Salas & Cirugías',
      icon: Calendar,
      badge: pendingAppointmentsCount > 0 ? `${pendingAppointmentsCount} hoy` : null,
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    },
    {
      id: 'documentos' as TabType,
      code: 'MED-UI-03',
      title: 'Gestión Documental',
      subtitle: 'Exámenes & Firma Digital',
      icon: FileText,
      badge: pendingDocumentsCount > 0 ? `${pendingDocumentsCount} ptes` : null,
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    },
    {
      id: 'facturacion' as TabType,
      code: 'MED-UI-04',
      title: 'Facturación SIN',
      subtitle: 'Ley Bolivia & SIAT Online',
      icon: Receipt,
      badge: 'SIN Bolivia',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    },
    {
      id: 'fidelizacion' as TabType,
      code: 'MED-UI-05',
      title: 'WhatsApp & Fidelización',
      subtitle: 'Recordatorios & Campañas',
      icon: MessageSquare,
      badge: unreadNotificationsCount > 0 ? `${unreadNotificationsCount}` : null,
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    },
  ];

  return (
    <aside className="w-72 bg-[#0F2343] text-white flex flex-col justify-between shrink-0 shadow-xl z-20 border-r border-[#1E3A66]">
      {/* Brand Header */}
      <div>
        <div className="p-6 border-b border-[#1E3A66]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-blue-900/50">
              <Stethoscope className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">MedicalSys</h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-blue-500/30 text-blue-300 rounded border border-blue-400/30">
                  SaaS Pro
                </span>
              </div>
              <p className="text-xs text-slate-300">Gestión Médica Hospitalaria</p>
            </div>
          </div>
        </div>

        {/* System Navigation */}
        <div className="px-3 py-6">
          <p className="px-3 mb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Módulos del Sistema
          </p>
          <nav className="space-y-1.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-tab-${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-left transition-all duration-200 group ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md shadow-blue-950/40 font-medium'
                      : 'text-slate-300 hover:bg-[#1A365D] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-[#152D52] text-slate-300 group-hover:text-blue-300 group-hover:bg-[#1C3B6B]'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold truncate leading-tight">{item.title}</span>
                      </div>
                      <span
                        className={`text-[11px] block truncate ${
                          isActive ? 'text-blue-100' : 'text-slate-400'
                        }`}
                      >
                        {item.subtitle}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 pl-1">
                    {item.badge && (
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          isActive
                            ? 'bg-white text-blue-900 border-white/20'
                            : item.badgeColor
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                    <ChevronRight
                      className={`w-3.5 h-3.5 transition-transform ${
                        isActive ? 'text-white translate-x-0.5' : 'text-slate-400 opacity-0 group-hover:opacity-100'
                      }`}
                    />
                  </div>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* System Status & Doctor Profile Footer */}
      <div className="p-4 border-t border-[#1E3A66] space-y-4">
        {/* Status Indicators */}
        <div className="bg-[#152D52] rounded-xl p-3 border border-[#1E3A66]/60 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-300 flex items-center gap-1.5">
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              SIAT / SIN Bolivia
            </span>
            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-800">
              En Línea
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-300 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-blue-400" />
              Base de Datos
            </span>
            <span className="text-[10px] text-slate-300">Sincronizado</span>
          </div>
        </div>

        {/* User Card */}
        <div className="flex items-center gap-3 bg-[#1A365D] p-2.5 rounded-xl border border-[#2B6CB0]/30">
          <div className="relative">
            <img
              src="https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=120&auto=format&fit=crop&q=80"
              alt="Dr. Carlos Mendoza"
              className="w-10 h-10 rounded-lg object-cover border-2 border-emerald-400"
            />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-[#1A365D]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-white truncate">Dr. Carlos Mendoza</p>
            <p className="text-[11px] text-blue-300 truncate">Cirujano General • Admin</p>
          </div>
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" title="Sesión Administrador Activa" />
        </div>
      </div>
    </aside>
  );
};
