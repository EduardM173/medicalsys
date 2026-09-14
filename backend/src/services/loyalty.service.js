const repository = require('../repositories/loyalty.repository');

class LoyaltyError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

const VALID_ESTADOS_FIDELIZACION = ['ACTIVO', 'INACTIVO', 'SUSPENDIDO'];
const VALID_NIVELES_FIDELIZACION = ['ESTANDAR', 'FRECUENTE', 'PREMIUM'];

function serializeLoyaltyRecord(item) {
  if (!item) return null;
  return {
    id: Number(item.id_fidelizacion),
    pacienteId: Number(item.id_paciente),
    estado: item.estado,
    nivel: item.nivel,
    puntosAcumulados: item.puntos_acumulados,
    fechaInscripcion: item.fecha_inscripcion ? item.fecha_inscripcion.toISOString() : null,
    fechaActualizacion: item.fecha_actualizacion ? item.fecha_actualizacion.toISOString() : null,
    notas: item.notas
  };
}

function serializePatientWithLoyalty(patient) {
  return {
    id: Number(patient.id_paciente),
    nombres: patient.nombres,
    apellidos: patient.apellidos,
    documentoIdentidad: patient.documento_identidad,
    complemento: patient.complemento,
    email: patient.email,
    telefono: patient.telefono,
    activo: patient.activo,
    esMiembro: Boolean(patient.fidelizacion),
    fidelizacion: patient.fidelizacion ? serializeLoyaltyRecord(patient.fidelizacion) : null
  };
}

async function listPatientsWithLoyalty({ search = '', estado = '', nivel = '', soloMiembros = false } = {}) {
  const patientWhere = {
    activo: true
  };

  if (search && search.trim()) {
    const term = search.trim();
    patientWhere.OR = [
      { nombres: { contains: term, mode: 'insensitive' } },
      { apellidos: { contains: term, mode: 'insensitive' } },
      { documento_identidad: { contains: term, mode: 'insensitive' } },
      { email: { contains: term, mode: 'insensitive' } },
      { telefono: { contains: term, mode: 'insensitive' } }
    ];
  }

  // Filtros aplicables a la relación de fidelización
  const loyaltyWhere = {};
  if (estado && VALID_ESTADOS_FIDELIZACION.includes(estado.toUpperCase())) {
    loyaltyWhere.estado = estado.toUpperCase();
  }
  if (nivel && VALID_NIVELES_FIDELIZACION.includes(nivel.toUpperCase())) {
    loyaltyWhere.nivel = nivel.toUpperCase();
  }

  if (estado === 'SIN_PROGRAMA') {
    patientWhere.fidelizacion = null;
  } else if (Object.keys(loyaltyWhere).length > 0 || soloMiembros) {
    patientWhere.fidelizacion = {
      is: loyaltyWhere
    };
  }

  const [patients, stats] = await Promise.all([
    repository.paciente.findMany({
      where: patientWhere,
      orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }],
      include: {
        fidelizacion: true
      }
    }),
    getLoyaltyStats()
  ]);

  return {
    patients: patients.map(serializePatientWithLoyalty),
    stats
  };
}

async function getLoyaltyStats() {
  const [totalPacientes, countsByEstado, countsByNivel] = await Promise.all([
    repository.paciente.count({ where: { activo: true } }),
    repository.fidelizacion_paciente.groupBy({
      by: ['estado'],
      _count: { id_fidelizacion: true }
    }),
    repository.fidelizacion_paciente.groupBy({
      by: ['nivel'],
      _count: { id_fidelizacion: true }
    })
  ]);

  let totalAfiliados = 0;
  let activos = 0;
  let suspendidos = 0;
  let inactivos = 0;

  for (const item of countsByEstado) {
    const count = Number(item._count.id_fidelizacion);
    totalAfiliados += count;
    if (item.estado === 'ACTIVO') activos = count;
    if (item.estado === 'SUSPENDIDO') suspendidos = count;
    if (item.estado === 'INACTIVO') inactivos = count;
  }

  const porNivel = {
    ESTANDAR: 0,
    FRECUENTE: 0,
    PREMIUM: 0
  };

  for (const item of countsByNivel) {
    if (porNivel[item.nivel] !== undefined) {
      porNivel[item.nivel] = Number(item._count.id_fidelizacion);
    }
  }

  const tasaAfiliacion = totalPacientes > 0
    ? Number(((totalAfiliados / totalPacientes) * 100).toFixed(1))
    : 0;

  return {
    totalPacientes,
    totalAfiliados,
    noAfiliados: Math.max(0, totalPacientes - totalAfiliados),
    activos,
    suspendidos,
    inactivos,
    tasaAfiliacion,
    porNivel
  };
}

async function enrollPatient({ patientId, nivel = 'ESTANDAR', puntos = 0, notas = '' }) {
  if (!/^\d+$/.test(String(patientId)) || BigInt(patientId) < 1n) {
    throw new LoyaltyError(400, 'El ID del paciente es obligatorio y debe ser válido.');
  }
  const pId = BigInt(patientId);

  const patient = await repository.paciente.findUnique({
    where: { id_paciente: pId },
    include: { fidelizacion: true }
  });

  if (!patient) {
    throw new LoyaltyError(404, 'El paciente especificado no existe.');
  }

  if (patient.fidelizacion) {
    throw new LoyaltyError(409, 'El paciente ya se encuentra afiliado al programa de fidelización.');
  }

  const nivelUpper = nivel && VALID_NIVELES_FIDELIZACION.includes(nivel.toUpperCase())
    ? nivel.toUpperCase()
    : 'ESTANDAR';

  const member = await repository.fidelizacion_paciente.create({
    data: {
      id_paciente: pId,
      estado: 'ACTIVO',
      nivel: nivelUpper,
      puntos_acumulados: Number(puntos) || 0,
      notas: notas ? notas.trim() : null
    },
    include: {
      paciente: true
    }
  });

  return {
    message: 'Paciente afiliado exitosamente al programa de fidelización.',
    member: serializeLoyaltyRecord(member),
    patient: serializePatientWithLoyalty(member.paciente)
  };
}

async function updatePatientLoyalty(patientId, data) {
  const pId = BigInt(patientId);

  const existing = await repository.fidelizacion_paciente.findUnique({
    where: { id_paciente: pId }
  });

  if (!existing) {
    throw new LoyaltyError(404, 'El paciente no cuenta con registro de fidelización.');
  }

  const updateData = {
    fecha_actualizacion: new Date()
  };

  if (data.estado !== undefined) {
    const estadoUpper = data.estado.toUpperCase();
    if (!VALID_ESTADOS_FIDELIZACION.includes(estadoUpper)) {
      throw new LoyaltyError(400, `Estado inválido. Valores permitidos: ${VALID_ESTADOS_FIDELIZACION.join(', ')}.`);
    }
    updateData.estado = estadoUpper;
  }

  if (data.nivel !== undefined) {
    const nivelUpper = data.nivel.toUpperCase();
    if (!VALID_NIVELES_FIDELIZACION.includes(nivelUpper)) {
      throw new LoyaltyError(400, `Nivel inválido. Valores permitidos: ${VALID_NIVELES_FIDELIZACION.join(', ')}.`);
    }
    updateData.nivel = nivelUpper;
  }

  if (data.puntosAcumulados !== undefined) {
    const puntos = Number(data.puntosAcumulados);
    if (isNaN(puntos) || puntos < 0) {
      throw new LoyaltyError(400, 'Los puntos deben ser un número entero mayor o igual a 0.');
    }
    updateData.puntos_acumulados = puntos;
  }

  if (data.notas !== undefined) {
    updateData.notas = data.notas ? data.notas.trim() : null;
  }

  const updated = await repository.fidelizacion_paciente.update({
    where: { id_paciente: pId },
    data: updateData,
    include: {
      paciente: true
    }
  });

  return {
    message: 'Estado de fidelización actualizado correctamente.',
    member: serializeLoyaltyRecord(updated),
    patient: serializePatientWithLoyalty(updated.paciente)
  };
}

async function removePatientLoyalty(patientId) {
  const pId = BigInt(patientId);

  const existing = await repository.fidelizacion_paciente.findUnique({
    where: { id_paciente: pId }
  });

  if (!existing) {
    throw new LoyaltyError(404, 'El paciente no cuenta con registro de fidelización.');
  }

  await repository.fidelizacion_paciente.delete({
    where: { id_paciente: pId }
  });

  return {
    success: true,
    message: 'El paciente fue retirado del programa de fidelización.'
  };
}

module.exports = {
  listPatientsWithLoyalty,
  getLoyaltyStats,
  enrollPatient,
  updatePatientLoyalty,
  removePatientLoyalty,
  LoyaltyError
};
