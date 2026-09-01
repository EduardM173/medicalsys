require('dotenv').config();

const bcrypt = require('bcryptjs');
const prisma = require('../src/config/prisma');

const roles = [
  ['ADMINISTRADOR', 'Administrador', 'Acceso administrativo al sistema'],
  ['MEDICO', 'Médico', 'Profesional médico'],
  ['RECEPCIONISTA', 'Recepcionista', 'Gestión de recepción'],
  ['PACIENTE', 'Paciente', 'Acceso de paciente']
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

  for (const [codigo, nombre, tipo, duracionMinutos, precioBase] of services) {
    await upsertService(codigo, nombre, tipo, duracionMinutos, precioBase);
  }

  console.log(`Seed listo: administrador ${admin.email}, médico ${doctor.email}, recepcionista ${receptionist.email}, perfil ${doctorProfile.id_medico}, ${services.length} servicios médicos.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
