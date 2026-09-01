require('dotenv').config();

const bcrypt = require('bcryptjs');
const prisma = require('../src/config/prisma');

const roles = [
  ['ADMINISTRADOR', 'Administrador', 'Acceso administrativo al sistema'],
  ['MEDICO', 'Médico', 'Profesional médico'],
  ['RECEPCIONISTA', 'Recepcionista', 'Gestión de recepción'],
  ['PACIENTE', 'Paciente', 'Acceso de paciente']
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

  await upsertTestAttention(history.id_historia, doctorId, 'Control de presión arterial', {
    fecha_atencion: new Date('2026-07-12T14:30:00.000Z'),
    anamnesis: 'Paciente refiere buen cumplimiento del tratamiento y ausencia de cefalea.',
    diagnostico_codigo: 'I10',
    diagnostico_descripcion: 'Hipertensión esencial controlada',
    tratamiento: 'Continuar tratamiento habitual y control domiciliario de presión arterial.',
    observaciones: 'Nuevo control recomendado en ocho semanas.'
  });

  await upsertTestAttention(history.id_historia, doctorId, 'Consulta por cuadro respiratorio', {
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

  return { history, patientWithHistory, patientWithoutHistory };
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

  console.log(
    `Seed listo: administrador ${admin.email}, médico ${doctor.email}, recepcionista ${receptionist.email}, `
      + `paciente con historial ${clinicalData.patientWithHistory.documento_identidad}, `
      + `paciente sin historial ${clinicalData.patientWithoutHistory.documento_identidad}.`
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
