import React, { useState, useMemo } from 'react';
import {
  Patient,
  ClinicalRecord,
  CIE10Item,
  PrescriptionItem,
  VitalSigns,
} from '../types';
import { Button, Input, Select } from './UIComponents';
import {
  Search,
  User,
  HeartPulse,
  AlertTriangle,
  FilePlus2,
  Calendar,
  Clock,
  Pill,
  Plus,
  Trash2,
  CheckCircle2,
  Stethoscope,
  Printer,
  ChevronRight,
  ShieldAlert,
  Activity,
  Phone,
  FileCheck,
  UserCheck,
} from 'lucide-react';

interface ClinicalHistoryModuleProps {
  patients: Patient[];
  records: ClinicalRecord[];
  cie10List: CIE10Item[];
  selectedPatientId: string;
  setSelectedPatientId: (id: string) => void;
  onSaveRecord: (newRecord: ClinicalRecord) => void;
  onSelectPatientForDocument?: (patient: Patient) => void;
}

export const ClinicalHistoryModule: React.FC<ClinicalHistoryModuleProps> = ({
  patients,
  records,
  cie10List,
  selectedPatientId,
  setSelectedPatientId,
  onSaveRecord,
}) => {
  const [patientSearch, setPatientSearch] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'timeline' | 'form'>('timeline');
  const [cieSearch, setCieSearch] = useState('');
  const [showCieDropdown, setShowCieDropdown] = useState(false);
  const [selectedRecordForPrint, setSelectedRecordForPrint] = useState<ClinicalRecord | null>(null);

  // Form State for "Registrar Atención Médica"
  const [reason, setReason] = useState('');
  const [anamnesis, setAnamnesis] = useState('');
  const [physicalExam, setPhysicalExam] = useState('');
  const [selectedCie, setSelectedCie] = useState<CIE10Item>({
    code: 'I10',
    description: 'Hipertensión esencial (primaria)',
    category: 'Cardiovascular',
  });
  const [treatmentPlan, setTreatmentPlan] = useState('');
  const [requiresFollowUp, setRequiresFollowUp] = useState(true);
  const [followUpDate, setFollowUpDate] = useState('2026-09-24');

  // Vitals State
  const [vitals, setVitals] = useState<VitalSigns>({
    bp: '120/80',
    hr: 75,
    temp: 36.6,
    spo2: 98,
    weight: 70,
    height: 170,
    bmi: 24.2,
  });

  // Dynamic Prescription List
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([
    {
      id: 'rx-initial-1',
      medication: 'Paracetamol 500 mg',
      dosage: '1 comprimido vía oral',
      frequency: 'Cada 8 horas',
      duration: '5 días',
      notes: 'Tomar con abundante agua si hay dolor.',
    },
  ]);

  // Form Prescription Inputs
  const [newMed, setNewMed] = useState({
    medication: '',
    dosage: '',
    frequency: 'Cada 8 horas',
    duration: '5 días',
    notes: '',
  });

  // Calculate BMI whenever weight or height changes
  const calculateBmi = (weightKg: number, heightCm: number) => {
    if (weightKg > 0 && heightCm > 0) {
      const heightM = heightCm / 100;
      const calculated = +(weightKg / (heightM * heightM)).toFixed(1);
      return calculated;
    }
    return 0;
  };

  const handleWeightChange = (w: number) => {
    const newBmi = calculateBmi(w, vitals.height);
    setVitals((prev) => ({ ...prev, weight: w, bmi: newBmi }));
  };

  const handleHeightChange = (h: number) => {
    const newBmi = calculateBmi(vitals.weight, h);
    setVitals((prev) => ({ ...prev, height: h, bmi: newBmi }));
  };

  // Filtered patients list
  const filteredPatients = useMemo(() => {
    const term = patientSearch.toLowerCase().trim();
    if (!term) return patients;
    return patients.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.ci.toLowerCase().includes(term) ||
        p.phone.includes(term)
    );
  }, [patients, patientSearch]);

  const selectedPatient = useMemo(() => {
    return patients.find((p) => p.id === selectedPatientId) || patients[0];
  }, [patients, selectedPatientId]);

  // Filtered clinical records for current patient
  const patientRecords = useMemo(() => {
    if (!selectedPatient) return [];
    return records.filter((r) => r.patientId === selectedPatient.id);
  }, [records, selectedPatient]);

  // Filtered CIE-10 list
  const filteredCieList = useMemo(() => {
    const term = cieSearch.toLowerCase().trim();
    if (!term) return cie10List.slice(0, 8);
    return cie10List.filter(
      (c) =>
        c.code.toLowerCase().includes(term) ||
        c.description.toLowerCase().includes(term) ||
        c.category.toLowerCase().includes(term)
    );
  }, [cie10List, cieSearch]);

  const handleAddPrescription = () => {
    if (!newMed.medication.trim()) return;
    const item: PrescriptionItem = {
      id: `rx-${Date.now()}`,
      medication: newMed.medication,
      dosage: newMed.dosage || '1 unidad',
      frequency: newMed.frequency,
      duration: newMed.duration,
      notes: newMed.notes,
    };
    setPrescriptions((prev) => [...prev, item]);
    setNewMed({
      medication: '',
      dosage: '',
      frequency: 'Cada 8 horas',
      duration: '5 días',
      notes: '',
    });
  };

  const handleRemovePrescription = (id: string) => {
    setPrescriptions((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSubmitRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;

    const newRecord: ClinicalRecord = {
      id: `REC-2026-${Math.floor(100 + Math.random() * 900)}`,
      patientId: selectedPatient.id,
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      doctor: 'Dr. Carlos Mendoza (Cirugía / Med. General)',
      specialty: 'Medicina General y Preventiva',
      reason: reason || 'Consulta médica general / Chequeo sintomático',
      anamnesis: anamnesis || 'Paciente acude a evaluación médica refiriendo síntomas actuales.',
      vitals: { ...vitals },
      physicalExam: physicalExam || 'Examen físico dentro de parámetros evaluables.',
      cie10Code: selectedCie.code,
      cie10Desc: selectedCie.description,
      prescription: [...prescriptions],
      treatmentPlan: treatmentPlan || 'Cumplir régimen prescrito y reposo relativo.',
      requiresFollowUp,
      followUpDate: requiresFollowUp ? followUpDate : undefined,
    };

    onSaveRecord(newRecord);
    // Reset form
    setReason('');
    setAnamnesis('');
    setPhysicalExam('');
    setTreatmentPlan('');
    setActiveSubTab('timeline');
  };

  return (
    <div className="space-y-6">
      {/* Top Patient Selector Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Patient Directory (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col h-[680px]">
          <div className="p-4 border-b border-slate-200 space-y-3 bg-slate-50/50 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-[#2B6CB0]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A365D]">
                  Directorio de Pacientes
                </h3>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                {filteredPatients.length} pacientes
              </span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                placeholder="Buscar por nombre, CI o teléfono..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Patient Cards List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 divide-y divide-slate-100">
            {filteredPatients.map((patient) => {
              const isSelected = selectedPatient?.id === patient.id;
              const hasAllergies = patient.allergies && patient.allergies.length > 0 && patient.allergies[0] !== 'Sin alergias conocidas';

              return (
                <div
                  key={patient.id}
                  id={`patient-card-${patient.id}`}
                  onClick={() => setSelectedPatientId(patient.id)}
                  className={`p-3 rounded-xl cursor-pointer transition-all duration-150 border text-left ${
                    isSelected
                      ? 'bg-blue-50/80 border-blue-300 shadow-xs ring-1 ring-blue-400/30'
                      : 'bg-white hover:bg-slate-50/80 border-slate-200/70'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={patient.photoUrl}
                      alt={patient.name}
                      className="w-10 h-10 rounded-full object-cover shrink-0 border border-slate-200"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className={`text-xs font-bold truncate ${isSelected ? 'text-[#1A365D]' : 'text-slate-800'}`}>
                          {patient.name}
                        </p>
                        <span className="text-[10px] font-bold text-slate-500 px-1.5 py-0.5 bg-slate-100 rounded">
                          {patient.bloodType}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                        <span className="font-mono text-slate-600">CI: {patient.ci}</span>
                        <span>•</span>
                        <span>{patient.age} años</span>
                      </div>

                      {hasAllergies && (
                        <div className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200/60 w-fit">
                          <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                          <span className="truncate max-w-[170px]">{patient.allergies.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Expediente Clínico Dossier & Actions (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Active Patient Dossier Header Banner */}
          {selectedPatient && (
            <div className="bg-gradient-to-r from-[#1A365D] to-[#2B6CB0] rounded-2xl p-6 text-white shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img
                      src={selectedPatient.photoUrl}
                      alt={selectedPatient.name}
                      className="w-16 h-16 rounded-2xl object-cover border-2 border-white/40 shadow-inner"
                    />
                    <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ring-2 ring-[#1A365D]">
                      {selectedPatient.gender === 'M' ? 'Masc' : 'Fem'}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold tracking-tight">{selectedPatient.name}</h3>
                      <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-md font-mono">
                        {selectedPatient.id}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-blue-100 mt-1 flex-wrap">
                      <span>CI: <strong className="text-white font-mono">{selectedPatient.ci}</strong></span>
                      <span>•</span>
                      <span>Edad: <strong className="text-white">{selectedPatient.age} años</strong></span>
                      <span>•</span>
                      <span>Grupo: <strong className="text-emerald-300">{selectedPatient.bloodType}</strong></span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {selectedPatient.phone}
                      </span>
                    </div>
                  </div>
                </div>

                {/* SubTab Switcher Buttons */}
                <div className="flex items-center gap-2 bg-white/10 p-1.5 rounded-xl self-start sm:self-auto">
                  <button
                    id="subtab-timeline"
                    onClick={() => setActiveSubTab('timeline')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      activeSubTab === 'timeline'
                        ? 'bg-white text-[#1A365D] shadow-sm'
                        : 'text-blue-100 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    Línea de Tiempo ({patientRecords.length})
                  </button>
                  <button
                    id="subtab-form"
                    onClick={() => setActiveSubTab('form')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      activeSubTab === 'form'
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'text-blue-100 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Nueva Atención
                  </button>
                </div>
              </div>

              {/* Alert Ribbons & Emergency Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5 pt-4 border-t border-white/15 text-xs">
                {/* Allergies Alert */}
                <div className="bg-rose-950/40 border border-rose-400/40 rounded-xl p-2.5 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-rose-200 tracking-wider block">
                      Alergias Conocidas
                    </span>
                    <span className="font-semibold text-rose-100">
                      {selectedPatient.allergies.join(', ')}
                    </span>
                  </div>
                </div>

                {/* Chronic Conditions */}
                <div className="bg-blue-950/40 border border-blue-400/30 rounded-xl p-2.5 flex items-start gap-2">
                  <Activity className="w-4 h-4 text-blue-300 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-blue-200 tracking-wider block">
                      Condiciones Crónicas
                    </span>
                    <span className="font-semibold text-blue-100">
                      {selectedPatient.chronicConditions.join(', ') || 'Ninguna registrada'}
                    </span>
                  </div>
                </div>

                {/* Insurance & Emergency */}
                <div className="bg-emerald-950/40 border border-emerald-400/30 rounded-xl p-2.5 flex items-start gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-200 tracking-wider block">
                      Cobertura / Seguro
                    </span>
                    <span className="font-semibold text-emerald-100 truncate block">
                      {selectedPatient.insurance}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SubTab 1: Timeline of Consultations (Historial Clínico) */}
          {activeSubTab === 'timeline' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#2B6CB0]" />
                  <h3 className="text-sm font-bold text-[#1A365D]">
                    Línea de Tiempo de Atenciones Médicas Anteriores
                  </h3>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  icon={FilePlus2}
                  onClick={() => setActiveSubTab('form')}
                >
                  Registrar Nueva Consulta
                </Button>
              </div>

              {patientRecords.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
                  <Stethoscope className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">Sin atenciones registradas en el historial</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Presione el botón "Nueva Atención" para abrir la ficha clínica y registrar la consulta del paciente.
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    className="mt-4"
                    onClick={() => setActiveSubTab('form')}
                  >
                    Comenzar Consulta
                  </Button>
                </div>
              ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                  {patientRecords.map((record) => (
                    <div
                      key={record.id}
                      className="relative bg-slate-50/80 hover:bg-slate-50 border border-slate-200 rounded-2xl p-5 transition-all shadow-xs space-y-4"
                    >
                      {/* Timeline Dot */}
                      <div className="absolute -left-6 top-6 w-3 h-3 rounded-full bg-blue-600 ring-4 ring-white border-2 border-blue-300" />

                      {/* Header of the card */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#1A365D] font-mono">
                              {record.date}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-[#1A365D] rounded-full">
                              {record.specialty}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-slate-600 mt-0.5">{record.doctor}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedRecordForPrint(record)}
                            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-100/80 hover:bg-blue-200 rounded-lg transition-colors cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Ver Receta Digital
                          </button>
                        </div>
                      </div>

                      {/* Motivo & Diagnóstico */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Motivo de Consulta & Anamnesis
                          </span>
                          <p className="font-semibold text-slate-800">{record.reason}</p>
                          <p className="text-slate-600 text-[11px] leading-relaxed">{record.anamnesis}</p>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Diagnóstico Principal (CIE-10)
                          </span>
                          <div className="flex items-start gap-2 bg-white p-2.5 rounded-xl border border-slate-200">
                            <span className="text-xs font-mono font-bold bg-[#1A365D] text-white px-2 py-0.5 rounded">
                              {record.cie10Code}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800">{record.cie10Desc}</p>
                              <p className="text-[10px] text-slate-500">Clasificación Internacional CIE-10</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Vital Signs Row */}
                      <div className="bg-white p-3 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 text-center text-xs">
                        <div className="p-1">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">P. Arterial</span>
                          <span className="font-bold text-slate-800">{record.vitals.bp} <span className="text-[9px] text-slate-400">mmHg</span></span>
                        </div>
                        <div className="p-1">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Frec. Card.</span>
                          <span className="font-bold text-slate-800">{record.vitals.hr} <span className="text-[9px] text-slate-400">bpm</span></span>
                        </div>
                        <div className="p-1">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Temp</span>
                          <span className="font-bold text-slate-800">{record.vitals.temp} <span className="text-[9px] text-slate-400">°C</span></span>
                        </div>
                        <div className="p-1">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">SpO2</span>
                          <span className="font-bold text-emerald-600">{record.vitals.spo2} <span className="text-[9px] text-slate-400">%</span></span>
                        </div>
                        <div className="p-1">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Peso</span>
                          <span className="font-bold text-slate-800">{record.vitals.weight} <span className="text-[9px] text-slate-400">kg</span></span>
                        </div>
                        <div className="p-1">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Talla</span>
                          <span className="font-bold text-slate-800">{record.vitals.height} <span className="text-[9px] text-slate-400">cm</span></span>
                        </div>
                        <div className="p-1">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">IMC</span>
                          <span className="font-bold text-blue-600">{record.vitals.bmi}</span>
                        </div>
                      </div>

                      {/* Prescriptions Pill Group */}
                      {record.prescription && record.prescription.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <Pill className="w-3.5 h-3.5 text-blue-600" />
                            Prescripción y Esquema Farmacológico
                          </span>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {record.prescription.map((rx) => (
                              <div
                                key={rx.id}
                                className="bg-blue-50/50 border border-blue-200/70 p-2.5 rounded-xl text-xs space-y-0.5"
                              >
                                <p className="font-bold text-[#1A365D]">{rx.medication}</p>
                                <p className="text-[11px] text-slate-600">
                                  {rx.dosage} • {rx.frequency} ({rx.duration})
                                </p>
                                {rx.notes && (
                                  <p className="text-[10px] text-slate-500 italic">Nota: {rx.notes}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Treatment Plan */}
                      {record.treatmentPlan && (
                        <div className="bg-slate-100/80 p-3 rounded-xl text-xs text-slate-700">
                          <strong className="text-slate-800">Plan e Indicaciones:</strong> {record.treatmentPlan}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SubTab 2: Formulario "Registrar Atención Médica" */}
          {activeSubTab === 'form' && (
            <form onSubmit={handleSubmitRecord} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div>
                  <h3 className="text-base font-bold text-[#1A365D]">
                    Formulario de Registro de Atención Médica
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Paciente: <strong>{selectedPatient?.name}</strong> (CI: {selectedPatient?.ci})
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveSubTab('timeline')}
                >
                  Cancelar
                </Button>
              </div>

              {/* 1. Motivo de Consulta & Anamnesis */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#1A365D] flex items-center gap-1.5">
                  <Stethoscope className="w-4 h-4 text-[#2B6CB0]" />
                  1. Motivo de Consulta y Anamnesis
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Motivo Principal de la Consulta"
                    placeholder="Ej. Cefalea intensa, dolor epigástrico..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                  />
                  <Input
                    label="Especialidad / Servicio"
                    value="Cirugía General / Medicina Interna"
                    disabled
                    className="bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Anamnesis y Evolución del Cuadro Clínico *
                  </label>
                  <textarea
                    rows={3}
                    value={anamnesis}
                    onChange={(e) => setAnamnesis(e.target.value)}
                    placeholder="Detalle cronológico de los síntomas, inicio, intensidad, factores agravantes o atenuantes..."
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              {/* 2. Signos Vitales y Examen Físico */}
              <div className="space-y-4 pt-4 border-t border-slate-200">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#1A365D] flex items-center gap-1.5">
                  <HeartPulse className="w-4 h-4 text-rose-500" />
                  2. Signos Vitales y Somatometría
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  <Input
                    label="P. Arterial (mmHg)"
                    value={vitals.bp}
                    onChange={(e) => setVitals({ ...vitals, bp: e.target.value })}
                    placeholder="120/80"
                    required
                  />
                  <Input
                    label="Frec. Cardíaca (bpm)"
                    type="number"
                    value={vitals.hr}
                    onChange={(e) => setVitals({ ...vitals, hr: +e.target.value })}
                    required
                  />
                  <Input
                    label="Temperatura (°C)"
                    type="number"
                    step="0.1"
                    value={vitals.temp}
                    onChange={(e) => setVitals({ ...vitals, temp: +e.target.value })}
                    required
                  />
                  <Input
                    label="Saturación SpO2 (%)"
                    type="number"
                    value={vitals.spo2}
                    onChange={(e) => setVitals({ ...vitals, spo2: +e.target.value })}
                    required
                  />
                  <Input
                    label="Peso (kg)"
                    type="number"
                    step="0.5"
                    value={vitals.weight}
                    onChange={(e) => handleWeightChange(+e.target.value)}
                    required
                  />
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">IMC (kg/m²)</label>
                    <div className="py-2 px-3 bg-blue-50 border border-blue-200 rounded-xl text-xs font-bold text-blue-700">
                      {vitals.bmi} ({vitals.bmi < 25 ? 'Normal' : vitals.bmi < 30 ? 'Sobrepeso' : 'Obesidad'})
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Examen Físico Segmentario
                  </label>
                  <textarea
                    rows={2}
                    value={physicalExam}
                    onChange={(e) => setPhysicalExam(e.target.value)}
                    placeholder="Cabeza y cuello, tórax, campos pulmonares, abdomen, extremidades..."
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* 3. Buscador CIE-10 de Diagnóstico */}
              <div className="space-y-3 pt-4 border-t border-slate-200">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#1A365D] flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-blue-600" />
                  3. Diagnóstico Médico CIE-10
                </h4>

                <div className="relative">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Buscador de Diagnósticos CIE-10 (Código o Descripción) *
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={cieSearch}
                      onFocus={() => setShowCieDropdown(true)}
                      onChange={(e) => {
                        setCieSearch(e.target.value);
                        setShowCieDropdown(true);
                      }}
                      placeholder="Escriba código (ej: I10, E11, K80) o nombre de patología..."
                      className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  {/* Dropdown for CIE-10 */}
                  {showCieDropdown && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100">
                      {filteredCieList.map((cie) => (
                        <div
                          key={cie.code}
                          onClick={() => {
                            setSelectedCie(cie);
                            setCieSearch(`${cie.code} - ${cie.description}`);
                            setShowCieDropdown(false);
                          }}
                          className="p-2.5 hover:bg-blue-50 cursor-pointer flex items-center justify-between text-xs transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-white bg-[#1A365D] px-2 py-0.5 rounded text-[11px]">
                              {cie.code}
                            </span>
                            <span className="font-semibold text-slate-800">{cie.description}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            {cie.category}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Selected CIE indicator */}
                  <div className="mt-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="text-xs text-slate-700">
                        Diagnóstico seleccionado: <strong className="font-mono text-emerald-900">[{selectedCie.code}]</strong> {selectedCie.description}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold uppercase text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      CIE-10 Oficial
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. Constructor Dinámico de Prescripción Médica */}
              <div className="space-y-4 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#1A365D] flex items-center gap-1.5">
                    <Pill className="w-4 h-4 text-blue-600" />
                    4. Prescripción Médica y Receta Digital
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    {prescriptions.length} medicamento(s) indicado(s)
                  </span>
                </div>

                {/* Prescriptions Added Table */}
                {prescriptions.length > 0 && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                    {prescriptions.map((p) => (
                      <div key={p.id} className="p-3 bg-slate-50/60 flex items-center justify-between gap-3 text-xs">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[#1A365D]">{p.medication}</p>
                          <p className="text-slate-600 text-[11px]">
                            {p.dosage} • {p.frequency} • Durante {p.duration}
                          </p>
                          {p.notes && <p className="text-[10px] text-slate-400">Nota: {p.notes}</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemovePrescription(p.id)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Eliminar de la receta"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick Add Medicine Bar */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <p className="text-[11px] font-bold text-slate-600 uppercase">Añadir Medicamento a la Receta</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <Input
                      placeholder="Medicamento (ej: Amoxicilina 500mg)"
                      value={newMed.medication}
                      onChange={(e) => setNewMed({ ...newMed, medication: e.target.value })}
                    />
                    <Input
                      placeholder="Dosis (ej: 1 comprimido)"
                      value={newMed.dosage}
                      onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })}
                    />
                    <Input
                      placeholder="Frecuencia (ej: Cada 8 horas)"
                      value={newMed.frequency}
                      onChange={(e) => setNewMed({ ...newMed, frequency: e.target.value })}
                    />
                    <Input
                      placeholder="Duración (ej: 7 días)"
                      value={newMed.duration}
                      onChange={(e) => setNewMed({ ...newMed, duration: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <input
                      type="text"
                      placeholder="Indicación complementaria (ej: Tomar después de alimentos)..."
                      value={newMed.notes}
                      onChange={(e) => setNewMed({ ...newMed, notes: e.target.value })}
                      className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon={Plus}
                      onClick={handleAddPrescription}
                    >
                      Añadir Fármaco
                    </Button>
                  </div>
                </div>
              </div>

              {/* 5. Plan de Tratamiento y Control */}
              <div className="space-y-4 pt-4 border-t border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Plan Terapéutico y Recomendaciones No Farmacológicas
                  </label>
                  <textarea
                    rows={2}
                    value={treatmentPlan}
                    onChange={(e) => setTreatmentPlan(e.target.value)}
                    placeholder="Dieta, reposo, signos de alarma para acudir a emergencias..."
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requiresFollowUp}
                      onChange={(e) => setRequiresFollowUp(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    Programar Cita de Control / Seguimiento
                  </label>

                  {requiresFollowUp && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Fecha sugerida:</span>
                      <input
                        type="date"
                        value={followUpDate}
                        onChange={(e) => setFollowUpDate(e.target.value)}
                        className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveSubTab('timeline')}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="success"
                  icon={CheckCircle2}
                  size="lg"
                >
                  Guardar Atención en Expediente
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Receta Digital Modal Preview */}
      {selectedRecordForPrint && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Prescription Header */}
            <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#1A365D] text-white flex items-center justify-center font-bold text-sm">
                  Rx
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#1A365D]">MedicalSys • Receta Médica Digital</h4>
                  <p className="text-[11px] text-slate-500">Firma Electrónica Médica Certificada</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRecordForPrint(null)}
                className="text-slate-400 hover:text-slate-700 p-1 text-xs"
              >
                ✕
              </button>
            </div>

            {/* Patient & Doctor Meta */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Paciente:</span>
                <strong className="text-slate-800">{selectedPatient?.name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Documento CI:</span>
                <span className="font-mono text-slate-700">{selectedPatient?.ci}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Fecha de Emisión:</span>
                <span className="text-slate-700">{selectedRecordForPrint.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Diagnóstico CIE-10:</span>
                <span className="font-semibold text-[#1A365D]">
                  [{selectedRecordForPrint.cie10Code}] {selectedRecordForPrint.cie10Desc}
                </span>
              </div>
            </div>

            {/* Meds List */}
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
                Indicaciones Farmacológicas (Rp.)
              </span>
              <div className="space-y-2">
                {selectedRecordForPrint.prescription.map((rx, idx) => (
                  <div key={rx.id} className="p-3 bg-blue-50/50 border border-blue-200 rounded-xl text-xs space-y-1">
                    <p className="font-bold text-[#1A365D]">{idx + 1}. {rx.medication}</p>
                    <p className="text-slate-700 font-medium">{rx.dosage} • {rx.frequency} ({rx.duration})</p>
                    {rx.notes && <p className="text-[11px] text-slate-500 italic">{rx.notes}</p>}
                  </div>
                ))}
              </div>
            </div>

            {/* Digital Stamp */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-slate-800">{selectedRecordForPrint.doctor}</p>
                <p className="text-[10px] text-slate-500">Mat. Profesional Med. #7492-LP</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-emerald-700 bg-emerald-100 font-mono px-2 py-0.5 rounded border border-emerald-300">
                  FIRMA DIGITAL VALIDADASHA256
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedRecordForPrint(null)}>
                Cerrar
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={Printer}
                onClick={() => {
                  window.print();
                }}
              >
                Imprimir Receta
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
