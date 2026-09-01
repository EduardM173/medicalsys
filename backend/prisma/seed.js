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

const initialServices = [
  { codigo: 'SERV-CONS-01', nombre: 'Consulta de Medicina General', tipo: 'CONSULTA', duracion_minutos: 30, precio_base: 150.00 },
  { codigo: 'SERV-CIRU-01', nombre: 'Cirugía Menor Ambulatoria', tipo: 'CIRUGIA', duracion_minutos: 60, precio_base: 800.00 },
  { codigo: 'SERV-PROC-01', nombre: 'Procedimiento Menor / Curación', tipo: 'PROCEDIMIENTO', duracion_minutos: 45, precio_base: 200.00 }
];

async function upsertRole(codigo, nombre, descripcion) {
  return prisma.rol.upsert({
    where: { codigo },
    update: { nombre, descripcion, activo: true },
    create: { codigo, nombre, descripcion, activo: true }
  });
}

async function upsertUser({ email, nombres, apellidos, idRol, passwordHash }) {
  return prisma.usuario.upsert({
    where: { email },
    update: {
      id_rol: idRol,
      nombres,
      apellidos,
      password_hash: passwordHash,
      estado: 'ACTIVO'
    },
    create: {
      id_rol: idRol,
      nombres,
      apellidos,
      email,
      password_hash: passwordHash,
      estado: 'ACTIVO'
    }
  });
}

async function upsertDoctorProfile(userId) {
  const existingProfile = await prisma.medico.findFirst({
    where: {
      OR: [
        { id_usuario: userId },
        { matricula_profesional: 'MED-DEV-001' }
      ]
    }
  });

  const data = {
    id_usuario: userId,
    matricula_profesional: 'MED-DEV-001',
    especialidad: 'Medicina General',
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

async function upsertServices() {
  const createdServices = [];
  for (const s of initialServices) {
    let existing = await prisma.servicio_medico.findUnique({
      where: { codigo: s.codigo }
    });
    if (!existing) {
      existing = await prisma.servicio_medico.create({ data: s });
    }
    createdServices.push(existing);
  }
  return createdServices;
}

async function seedTestAppointments({ patients, doctorId, serviceId, adminId }) {
  const today = new Date().toISOString().slice(0, 10);
  const appointmentsData = [
    {
      id_paciente: patients[0].id_paciente,
      id_medico: doctorId,
      id_servicio: serviceId,
      creado_por: adminId,
      fecha_hora_inicio: new Date(`${today}T09:00:00.000Z`),
      fecha_hora_fin: new Date(`${today}T09:30:00.000Z`),
      motivo: 'Control de rutina y revisión general',
      estado: 'PROGRAMADA'
    },
    {
      id_paciente: patients[1].id_paciente,
      id_medico: doctorId,
      id_servicio: serviceId,
      creado_por: adminId,
      fecha_hora_inicio: new Date(`${today}T10:30:00.000Z`),
      fecha_hora_fin: new Date(`${today}T11:00:00.000Z`),
      motivo: 'Evaluación por dolores articulares',
      estado: 'PROGRAMADA'
    },
    {
      id_paciente: patients[2].id_paciente,
      id_medico: doctorId,
      id_servicio: serviceId,
      creado_por: adminId,
      fecha_hora_inicio: new Date(`${today}T14:00:00.000Z`),
      fecha_hora_fin: new Date(`${today}T15:00:00.000Z`),
      motivo: 'Procedimiento ambulatorio programado',
      estado: 'PROGRAMADA'
    }
  ];

  const created = [];
  for (const appt of appointmentsData) {
    const existing = await prisma.cita.findFirst({
      where: {
        id_paciente: appt.id_paciente,
        fecha_hora_inicio: appt.fecha_hora_inicio
      }
    });
    if (!existing) {
      created.push(await prisma.cita.create({ data: appt }));
    } else {
      created.push(existing);
    }
  }
  return created;
}

async function main() {
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
  const receptionist = await upsertUser({
    email: 'recepcionista@medicalsys.test',
    nombres: 'Recepcionista',
    apellidos: 'MedicalSys',
    idRol: rolesByCode.RECEPCIONISTA.id_rol,
    passwordHash
  });
  const doctorProfile = await upsertDoctorProfile(doctor.id_usuario);
  const clinicalData = await seedMedicalHistory(doctorProfile.id_medico);
  const documentData = await seedClinicalDocuments(clinicalData, doctor.id_usuario);
  await upsertRooms();
  const services = await upsertServices();

  const appointments = await seedTestAppointments({
    patients: [clinicalData.patientWithHistory, clinicalData.patientWithoutHistory, documentData.secondPatient],
    doctorId: doctorProfile.id_medico,
    serviceId: services[0].id_servicio,
    adminId: admin.id_usuario
  });

  console.log(
    `Seed listo: administrador ${admin.email}, médico ${doctor.email}, recepcionista ${receptionist.email}, `
      + `pacientes 3, citas de prueba ${appointments.length}, salas 4, servicios 3.`
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
