const crypto = require('crypto');
const repository = require('../repositories/consent.repository');
const storageService = require('./storage/storage.service');
const cryptoService = require('./crypto.service');
const digitalSignature = require('./digital-signature.service');

const folioAttempts = 3;

const consentSelect = {
  id_consentimiento: true,
  folio: true,
  procedimiento: true,
  contenido: true,
  estado: true,
  version_plantilla: true,
  pdf_path: true,
  pdf_hash: true,
  fecha_generacion: true,
  fecha_firma: true,
  firma_storage_key: true,
  firma_hash_sha256: true,
  plantilla: {
    select: {
      id_plantilla: true,
      codigo: true,
      titulo: true,
      version: true
    }
  },
  firma: {
    select: {
      id_firma: true,
      tipo_firmante: true,
      nombre_firmante: true,
      ci_firmante: true,
      relacion_tutor: true,
      emisor_ca: true,
      serial_number: true,
      valido_desde: true,
      valido_hasta: true,
      algoritmo: true,
      fecha_firma: true,
      hash_documento: true,
      firma_bruta: true,
      certificado_pem: true,
      resultado_validacion: true
    }
  },
  anulacion: {
    select: {
      id_anulacion: true,
      motivo: true,
      anulado_por_usuario: true,
      fecha_anulacion: true
    }
  },
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
  cita: {
    select: {
      id_cita: true,
      fecha_hora_inicio: true,
      fecha_hora_fin: true,
      estado: true,
      servicio_medico: { select: { nombre: true } }
    }
  }
};

class ConsentError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function parseId(value, entity, optional = false) {
  if (optional && (value === undefined || value === null || value === '')) return null;
  if (!/^\d+$/.test(String(value)) || BigInt(value) < 1n) {
    throw new ConsentError(400, `Identificador de ${entity} no válido.`);
  }
  return BigInt(value);
}

function requiredText(value, fieldName, maxLength) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    throw new ConsentError(400, `${fieldName} es obligatorio.`);
  }
  if (normalized.length > maxLength) {
    throw new ConsentError(400, `${fieldName} supera la longitud permitida.`);
  }
  return normalized;
}

function generateFolio() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `CI-${datePart}-${randomPart}`;
}

function toDoctor(doctor) {
  return {
    id: Number(doctor.id_medico),
    fullName: `${doctor.usuario.nombres} ${doctor.usuario.apellidos}`.trim(),
    specialty: doctor.especialidad
  };
}

function toPatient(patient) {
  return {
    id: Number(patient.id_paciente),
    fullName: `${patient.nombres} ${patient.apellidos}`.trim(),
    documentNumber: patient.documento_identidad || '',
    complement: patient.complemento || ''
  };
}

function toAppointment(appointment) {
  if (!appointment) return null;
  return {
    id: Number(appointment.id_cita),
    startTime: appointment.fecha_hora_inicio.toISOString(),
    endTime: appointment.fecha_hora_fin.toISOString(),
    status: appointment.estado,
    service: appointment.servicio_medico.nombre
  };
}

function toSignature(signature) {
  if (!signature) return null;
  return {
    id: Number(signature.id_firma),
    signerType: signature.tipo_firmante,
    signerName: signature.nombre_firmante,
    signerCi: signature.ci_firmante,
    tutorRelationship: signature.relacion_tutor || null,
    issuer: signature.emisor_ca,
    serialNumber: signature.serial_number,
    validFrom: signature.valido_desde?.toISOString() || null,
    validTo: signature.valido_hasta?.toISOString() || null,
    algorithm: signature.algoritmo,
    signedAt: signature.fecha_firma.toISOString(),
    documentHash: signature.hash_documento || null,
    validationResult: signature.resultado_validacion
  };
}

function toAnnulment(annulment) {
  if (!annulment) return null;
  return {
    id: Number(annulment.id_anulacion),
    reason: annulment.motivo,
    cancelledByUserId: Number(annulment.anulado_por_usuario),
    cancelledAt: annulment.fecha_anulacion.toISOString()
  };
}

function toConsent(consent) {
  return {
    id: Number(consent.id_consentimiento),
    folio: consent.folio,
    procedure: consent.procedimiento,
    content: consent.contenido,
    status: consent.estado,
    generatedAt: consent.fecha_generacion.toISOString(),
    signedAt: consent.fecha_firma?.toISOString() || null,
    templateVersion: consent.version_plantilla || null,
    template: consent.plantilla ? {
      id: Number(consent.plantilla.id_plantilla),
      code: consent.plantilla.codigo,
      title: consent.plantilla.titulo,
      version: consent.plantilla.version
    } : null,
    pdfAvailable: Boolean(consent.pdf_path),
    pdfHash: consent.pdf_hash || null,
    signature: toSignature(consent.firma),
    annulment: toAnnulment(consent.anulacion),
    signatureHash: consent.firma_hash_sha256 || null,
    hasSignature: Boolean(consent.firma_storage_key || consent.firma_hash_sha256 || consent.firma),
    patient: toPatient(consent.paciente),
    doctor: toDoctor(consent.medico),
    appointment: toAppointment(consent.cita)
  };
}

/**
 * Lee y descifra el PDF almacenado del consentimiento (PA-06: se persiste
 * cifrado AES-256-GCM; el hash firmado corresponde al PDF en claro).
 */
async function readStoredPdfBuffer(consent) {
  if (!consent.pdf_path) {
    throw new ConsentError(400, 'El consentimiento aún no cuenta con un documento PDF generado.');
  }
  const storedFile = await storageService.getFileStream(consent.pdf_path, 'LOCAL');
  const chunks = [];
  for await (const chunk of storedFile.stream) chunks.push(chunk);
  return cryptoService.decryptBuffer(Buffer.concat(chunks));
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
    throw new ConsentError(
      403,
      'El usuario autenticado no posee un perfil médico asociado.'
    );
  }
  return doctor;
}

async function validateAssociations(patientId, doctorId, appointmentId) {
  const patient = await repository.paciente.findUnique({
    where: { id_paciente: patientId },
    select: { id_paciente: true }
  });
  if (!patient) throw new ConsentError(404, 'Paciente no encontrado.');

  if (!appointmentId) return;
  const appointment = await repository.cita.findUnique({
    where: { id_cita: appointmentId },
    select: { id_paciente: true, id_medico: true }
  });
  if (!appointment) throw new ConsentError(404, 'Cita no encontrada.');
  if (appointment.id_paciente !== patientId) {
    throw new ConsentError(400, 'La cita no corresponde al paciente seleccionado.');
  }
  if (appointment.id_medico !== doctorId) {
    throw new ConsentError(403, 'La cita no corresponde al médico autenticado.');
  }
}

function isFolioCollision(error) {
  if (!repository.isUniqueConstraintError(error)) {
    return false;
  }
  return String(error.meta?.target || '').includes('folio');
}

async function createConsent(userIdInput, input) {
  const patientId = parseId(input.patientId, 'paciente');
  const appointmentId = parseId(input.appointmentId, 'cita', true);
  const procedure = requiredText(input.procedure, 'El procedimiento', 255);
  const content = requiredText(input.content, 'El contenido', 100000);
  const doctor = await findAuthenticatedDoctor(userIdInput);
  await validateAssociations(patientId, doctor.id_medico, appointmentId);

  for (let attempt = 1; attempt <= folioAttempts; attempt += 1) {
    try {
      const consent = await repository.consentimiento_informado.create({
        data: {
          id_paciente: patientId,
          id_medico: doctor.id_medico,
          id_cita: appointmentId,
          folio: generateFolio(),
          procedimiento: procedure,
          contenido: content,
          estado: 'GENERADO'
        },
        select: consentSelect
      });
      return toConsent(consent);
    } catch (error) {
      if (!isFolioCollision(error) || attempt === folioAttempts) throw error;
    }
  }

  throw new ConsentError(500, 'No fue posible generar un folio único.');
}

async function getConsentById(userIdInput, consentIdInput) {
  const consentId = parseId(consentIdInput, 'consentimiento');
  const doctor = await findAuthenticatedDoctor(userIdInput);
  const consent = await repository.consentimiento_informado.findFirst({
    where: { id_consentimiento: consentId, id_medico: doctor.id_medico },
    select: consentSelect
  });
  if (!consent) {
    throw new ConsentError(404, 'Consentimiento informado no encontrado.');
  }
  return toConsent(consent);
}

/**
 * Firma del consentimiento informado.
 *
 * Admite dos modos:
 *   1. Legado: signatureData como cadena (solo registra la huella SHA-256).
 *   2. PKI (HU-33): objeto con certificado X.509 y firma criptográfica sobre el
 *      SHA-256 del PDF completo. Si el certificado es inválido/vencido o el
 *      proveedor/CA no está disponible, la operación se aborta y el documento
 *      permanece en su estado actual (PA-10).
 */
async function signConsent(userIdInput, consentIdInput, signatureData) {
  if (signatureData && typeof signatureData === 'object' && !signatureData.signatureData && signatureData.certificate) {
    return signConsentWithCertificate(userIdInput, consentIdInput, signatureData);
  }

  const legacyData = typeof signatureData === 'string'
    ? signatureData
    : (signatureData && typeof signatureData === 'object' ? signatureData.signatureData : null);

  const consentId = parseId(consentIdInput, 'consentimiento');
  const doctor = await findAuthenticatedDoctor(userIdInput);

  if (!legacyData || typeof legacyData !== 'string' || !legacyData.trim()) {
    throw new ConsentError(400, 'Los datos de la firma son obligatorios.');
  }

  const result = await repository.transaction(async (tx) => {
    // PA-01 (MED-163): Validar existencia del consentimiento
    const consent = await tx.consentimiento_informado.findFirst({
      where: { id_consentimiento: consentId, id_medico: doctor.id_medico }
    });

    if (!consent) {
      throw new ConsentError(404, 'Consentimiento informado no encontrado.');
    }

    // PA-02 (MED-164): Validar que no esté ANULADO
    if (consent.estado === 'ANULADO') {
      throw new ConsentError(400, 'No se puede firmar un consentimiento anulado.');
    }

    // PA-07 (MED-169): Validar que no esté ya FIRMADO
    if (consent.estado === 'FIRMADO') {
      throw new ConsentError(409, 'Este consentimiento ya fue firmado. No se permite sobreescribir la firma sin una reexpedición previa.');
    }

    // PA-04 (MED-161, MED-166): Calcular huella SHA-256 de los datos de firma
    const hash = crypto.createHash('sha256').update(legacyData).digest('hex');

    // PA-03 + PA-05 (MED-160, MED-162, MED-165, MED-167): Actualizar fecha_firma, hash y estado
    const updated = await tx.consentimiento_informado.update({
      where: { id_consentimiento: consentId },
      data: {
        estado: 'FIRMADO',
        fecha_firma: new Date(),
        firma_hash_sha256: hash
      },
      select: consentSelect
    });

    return updated;
  });

  return toConsent(result);
}

/**
 * MED-310 / PA-04, PA-05, PA-06, PA-10: firma digital PKI.
 * Valida el certificado X.509, verifica la firma criptográfica sobre el SHA-256
 * del PDF completo y persiste los metadatos en firma_digital_consentimiento.
 */
async function signConsentWithCertificate(userIdInput, consentIdInput, input) {
  const consentId = parseId(consentIdInput, 'consentimiento');
  const doctor = await findAuthenticatedDoctor(userIdInput);

  const signerType = String(input.signerType || 'PACIENTE').toUpperCase();
  if (!['PACIENTE', 'TUTOR'].includes(signerType)) {
    throw new ConsentError(400, 'Tipo de firmante no válido. Use PACIENTE o TUTOR.');
  }
  const signerName = requiredText(input.signerName, 'El nombre del firmante', 180);
  const signerCi = requiredText(input.signerCi, 'El CI del firmante', 40);
  const tutorRelationship = signerType === 'TUTOR'
    ? requiredText(input.tutorRelationship, 'La relación del tutor', 80)
    : null;
  const certificatePem = input.certificate;
  const rawSignature = String(input.signature || '');

  // PA-06 / PA-10: validar el certificado ANTES de iniciar la transacción;
  // ante un certificado inválido o un proveedor de firma no disponible el
  // documento permanece tal cual (PENDING/GENERADO) con un error explícito.
  let certificateInfo;
  try {
    certificateInfo = digitalSignature.validateCertificate(certificatePem);
  } catch (error) {
    if (error instanceof digitalSignature.SignatureError) {
      throw new ConsentError(400, error.message);
    }
    throw error;
  }

  const result = await repository.transaction(async (tx) => {
    const consent = await tx.consentimiento_informado.findFirst({
      where: { id_consentimiento: consentId, id_medico: doctor.id_medico }
    });
    if (!consent) {
      throw new ConsentError(404, 'Consentimiento informado no encontrado.');
    }
    if (consent.estado === 'ANULADO') {
      throw new ConsentError(400, 'No se puede firmar un consentimiento anulado.');
    }
    if (consent.estado === 'FIRMADO') {
      throw new ConsentError(409, 'Este consentimiento ya fue firmado digitalmente.');
    }
    if (!consent.pdf_path || !consent.pdf_hash) {
      throw new ConsentError(
        400,
        'Primero debe generarse el PDF del consentimiento (consulte la vista previa) para poder firmarlo digitalmente.'
      );
    }

    // MED-307: la firma se vincula al SHA-256 del PDF COMPLETO (PA-04).
    const buffer = await readStoredPdfBuffer(consent);
    const currentHash = crypto.createHash('sha256').update(buffer).digest('hex');
    if (currentHash !== consent.pdf_hash) {
      throw new ConsentError(
        423,
        'El PDF almacenado no coincide con el hash registrado; no es posible firmar el documento.'
      );
    }

    if (!rawSignature || !/^[0-9a-f]+$/i.test(rawSignature)) {
      throw new ConsentError(
        400,
        'Los datos de la firma digital son obligatorios (signature en hexadecimal).'
      );
    }
    const verified = digitalSignature.verifySignature(certificatePem, currentHash, rawSignature);
    if (!verified) {
      throw new ConsentError(
        422,
        'La firma digital no se corresponde con el hash del documento firmado.'
      );
    }

    await tx.firma_digital_consentimiento.create({
      data: {
        id_consentimiento: consentId,
        tipo_firmante: signerType,
        nombre_firmante: signerName,
        ci_firmante: signerCi,
        relacion_tutor: tutorRelationship,
        certificado_pem: certificatePem,
        emisor_ca: certificateInfo.issuerCN || certificateInfo.issuer,
        serial_number: certificateInfo.serialNumber,
        valido_desde: new Date(certificateInfo.validFrom),
        valido_hasta: new Date(certificateInfo.validTo),
        algoritmo: 'SHA256withRSA',
        hash_documento: currentHash,
        firma_bruta: rawSignature,
        resultado_validacion: true
      }
    });

    const updated = await tx.consentimiento_informado.update({
      where: { id_consentimiento: consentId },
      data: { estado: 'FIRMADO', fecha_firma: new Date() },
      select: consentSelect
    });
    return updated;
  });

  return toConsent(result);
}

/**
 * MED-311 / PA-03: obtiene el PDF del consentimiento (vista previa pre-firma
 * o descarga del documento firmado, PA-09).
 */
async function getConsentPdf(userIdInput, consentIdInput) {
  const consentId = parseId(consentIdInput, 'consentimiento');
  const doctor = await findAuthenticatedDoctor(userIdInput);
  const consent = await repository.consentimiento_informado.findFirst({
    where: { id_consentimiento: consentId, id_medico: doctor.id_medico },
    select: consentSelect
  });
  if (!consent) {
    throw new ConsentError(404, 'Consentimiento informado no encontrado.');
  }
  const buffer = await readStoredPdfBuffer(consent);
  return {
    buffer,
    fileName: `${consent.folio}.pdf`,
    mimeType: 'application/pdf',
    pdfHash: consent.pdf_hash,
    status: consent.estado,
    signedAt: consent.fecha_firma?.toISOString() || null
  };
}

/**
 * MED-311 / PA-05, PA-09: verificación independiente de integridad.
 * Recalcula el SHA-256 del PDF almacenado, lo contrasta con el hash firmado y
 * verifica la firma criptográfica con la clave pública del certificado.
 */
async function verifyConsent(userIdInput, consentIdInput) {
  const consentId = parseId(consentIdInput, 'consentimiento');
  const doctor = await findAuthenticatedDoctor(userIdInput);
  const consent = await repository.consentimiento_informado.findFirst({
    where: { id_consentimiento: consentId, id_medico: doctor.id_medico },
    select: consentSelect
  });
  if (!consent) {
    throw new ConsentError(404, 'Consentimiento informado no encontrado.');
  }
  if (!consent.firma) {
    return {
      documentId: Number(consentId),
      folio: consent.folio,
      valid: false,
      reason: 'SIN_FIRMA',
      integrity: false,
      signatureVerified: false,
      pdfHash: consent.pdf_hash || null,
      templateVersion: consent.version_plantilla,
      annulled: consent.estado === 'ANULADO',
      status: consent.estado
    };
  }

  const buffer = await readStoredPdfBuffer(consent);
  const currentHash = crypto.createHash('sha256').update(buffer).digest('hex');
  const integrity =
    currentHash === consent.pdf_hash &&
    currentHash === consent.firma.hash_documento;

  let signatureVerified = false;
  try {
    signatureVerified = digitalSignature.verifySignature(
      consent.firma.certificado_pem,
      consent.firma.hash_documento,
      consent.firma.firma_bruta
    );
  } catch (_error) {
    signatureVerified = false;
  }

  return {
    documentId: Number(consentId),
    folio: consent.folio,
    valid: integrity && signatureVerified,
    integrity,
    signatureVerified,
    pdfHash: currentHash,
    expectedHash: consent.firma.hash_documento,
    templateVersion: consent.version_plantilla,
    annulled: consent.estado === 'ANULADO',
    status: consent.estado,
    signature: toSignature(consent.firma)
  };
}

/**
 * MED-311 / PA-08: anulación lógica. Registra el evento de anulación y cambia
 * el estado a ANULADO conservando intactos el PDF y la firma previa.
 */
async function annulConsent(userIdInput, consentIdInput, input = {}) {
  const consentId = parseId(consentIdInput, 'consentimiento');
  const doctor = await findAuthenticatedDoctor(userIdInput);
  const motivo = requiredText(input.reason, 'El motivo de la anulación', 1000);

  const result = await repository.transaction(async (tx) => {
    const consent = await tx.consentimiento_informado.findFirst({
      where: { id_consentimiento: consentId, id_medico: doctor.id_medico },
      select: { id_consentimiento: true, estado: true }
    });
    if (!consent) {
      throw new ConsentError(404, 'Consentimiento informado no encontrado.');
    }
    if (consent.estado === 'ANULADO') {
      throw new ConsentError(400, 'El consentimiento ya se encuentra anulado.');
    }

    await tx.anulacion_consentimiento.create({
      data: {
        id_consentimiento: consentId,
        motivo,
        anulado_por_usuario: BigInt(userIdInput)
      }
    });

    return tx.consentimiento_informado.update({
      where: { id_consentimiento: consentId },
      data: { estado: 'ANULADO' },
      select: consentSelect
    });
  });

  return toConsent(result);
}

/**
 * MED-310 / PA-07: bloquea la edición de un consentimiento firmado (409) o
 * anulado (400). Antes de firmar solo se permite ajustar metadatos.
 */
async function updateConsent(userIdInput, consentIdInput, input = {}) {
  const consentId = parseId(consentIdInput, 'consentimiento');
  const doctor = await findAuthenticatedDoctor(userIdInput);
  const consent = await repository.consentimiento_informado.findFirst({
    where: { id_consentimiento: consentId, id_medico: doctor.id_medico },
    select: { id_consentimiento: true, estado: true }
  });
  if (!consent) {
    throw new ConsentError(404, 'Consentimiento informado no encontrado.');
  }
  if (consent.estado === 'FIRMADO') {
    throw new ConsentError(
      409,
      'Este consentimiento ya fue firmado digitalmente. No se permite modificar ni sobreescribir el documento firmado.'
    );
  }
  if (consent.estado === 'ANULADO') {
    throw new ConsentError(400, 'No se puede modificar un consentimiento anulado.');
  }

  const data = {};
  if (input.procedure !== undefined) {
    data.procedimiento = requiredText(input.procedure, 'El procedimiento', 255);
  }
  if (!Object.keys(data).length) {
    throw new ConsentError(400, 'No se indicaron campos editables.');
  }

  const updated = await repository.consentimiento_informado.update({
    where: { id_consentimiento: consentId },
    data,
    select: consentSelect
  });
  return toConsent(updated);
}

async function getConsentHistory(userIdInput, filters = {}) {
  const doctor = await findAuthenticatedDoctor(userIdInput);

  const where = { id_medico: doctor.id_medico };
  if (filters.estado && ['GENERADO', 'PENDIENTE_FIRMA', 'FIRMADO', 'ANULADO'].includes(filters.estado)) {
    where.estado = filters.estado;
  }

  const consents = await repository.consentimiento_informado.findMany({
    where,
    orderBy: { fecha_generacion: 'desc' },
    select: consentSelect
  });

  return { consents: consents.map(toConsent) };
}

async function getConsentOptions(userIdInput) {
  const doctor = await findAuthenticatedDoctor(userIdInput);
  const [patients, appointments] = await Promise.all([
    repository.paciente.findMany({
      where: { activo: true },
      orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }],
      select: { id_paciente: true, nombres: true, apellidos: true }
    }),
    repository.cita.findMany({
      where: { id_medico: doctor.id_medico },
      orderBy: { fecha_hora_inicio: 'desc' },
      take: 100,
      select: {
        id_cita: true,
        id_paciente: true,
        fecha_hora_inicio: true,
        fecha_hora_fin: true,
        estado: true,
        servicio_medico: { select: { nombre: true } }
      }
    })
  ]);

  return {
    doctor: toDoctor(doctor),
    patients: patients.map(toPatient),
    appointments: appointments.map((appointment) => ({
      ...toAppointment(appointment),
      patientId: Number(appointment.id_paciente)
    }))
  };
}

module.exports = {
  ConsentError,
  annulConsent,
  createConsent,
  getConsentById,
  getConsentHistory,
  getConsentOptions,
  getConsentPdf,
  signConsent,
  updateConsent,
  verifyConsent
};
