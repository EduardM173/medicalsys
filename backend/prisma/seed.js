require('dotenv').config();

const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const prisma = require('../src/config/prisma');

const developmentStorageRoot = path.resolve(__dirname, '../storage/dev');

const roles = [
  ['ADMINISTRADOR', 'Administrador', 'Acceso administrativo al sistema'],
  ['MEDICO', 'Médico', 'Profesional médico'],
  ['RECEPCIONISTA', 'Recepcionista', 'Gestión de recepción'],
  ['PACIENTE', 'Paciente', 'Acceso de paciente']
];

const initialRooms = [
  { nombre: 'Consultorio 101', tipo: 'CONSULTORIO', ubicacion: 'Planta Baja - Ala Este', estado: 'DISPONIBLE' },
  { nombre: 'Consultorio 102', tipo: 'CONSULTORIO', ubicacion: 'Planta Baja - Ala Este', estado: 'DISPONIBLE' },
  { nombre: 'Quirófano Central A', tipo: 'QUIROFANO', ubicacion: 'Piso 2 - Bloque Quirúrgico', estado: 'DISPONIBLE' },
  { nombre: 'Sala de Procedimientos 1', tipo: 'SALA', ubicacion: 'Piso 1 - Procedimientos Menores', estado: 'DISPONIBLE' }
];

const services = [
  ['CONS-GEN', 'Consulta General', 'CONSULTA', 30, 100],
  ['CONS-ESP', 'Consulta Especializada', 'CONSULTA', 45, 150],
  ['CTRL-POST', 'Control Post-Operatorio', 'CONSULTA', 30, 80],
  ['CIR-GEN', 'Cirugía General', 'CIRUGIA', 90, 800],
  ['ECO-PEL', 'Chequeo Ecográfico Pélvico', 'EXAMEN', 45, 120]
];

async function upsertRole(codigo, nombre, descripcion) {
  return prisma.rol.upsert({
    where: { codigo },
    update: { nombre, descripcion, activo: true },
    create: { codigo, nombre, descripcion, activo: true }
  });
}

async function upsertUser({
  email,
  nombres,
  apellidos,
  idRol,
  passwordHash,
  estado = 'ACTIVO'
}) {
  return prisma.usuario.upsert({
    where: { email },
    update: {
      id_rol: idRol,
      nombres,
      apellidos,
      password_hash: passwordHash,
      estado
    },
    create: {
      id_rol: idRol,
      nombres,
      apellidos,
      email,
      password_hash: passwordHash,
      estado
    }
  });
}

async function upsertDoctorProfile({ userId, license, specialty }) {
  const existingProfile = await prisma.medico.findFirst({
    where: {
      OR: [
        { id_usuario: userId },
        { matricula_profesional: license }
      ]
    }
  });

  const data = {
    id_usuario: userId,
    matricula_profesional: license,
    especialidad: specialty,
    activo: true
  };

  if (existingProfile) {
    return prisma.medico.update({
      where: { id_medico: existingProfile.id_medico },
      data
    });
  }

  return prisma.medico.create({ data });
}

async function upsertService(codigo, nombre, tipo, duracionMinutos, precioBase) {
  return prisma.servicio_medico.upsert({
    where: { codigo },
    update: { nombre, tipo, duracion_minutos: duracionMinutos, precio_base: precioBase, activo: true },
    create: {
      codigo,
      nombre,
      tipo,
      duracion_minutos: duracionMinutos,
      precio_base: precioBase,
      activo: true
    }
  });
}

async function upsertTestPatient(documentoIdentidad, data) {
  const existingPatient = await prisma.paciente.findFirst({
    where: {
      documento_identidad: documentoIdentidad,
      complemento: ''
    }
  });

  const patientData = {
    ...data,
    documento_identidad: documentoIdentidad,
    complemento: '',
    activo: true,
    fecha_actualizacion: new Date()
  };

  if (existingPatient) {
    return prisma.paciente.update({
      where: { id_paciente: existingPatient.id_paciente },
      data: patientData
    });
  }

  return prisma.paciente.create({ data: patientData });
}

async function upsertTestAttention(historyId, doctorId, motivoConsulta, data) {
  const existingAttention = await prisma.atencion_medica.findFirst({
    where: {
      id_historia: historyId,
      id_medico: doctorId,
      motivo_consulta: motivoConsulta
    }
  });

  const attentionData = {
    ...data,
    id_historia: historyId,
    id_medico: doctorId,
    motivo_consulta: motivoConsulta,
    fecha_actualizacion: new Date()
  };

  if (existingAttention) {
    return prisma.atencion_medica.update({
      where: { id_atencion: existingAttention.id_atencion },
      data: attentionData
    });
  }

  return prisma.atencion_medica.create({ data: attentionData });
}

async function seedMedicalHistory(doctorId) {
  const patientWithHistory = await upsertTestPatient('4892104', {
    nombres: 'Alejandro',
    apellidos: 'Morales Quiroga',
    fecha_nacimiento: new Date('1988-04-18T00:00:00.000Z'),
    sexo: 'MASCULINO',
    grupo_sanguineo: 'O+',
    email: 'alejandro.morales@medicalsys.test',
    telefono: '72010001',
    direccion: 'Zona Central, La Paz',
    contacto_emergencia: 'María Quiroga',
    telefono_emergencia: '72010002'
  });

  const history = await prisma.historia_clinica.upsert({
    where: { id_paciente: patientWithHistory.id_paciente },
    update: {
      antecedentes: 'Apendicectomía en 2012. Antecedente familiar de hipertensión arterial.',
      alergias: 'Alergia a la penicilina.',
      condiciones_cronicas: 'Hipertensión arterial controlada.',
      observaciones_generales: 'Paciente realiza actividad física moderada tres veces por semana.',
      fecha_actualizacion: new Date()
    },
    create: {
      id_paciente: patientWithHistory.id_paciente,
      fecha_apertura: new Date('2026-01-15T00:00:00.000Z'),
      antecedentes: 'Apendicectomía en 2012. Antecedente familiar de hipertensión arterial.',
      alergias: 'Alergia a la penicilina.',
      condiciones_cronicas: 'Hipertensión arterial controlada.',
      observaciones_generales: 'Paciente realiza actividad física moderada tres veces por semana.'
    }
  });

  const pressureAttention = await upsertTestAttention(history.id_historia, doctorId, 'Control de presión arterial', {
    fecha_atencion: new Date('2026-07-12T14:30:00.000Z'),
    anamnesis: 'Paciente refiere buen cumplimiento del tratamiento y ausencia de cefalea.',
    diagnostico_codigo: 'I10',
    diagnostico_descripcion: 'Hipertensión esencial controlada',
    tratamiento: 'Continuar tratamiento habitual y control domiciliario de presión arterial.',
    observaciones: 'Nuevo control recomendado en ocho semanas.'
  });

  const respiratoryAttention = await upsertTestAttention(history.id_historia, doctorId, 'Consulta por cuadro respiratorio', {
    fecha_atencion: new Date('2026-08-20T16:00:00.000Z'),
    anamnesis: 'Tos seca y congestión nasal de tres días de evolución, sin dificultad respiratoria.',
    diagnostico_codigo: 'J06.9',
    diagnostico_descripcion: 'Infección aguda de vías respiratorias superiores',
    tratamiento: 'Hidratación, reposo y tratamiento sintomático.',
    observaciones: 'Acudir nuevamente si presenta fiebre persistente o dificultad respiratoria.'
  });

  const patientWithoutHistory = await upsertTestPatient('5938217', {
    nombres: 'Lucía',
    apellidos: 'Fernández Rojas',
    fecha_nacimiento: new Date('1997-09-03T00:00:00.000Z'),
    sexo: 'FEMENINO',
    grupo_sanguineo: 'A+',
    email: 'lucia.fernandez@medicalsys.test',
    telefono: '72020001',
    direccion: 'Sopocachi, La Paz'
  });

  return {
    history,
    patientWithHistory,
    patientWithoutHistory,
    pressureAttention,
    respiratoryAttention
  };
}

async function upsertTestDocument({
  historyId,
  attentionId,
  uploaderId,
  type,
  title,
  fileName,
  storageKey,
  mimeType,
  registeredAt
}) {
  let fileStats = { size: 1024 };
  const targetPath = path.join(developmentStorageRoot, storageKey);
  if (fs.existsSync(targetPath)) {
    fileStats = await fs.promises.stat(targetPath);
  }

  const data = {
    id_historia: historyId,
    id_atencion: attentionId || null,
    subido_por: uploaderId,
    tipo: type,
    titulo: title,
    nombre_archivo: fileName,
    storage_provider: 'LOCAL',
    storage_key: storageKey,
    mime_type: mimeType,
    tamano_bytes: BigInt(fileStats.size),
    fecha_registro: registeredAt
  };

  return prisma.documento_clinico.upsert({
    where: { storage_key: storageKey },
    update: data,
    create: data
  });
}

async function seedClinicalDocuments(clinicalData, uploaderId) {
  const secondPatient = await upsertTestPatient('6047331', {
    nombres: 'Camila',
    apellidos: 'Vargas Salazar',
    fecha_nacimiento: new Date('1993-11-22T00:00:00.000Z'),
    sexo: 'FEMENINO',
    grupo_sanguineo: 'B+',
    email: 'camila.vargas@medicalsys.test',
    telefono: '72030001',
    direccion: 'Miraflores, La Paz'
  });
  const secondHistory = await prisma.historia_clinica.upsert({
    where: { id_paciente: secondPatient.id_paciente },
    update: { fecha_actualizacion: new Date() },
    create: {
      id_paciente: secondPatient.id_paciente,
      fecha_apertura: new Date('2026-03-08T00:00:00.000Z')
    }
  });

  const documents = await Promise.all([
    upsertTestDocument({
      historyId: clinicalData.history.id_historia,
      attentionId: clinicalData.respiratoryAttention.id_atencion,
      uploaderId,
      type: 'EXAMEN',
      title: 'Resultado de laboratorio de control',
      fileName: 'resultado-laboratorio-control.txt',
      storageKey: 'TEST-DOC-A1.txt',
      mimeType: 'text/plain; charset=utf-8',
      registeredAt: new Date('2026-08-21T13:00:00.000Z')
    }),
    upsertTestDocument({
      historyId: clinicalData.history.id_historia,
      attentionId: null,
      uploaderId,
      type: 'INFORME',
      title: 'Informe clínico de seguimiento',
      fileName: 'informe-clinico-seguimiento.txt',
      storageKey: 'TEST-DOC-A2.txt',
      mimeType: 'text/plain; charset=utf-8',
      registeredAt: new Date('2026-07-15T15:30:00.000Z')
    }),
    upsertTestDocument({
      historyId: secondHistory.id_historia,
      attentionId: null,
      uploaderId,
      type: 'RADIOGRAFIA',
      title: 'Informe radiológico de demostración',
      fileName: 'informe-radiologico-demo.txt',
      storageKey: 'TEST-DOC-B1.txt',
      mimeType: 'text/plain; charset=utf-8',
      registeredAt: new Date('2026-06-10T11:00:00.000Z')
    })
  ]);

  return { documents, secondPatient };
}

async function upsertRooms() {
  const createdRooms = [];
  for (const room of initialRooms) {
    let existing = await prisma.sala.findUnique({
      where: { nombre: room.nombre }
    });
    if (!existing) {
      existing = await prisma.sala.create({ data: room });
    }
    createdRooms.push(existing);
  }
  return createdRooms;
}

async function upsertMedicalService() {
  return prisma.servicio_medico.upsert({
    where: { codigo: 'CONS-GEN-DEV' },
    update: {
      nombre: 'Consulta de Medicina General',
      descripcion: 'Servicio de prueba para la agenda médica.',
      tipo: 'CONSULTA',
      duracion_minutos: 30,
      precio_base: '120.00',
      activo: true,
      fecha_actualizacion: new Date()
    },
    create: {
      codigo: 'CONS-GEN-DEV',
      nombre: 'Consulta de Medicina General',
      descripcion: 'Servicio de prueba para la agenda médica.',
      tipo: 'CONSULTA',
      duracion_minutos: 30,
      precio_base: '120.00',
      activo: true
    }
  });
}

function clinicDateTime(daysFromToday, time) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/La_Paz',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const date = new Date(Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day) + daysFromToday
  ));
  const dateText = date.toISOString().slice(0, 10);
  return new Date(`${dateText}T${time}:00-04:00`);
}

function clinicDateText(daysFromToday = 0) {
  return clinicDateTime(daysFromToday, '12:00').toISOString().slice(0, 10);
}

function scheduleTime(time) {
  return new Date(`1970-01-01T${time}:00.000Z`);
}

async function upsertTestSchedule({ doctorId, day, start, end, active = true }) {
  const startTime = scheduleTime(start);
  const endTime = scheduleTime(end);
  const existing = await prisma.horario_medico.findFirst({
    where: {
      id_medico: doctorId,
      dia_semana: day,
      hora_inicio: startTime,
      hora_fin: endTime
    }
  });
  const data = {
    id_medico: doctorId,
    dia_semana: day,
    hora_inicio: startTime,
    hora_fin: endTime,
    activo: active,
    fecha_actualizacion: new Date()
  };

  if (existing) {
    return prisma.horario_medico.update({
      where: { id_horario: existing.id_horario },
      data
    });
  }
  return prisma.horario_medico.create({ data });
}

async function seedDoctorSchedules({ doctorAId, doctorBId }) {
  return Promise.all([
    ...[1, 2, 3, 4, 5].map((day) => upsertTestSchedule({
      doctorId: doctorAId,
      day,
      start: '08:00',
      end: '12:00'
    })),
    ...[1, 3, 5].map((day) => upsertTestSchedule({
      doctorId: doctorBId,
      day,
      start: '14:00',
      end: '18:00'
    })),
    upsertTestSchedule({
      doctorId: doctorBId,
      day: 6,
      start: '09:00',
      end: '12:00',
      active: false
    })
  ]);
}

async function upsertTestAppointment({
  doctorId,
  patientId,
  serviceId,
  createdBy,
  seedKey,
  startTime,
  endTime,
  reason,
  status
}) {
  const existingAppointment = await prisma.cita.findFirst({
    where: {
      id_medico: doctorId,
      indicaciones_previas: `SEED:${seedKey}`
    }
  });
  const data = {
    id_paciente: patientId,
    id_medico: doctorId,
    id_servicio: serviceId,
    creado_por: createdBy,
    fecha_hora_inicio: startTime,
    fecha_hora_fin: endTime,
    motivo: reason,
    indicaciones_previas: `SEED:${seedKey}`,
    estado: status,
    fecha_actualizacion: new Date()
  };

  if (existingAppointment) {
    return prisma.cita.update({
      where: { id_cita: existingAppointment.id_cita },
      data
    });
  }

  return prisma.cita.create({ data });
}

async function seedMedicalAgenda({ doctorAId, doctorBId, createdBy, patientAId, patientBId }) {
  const service = await upsertMedicalService();
  const appointments = await Promise.all([
    upsertTestAppointment({
      doctorId: doctorAId,
      patientId: patientAId,
      serviceId: service.id_servicio,
      createdBy,
      seedKey: 'AGENDA-MEDICO-A-HOY-1',
      startTime: clinicDateTime(0, '08:00'),
      endTime: clinicDateTime(0, '08:30'),
      reason: 'Control médico general',
      status: 'CONFIRMADA'
    }),
    upsertTestAppointment({
      doctorId: doctorAId,
      patientId: patientBId,
      serviceId: service.id_servicio,
      createdBy,
      seedKey: 'AGENDA-MEDICO-A-HOY-2',
      startTime: clinicDateTime(0, '09:30'),
      endTime: clinicDateTime(0, '10:00'),
      reason: 'Consulta de seguimiento',
      status: 'PROGRAMADA'
    }),
    upsertTestAppointment({
      doctorId: doctorAId,
      patientId: patientAId,
      serviceId: service.id_servicio,
      createdBy,
      seedKey: 'AGENDA-MEDICO-A-HOY-3',
      startTime: clinicDateTime(0, '11:00'),
      endTime: clinicDateTime(0, '11:30'),
      reason: 'Consulta cancelada de demostración',
      status: 'CANCELADA'
    }),
    upsertTestAppointment({
      doctorId: doctorBId,
      patientId: patientBId,
      serviceId: service.id_servicio,
      createdBy,
      seedKey: 'AGENDA-MEDICO-B-HOY-1',
      startTime: clinicDateTime(0, '14:30'),
      endTime: clinicDateTime(0, '15:00'),
      reason: 'Cita exclusiva del segundo médico',
      status: 'PROGRAMADA'
    }),
    upsertTestAppointment({
      doctorId: doctorAId,
      patientId: patientBId,
      serviceId: service.id_servicio,
      createdBy,
      seedKey: 'AGENDA-MEDICO-A-MANANA-1',
      startTime: clinicDateTime(1, '10:00'),
      endTime: clinicDateTime(1, '10:30'),
      reason: 'Control en fecha diferente',
      status: 'PROGRAMADA'
    })
  ]);

  return { appointments, service };
}

async function upsertTestConsent({
  folio,
  patientId,
  doctorId,
  appointmentId,
  procedure,
  content,
  status,
  signedAt = null,
  signatureKey = null,
  signatureHash = null
}) {
  const data = {
    id_paciente: patientId,
    id_medico: doctorId,
    id_cita: appointmentId || null,
    folio,
    procedimiento: procedure,
    contenido: content,
    estado: status,
    fecha_generacion: clinicDateTime(0, '07:30'),
    fecha_firma: signedAt,
    firma_storage_key: signatureKey,
    firma_hash_sha256: signatureHash
  };
  return prisma.consentimiento_informado.upsert({
    where: { folio },
    update: data,
    create: data
  });
}

async function seedConsents({ doctorId, patientAId, patientBId, appointments }) {
  return Promise.all([
    upsertTestConsent({
      folio: 'CI-SEED-GENERADO-001',
      patientId: patientAId,
      doctorId,
      appointmentId: appointments[0].id_cita,
      procedure: 'Procedimiento ambulatorio de demostración',
      content: 'Se explicó al paciente el objetivo del procedimiento, sus beneficios, riesgos frecuentes, alternativas disponibles y el derecho a retirar su consentimiento antes de iniciar.',
      status: 'GENERADO'
    }),
    upsertTestConsent({
      folio: 'CI-SEED-FIRMADO-001',
      patientId: patientBId,
      doctorId,
      appointmentId: appointments[1].id_cita,
      procedure: 'Tratamiento clínico de seguimiento',
      content: 'El paciente declara haber recibido información comprensible, haber resuelto sus dudas y aceptar voluntariamente el tratamiento clínico propuesto.',
      status: 'FIRMADO',
      signedAt: clinicDateTime(0, '07:45'),
      signatureKey: 'seed/consentimientos/CI-SEED-FIRMADO-001.sig',
      signatureHash: 'd5fca5ec9ed2e8f5652b9a80e8fc57fd4c5b9e335703519056be814a6774467b'
    })
  ]);
}

async function createIssuedTestInvoice({ number, configurationId, patientId, issuedBy, date, receiver, paymentMethod, items }) {
  const existing = await prisma.factura.findUnique({ where: { numero_factura: number } });
  if (existing) return existing;
  const subtotal = items.reduce((sum, item) => sum + Number(item.subtotal), 0).toFixed(2);
  return prisma.factura.create({
    data: {
      id_configuracion_clinica: configurationId,
      id_paciente: patientId,
      emitida_por: issuedBy,
      numero_factura: number,
      fecha_emision: date,
      nit_ci: receiver.nitCi,
      complemento: receiver.complemento || '',
      razon_social: receiver.razonSocial,
      email_receptor: receiver.email,
      metodo_pago: paymentMethod,
      subtotal,
      total: subtotal,
      estado: 'EMITIDA',
      sin_estado: 'SIMULADA',
      detalle_factura: {
        create: items.map((item) => ({
          id_servicio: item.serviceId,
          descripcion: item.description,
          cantidad: item.quantity,
          precio_unitario: item.unitPrice,
          subtotal: item.subtotal
        }))
      }
    }
  });
}

async function seedIssuedInvoices({ patientA, patientB, issuedBy }) {
  const configuration = await prisma.configuracion_clinica.upsert({
    where: { nit: '1023942027' },
    update: {},
    create: {
      nombre_comercial: 'MedicalSys Centro Médico',
      razon_social: 'MEDICALSYS S.R.L.',
      nit: '1023942027',
      direccion: 'Av. Arce Nro. 2300, La Paz',
      telefono: '+591 2 244 0000',
      email: 'facturacion@medicalsys.bo',
      ciudad: 'La Paz',
      pais: 'Bolivia',
      activa: true
    }
  });
  const invoiceServices = await prisma.servicio_medico.findMany({
    where: { codigo: { in: ['CONS-ESP', 'ECO-PEL', 'CIR-GEN'] } },
    select: { id_servicio: true, codigo: true }
  });
  const byCode = new Map(invoiceServices.map((service) => [service.codigo, service]));
  if (!byCode.has('CONS-ESP') || !byCode.has('ECO-PEL') || !byCode.has('CIR-GEN')) {
    throw new Error('No se encontraron los servicios requeridos para las facturas HU-23.');
  }
  const invoiceA = await createIssuedTestInvoice({
    number: 'TEST-FACT-HU23-001',
    configurationId: configuration.id_configuracion,
    patientId: patientA.id_paciente,
    issuedBy,
    date: new Date('2026-09-05T14:30:00-04:00'),
    receiver: {
      nitCi: patientA.documento_identidad,
      complemento: patientA.complemento,
      razonSocial: 'Alejandro Morales Quiroga',
      email: 'alejandro.facturacion@medicalsys.test'
    },
    paymentMethod: 'EFECTIVO',
    items: [
      { serviceId: byCode.get('CONS-ESP').id_servicio, description: 'Consulta Especializada', quantity: 1, unitPrice: '150.00', subtotal: '150.00' },
      { serviceId: byCode.get('ECO-PEL').id_servicio, description: 'Chequeo Ecográfico Pélvico', quantity: 1, unitPrice: '120.00', subtotal: '120.00' }
    ]
  });
  const invoiceB = await createIssuedTestInvoice({
    number: 'TEST-FACT-HU23-002',
    configurationId: configuration.id_configuracion,
    patientId: patientB.id_paciente,
    issuedBy,
    date: new Date('2026-09-06T10:15:00-04:00'),
    receiver: {
      nitCi: patientB.documento_identidad,
      complemento: patientB.complemento,
      razonSocial: 'Camila Vargas Salazar',
      email: 'camila.facturacion@medicalsys.test'
    },
    paymentMethod: 'QR',
    items: [
      { serviceId: byCode.get('CIR-GEN').id_servicio, description: 'Cirugía General', quantity: 1, unitPrice: '800.00', subtotal: '800.00' }
    ]
  });
  return [invoiceA, invoiceB];
}

async function createSeedNotification(data) {
  const existing = await prisma.notificacion.findFirst({
    where: { proveedor_referencia: data.proveedor_referencia }
  });
  if (existing) return existing;
  return prisma.notificacion.create({ data });
}

function seedPhone(patient) {
  const phone = String(patient.telefono || '').replace(/\D/g, '');
  return phone.startsWith('591') ? `+${phone}` : `+591${phone}`;
}

async function seedNotificationHistory({ patientA, patientB, appointments, issuedBy }) {
  const [appointmentA1, appointmentB1, appointmentA2] = appointments;
  const phoneA = seedPhone(patientA);
  const phoneB = seedPhone(patientB);
  const base = {
    usuario_emisor: issuedBy,
    direccion: 'SALIENTE',
    canal: 'WHATSAPP'
  };
  return Promise.all([
    createSeedNotification({
      ...base,
      id_paciente: patientA.id_paciente,
      id_cita: appointmentA1.id_cita,
      tipo: 'CONFIRMACION_CITA',
      telefono_destino: phoneA,
      mensaje: 'Confirmación de cita entregada para prueba HU-26.',
      fecha_envio: new Date('2026-09-01T13:00:00.000Z'),
      fecha_entrega: new Date('2026-09-01T13:01:00.000Z'),
      estado: 'ENTREGADA',
      proveedor_referencia: 'SEED-HU26-A1-CONF',
      fecha_creacion: new Date('2026-09-01T13:00:00.000Z')
    }),
    createSeedNotification({
      ...base,
      id_paciente: patientA.id_paciente,
      id_cita: appointmentA1.id_cita,
      tipo: 'RECORDATORIO_CITA',
      telefono_destino: phoneA,
      mensaje: 'Recordatorio de cita leído para prueba HU-26.',
      fecha_envio: new Date('2026-09-01T14:00:00.000Z'),
      fecha_entrega: new Date('2026-09-01T14:01:00.000Z'),
      fecha_lectura: new Date('2026-09-01T14:05:00.000Z'),
      estado: 'LEIDA',
      proveedor_referencia: 'SEED-HU26-A1-REM',
      fecha_creacion: new Date('2026-09-01T14:00:00.000Z')
    }),
    createSeedNotification({
      ...base,
      id_paciente: patientA.id_paciente,
      id_cita: appointmentA1.id_cita,
      tipo: 'RECORDATORIO_CITA',
      telefono_destino: phoneA,
      mensaje: 'Intento de recordatorio fallido para prueba HU-26.',
      fecha_programada: new Date('2026-09-01T15:00:00.000Z'),
      estado: 'FALLIDA',
      proveedor_referencia: 'SEED-HU26-A1-FAIL',
      fecha_creacion: new Date('2026-09-01T15:00:00.000Z')
    }),
    createSeedNotification({
      ...base,
      id_paciente: patientA.id_paciente,
      id_cita: appointmentA2.id_cita,
      tipo: 'CONFIRMACION_CITA',
      telefono_destino: phoneA,
      mensaje: 'Confirmación enviada para la segunda cita de prueba HU-26.',
      fecha_envio: new Date('2026-08-31T16:00:00.000Z'),
      estado: 'ENVIADA',
      proveedor_referencia: 'SEED-HU26-A2-CONF',
      fecha_creacion: new Date('2026-08-31T16:00:00.000Z')
    }),
    createSeedNotification({
      ...base,
      id_paciente: patientB.id_paciente,
      id_cita: appointmentB1.id_cita,
      tipo: 'CONFIRMACION_CITA',
      telefono_destino: phoneB,
      mensaje: 'Confirmación entregada al segundo paciente para prueba HU-26.',
      fecha_envio: new Date('2026-09-01T13:30:00.000Z'),
      fecha_entrega: new Date('2026-09-01T13:31:00.000Z'),
      estado: 'ENTREGADA',
      proveedor_referencia: 'SEED-HU26-B1-CONF',
      fecha_creacion: new Date('2026-09-01T13:30:00.000Z')
    })
  ]);
}

async function seedCampaignsAndLoyalty({ adminId, patients }) {
  const today = new Date();
  const nextMonth = new Date();
  nextMonth.setDate(today.getDate() + 30);
  const prevMonth = new Date();
  prevMonth.setDate(today.getDate() - 30);

  const campaignsData = [
    {
      nombre: 'Jornada Preventiva de Salud Cardiovascular & Hipertensión',
      descripcion: 'Campaña integral de detección temprana de factores de riesgo coronario, medición de presión arterial y electrocardiograma con arancel preferencial.',
      fecha_inicio: prevMonth,
      fecha_fin: nextMonth,
      estado: 'ACTIVA',
      tipo_promocion: 'DESCUENTO_CONSULTA',
      descuento_porcentaje: 20.00,
      publico_objetivo: 'Pacientes mayores de 40 años o con antecedentes de hipertensión arterial',
      presupuesto: 2500.00,
      creada_por: adminId
    },
    {
      nombre: 'Chequeo Pediátrico Integral Vuelta a Clases',
      descripcion: 'Evaluación de agudeza visual, audiometría, curva de crecimiento y esquema de vacunación completo para el inicio del año escolar.',
      fecha_inicio: today,
      fecha_fin: nextMonth,
      estado: 'PROGRAMADA',
      tipo_promocion: 'PAQUETE_PREVENTIVO',
      descuento_porcentaje: 15.00,
      publico_objetivo: 'Pacientes en edad escolar (de 4 a 14 años)',
      presupuesto: 1800.00,
      creada_por: adminId
    },
    {
      nombre: 'Campaña Odontológica Preventiva 2026',
      descripcion: 'Profilaxis dental y fluorización para toda la familia.',
      fecha_inicio: null,
      fecha_fin: null,
      estado: 'BORRADOR',
      tipo_promocion: 'JORNADA_GRATUITA',
      descuento_porcentaje: 50.00,
      publico_objetivo: 'Comunidad general y grupos familiares',
      presupuesto: 3000.00,
      creada_por: adminId
    }
  ];

  const campaigns = [];
  for (const c of campaignsData) {
    let existing = await prisma.campania.findFirst({
      where: { nombre: c.nombre }
    });
    if (!existing) {
      existing = await prisma.campania.create({ data: c });
    } else {
      existing = await prisma.campania.update({
        where: { id_campania: existing.id_campania },
        data: c
      });
    }
    campaigns.push(existing);
  }

  // Aseguramos que patients[1] (Lucía Fernández) quede sin afiliar para pruebas de afiliación
  await prisma.fidelizacion_paciente.deleteMany({
    where: { id_paciente: patients[1].id_paciente }
  });

  const loyaltyData = [
    {
      id_paciente: patients[0].id_paciente,
      estado: 'ACTIVO',
      nivel: 'PREMIUM',
      puntos_acumulados: 350,
      notas: 'Paciente frecuente del programa cardiovascular. Cumplimiento ejemplar.'
    },
    {
      id_paciente: patients[2].id_paciente,
      estado: 'SUSPENDIDO',
      nivel: 'ESTANDAR',
      puntos_acumulados: 40,
      notas: 'Pausa temporal solicitada por viaje prolongado.'
    }
  ];

  const loyaltyMembers = [];
  for (const l of loyaltyData) {
    const member = await prisma.fidelizacion_paciente.upsert({
      where: { id_paciente: l.id_paciente },
      update: l,
      create: l
    });
    loyaltyMembers.push(member);
  }

  return { campaigns, loyaltyMembers };
}

async function main() {
  await require('../scripts/setup-security')();
  await require('../scripts/seed-security')();
  const rolesByCode = {};
  for (const [codigo, nombre, descripcion] of roles) {
    rolesByCode[codigo] = await upsertRole(codigo, nombre, descripcion);
  }

  const passwordHash = await bcrypt.hash('MedicalSys2026!', 12);
  const admin = await upsertUser({
    email: 'admin@medicalsys.test',
    nombres: 'Administrador',
    apellidos: 'MedicalSys',
    idRol: rolesByCode.ADMINISTRADOR.id_rol,
    passwordHash
  });
  const doctor = await upsertUser({
    email: 'medico@medicalsys.test',
    nombres: 'Médico',
    apellidos: 'MedicalSys',
    idRol: rolesByCode.MEDICO.id_rol,
    passwordHash
  });
  const secondDoctor = await upsertUser({
    email: 'medico.b@medicalsys.test',
    nombres: 'Elena',
    apellidos: 'Vargas',
    idRol: rolesByCode.MEDICO.id_rol,
    passwordHash
  });
  const receptionist = await upsertUser({
    email: 'recepcionista@medicalsys.test',
    nombres: 'Recepcionista',
    apellidos: 'MedicalSys',
    idRol: rolesByCode.RECEPCIONISTA.id_rol,
    passwordHash
  });
  const patientUser = await upsertUser({
    email: 'paciente@medicalsys.test',
    nombres: 'Alejandro',
    apellidos: 'Morales Quiroga',
    idRol: rolesByCode.PACIENTE.id_rol,
    passwordHash
  });
  const inactiveUser = await upsertUser({
    email: 'usuario.inactivo@medicalsys.test',
    nombres: 'Usuario',
    apellidos: 'Inactivo',
    idRol: rolesByCode.RECEPCIONISTA.id_rol,
    passwordHash,
    estado: 'INACTIVO'
  });
  const doctorProfile = await upsertDoctorProfile({
    userId: doctor.id_usuario,
    license: 'MED-DEV-001',
    specialty: 'Medicina General'
  });
  const secondDoctorProfile = await upsertDoctorProfile({
    userId: secondDoctor.id_usuario,
    license: 'MED-DEV-002',
    specialty: 'Medicina Interna'
  });
  const clinicalData = await seedMedicalHistory(doctorProfile.id_medico);
  await prisma.paciente.update({
    where: { id_paciente: clinicalData.patientWithHistory.id_paciente },
    data: { id_usuario: patientUser.id_usuario }
  });
  const documentData = await seedClinicalDocuments(
    clinicalData,
    doctor.id_usuario
  );
  const agendaData = await seedMedicalAgenda({
    doctorAId: doctorProfile.id_medico,
    doctorBId: secondDoctorProfile.id_medico,
    createdBy: receptionist.id_usuario,
    patientAId: clinicalData.patientWithHistory.id_paciente,
    patientBId: documentData.secondPatient.id_paciente
  });
  const schedules = await seedDoctorSchedules({
    doctorAId: doctorProfile.id_medico,
    doctorBId: secondDoctorProfile.id_medico
  });
  const consents = await seedConsents({
    doctorId: doctorProfile.id_medico,
    patientAId: clinicalData.patientWithHistory.id_paciente,
    patientBId: documentData.secondPatient.id_paciente,
    appointments: agendaData.appointments
  });

  for (const [codigo, nombre, tipo, duracionMinutos, precioBase] of services) {
    await upsertService(codigo, nombre, tipo, duracionMinutos, precioBase);
  }

  const invoices = await seedIssuedInvoices({
    patientA: clinicalData.patientWithHistory,
    patientB: documentData.secondPatient,
    issuedBy: receptionist.id_usuario
  });

  const notificationHistory = await seedNotificationHistory({
    patientA: clinicalData.patientWithHistory,
    patientB: documentData.secondPatient,
    appointments: agendaData.appointments,
    issuedBy: receptionist.id_usuario
  });

  await upsertRooms();

  const { campaigns, loyaltyMembers } = await seedCampaignsAndLoyalty({
    adminId: admin.id_usuario,
    patients: [
      clinicalData.patientWithHistory,
      clinicalData.patientWithoutHistory,
      documentData.secondPatient
    ]
  });

  console.log(
    `Seed listo: administrador ${admin.email}, médicos ${doctor.email} y ${secondDoctor.email}, `
      + `recepcionista ${receptionist.email}, paciente ${patientUser.email}, usuario inactivo ${inactiveUser.email}, `
      + `paciente con historial ${clinicalData.patientWithHistory.documento_identidad}, `
      + `paciente sin historial ${clinicalData.patientWithoutHistory.documento_identidad}, `
      + `documentos clínicos ${documentData.documents.length}, `
      + `servicios médicos ${services.length}, `
      + `salas iniciales 4, `
      + `horarios ${schedules.length}, citas ${agendaData.appointments.length} (${clinicDateText()} y ${clinicDateText(1)}), `
      + `consentimientos ${consents.map((consent) => `${consent.folio}=/consentimientos/${consent.id_consentimiento}`).join(', ')}.`
      + ` facturas HU-23 ${invoices.map((invoice) => invoice.numero_factura).join(', ')}.`
      + ` notificaciones HU-26 ${notificationHistory.length}.`
      + ` campañas HU-27 ${campaigns.length}.`
      + ` fidelización HU-28 ${loyaltyMembers.length}.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
