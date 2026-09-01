const prisma = require('../config/prisma');

class AttentionError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function parseId(value, entity, optional = false) {
  if (optional && (value === undefined || value === null || value === '')) return null;
  if (!/^\d+$/.test(String(value)) || BigInt(value) < 1n) {
    throw new AttentionError(400, `Identificador de ${entity} no válido.`);
  }
  return BigInt(value);
}

function requiredText(value, fieldName, maxLength) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    throw new AttentionError(400, `${fieldName} es obligatorio.`);
  }
  if (maxLength && normalized.length > maxLength) {
    throw new AttentionError(400, `${fieldName} supera la longitud permitida.`);
  }
  return normalized;
}

function optionalText(value, maxLength) {
  if (value === undefined || value === null) return null;
  const normalized = typeof value === 'string' ? value.trim() : String(value).trim();
  if (!normalized) return null;
  if (maxLength && normalized.length > maxLength) {
    return normalized.slice(0, maxLength);
  }
  return normalized;
}

function parseNumber(value, fieldName, min, max, isInteger = false) {
  if (value === undefined || value === null || value === '') return null;
  const num = isInteger ? parseInt(value, 10) : parseFloat(value);
  if (isNaN(num)) {
    throw new AttentionError(400, `${fieldName} debe ser un valor numérico.`);
  }
  if (min !== undefined && num < min) {
    throw new AttentionError(400, `${fieldName} debe ser mayor o igual a ${min}.`);
  }
  if (max !== undefined && num > max) {
    throw new AttentionError(400, `${fieldName} debe ser menor o igual a ${max}.`);
  }
  return num;
}

function parseBloodPressure(input) {
  let sistolica = parseNumber(input.presionSistolica ?? input.presion_sistolica, 'Presión sistólica', 40, 300, true);
  let diastolica = parseNumber(input.presionDiastolica ?? input.presion_diastolica, 'Presión diastólica', 30, 200, true);

  if ((!sistolica || !diastolica) && (input.presionArterial || input.presion_arterial)) {
    const bpStr = String(input.presionArterial || input.presion_arterial).trim();
    const parts = bpStr.split(/[\/\-]/).map((p) => p.trim());
    if (parts.length === 2) {
      sistolica = parseNumber(parts[0], 'Presión sistólica', 40, 300, true);
      diastolica = parseNumber(parts[1], 'Presión diastólica', 30, 200, true);
    }
  }

  return { sistolica, diastolica };
}

function toDoctor(doctor) {
  return {
    id: Number(doctor.id_medico),
    nombreCompleto: `${doctor.usuario.nombres} ${doctor.usuario.apellidos}`.trim(),
    especialidad: doctor.especialidad
  };
}

function toPatient(patient) {
  return {
    id: Number(patient.id_paciente),
    nombres: patient.nombres,
    apellidos: patient.apellidos,
    documentoIdentidad: patient.documento_identidad,
    complemento: patient.complemento
  };
}

function toAttention(attention) {
  const sistolica = attention.presion_sistolica;
  const diastolica = attention.presion_diastolica;
  const peso = attention.peso_kg ? Number(attention.peso_kg) : null;
  const talla = attention.talla_cm ? Number(attention.talla_cm) : null;
  let imc = null;
  if (peso && talla && talla > 0) {
    const tallaM = talla / 100;
    imc = Number((peso / (tallaM * tallaM)).toFixed(2));
  }

  return {
    id: Number(attention.id_atencion),
    idHistoria: Number(attention.id_historia),
    idCita: attention.id_cita ? Number(attention.id_cita) : null,
    fechaAtencion: attention.fecha_atencion.toISOString(),
    motivoConsulta: attention.motivo_consulta,
    anamnesis: attention.anamnesis,
    diagnosticoCodigo: attention.diagnostico_codigo,
    diagnosticoDescripcion: attention.diagnostico_descripcion,
    tratamiento: attention.tratamiento,
    observaciones: attention.observaciones,
    presionSistolica: sistolica,
    presionDiastolica: diastolica,
    presionArterial: sistolica && diastolica ? `${sistolica}/${diastolica}` : null,
    frecuenciaCardiaca: attention.frecuencia_cardiaca,
    temperatura: attention.temperatura ? Number(attention.temperatura) : null,
    saturacionOxigeno: attention.saturacion_oxigeno,
    pesoKg: peso,
    tallaCm: talla,
    imc,
    medico: attention.medico ? toDoctor(attention.medico) : null,
    paciente: attention.historia_clinica?.paciente ? toPatient(attention.historia_clinica.paciente) : null
  };
}

async function resolveDoctor(userId, explicitDoctorId) {
  if (explicitDoctorId) {
    const doctorId = parseId(explicitDoctorId, 'médico');
    const doctor = await prisma.medico.findUnique({
      where: { id_medico: doctorId },
      include: { usuario: true }
    });
    if (!doctor) throw new AttentionError(404, 'Médico no encontrado.');
    return doctor;
  }

  const doctor = await prisma.medico.findUnique({
    where: { id_usuario: BigInt(userId) },
    include: { usuario: true }
  });

  if (!doctor) {
    throw new AttentionError(403, 'El usuario autenticado no posee un perfil médico asociado.');
  }
  return doctor;
}

/**
 * PA-01 a PA-06: Registro de Atención Médica dentro de transacción.
 */
async function createAttention(userId, input) {
  const patientId = parseId(input.patientId ?? input.id_paciente, 'paciente');
  const appointmentId = parseId(input.appointmentId ?? input.id_cita, 'cita', true);
  const doctor = await resolveDoctor(userId, input.doctorId ?? input.id_medico);

  const motivoConsulta = requiredText(input.motivoConsulta ?? input.motivo_consulta, 'El motivo de consulta', 1000);
  const anamnesis = optionalText(input.anamnesis, 5000);
  const diagnosticoCodigo = optionalText(input.diagnosticoCodigo ?? input.diagnostico_codigo, 30);
  const diagnosticoDescripcion = optionalText(input.diagnosticoDescripcion ?? input.diagnostico_descripcion ?? input.diagnostico, 1000);
  const tratamiento = optionalText(input.tratamiento, 5000);
  const observaciones = optionalText(input.observaciones, 5000);

  const { sistolica, diastolica } = parseBloodPressure(input);
  const frecuenciaCardiaca = parseNumber(input.frecuenciaCardiaca ?? input.frecuencia_cardiaca, 'Frecuencia cardíaca', 20, 250, true);
  const temperatura = parseNumber(input.temperatura, 'Temperatura', 30, 45);
  const saturacionOxigeno = parseNumber(input.saturacionOxigeno ?? input.saturacion_oxigeno, 'Saturación de oxígeno', 50, 100, true);
  const pesoKg = parseNumber(input.pesoKg ?? input.peso_kg ?? input.peso, 'Peso', 1, 500);
  const tallaCm = parseNumber(input.tallaCm ?? input.talla_cm ?? input.talla, 'Talla', 20, 260);

  const result = await prisma.$transaction(async (tx) => {
    // PA-01 (MED-66): Validar que el paciente exista
    const patient = await tx.paciente.findUnique({
      where: { id_paciente: patientId },
      include: { historia_clinica: true }
    });

    if (!patient) {
      throw new AttentionError(404, 'Paciente no encontrado.');
    }

    // PA-04 (MED-69): Verificar o crear automáticamente Historia Clínica
    let history = patient.historia_clinica;
    if (!history) {
      history = await tx.historia_clinica.create({
        data: {
          id_paciente: patientId,
          fecha_apertura: new Date()
        }
      });
    }

    // PA-05 (MED-70): Validar cita si está presente
    if (appointmentId) {
      const appointment = await tx.cita.findUnique({
        where: { id_cita: appointmentId }
      });

      if (!appointment) {
        throw new AttentionError(404, 'Cita médica no encontrada.');
      }

      if (appointment.id_paciente !== patientId) {
        throw new AttentionError(400, 'La cita no corresponde al paciente indicado.');
      }

      if (appointment.id_medico !== doctor.id_medico) {
        throw new AttentionError(400, 'La cita no corresponde al médico tratante.');
      }

      // PA-06 (MED-71): Actualizar estado de la cita a COMPLETADA
      await tx.cita.update({
        where: { id_cita: appointmentId },
        data: { estado: 'COMPLETADA' }
      });
    }

    // PA-02 & PA-03: Crear registro de Atención Médica con signos vitales
    const createdAttention = await tx.atencion_medica.create({
      data: {
        id_historia: history.id_historia,
        id_medico: doctor.id_medico,
        id_cita: appointmentId,
        fecha_atencion: input.fechaAtencion ? new Date(input.fechaAtencion) : new Date(),
        motivo_consulta: motivoConsulta,
        anamnesis: anamnesis,
        diagnostico_codigo: diagnosticoCodigo,
        diagnostico_descripcion: diagnosticoDescripcion,
        tratamiento: tratamiento,
        observaciones: observaciones,
        presion_sistolica: sistolica,
        presion_diastolica: diastolica,
        frecuencia_cardiaca: frecuenciaCardiaca,
        temperatura: temperatura !== null ? temperatura : null,
        saturacion_oxigeno: saturacionOxigeno,
        peso_kg: pesoKg !== null ? pesoKg : null,
        talla_cm: tallaCm !== null ? tallaCm : null
      },
      include: {
        medico: { include: { usuario: true } },
        historia_clinica: { include: { paciente: true } }
      }
    });

    return createdAttention;
  });

  return toAttention(result);
}

async function getAttentionsByHistoryId(historyIdInput) {
  const historyId = parseId(historyIdInput, 'historia clínica');
  const attentions = await prisma.atencion_medica.findMany({
    where: { id_historia: historyId },
    orderBy: { fecha_atencion: 'desc' },
    include: {
      medico: { include: { usuario: true } },
      historia_clinica: { include: { paciente: true } }
    }
  });

  return attentions.map(toAttention);
}

async function getAttentionOptions(userId) {
  const doctor = await prisma.medico.findUnique({
    where: { id_usuario: BigInt(userId) },
    include: { usuario: true }
  });

  const [patients, doctors, appointments] = await Promise.all([
    prisma.paciente.findMany({
      where: { activo: true },
      orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }],
      select: {
        id_paciente: true,
        nombres: true,
        apellidos: true,
        documento_identidad: true,
        complemento: true
      }
    }),
    prisma.medico.findMany({
      where: { activo: true },
      include: { usuario: true }
    }),
    prisma.cita.findMany({
      where: {
        ...(doctor ? { id_medico: doctor.id_medico } : {}),
        estado: { in: ['PROGRAMADA', 'CONFIRMADA', 'EN_CONSULTA'] }
      },
      orderBy: { fecha_hora_inicio: 'desc' },
      take: 100,
      include: {
        paciente: true,
        servicio_medico: true
      }
    })
  ]);

  return {
    currentDoctor: doctor ? toDoctor(doctor) : null,
    patients: patients.map(toPatient),
    doctors: doctors.map(toDoctor),
    appointments: appointments.map((cita) => ({
      id: Number(cita.id_cita),
      pacienteId: Number(cita.id_paciente),
      medicoId: Number(cita.id_medico),
      pacienteNombre: `${cita.paciente.nombres} ${cita.paciente.apellidos}`.trim(),
      servicioNombre: cita.servicio_medico.nombre,
      fechaHoraInicio: cita.fecha_hora_inicio.toISOString(),
      estado: cita.estado,
      motivo: cita.motivo
    }))
  };
}

module.exports = {
  createAttention,
  getAttentionsByHistoryId,
  getAttentionOptions,
  AttentionError
};
