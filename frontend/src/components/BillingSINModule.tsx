import React, { useState, useMemo } from 'react';
import { InvoiceSIN, InvoiceItem, Patient } from '../types';
import { Button, Input, Select, Modal } from './UIComponents';
import {
  Receipt,
  QrCode,
  CheckCircle2,
  Printer,
  FileCheck,
  Plus,
  Trash2,
  Search,
  Building,
  CreditCard,
  Banknote,
  Send,
  Download,
  AlertCircle,
  HelpCircle,
  Copy,
  Check,
} from 'lucide-react';

interface BillingSINModuleProps {
  invoices: InvoiceSIN[];
  patients: Patient[];
  onEmitInvoice: (invoice: InvoiceSIN) => void;
}

export const BillingSINModule: React.FC<BillingSINModuleProps> = ({
  invoices,
  patients,
  onEmitInvoice,
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  const [selectedInvoicePreview, setSelectedInvoicePreview] = useState<InvoiceSIN | null>(null);
  const [copiedCuf, setCopiedCuf] = useState(false);

  // Quick Services Catalog
  const medicalServicesCatalog = [
    { code: 'MED-SER-01', description: 'Consulta Médica con Especialista (Cirugía / Med. Interna)', price: 250 },
    { code: 'MED-SER-02', description: 'Consulta Médica General / Control Rutinario', price: 150 },
    { code: 'MED-LAB-04', description: 'Electrocardiograma Digital con Informe Médico', price: 120 },
    { code: 'MED-IMG-02', description: 'Radiografía Digital de Tórax (2 Incidencias PA y Lat)', price: 180 },
    { code: 'MED-IMG-05', description: 'Ecografía Abdominal y Pélvica de Alta Resolución', price: 280 },
    { code: 'MED-QUI-01', description: 'Derecho de Uso de Quirófano y Sala de Recuperación (Hora)', price: 850 },
    { code: 'MED-PRO-03', description: 'Curación Quirúrgica y Retiro de Puntos', price: 90 },
  ];

  // Form State
  const [selectedPatientId, setSelectedPatientId] = useState(patients[0]?.id || '');
  const [razonSocial, setRazonSocial] = useState(patients[0]?.name || '');
  const [nitCi, setNitCi] = useState(patients[0]?.ci.replace(/[^\d]/g, '') || '');
  const [complemento, setComplemento] = useState('LP');
  const [emailCliente, setEmailCliente] = useState(patients[0]?.email || '');
  const [paymentMethod, setPaymentMethod] = useState<InvoiceSIN['paymentMethod']>('QR Simple');

  // Dynamic Items in Invoice
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([
    {
      id: 'inv-item-1',
      code: 'MED-SER-01',
      description: 'Consulta Médica con Especialista (Cirugía / Med. Interna)',
      quantity: 1,
      unitPrice: 250,
      subtotal: 250,
    },
  ]);

  // Form New Item Inputs
  const [newItemCode, setNewItemCode] = useState(medicalServicesCatalog[0].code);
  const [newItemDesc, setNewItemDesc] = useState(medicalServicesCatalog[0].description);
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemPrice, setNewItemPrice] = useState(medicalServicesCatalog[0].price);
  const [discountAmount, setDiscountAmount] = useState(0);

  // Sync patient data on dropdown change
  const handlePatientSelectChange = (patId: string) => {
    setSelectedPatientId(patId);
    const pat = patients.find((p) => p.id === patId);
    if (pat) {
      setRazonSocial(pat.name);
      // Extract numeric part from CI
      const cleanCi = pat.ci.replace(/[^\d]/g, '');
      const comp = pat.ci.includes(' ') ? pat.ci.split(' ')[1] : '';
      setNitCi(cleanCi);
      setComplemento(comp || 'LP');
      setEmailCliente(pat.email);
    }
  };

  const handleCatalogSelect = (code: string) => {
    setNewItemCode(code);
    const s = medicalServicesCatalog.find((c) => c.code === code);
    if (s) {
      setNewItemDesc(s.description);
      setNewItemPrice(s.price);
    }
  };

  const handleAddItem = () => {
    if (!newItemDesc.trim() || newItemPrice <= 0 || newItemQty <= 0) return;
    const item: InvoiceItem = {
      id: `item-${Date.now()}`,
      code: newItemCode,
      description: newItemDesc,
      quantity: newItemQty,
      unitPrice: newItemPrice,
      subtotal: +(newItemQty * newItemPrice).toFixed(2),
    };
    setInvoiceItems((prev) => [...prev, item]);
    setNewItemQty(1);
  };

  const handleRemoveItem = (id: string) => {
    setInvoiceItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Calculations
  const calculatedSubtotal = useMemo(() => {
    return +invoiceItems.reduce((acc, curr) => acc + curr.subtotal, 0).toFixed(2);
  }, [invoiceItems]);

  const calculatedTotal = useMemo(() => {
    const total = Math.max(0, calculatedSubtotal - discountAmount);
    return +total.toFixed(2);
  }, [calculatedSubtotal, discountAmount]);

  // Convert total to Spanish literal words (e.g., SON: DOSCIENTOS CINCUENTA 00/100 BOLIVIANOS)
  const numberToLiteral = (num: number) => {
    const units = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    const tens = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const hundreds = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

    const intPart = Math.floor(num);
    const decimals = Math.round((num - intPart) * 100);
    const decStr = decimals < 10 ? `0${decimals}` : `${decimals}`;

    if (intPart === 0) return `SON: CERO ${decStr}/100 BOLIVIANOS`;
    if (intPart === 100) return `SON: CIEN ${decStr}/100 BOLIVIANOS`;

    let result = '';
    if (intPart >= 1000) {
      const thousands = Math.floor(intPart / 1000);
      result += thousands === 1 ? 'MIL ' : `${units[thousands]} MIL `;
    }
    const remainder100 = intPart % 1000;
    const h = Math.floor(remainder100 / 100);
    const remainder10 = remainder100 % 100;
    const t = Math.floor(remainder10 / 10);
    const u = remainder10 % 10;

    if (h > 0) result += `${hundreds[h]} `;
    if (t > 0) result += `${tens[t]} `;
    if (u > 0) result += `${units[u]} `;

    return `SON: ${result.trim()} ${decStr}/100 BOLIVIANOS`;
  };

  const handleEmitInvoiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (invoiceItems.length === 0) return;

    const invoiceNum = `00${invoices.length + 482}`;
    const generatedCuf = `8FA${Math.random().toString(36).substring(2, 10).toUpperCase()}${Date.now()}948572019485729104`;
    const nitEmisor = '3829102019';

    const newInvoice: InvoiceSIN = {
      id: `INV-2026-${invoiceNum}`,
      invoiceNumber: invoiceNum,
      authorizationNumber: '4910293849102',
      cuf: generatedCuf,
      nitEmisor,
      razonSocialEmisor: 'CLÍNICA ESPECIALIZADA MEDICALSYS S.R.L.',
      nitCiCliente: nitCi || '0',
      complemento: complemento || undefined,
      razonSocialCliente: razonSocial || 'Sin Nombre',
      emailCliente: emailCliente || undefined,
      fechaEmision: new Date().toISOString().replace('T', ' ').substring(0, 19),
      paymentMethod,
      items: [...invoiceItems],
      subtotal: calculatedSubtotal,
      discount: discountAmount,
      total: calculatedTotal,
      qrData: `https://siat.sin.gob.bo/consulta/QR?nit=${nitEmisor}&cuf=${generatedCuf}&numero=${invoiceNum}&monto=${calculatedTotal.toFixed(2)}&fecha=24/08/2026`,
      status: 'Válida',
      cashier: 'Dr. Carlos Mendoza (Admin)',
    };

    onEmitInvoice(newInvoice);
    setSelectedInvoicePreview(newInvoice);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCuf(true);
    setTimeout(() => setCopiedCuf(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: SIAT / SIN Connection Status */}
      <div className="bg-gradient-to-r from-[#1A365D] to-[#2B6CB0] rounded-2xl p-5 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
            <Receipt className="w-6 h-6 text-emerald-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold tracking-tight">
                Sistema de Facturación Computarizada en Línea
              </h3>
              <span className="text-[10px] font-bold uppercase bg-emerald-500/30 text-emerald-200 px-2 py-0.5 rounded border border-emerald-400/30">
                Ley Bolivia • SIAT Online
              </span>
            </div>
            <p className="text-xs text-blue-100 mt-0.5">
              Servicio de Impuestos Nacionales (SIN) • CUFD Vigente • Modalidad Computarizada en Línea
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto bg-white/10 p-1.5 rounded-xl">
          <button
            id="tab-new-invoice"
            onClick={() => setActiveTab('create')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'create'
                ? 'bg-white text-[#1A365D] shadow-sm'
                : 'text-blue-100 hover:text-white hover:bg-white/10'
            }`}
          >
            Emitir Nueva Factura
          </button>
          <button
            id="tab-history-invoices"
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-white text-[#1A365D] shadow-sm'
                : 'text-blue-100 hover:text-white hover:bg-white/10'
            }`}
          >
            Historial Emitidas ({invoices.length})
          </button>
        </div>
      </div>

      {/* VIEW 1: Formulario de Emisión de Factura SIN */}
      {activeTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Form (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
            <form onSubmit={handleEmitInvoiceSubmit} className="space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="text-sm font-bold text-[#1A365D] uppercase tracking-wider">
                  1. Datos del Cliente / Paciente Receptor
                </h3>
                <span className="text-[11px] text-slate-500">Cargar datos rápidos:</span>
              </div>

              {/* Patient Quick Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <Select
                    label="Autocompletar desde Paciente Registrado"
                    value={selectedPatientId}
                    onChange={(e) => handlePatientSelectChange(e.target.value)}
                    options={patients.map((p) => ({
                      value: p.id,
                      label: `${p.name} (CI: ${p.ci})`,
                    }))}
                  />
                </div>

                <Input
                  label="Razón Social / Nombre Completo"
                  value={razonSocial}
                  onChange={(e) => setRazonSocial(e.target.value)}
                  placeholder="Nombre de la persona o empresa"
                  required
                />

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Input
                      label="NIT / CI / CEX"
                      value={nitCi}
                      onChange={(e) => setNitCi(e.target.value)}
                      placeholder="Número de documento"
                      required
                    />
                  </div>
                  <div>
                    <Input
                      label="Compl."
                      value={complemento}
                      onChange={(e) => setComplemento(e.target.value)}
                      placeholder="LP"
                    />
                  </div>
                </div>

                <Input
                  label="Correo Electrónico (Para envío de Factura)"
                  type="email"
                  value={emailCliente}
                  onChange={(e) => setEmailCliente(e.target.value)}
                  placeholder="paciente@correo.bo"
                />

                <Select
                  label="Método de Pago"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as InvoiceSIN['paymentMethod'])}
                  options={[
                    { value: 'QR Simple', label: '📱 QR Simple (Bancario)' },
                    { value: 'Tarjeta de Débito/Crédito', label: '💳 Tarjeta de Débito / Crédito' },
                    { value: 'Efectivo', label: '💵 Efectivo en Caja' },
                    { value: 'Transferencia Bancaria', label: '🏦 Transferencia Bancaria' },
                  ]}
                  required
                />
              </div>

              {/* Items Table in Invoice */}
              <div className="space-y-3 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#1A365D] uppercase tracking-wider">
                    2. Detalle de Prestaciones Médicas e Ítems
                  </h3>
                  <span className="text-[11px] text-slate-500">{invoiceItems.length} ítem(s)</span>
                </div>

                {/* Items List */}
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                  {invoiceItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-slate-50/60 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="font-mono font-bold text-[10px] text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded mr-1.5">
                          {item.code}
                        </span>
                        <span className="font-bold text-slate-800">{item.description}</span>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Cant: {item.quantity} × Bs. {item.unitPrice.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-900 block font-mono">
                          Bs. {item.subtotal.toFixed(2)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Quick Add from Medical Catalog */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <p className="text-[11px] font-bold text-slate-600 uppercase">
                    Añadir Prestación Médica al Detalle
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-8">
                      <select
                        value={newItemCode}
                        onChange={(e) => handleCatalogSelect(e.target.value)}
                        className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800"
                      >
                        {medicalServicesCatalog.map((cat) => (
                          <option key={cat.code} value={cat.code}>
                            [{cat.code}] {cat.description} - Bs. {cat.price}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        type="number"
                        min="1"
                        value={newItemQty}
                        onChange={(e) => setNewItemQty(+e.target.value)}
                        placeholder="Cant."
                        className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        icon={Plus}
                        className="w-full"
                        onClick={handleAddItem}
                      >
                        Añadir
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] text-slate-500 block">Total a Facturar:</span>
                  <span className="text-xl font-extrabold text-[#1A365D] font-mono">
                    Bs. {calculatedTotal.toFixed(2)}
                  </span>
                </div>

                <Button
                  type="submit"
                  variant="success"
                  size="lg"
                  icon={CheckCircle2}
                  disabled={invoiceItems.length === 0}
                >
                  Emitir Factura Oficial (SIN)
                </Button>
              </div>
            </form>
          </div>

          {/* Right Column: Live Official SIN Invoice Preview (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-2xl border-2 border-slate-300 shadow-md p-6 space-y-4 text-xs font-mono">
              {/* Official SIN Header */}
              <div className="text-center border-b-2 border-dashed border-slate-300 pb-4 space-y-1">
                <h4 className="font-extrabold text-sm text-slate-900 uppercase">
                  CLÍNICA ESPECIALIZADA MEDICALSYS S.R.L.
                </h4>
                <p className="text-[11px] text-slate-600">Casa Matriz: Av. 6 de Agosto N° 2450, La Paz</p>
                <p className="text-[11px] text-slate-600">Teléfono: +591 (2) 2450000</p>
                <div className="pt-2">
                  <p className="font-bold text-slate-800">NIT: 3829102019</p>
                  <p className="font-bold text-slate-800">FACTURA N°: 00{invoices.length + 482}</p>
                  <p className="text-[10px] text-slate-500">CÓD. AUTORIZACIÓN: 4910293849102</p>
                </div>
              </div>

              {/* CUF Box */}
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[10px]">
                <span className="font-bold text-slate-700 block">CUF (CÓDIGO ÚNICO DE FACTURACIÓN):</span>
                <p className="break-all font-mono text-slate-600">
                  8FA92B019284716294029485720193847562019485729104
                </p>
              </div>

              {/* Customer Details */}
              <div className="space-y-1 border-b border-slate-200 pb-3 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">FECHA Y HORA:</span>
                  <span className="font-bold text-slate-800">24/08/2026 12:54:36</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">SEÑOR(ES):</span>
                  <strong className="text-slate-900 truncate max-w-[190px]">{razonSocial || 'Particular'}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">NIT / CI / CEX:</span>
                  <span className="font-bold text-slate-800">{nitCi} {complemento}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">MÉTODO DE PAGO:</span>
                  <span className="font-semibold text-slate-800">{paymentMethod}</span>
                </div>
              </div>

              {/* Items Breakdown */}
              <div className="space-y-2 border-b border-slate-200 pb-3">
                <div className="flex justify-between font-bold text-[10px] uppercase text-slate-500 border-b border-slate-100 pb-1">
                  <span>Detalle</span>
                  <span>Subtotal</span>
                </div>
                {invoiceItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-[11px]">
                    <div className="min-w-0 pr-2">
                      <span className="text-slate-800 block truncate">{item.quantity}x {item.description}</span>
                    </div>
                    <span className="font-bold text-slate-900 shrink-0">
                      Bs. {item.subtotal.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Total & Literal */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm font-extrabold text-slate-900">
                  <span>TOTAL A PAGAR:</span>
                  <span>Bs. {calculatedTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>IMPORTE BASE CRÉDITO FISCAL:</span>
                  <span>Bs. {calculatedTotal.toFixed(2)}</span>
                </div>
                <p className="text-[10px] text-slate-700 font-bold uppercase pt-1">
                  {numberToLiteral(calculatedTotal)}
                </p>
              </div>

              {/* Official QR Code & SIN Legal Legends */}
              <div className="pt-3 border-t-2 border-dashed border-slate-300 flex items-center gap-3">
                <div className="w-20 h-20 bg-slate-900 rounded-lg p-1 shrink-0 flex items-center justify-center text-white">
                  <QrCode className="w-16 h-16" />
                </div>
                <div className="text-[9px] text-slate-600 leading-tight space-y-1">
                  <p className="font-bold text-slate-800">
                    "ESTA FACTURA CONTRIBUYE AL DESARROLLO DEL PAÍS, EL USO ILÍCITO SERÁ SANCIONADO PENALMENTE DE ACUERDO A LEY"
                  </p>
                  <p>
                    Ley N° 453: Los servicios deben prestarse en condiciones de inocuidad y calidad.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: Invoices History Table */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A365D]">
              Historial de Facturas Emitidas (SIN Bolivia)
            </h3>
            <span className="text-xs font-semibold text-slate-500">
              Total facturado: Bs. {invoices.reduce((a, b) => a + b.total, 0).toFixed(2)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/75 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">N° Factura</th>
                  <th className="py-3 px-4">Fecha y Hora</th>
                  <th className="py-3 px-4">Razón Social / Cliente</th>
                  <th className="py-3 px-4">NIT / CI</th>
                  <th className="py-3 px-4">Método de Pago</th>
                  <th className="py-3 px-4 font-mono">Monto Total</th>
                  <th className="py-3 px-4">Estado SIN</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#1A365D]">
                      #{inv.invoiceNumber}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                      {inv.fechaEmision}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-800">
                      {inv.razonSocialCliente}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {inv.nitCiCliente} {inv.complemento}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                        {inv.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">
                      Bs. {inv.total.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {inv.status} (SIAT)
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedInvoicePreview(inv)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                        >
                          Ver Factura
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

      {/* Modal: Full Official Invoice View with Print / Share */}
      {selectedInvoicePreview && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedInvoicePreview(null)}
          title={`Factura Computarizada en Línea N° ${selectedInvoicePreview.invoiceNumber}`}
          subtitle="Comprobante Fiscal Autorizado por el Servicio de Impuestos Nacionales"
          maxWidth="lg"
        >
          <div className="space-y-4">
            {/* Printable Invoice Container */}
            <div id="printable-invoice" className="border-2 border-slate-300 rounded-xl p-5 bg-white font-mono text-xs space-y-4">
              <div className="text-center border-b-2 border-dashed border-slate-300 pb-3">
                <h4 className="font-extrabold text-sm text-slate-900">
                  {selectedInvoicePreview.razonSocialEmisor}
                </h4>
                <p className="text-[11px] text-slate-600">Casa Matriz: Av. 6 de Agosto N° 2450, La Paz</p>
                <div className="pt-2 font-bold text-slate-800">
                  <p>NIT: {selectedInvoicePreview.nitEmisor}</p>
                  <p>FACTURA N°: {selectedInvoicePreview.invoiceNumber}</p>
                  <p className="text-[10px] text-slate-500">CÓD. AUTORIZACIÓN: {selectedInvoicePreview.authorizationNumber}</p>
                </div>
              </div>

              <div className="bg-slate-50 p-2 rounded text-[9px] break-all border border-slate-200">
                <strong>CUF:</strong> {selectedInvoicePreview.cuf}
              </div>

              <div className="space-y-1 text-[11px] border-b border-slate-200 pb-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">FECHA:</span>
                  <span>{selectedInvoicePreview.fechaEmision}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">CLIENTE:</span>
                  <strong>{selectedInvoicePreview.razonSocialCliente}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">NIT / CI:</span>
                  <span>{selectedInvoicePreview.nitCiCliente} {selectedInvoicePreview.complemento}</span>
                </div>
              </div>

              <div className="space-y-1.5 border-b border-slate-200 pb-2">
                {selectedInvoicePreview.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-[11px]">
                    <span>{item.quantity}x {item.description}</span>
                    <strong className="shrink-0">Bs. {item.subtotal.toFixed(2)}</strong>
                  </div>
                ))}
              </div>

              <div className="space-y-1 text-right">
                <div className="text-sm font-extrabold text-slate-900 flex justify-between">
                  <span>TOTAL:</span>
                  <span>Bs. {selectedInvoicePreview.total.toFixed(2)}</span>
                </div>
                <p className="text-[10px] text-slate-600 text-left font-bold uppercase">
                  {numberToLiteral(selectedInvoicePreview.total)}
                </p>
              </div>

              <div className="pt-2 border-t-2 border-dashed border-slate-300 flex items-center gap-3">
                <div className="w-16 h-16 bg-slate-900 rounded p-1 text-white flex items-center justify-center shrink-0">
                  <QrCode className="w-14 h-14" />
                </div>
                <p className="text-[9px] text-slate-600 leading-tight">
                  "ESTA FACTURA CONTRIBUYE AL DESARROLLO DEL PAÍS, EL USO ILÍCITO SERÁ SANCIONADO PENALMENTE DE ACUERDO A LEY"
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                icon={copiedCuf ? Check : Copy}
                onClick={() => copyToClipboard(selectedInvoicePreview.cuf)}
              >
                {copiedCuf ? 'Copiado' : 'Copiar CUF'}
              </Button>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedInvoicePreview(null)}
                >
                  Cerrar
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={Printer}
                  onClick={() => window.print()}
                >
                  Imprimir Factura
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
