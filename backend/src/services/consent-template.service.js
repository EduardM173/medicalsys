const crypto = require('crypto');
const repository = require('../repositories/consent.repository');
const storageService = require('./storage/storage.service');
const pdfGenerator = require('./pdf-generator.service');

/**
 * HU-33 / MED-308: Catálogo y versionado de plantillas de consentimiento.
 *
 * La generación (generateConsent) toma la plantilla activa del procedimiento,
 * renderiza las variables ({{paciente_nombre}}, {{paciente_ci}}, {{medico_nombre}},
 * {{medico_especialidad}}, {{fecha}}, {{procedimiento}}), genera el PDF inmutable
 * (MED-309) y persiste el ConsentDocument en estado GENERADO conservando la
 * versión exacta de la plantilla utilizada (PA-01, PA-02).
 */

class ConsentTemplateError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function parseId(value, entity) {
  if (!/^\d+$/.test(String(value)) || BigInt(value) < 1n) {
    throw new ConsentTemplateError(400, `Identificador de ${entity} no válido.`);
  }
  return BigInt(value);
}

function requiredText(value, fieldName, maxLength) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    throw new ConsentTemplateError(400, `${fieldName} es obligatorio.`);
  }
  if (normalized.length > maxLength) {
    throw new ConsentTemplateError(400, `${fieldName} supera la longitud permitida.`);
  }
  return normalized;
}

function generateFolio() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `CI-${datePart}-${randomPart}`;
}

function isFolioCollision(error) {
  return repository.isUniqueConstraintError(error) &&
    String(error.meta?.target || '').includes('folio');
}

function toTemplate(template) {
  return {
    id: Number(template.id_plantilla),
    code: template.codigo,
    title: template.titulo,
    procedureType: template.tipo_procedimiento,
    content: template.contenido,
    version: template.version,
    active: template.activa,
    createdAt: template.fecha_creacion.toISOString(),
    updatedAt: template.fecha_actualizacion.toISOString()
  };
}

function toPatient(patient) {
  return {
    id: Number(patient.id_paciente),
    fullName: [patient.nombres, patient.apellidos].filter(Boolean).join(' '),
    documentNumber: patient.documento_identidad || '',
    complement: patient.complemento || ''
  };
}

function toDoctor(doctor) {
  const usuario = (doctor && doctor.usuario) || {};
  return {
    id: Number(doctor.id_medico),
    fullName: [usuario.nombres, usuario.apellidos].filter(Boolean).join(' '),
    specialty: doctor.especialidad || ''
  };
}

async function listTemplates({ activeOnly = false } = {}) {
  const templates = await repository.plantilla_consentimiento.findMany({
    where: activeOnly ? { activa: true } : {},
    orderBy: [{ codigo: 'asc' }, { version: 'desc' }]
  });
  return { templates: templates.map(toTemplate) };
}

async function getTemplate(identifierInput) {
  const template = await resolveTemplate(identifierInput);
  return { template: toTemplate(template) };
}

async function resolveTemplate(identifierInput) {
  const input = String(identifierInput || '').trim();
  let template = null;
  if (/^\d+$/.test(input)) {
    template = await repository.plantilla_consentimiento.findUnique({
      where: { id_plantilla: BigInt(input) }
    });
  } else if (input) {
    template = await repository.plantilla_consentimiento.findFirst({
      where: { codigo: input }
    });
  }
  if (!template) {
    throw new ConsentTemplateError(404, 'Plantilla de consentimiento no encontrada.');
  }
  return template;
}

async function resolveActiveTemplate(identifierInput) {
  const input = String(identifierInput || '').trim();
  let template = null;
  if (/^\d+$/.test(input)) {
    template = await repository.plantilla_consentimiento.findFirst({
      where: { id_plantilla: BigInt(input), activa: true }
    });
  } else if (input) {
    template = await repository.plantilla_consentimiento.findFirst({
      where: { codigo: input, activa: true }
    });
  }
  if (!template) {
    throw new ConsentTemplateError(
      404,
      'No existe una plantilla activa para el procedimiento solicitado.'
    );
  }
  return template;
}

async function createTemplate(input) {
  const codigo = requiredText(input.code, 'El código de la plantilla', 50).toUpperCase();
  const titulo = requiredText(input.title, 'El título de la plantilla', 180);
  const tipoProcedimiento = requiredText(input.procedureType, 'El tipo de procedimiento', 100);
  const contenido = requiredText(input.content, 'El contenido de la plantilla', 100000);
  if (!/\{\{\s*paciente_nombre\s*\}\}/.test(contenido)) {
    throw new ConsentTemplateError(
      400,
      'La plantilla debe incluir la variable {{paciente_nombre}} en su contenido.'
    );
  }

  const existing = await repository.plantilla_consentimiento.findFirst({
    where: { codigo }
  });
  if (existing) {
    throw new ConsentTemplateError(409, 'Ya existe una plantilla con ese código.');
  }

  const template = await repository.plantilla_consentimiento.create({
    data: {
      codigo,
      titulo,
      tipo_procedimiento: tipoProcedimiento,
      contenido,
      version: 1,
      activa: input.active !== false
    }
  });
  return toTemplate(template);
}

async function updateTemplate(idInput, input) {
  const idPlantilla = parseId(idInput, 'plantilla');
  const template = await repository.plantilla_consentimiento.findUnique({
    where: { id_plantilla: idPlantilla }
  });
  if (!template) {
    throw new ConsentTemplateError(404, 'Plantilla de consentimiento no encontrada.');
  }

  const titulo = input.title !== undefined
    ? requiredText(input.title, 'El título de la plantilla', 180)
    : template.titulo;
  const tipoProcedimiento = input.procedureType !== undefined
    ? requiredText(input.procedureType, 'El tipo de procedimiento', 100)
    : template.tipo_procedimiento;
  const contenido = input.content !== undefined
    ? requiredText(input.content, 'El contenido de la plantilla', 100000)
    : template.contenido;
  if (!/\{\{\s*paciente_nombre\s*\}\}/.test(contenido)) {
    throw new ConsentTemplateError(
      400,
      'La plantilla debe incluir la variable {{paciente_nombre}} en su contenido.'
    );
  }

  // PA-02: cualquier modificación estructural incrementa la versión. Los
  // documentos ya generados conservan la versión con la que fueron emitidos.
  const contentChanged =
    titulo !== template.titulo ||
    tipoProcedimiento !== template.tipo_procedimiento ||
    contenido !== template.contenido;
  const version = contentChanged ? template.version + 1 : template.version;

  const updated = await repository.plantilla_consentimiento.update({
    where: { id_plantilla: idPlantilla },
    data: {
      titulo,
      tipo_procedimiento: tipoProcedimiento,
      contenido,
      version,
      activa: input.active !== undefined ? input.active : template.activa,
      fecha_actualizacion: new Date()
    }
  });
  return toTemplate(updated);
}

function renderContent(template, variables) {
  return template.contenido.replace(
    /\{\{\s*([a-zA-Z_]+)\s*\}\}/g,
    (match, name) => (variables[name] !== undefined ? variables[name] : '')
  );
}

async function findAuthenticatedDoctor(userIdInput) {
  const doctor = await repository.medico.findUnique({
    where: { id_usuario: BigInt(userIdInput) },
    select: {
      id_medico: true,
      especialidad: true,
      usuario: { select: { nombres: true, apellidos: true } }
    }
  });
  if (!doctor) {
    throw new ConsentTemplateError(
      403,
      'El usuario autenticado no posee un perfil médico asociado.'
    );
  }
  return doctor;
}

/**
 * MED-308 / MED-309: genera el documento de consentimiento a partir de la
 * plantilla activa, renderiza las variables y persiste el PDF inmutable con su
 * hash SHA-256 (PA-01, PA-02, PA-03).
 */
async function generateConsent(userIdInput, input) {
  const patientId = parseId(input.patientId, 'paciente');
  const appointmentId = input.appointmentId
    ? parseId(input.appointmentId, 'cita')
    : null;
  const template = await resolveActiveTemplate(input.templateId || input.code || input.procedureCode);

  const patient = await repository.paciente.findUnique({
    where: { id_paciente: patientId },
    select: {
      id_paciente: true,
      nombres: true,
      apellidos: true,
      documento_identidad: true,
      complemento: true
    }
  });
  if (!patient) {
    throw new ConsentTemplateError(404, 'Paciente no encontrado.');
  }

  const doctor = await findAuthenticatedDoctor(userIdInput);

  if (appointmentId) {
    const appointment = await repository.cita.findUnique({
      where: { id_cita: appointmentId },
      select: { id_paciente: true, id_medico: true }
    });
    if (!appointment) throw new ConsentTemplateError(404, 'Cita no encontrada.');
    if (appointment.id_paciente !== patientId) {
      throw new ConsentTemplateError(400, 'La cita no corresponde al paciente seleccionado.');
    }
    if (appointment.id_medico !== doctor.id_medico) {
      throw new ConsentTemplateError(403, 'La cita no corresponde al médico autenticado.');
    }
  }

  const fecha = new Date().toISOString().slice(0, 10);
  const variables = {
    paciente_nombre: toPatient(patient).fullName,
    paciente_ci: patient.documento_identidad || '',
    paciente_complemento: patient.complemento || '',
    medico_nombre: toDoctor(doctor).fullName,
    medico_especialidad: doctor.especialidad || '',
    procedimiento: template.titulo,
    fecha
  };
  const contenido = renderContent(template, variables);

  const folio = await createUniqueFolio();
  const pdfResult = await pdfGenerator.renderConsentPdf({
    title: template.titulo,
    folio,
    procedure: template.titulo,
    content: contenido,
    patient,
    doctor: doctor.usuario,
    generatedAt: new Date()
  });

  // PA-06: el PDF se persiste cifrado AES-256-GCM como el resto de archivos clínicos.
  const encryptedPdf = encryptPdfBuffer(pdfResult.buffer);
  const storageResult = await storageService.saveFile({
    buffer: encryptedPdf,
    filename: `${folio}.pdf`,
    mimeType: 'application/pdf'
  });

  const consent = await repository.consentimiento_informado.create({
    data: {
      id_paciente: patientId,
      id_medico: doctor.id_medico,
      id_cita: appointmentId,
      id_plantilla: template.id_plantilla,
      version_plantilla: template.version,
      folio,
      procedimiento: template.titulo,
      contenido,
      estado: 'GENERADO',
      pdf_path: storageResult.storageKey,
      pdf_hash: pdfResult.sha256
    },
    select: consentsSelect
  });

  return {
    id: Number(consent.id_consentimiento),
    folio: consent.folio,
    procedure: consent.procedimiento,
    content: consent.contenido,
    status: consent.estado,
    templateVersion: consent.version_plantilla,
    template: {
      id: Number(template.id_plantilla),
      code: template.codigo,
      title: template.titulo,
      version: template.version
    },
    pdfHash: consent.pdf_hash || null,
    hasPdf: Boolean(consent.pdf_path),
    generatedAt: consent.fecha_generacion.toISOString(),
    patient: toPatient(patient),
    doctor: toDoctor(doctor)
  };
}

async function createUniqueFolio() {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const folio = generateFolio();
    try {
      const existing = await repository.consentimiento_informado.findUnique({
        where: { folio },
        select: { id_consentimiento: true }
      });
      if (!existing) return folio;
    } catch (_error) {
      // reintentar con otro folio
    }
  }
  throw new ConsentTemplateError(500, 'No fue posible generar un folio único.');
}

const consentsSelect = {
  id_consentimiento: true,
  folio: true,
  procedimiento: true,
  contenido: true,
  estado: true,
  version_plantilla: true,
  pdf_path: true,
  pdf_hash: true,
  fecha_generacion: true,
  paciente: {
    select: {
      id_paciente: true,
      nombres: true,
      apellidos: true,
      documento_identidad: true,
      complemento: true
    }
  },
  medico: {
    select: {
      id_medico: true,
      especialidad: true,
      usuario: { select: { nombres: true, apellidos: true } }
    }
  },
  plantilla: {
    select: {
      id_plantilla: true,
      codigo: true,
      titulo: true,
      version: true
    }
  }
};

function encryptPdfBuffer(buffer) {
  const cryptoService = require('./crypto.service');
  return cryptoService.encryptBuffer(buffer);
}

module.exports = {
  ConsentTemplateError,
  createTemplate,
  generateConsent,
  getTemplate,
  listTemplates,
  renderContent,
  toTemplate,
  updateTemplate
};