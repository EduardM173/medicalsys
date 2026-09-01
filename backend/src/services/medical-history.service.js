const prisma = require('../config/prisma');

class MedicalHistoryError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function parsePatientId(value) {
  if (!/^\d+$/.test(String(value)) || BigInt(value) < 1n) {
    throw new MedicalHistoryError(400, 'Identificador de paciente no válido.');
  }
  return BigInt(value);
}

function toPatient(patient) {
  return {
    id: Number(patient.id_paciente),
    nombres: patient.nombres,
    apellidos: patient.apellidos,
    documentoIdentidad: patient.documento_identidad,
    complemento: patient.complemento,
    fechaNacimiento: patient.fecha_nacimiento?.toISOString().slice(0, 10) || null,
    telefono: patient.telefono,
    grupoSanguineo: patient.grupo_sanguineo
  };
}

function toDoctor(doctor) {
  return {
    id: Number(doctor.id_medico),
    nombreCompleto: `${doctor.usuario.nombres} ${doctor.usuario.apellidos}`.trim(),
    especialidad: doctor.especialidad
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
    medico: toDoctor(attention.medico)
  };
}

function toHistory(history) {
  return {
    id: Number(history.id_historia),
    pacienteId: Number(history.id_paciente),
    fechaApertura: history.fecha_apertura.toISOString().slice(0, 10),
    antecedentes: history.antecedentes,
    alergias: history.alergias,
    condicionesCronicas: history.condiciones_cronicas,
    observacionesGenerales: history.observaciones_generales
  };
}

async function getMedicalHistoryByPatientId(patientIdInput) {
  const patientId = parsePatientId(patientIdInput);
  const patient = await prisma.paciente.findUnique({
    where: { id_paciente: patientId },
    select: {
      id_paciente: true,
      nombres: true,
      apellidos: true,
      documento_identidad: true,
      complemento: true,
      fecha_nacimiento: true,
      telefono: true,
      grupo_sanguineo: true,
      historia_clinica: {
        select: {
          id_historia: true,
          id_paciente: true,
          fecha_apertura: true,
          antecedentes: true,
          alergias: true,
          condiciones_cronicas: true,
          observaciones_generales: true,
          atencion_medica: {
            orderBy: { fecha_atencion: 'desc' },
            select: {
              id_atencion: true,
              fecha_atencion: true,
              motivo_consulta: true,
              anamnesis: true,
              diagnostico_codigo: true,
              diagnostico_descripcion: true,
              tratamiento: true,
              observaciones: true,
              presion_sistolica: true,
              presion_diastolica: true,
              frecuencia_cardiaca: true,
              temperatura: true,
              saturacion_oxigeno: true,
              peso_kg: true,
              talla_cm: true,
              medico: {
                select: {
                  id_medico: true,
                  especialidad: true,
                  usuario: {
                    select: {
                      nombres: true,
                      apellidos: true
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  if (!patient) {
    throw new MedicalHistoryError(404, 'Paciente no encontrado.');
  }

  const history = patient.historia_clinica;
  return {
    patient: toPatient(patient),
    history: history ? toHistory(history) : null,
    attentions: history ? history.atencion_medica.map(toAttention) : []
  };
}

module.exports = {
  getMedicalHistoryByPatientId,
  MedicalHistoryError
};
