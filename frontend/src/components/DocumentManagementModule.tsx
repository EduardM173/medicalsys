import React, { useState, useRef, useEffect, useMemo } from 'react';
import { DocumentItem, ConsentForm, Patient } from '../types';
import { Button, Input, Select, Modal } from './UIComponents';
import {
  FileText,
  Upload,
  Search,
  Filter,
  CheckCircle2,
  FileCheck2,
  PenTool,
  RotateCcw,
  ShieldCheck,
  Eye,
  Download,
  Printer,
  Trash2,
  Plus,
  Lock,
  AlertCircle,
  FileSpreadsheet,
  Calendar,
} from 'lucide-react';

interface DocumentManagementModuleProps {
  documents: DocumentItem[];
  consentForm: ConsentForm;
  patients: Patient[];
  onUploadDocument: (doc: DocumentItem) => void;
  onSignConsent: (signedConsent: ConsentForm) => void;
}

export const DocumentManagementModule: React.FC<DocumentManagementModuleProps> = ({
  documents,
  consentForm,
  patients,
  onUploadDocument,
  onSignConsent,
}) => {
  const [activeTab, setActiveTab] = useState<'documents' | 'consent'>('consent');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchDoc, setSearchDoc] = useState('');
  const [selectedDocPreview, setSelectedDocPreview] = useState<DocumentItem | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Digital Signature Canvas Refs & State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [currentConsent, setCurrentConsent] = useState<ConsentForm>(consentForm);

  // Upload Form State
  const [uploadPatientId, setUploadPatientId] = useState(patients[0]?.id || '');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState<DocumentItem['category']>('Laboratorio');
  const [uploadDoctor, setUploadDoctor] = useState('Dr. Carlos Mendoza');
  const [uploadFileSize, setUploadFileSize] = useState('1.2 MB');
  const [uploadFileType, setUploadFileType] = useState('PDF');

  // Filtered documents
  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      const matchCat = categoryFilter === 'all' || doc.category === categoryFilter;
      const term = searchDoc.toLowerCase().trim();
      const matchSearch =
        !term ||
        doc.title.toLowerCase().includes(term) ||
        doc.patientName.toLowerCase().includes(term) ||
        doc.patientCi.toLowerCase().includes(term);
      return matchCat && matchSearch;
    });
  }, [documents, categoryFilter, searchDoc]);

  // Handle Canvas Drawing for Digital Signature
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#0F2343';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [activeTab]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSignature(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleConfirmSignature = () => {
    const canvas = canvasRef.current;
    let dataUrl = '';
    if (canvas) {
      dataUrl = canvas.toDataURL('image/png');
    }

    const updated: ConsentForm = {
      ...currentConsent,
      status: 'Firmado Electrónicamente',
      signedDate: new Date().toISOString().replace('T', ' ').substring(0, 16),
      signatureDataUrl: dataUrl,
      hash: `SHA256-MEDSYS-${Math.random().toString(36).substring(2, 12).toUpperCase()}${Date.now()}`,
    };

    setCurrentConsent(updated);
    onSignConsent(updated);
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = patients.find((pat) => pat.id === uploadPatientId) || patients[0];

    const newDoc: DocumentItem = {
      id: `DOC-${Math.floor(600 + Math.random() * 400)}`,
      patientId: p.id,
      patientName: p.name,
      patientCi: p.ci,
      title: uploadTitle || 'Estudio Médico Complementario',
      category: uploadCategory,
      date: new Date().toISOString().substring(0, 10),
      doctor: uploadDoctor,
      fileType: uploadFileType,
      fileSize: uploadFileSize,
      isSigned: true,
      signatureHash: `SHA256: ${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`,
    };

    onUploadDocument(newDoc);
    setIsUploadModalOpen(false);
    setUploadTitle('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Tab Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl self-start">
            <button
              id="tab-consent-module"
              onClick={() => setActiveTab('consent')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'consent'
                  ? 'bg-white text-[#1A365D] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PenTool className="w-4 h-4 text-emerald-600" />
              <span>Consentimiento Informado & Firma Digital</span>
            </button>
            <button
              id="tab-documents-table"
              onClick={() => setActiveTab('documents')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'documents'
                  ? 'bg-white text-[#1A365D] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4 text-[#2B6CB0]" />
              <span>Archivo de Exámenes Clínicos ({documents.length})</span>
            </button>
          </div>

          <Button
            id="btn-subir-documento-modal"
            variant="primary"
            icon={Upload}
            onClick={() => setIsUploadModalOpen(true)}
          >
            Subir Nuevo Examen / Documento
          </Button>
        </div>
      </div>

      {/* TAB 1: Consentimiento Informado & Firma Digital */}
      {activeTab === 'consent' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Legal / Medical Document Preview (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                  Documento Médico Legal
                </span>
                <h3 className="text-base font-extrabold text-[#1A365D] mt-1">
                  Consentimiento Informado para Procedimiento Quirúrgico
                </h3>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-bold text-slate-500">Folio: {currentConsent.id}</span>
              </div>
            </div>

            {/* Patient & Procedure Meta */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Paciente Otorgante:</span>
                  <strong className="text-slate-800 text-sm">{currentConsent.patientName}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Documento de Identidad:</span>
                  <strong className="font-mono text-slate-800">{currentConsent.patientCi}</strong>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200/80">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Procedimiento Programado:</span>
                  <span className="font-bold text-[#1A365D]">{currentConsent.procedureName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Servicio / Especialidad:</span>
                  <span className="font-medium text-slate-700">{currentConsent.department}</span>
                </div>
              </div>
            </div>

            {/* Document Text & Clauses */}
            <div className="space-y-3 text-xs text-slate-700 leading-relaxed bg-slate-50/50 p-4 rounded-xl border border-slate-200">
              <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">
                Declaración y Cláusulas Informativas
              </h4>
              <p>
                Yo, <strong>{currentConsent.patientName}</strong>, con CI <strong>{currentConsent.patientCi}</strong>, en pleno uso de mis facultades mentales, declaro que el <strong>{currentConsent.doctorName}</strong> me ha explicado detalladamente la naturaleza, objetivos, beneficios esperados, riesgos previsibles y alternativas terapéuticas del procedimiento quirúrgico <strong>"{currentConsent.procedureName}"</strong>.
              </p>
              <div className="p-3 bg-amber-50/80 border border-amber-200/70 rounded-lg text-amber-900 space-y-1 text-[11px]">
                <strong className="block font-bold">Riesgos y Complicaciones Advertidas:</strong>
                <p>{currentConsent.risksText}</p>
              </div>
              <p className="text-[11px] text-slate-600">
                Asimismo, autorizo al equipo quirúrgico a realizar cualquier intervención de urgencia imprevista que sea necesaria para preservar mi vida o integridad física durante el acto anestésico-quirúrgico.
              </p>
            </div>

            {/* Medical Signer info */}
            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 text-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] text-blue-600 uppercase font-bold block">Médico Tratante / Cirujano</span>
                <span className="font-bold text-[#1A365D]">{currentConsent.doctorName}</span>
              </div>
              <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-mono font-semibold">
                Matrícula Vigente
              </span>
            </div>
          </div>

          {/* Right Column: Interactive Digital Signature Box (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Signature Pad Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <PenTool className="w-4 h-4 text-[#2B6CB0]" />
                  <h3 className="text-sm font-bold text-[#1A365D]">
                    Recuadro de Firma Digital del Paciente
                  </h3>
                </div>
                <span className="text-[10px] text-slate-500 font-semibold">
                  Táctil o Cursor
                </span>
              </div>

              <p className="text-xs text-slate-500">
                Por favor, solicite al paciente o tutor legal realizar su firma en el siguiente recuadro:
              </p>

              {/* Canvas Pad */}
              <div className="relative border-2 border-dashed border-blue-300 rounded-2xl bg-slate-50/50 p-2 overflow-hidden shadow-inner">
                <canvas
                  ref={canvasRef}
                  width={380}
                  height={180}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-[180px] bg-white rounded-xl touch-none cursor-crosshair"
                />

                {!hasSignature && !currentConsent.signatureDataUrl && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-400">
                    <PenTool className="w-8 h-8 stroke-1 text-slate-300 mb-1" />
                    <span className="text-xs font-semibold">Dibuje su firma aquí</span>
                  </div>
                )}
              </div>

              {/* Pad Action Controls */}
              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  icon={RotateCcw}
                  onClick={clearSignature}
                >
                  Limpiar Firma
                </Button>

                <Button
                  type="button"
                  variant="success"
                  size="sm"
                  icon={ShieldCheck}
                  disabled={!hasSignature}
                  onClick={handleConfirmSignature}
                >
                  Confirmar y Firmar Documento
                </Button>
              </div>

              {/* Signature Status Certificate */}
              {currentConsent.status === 'Firmado Electrónicamente' && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-emerald-900">
                        Consentimiento Firmado y Validado
                      </h4>
                      <p className="text-[11px] text-emerald-700">
                        Fecha y Hora: {currentConsent.signedDate}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-emerald-200/80">
                    <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                      Huella Criptográfica SHA-256:
                    </span>
                    <p className="text-[10px] font-mono text-emerald-900 break-all bg-emerald-100/70 p-1.5 rounded mt-0.5">
                      {currentConsent.hash}
                    </p>
                  </div>

                  <div className="pt-1 flex gap-2 justify-end">
                    <button
                      onClick={() => window.print()}
                      className="text-xs font-semibold text-emerald-800 bg-white hover:bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Imprimir Certificado
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Security Notice Card */}
            <div className="bg-slate-100/80 rounded-2xl p-4 border border-slate-200 text-xs text-slate-600 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-[#1A365D]">
                <Lock className="w-4 h-4 text-emerald-600" />
                <span>Validez Jurídica de la Firma Digital</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Este consentimiento cumple con los estándares de firma digital médica. El documento queda inmutable y almacenado en el expediente clínico digital del paciente.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Archivo de Documentos y Exámenes Clínicos */}
      {activeTab === 'documents' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Table Filters Toolbar */}
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-500">Categoría:</span>
              {(['all', 'Laboratorio', 'Radiología', 'Consentimiento', 'Ecografía', 'Informe Quirúrgico'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    categoryFilter === cat
                      ? 'bg-[#1A365D] text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {cat === 'all' ? 'Todos' : cat}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchDoc}
                onChange={(e) => setSearchDoc(e.target.value)}
                placeholder="Buscar por documento o paciente..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/75 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Documento / Título</th>
                  <th className="py-3 px-4">Paciente & CI</th>
                  <th className="py-3 px-4">Categoría</th>
                  <th className="py-3 px-4">Médico / Especialista</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Firma Digital</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-[#1A365D]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#2B6CB0] flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 leading-tight">{doc.title}</p>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {doc.fileType} • {doc.fileSize}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-800">{doc.patientName}</p>
                      <p className="text-[10px] text-slate-500 font-mono">CI: {doc.patientCi}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md border border-slate-200">
                        {doc.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium">
                      {doc.doctor}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500">
                      {doc.date}
                    </td>
                    <td className="py-3.5 px-4">
                      {doc.isSigned ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          Certificado
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Pendiente
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedDocPreview(doc)}
                          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Visualizar documento"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            window.print();
                          }}
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Descargar / Imprimir"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Subir Nuevo Examen o Documento */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Subir Examen Clínico o Documento Digital"
        subtitle="Cargue resultados de laboratorio, ecografías, radiografías o informes médicos."
        maxWidth="xl"
      >
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          <Select
            label="Paciente Titular"
            value={uploadPatientId}
            onChange={(e) => setUploadPatientId(e.target.value)}
            options={patients.map((p) => ({
              value: p.id,
              label: `${p.name} (CI: ${p.ci})`,
            }))}
            required
          />

          <Input
            label="Título / Nombre del Examen"
            placeholder="Ej. Ecografía Doppler Renal, Perfil Hepático..."
            value={uploadTitle}
            onChange={(e) => setUploadTitle(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Categoría"
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value as DocumentItem['category'])}
              options={[
                { value: 'Laboratorio', label: 'Laboratorio Clínico' },
                { value: 'Radiología', label: 'Radiología / Rayos X' },
                { value: 'Ecografía', label: 'Ecografía / Ultrasonido' },
                { value: 'Consentimiento', label: 'Consentimiento Informado' },
                { value: 'Informe Quirúrgico', label: 'Informe Quirúrgico' },
                { value: 'Epicrisis', label: 'Epicrisis / Alta Hospitalaria' },
              ]}
              required
            />

            <Input
              label="Médico o Bioquímico Responsable"
              value={uploadDoctor}
              onChange={(e) => setUploadDoctor(e.target.value)}
              required
            />
          </div>

          {/* Drag & Drop Simulation Box */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Archivo Digital (PDF, DICOM, JPG, PNG) *
            </label>
            <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-6 text-center bg-slate-50 hover:bg-blue-50/40 transition-colors cursor-pointer space-y-2">
              <Upload className="w-8 h-8 text-[#2B6CB0] mx-auto" />
              <div>
                <p className="text-xs font-bold text-slate-700">Haga clic o arrastre su archivo aquí</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Soporta PDF, DICOM, JPG hasta 25 MB</p>
              </div>
              <span className="inline-block text-[10px] font-semibold bg-white border border-slate-200 text-slate-600 px-2.5 py-1 rounded-lg">
                Seleccionar Archivo Local
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsUploadModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" icon={Upload}>
              Subir y Adjuntar a Expediente
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Document Preview */}
      {selectedDocPreview && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedDocPreview(null)}
          title={`Vista Previa: ${selectedDocPreview.title}`}
          subtitle={`Paciente: ${selectedDocPreview.patientName} • Fecha: ${selectedDocPreview.date}`}
          maxWidth="2xl"
        >
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-slate-800">{selectedDocPreview.doctor}</p>
                <p className="text-slate-500 font-mono">Firma Hash: {selectedDocPreview.signatureHash}</p>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                Documento Autenticado
              </span>
            </div>

            {selectedDocPreview.previewUrl ? (
              <img
                src={selectedDocPreview.previewUrl}
                alt="Documento médico"
                className="w-full h-80 object-cover rounded-xl border border-slate-200 shadow-inner"
              />
            ) : (
              <div className="h-64 bg-slate-100 rounded-xl flex flex-col items-center justify-center text-slate-400 border border-slate-200">
                <FileSpreadsheet className="w-12 h-12 text-slate-400 mb-2" />
                <p className="text-xs font-bold text-slate-700">{selectedDocPreview.title}</p>
                <p className="text-[11px] text-slate-500">Documento electrónico tipo {selectedDocPreview.fileType}</p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setSelectedDocPreview(null)}>
                Cerrar
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={Printer}
                onClick={() => window.print()}
              >
                Imprimir Documento
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
