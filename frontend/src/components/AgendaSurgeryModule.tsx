import React, { useState, useMemo } from 'react';
import { Appointment, MedicalRoom, Patient } from '../types';
import { Button, Input, Select, Modal } from './UIComponents';
import {
  Calendar,
  Clock,
  User,
  Plus,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Stethoscope,
  Filter,
  Check,
  Building,
  Sparkles,
  BedDouble,
  Activity,
  Layers,
  Phone,
  ShieldCheck,
} from 'lucide-react';

interface AgendaSurgeryModuleProps {
  appointments: Appointment[];
  rooms: MedicalRoom[];
  patients: Patient[];
  onAddAppointment: (newAppt: Appointment) => void;
  onUpdateAppointmentStatus: (id: string, newStatus: Appointment['status']) => void;
  onUpdateRoomStatus: (id: string, newStatus: MedicalRoom['status']) => void;
}

export const AgendaSurgeryModule: React.FC<AgendaSurgeryModuleProps> = ({
  appointments,
  rooms,
  patients,
  onAddAppointment,
  onUpdateAppointmentStatus,
  onUpdateRoomStatus,
}) => {
  const [activeView, setActiveView] = useState<'agenda' | 'rooms'>('agenda');
  const [selectedDate, setSelectedDate] = useState('2026-08-25');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>('all');
  const [isNewAppointmentModalOpen, setIsNewAppointmentModalOpen] = useState(false);

  // Form State for New Appointment
  const [formPatientId, setFormPatientId] = useState(patients[0]?.id || '');
  const [formDoctor, setFormDoctor] = useState('Dr. Carlos Mendoza');
  const [formSpecialty, setFormSpecialty] = useState('Cirugía General');
  const [formDate, setFormDate] = useState('2026-08-25');
  const [formTime, setFormTime] = useState('14:00');
  const [formDuration, setFormDuration] = useState('30');
  const [formType, setFormType] = useState<Appointment['type']>('Consulta General');
  const [formRoom, setFormRoom] = useState('Consultorio 204');
  const [formNotes, setFormNotes] = useState('');

  // Doctor Specialties map for convenience
  const doctorOptions = [
    { value: 'Dr. Carlos Mendoza', label: 'Dr. Carlos Mendoza (Cirugía General)' },
    { value: 'Dra. Marcela Ugarte', label: 'Dra. Marcela Ugarte (Cardiología)' },
    { value: 'Dra. Andrea Salguero', label: 'Dra. Andrea Salguero (Ginecología)' },
    { value: 'Dr. Roberto Siles', label: 'Dr. Roberto Siles (Gastroenterología)' },
    { value: 'Dr. Javier Villarroel', label: 'Dr. Javier Villarroel (Imagenología)' },
  ];

  const appointmentTypes: Appointment['type'][] = [
    'Consulta General',
    'Especialidad',
    'Control Post-Operatorio',
    'Cirugía Programada',
    'Procedimiento Menor',
  ];

  // Filtered appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter((app) => {
      const matchStatus = statusFilter === 'all' || app.status === statusFilter;
      return matchStatus;
    });
  }, [appointments, statusFilter]);

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      if (roomTypeFilter === 'all') return true;
      return r.type === roomTypeFilter;
    });
  }, [rooms, roomTypeFilter]);

  // Appointment counts
  const stats = useMemo(() => {
    const total = appointments.length;
    const confirmed = appointments.filter((a) => a.status === 'Confirmada').length;
    const pending = appointments.filter((a) => a.status === 'Pendiente').length;
    const surgeries = appointments.filter((a) => a.type === 'Cirugía Programada').length;
    const roomsInUse = rooms.filter((r) => r.status === 'En Cirugía' || r.status === 'En Consulta').length;

    return { total, confirmed, pending, surgeries, roomsInUse };
  }, [appointments, rooms]);

  const handleCreateAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    const patientObj = patients.find((p) => p.id === formPatientId) || patients[0];

    const newAppt: Appointment = {
      id: `APT-${Math.floor(200 + Math.random() * 800)}`,
      patientId: patientObj.id,
      patientName: patientObj.name,
      patientCi: patientObj.ci,
      patientPhone: patientObj.phone,
      doctorName: formDoctor,
      specialty: formSpecialty,
      date: formDate,
      time: formTime,
      durationMin: Number(formDuration),
      type: formType,
      room: formRoom,
      status: 'Confirmada',
      notes: formNotes || undefined,
    };

    onAddAppointment(newAppt);
    setIsNewAppointmentModalOpen(false);
    // Reset form
    setFormNotes('');
  };

  const getStatusBadge = (status: Appointment['status']) => {
    switch (status) {
      case 'Confirmada':
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/90 px-2.5 py-0.5 rounded-full border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            Confirmada
          </span>
        );
      case 'Pendiente':
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100/90 px-2.5 py-0.5 rounded-full border border-amber-200">
            <AlertCircle className="w-3 h-3" />
            Pendiente
          </span>
        );
      case 'En Consulta':
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-100/90 px-2.5 py-0.5 rounded-full border border-blue-200 animate-pulse">
            <Activity className="w-3 h-3" />
            En Consulta
          </span>
        );
      case 'Completada':
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-300">
            <Check className="w-3 h-3" />
            Atendida
          </span>
        );
      case 'Cancelada':
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100/90 px-2.5 py-0.5 rounded-full border border-rose-200">
            <XCircle className="w-3 h-3" />
            Cancelada
          </span>
        );
    }
  };

  const getRoomStatusColor = (status: MedicalRoom['status']) => {
    switch (status) {
      case 'Disponible':
        return {
          badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          border: 'border-emerald-200',
          indicator: 'bg-emerald-500',
        };
      case 'En Cirugía':
        return {
          badge: 'bg-rose-100 text-rose-800 border-rose-300',
          border: 'border-rose-200',
          indicator: 'bg-rose-500 animate-ping',
        };
      case 'En Consulta':
        return {
          badge: 'bg-blue-100 text-blue-800 border-blue-300',
          border: 'border-blue-200',
          indicator: 'bg-blue-500',
        };
      case 'Mantenimiento / Limpieza':
        return {
          badge: 'bg-amber-100 text-amber-800 border-amber-300',
          border: 'border-amber-200',
          indicator: 'bg-amber-500',
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Citas Programadas
            </p>
            <h4 className="text-2xl font-extrabold text-[#1A365D] mt-0.5">{stats.total}</h4>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2B6CB0] flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Citas Confirmadas
            </p>
            <h4 className="text-2xl font-extrabold text-emerald-600 mt-0.5">{stats.confirmed}</h4>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Cirugías en Quirófano
            </p>
            <h4 className="text-2xl font-extrabold text-rose-600 mt-0.5">{stats.surgeries}</h4>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Salas Ocupadas
            </p>
            <h4 className="text-2xl font-extrabold text-[#1A365D] mt-0.5">
              {stats.roomsInUse} <span className="text-xs text-slate-400 font-normal">/ {rooms.length}</span>
            </h4>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
            <Building className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main View Toggle & Filters Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Main View Segmented Control */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl self-start">
            <button
              id="view-agenda-tab"
              onClick={() => setActiveView('agenda')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeView === 'agenda'
                  ? 'bg-white text-[#1A365D] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Calendario de Citas ({appointments.length})</span>
            </button>
            <button
              id="view-rooms-tab"
              onClick={() => setActiveView('rooms')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeView === 'rooms'
                  ? 'bg-white text-[#1A365D] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building className="w-4 h-4" />
              <span>Disponibilidad de Quirófanos y Salas ({rooms.length})</span>
            </button>
          </div>

          {/* Action Button: Reservar Cita */}
          <Button
            id="btn-reservar-cita-modal"
            variant="primary"
            icon={Plus}
            onClick={() => setIsNewAppointmentModalOpen(true)}
          >
            Reservar Cita Médica / Quirófano
          </Button>
        </div>

        {/* Filters Row */}
        {activeView === 'agenda' ? (
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Estado:
              </span>
              {(['all', 'Confirmada', 'Pendiente', 'En Consulta', 'Completada', 'Cancelada'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    statusFilter === st
                      ? 'bg-[#1A365D] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st === 'all' ? 'Todas' : st}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-semibold">Fecha:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 pt-3 border-t border-slate-100 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Filtrar por Tipo de Sala:
            </span>
            {(['all', 'Quirófano', 'Consultorio', 'Tópico Procedimientos', 'Sala Recuperación'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setRoomTypeFilter(t)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  roomTypeFilter === t
                    ? 'bg-[#1A365D] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t === 'all' ? 'Todas las Salas' : t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* VIEW 1: Appointments List / Cards */}
      {activeView === 'agenda' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAppointments.map((appt) => {
              const isSurgery = appt.type === 'Cirugía Programada';

              return (
                <div
                  key={appt.id}
                  className={`bg-white rounded-2xl border transition-all duration-200 hover:shadow-md p-5 flex flex-col justify-between space-y-4 ${
                    isSurgery
                      ? 'border-rose-300 ring-1 ring-rose-400/20 bg-gradient-to-b from-rose-50/30 to-white'
                      : 'border-slate-200'
                  }`}
                >
                  {/* Top: Time & Status */}
                  <div>
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold font-mono text-[#1A365D] bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                          {appt.time}
                        </span>
                        <span className="text-[11px] text-slate-500 font-semibold">
                          ({appt.durationMin} min)
                        </span>
                      </div>
                      {getStatusBadge(appt.status)}
                    </div>

                    {/* Patient & Details */}
                    <div className="mt-3 space-y-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Paciente
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 leading-tight">
                          {appt.patientName}
                        </h4>
                        <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                          CI: {appt.patientCi} • {appt.patientPhone}
                        </p>
                      </div>

                      <div className="p-2.5 bg-slate-50 rounded-xl space-y-1 text-xs border border-slate-100">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Médico:</span>
                          <strong className="text-slate-800">{appt.doctorName}</strong>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Especialidad:</span>
                          <span className="text-[#2B6CB0] font-semibold">{appt.specialty}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Ubicación / Sala:</span>
                          <strong className="text-slate-700 font-mono">{appt.room}</strong>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Modalidad:</span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              isSurgery ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-800'
                            }`}
                          >
                            {appt.type}
                          </span>
                        </div>
                      </div>

                      {appt.notes && (
                        <p className="text-[11px] text-slate-600 bg-amber-50/70 border border-amber-200/60 p-2 rounded-lg italic">
                          <strong>Indicaciones:</strong> {appt.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Quick Action Footer to change status */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-1 text-xs">
                    <span className="text-[10px] text-slate-400 font-semibold">Cambiar Estado:</span>
                    <div className="flex items-center gap-1">
                      {appt.status !== 'Confirmada' && (
                        <button
                          onClick={() => onUpdateAppointmentStatus(appt.id, 'Confirmada')}
                          className="px-2 py-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer"
                          title="Confirmar asistencia"
                        >
                          Confirmar
                        </button>
                      )}
                      {appt.status !== 'En Consulta' && (
                        <button
                          onClick={() => onUpdateAppointmentStatus(appt.id, 'En Consulta')}
                          className="px-2 py-1 text-[11px] font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md transition-colors cursor-pointer"
                          title="Llamar a consulta"
                        >
                          Atender
                        </button>
                      )}
                      {appt.status !== 'Cancelada' && (
                        <button
                          onClick={() => onUpdateAppointmentStatus(appt.id, 'Cancelada')}
                          className="px-2 py-1 text-[11px] font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-md transition-colors cursor-pointer"
                          title="Cancelar cita"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: Operating Rooms & Boxes Availability Panel */}
      {activeView === 'rooms' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRooms.map((room) => {
            const styles = getRoomStatusColor(room.status);
            const isSurgery = room.type === 'Quirófano';

            return (
              <div
                key={room.id}
                className={`bg-white rounded-2xl border ${styles.border} shadow-xs p-5 space-y-4 relative flex flex-col justify-between`}
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                        {isSurgery ? <Activity className="w-5 h-5 text-rose-600" /> : <BedDouble className="w-5 h-5 text-blue-600" />}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 leading-tight">{room.name}</h4>
                        <span className="text-[10px] font-semibold text-slate-500 uppercase">{room.type}</span>
                      </div>
                    </div>

                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${styles.badge} flex items-center gap-1.5`}>
                      <span className={`w-2 h-2 rounded-full ${styles.indicator}`} />
                      {room.status}
                    </span>
                  </div>

                  {/* Current Active Assignment */}
                  <div className="mt-4 space-y-2">
                    {room.currentPatient ? (
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Paciente Actual:</span>
                          <strong className="text-slate-900">{room.currentPatient}</strong>
                        </div>
                        {room.currentDoctor && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Médico Responsable:</span>
                            <span className="font-semibold text-[#1A365D]">{room.currentDoctor}</span>
                          </div>
                        )}
                        {room.currentProcedure && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Procedimiento:</span>
                            <span className="font-medium text-rose-700">{room.currentProcedure}</span>
                          </div>
                        )}
                        <div className="flex justify-between pt-1 border-t border-slate-200">
                          <span className="text-slate-500">Estimación de Fin:</span>
                          <span className="font-bold text-slate-800 font-mono">{room.endTime}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200 text-xs text-emerald-800">
                        <p className="font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Sala Lista y Desinfectada
                        </p>
                        <p className="text-[11px] text-emerald-700 mt-0.5">{room.endTime}</p>
                      </div>
                    )}

                    {/* Equipment list */}
                    <div className="pt-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Equipamiento y Monitores
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {room.equipment.map((eq, i) => (
                          <span
                            key={i}
                            className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200"
                          >
                            {eq}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Change Room Status Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-1 text-xs">
                  <span className="text-[10px] text-slate-400 font-semibold">Estado de Sala:</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onUpdateRoomStatus(room.id, 'Disponible')}
                      className={`px-2 py-1 text-[10px] font-bold rounded-md transition-colors cursor-pointer ${
                        room.status === 'Disponible'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
                      }`}
                    >
                      Disponible
                    </button>
                    <button
                      onClick={() => onUpdateRoomStatus(room.id, isSurgery ? 'En Cirugía' : 'En Consulta')}
                      className={`px-2 py-1 text-[10px] font-bold rounded-md transition-colors cursor-pointer ${
                        room.status === 'En Cirugía' || room.status === 'En Consulta'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700'
                      }`}
                    >
                      En Uso
                    </button>
                    <button
                      onClick={() => onUpdateRoomStatus(room.id, 'Mantenimiento / Limpieza')}
                      className={`px-2 py-1 text-[10px] font-bold rounded-md transition-colors cursor-pointer ${
                        room.status === 'Mantenimiento / Limpieza'
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-amber-50 hover:text-amber-700'
                      }`}
                    >
                      Limpieza
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Reservar Cita Médica */}
      <Modal
        isOpen={isNewAppointmentModalOpen}
        onClose={() => setIsNewAppointmentModalOpen(false)}
        title="Reservar Cita Médica o Quirófano"
        subtitle="Complete los datos para agendar la atención y enviar confirmación por WhatsApp."
        maxWidth="2xl"
      >
        <form onSubmit={handleCreateAppointment} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Seleccionar Paciente"
              value={formPatientId}
              onChange={(e) => setFormPatientId(e.target.value)}
              options={patients.map((p) => ({
                value: p.id,
                label: `${p.name} (CI: ${p.ci})`,
              }))}
              required
            />

            <Select
              label="Médico Responsable"
              value={formDoctor}
              onChange={(e) => {
                setFormDoctor(e.target.value);
                if (e.target.value.includes('Cardiología')) setFormSpecialty('Cardiología');
                else if (e.target.value.includes('Ginecología')) setFormSpecialty('Ginecología');
                else if (e.target.value.includes('Gastroenterología')) setFormSpecialty('Gastroenterología');
                else setFormSpecialty('Cirugía General');
              }}
              options={doctorOptions}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Fecha de la Cita"
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              required
            />

            <Input
              label="Hora de Inicio"
              type="time"
              value={formTime}
              onChange={(e) => setFormTime(e.target.value)}
              required
            />

            <Select
              label="Duración Estimada"
              value={formDuration}
              onChange={(e) => setFormDuration(e.target.value)}
              options={[
                { value: '15', label: '15 minutos (Control rápido)' },
                { value: '30', label: '30 minutos (Consulta estándar)' },
                { value: '45', label: '45 minutos (Especialidad)' },
                { value: '60', label: '60 minutos (Procedimiento)' },
                { value: '90', label: '90 minutos (Cirugía programada)' },
                { value: '120', label: '120 minutos (Cirugía compleja)' },
              ]}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Tipo de Atención / Procedimiento"
              value={formType}
              onChange={(e) => setFormType(e.target.value as Appointment['type'])}
              options={appointmentTypes.map((t) => ({ value: t, label: t }))}
              required
            />

            <Select
              label="Consultorio o Quirófano Asignado"
              value={formRoom}
              onChange={(e) => setFormRoom(e.target.value)}
              options={rooms.map((r) => ({
                value: r.name,
                label: `${r.name} (${r.status})`,
              }))}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Notas e Instrucciones Previas para el Paciente
            </label>
            <textarea
              rows={2}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Ej. Asistir en ayunas de 8 horas, traer estudios radiográficos previos..."
              className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Se generará y enviará automáticamente el recordatorio y confirmación por <strong>WhatsApp</strong> al paciente.
            </span>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsNewAppointmentModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" icon={Check}>
              Confirmar y Agendar Cita
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
