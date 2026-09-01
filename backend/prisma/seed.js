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

// HU-14: catálogo de servicios médicos usado por el formulario de reserva de citas.
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
  const fileStats = await fs.promises.stat(path.join(developmentStorageRoot, storageKey));
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
  const documentData = await seedClinicalDocuments(
    clinicalData,
    doctor.id_usuario
  );

  for (const [codigo, nombre, tipo, duracionMinutos, precioBase] of services) {
    await upsertService(codigo, nombre, tipo, duracionMinutos, precioBase);
  }

  console.log(
    `Seed listo: administrador ${admin.email}, médico ${doctor.email}, recepcionista ${receptionist.email}, `
      + `paciente con historial ${clinicalData.patientWithHistory.documento_identidad}, `
      + `paciente sin historial ${clinicalData.patientWithoutHistory.documento_identidad}, `
      + `documentos clínicos ${documentData.documents.length}, `
      + `servicios médicos ${services.length}.`
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
