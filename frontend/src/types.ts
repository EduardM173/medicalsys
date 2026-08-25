export type TabType = 'historial' | 'agenda' | 'documentos' | 'facturacion' | 'fidelizacion';

export interface Patient {
  id: string;
  name: string;
  ci: string;
  age: number;
  gender: 'M' | 'F';
  birthDate: string;
  bloodType: string;
  allergies: string[];
  chronicConditions: string[];
  phone: string;
  email: string;
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  insurance: string;
  lastVisit: string;
  photoUrl: string;
}

export interface VitalSigns {
  bp: string; // e.g. "120/80"
  hr: number; // e.g. 74 bpm
  temp: number; // e.g. 36.6 °C
  spo2: number; // e.g. 98%
  weight: number; // e.g. 72 kg
  height: number; // e.g. 175 cm
  bmi: number; // e.g. 23.5
}

export interface PrescriptionItem {
  id: string;
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes?: string;
}

export interface ClinicalRecord {
  id: string;
  patientId: string;
  date: string;
  doctor: string;
  specialty: string;
  reason: string;
  anamnesis: string;
  vitals: VitalSigns;
  physicalExam: string;
  cie10Code: string;
  cie10Desc: string;
  prescription: PrescriptionItem[];
  treatmentPlan: string;
  requiresFollowUp: boolean;
  followUpDate?: string;
}

export type AppointmentStatus = 'Confirmada' | 'Pendiente' | 'En Consulta' | 'Cancelada' | 'Completada';

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  patientCi: string;
  patientPhone: string;
  doctorName: string;
  specialty: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  durationMin: number;
  type: 'Consulta General' | 'Especialidad' | 'Control Post-Operatorio' | 'Cirugía Programada' | 'Procedimiento Menor';
  room: string;
  status: AppointmentStatus;
  notes?: string;
}

export type RoomStatus = 'Disponible' | 'En Cirugía' | 'En Consulta' | 'Mantenimiento / Limpieza';

export interface MedicalRoom {
  id: string;
  name: string;
  type: 'Quirófano' | 'Consultorio' | 'Sala Recuperación' | 'Tópico Procedimientos';
  status: RoomStatus;
  currentPatient?: string;
  currentDoctor?: string;
  currentProcedure?: string;
  endTime?: string;
  equipment: string[];
}

export interface DocumentItem {
  id: string;
  patientId: string;
  patientName: string;
  patientCi: string;
  title: string;
  category: 'Laboratorio' | 'Radiología' | 'Consentimiento' | 'Informe Quirúrgico' | 'Ecografía' | 'Epicrisis';
  date: string;
  doctor: string;
  fileType: string;
  fileSize: string;
  isSigned?: boolean;
  signatureHash?: string;
  previewUrl?: string;
}

export interface ConsentForm {
  id: string;
  patientId: string;
  patientName: string;
  patientCi: string;
  procedureName: string;
  department: string;
  risksText: string;
  doctorName: string;
  signedDate?: string;
  signatureDataUrl?: string;
  status: 'Pendiente de Firma' | 'Firmado Electrónicamente';
  hash?: string;
}

export interface InvoiceItem {
  id: string;
  code: string;
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface InvoiceSIN {
  id: string;
  invoiceNumber: string;
  authorizationNumber: string;
  cuf: string;
  nitEmisor: string;
  razonSocialEmisor: string;
  nitCiCliente: string;
  complemento?: string;
  razonSocialCliente: string;
  emailCliente?: string;
  fechaEmision: string;
  paymentMethod: 'Efectivo' | 'Tarjeta de Débito/Crédito' | 'QR Simple' | 'Transferencia Bancaria';
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  total: number;
  qrData: string;
  status: 'Válida' | 'Anulada';
  cashier: string;
}

export interface WhatsAppNotification {
  id: string;
  patientName: string;
  phone: string;
  type: 'Confirmación de Cita' | 'Recordatorio 24h' | 'Receta Digital' | 'Resultados Listos' | 'Campaña Preventiva';
  message: string;
  timestamp: string;
  status: 'Enviado' | 'Entregado' | 'Leído' | 'Respondido';
}

export interface HealthCampaign {
  id: string;
  name: string;
  targetAudience: string;
  recipientCount: number;
  messageTemplate: string;
  discountOrBenefit: string;
  sentDate: string;
  status: 'Enviada' | 'Programada' | 'Borrador';
  readRate: string;
  bookedCount: number;
}

export interface CIE10Item {
  code: string;
  description: string;
  category: string;
}
