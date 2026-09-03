const prisma = require('../config/prisma');
const SinProviderFactory = require('./billing/sin-provider.factory');

class FacturacionError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

/**
 * Normaliza el método de pago para que coincida con el enum de PostgreSQL/Prisma
 * @param {string} metodo 
 * @returns {'EFECTIVO' | 'QR' | 'TARJETA' | 'TRANSFERENCIA' | 'OTRO'}
 */
function normalizarMetodoPago(metodo) {
  if (!metodo) return 'EFECTIVO';
  const m = String(metodo).toUpperCase().trim();
  if (m === 'QR_SIMPLE' || m === 'QR') return 'QR';
  if (m === 'TARJETA' || m === 'CARD') return 'TARJETA';
  if (m === 'TRANSFERENCIA') return 'TRANSFERENCIA';
  if (m === 'EFECTIVO' || m === 'CASH') return 'EFECTIVO';
  return 'OTRO';
}

/**
 * Serializa una factura para respuesta JSON convirtiendo BigInt y Decimal
 */
function serializeFactura(factura) {
  if (!factura) return null;

  return {
    id: factura.id_factura.toString(),
    idFactura: factura.id_factura.toString(),
    numeroFactura: factura.numero_factura,
    fechaEmision: factura.fecha_emision ? factura.fecha_emision.toISOString() : null,
    nitCi: factura.nit_ci || '',
    complemento: factura.complemento || '',
    razonSocial: factura.razon_social || '',
    emailReceptor: factura.email_receptor || '',
    metodoPago: factura.metodo_pago,
    metodoPagoDisplay: factura.metodo_pago === 'QR' ? 'QR Simple' : factura.metodo_pago,
    subtotal: Number(factura.subtotal),
    total: Number(factura.total),
    estado: factura.estado,
    sinEstado: factura.sin_estado,
    sinReferencia: factura.sin_referencia || '',
    referenciaSin: factura.sin_referencia || '',
    codigoAutorizacion: factura.codigo_autorizacion || '',
    cuf: factura.cuf || '',
    qrPayload: factura.qr_payload || '',
    fechaCreacion: factura.fecha_creacion ? factura.fecha_creacion.toISOString() : null,
    fechaActualizacion: factura.fecha_actualizacion ? factura.fecha_actualizacion.toISOString() : null,
    paciente: factura.paciente ? {
      id: factura.paciente.id_paciente.toString(),
      nombres: factura.paciente.nombres,
      apellidos: factura.paciente.apellidos,
      nombreCompleto: `${factura.paciente.nombres} ${factura.paciente.apellidos}`.trim(),
      documentoIdentidad: factura.paciente.documento_identidad,
      complemento: factura.paciente.complemento,
      email: factura.paciente.email,
      telefono: factura.paciente.telefono
    } : null,
    clinica: factura.configuracion_clinica ? {
      id: factura.configuracion_clinica.id_configuracion.toString(),
      nombreComercial: factura.configuracion_clinica.nombre_comercial,
      razonSocial: factura.configuracion_clinica.razon_social,
      nit: factura.configuracion_clinica.nit,
      direccion: factura.configuracion_clinica.direccion,
      telefono: factura.configuracion_clinica.telefono,
      email: factura.configuracion_clinica.email,
      ciudad: factura.configuracion_clinica.ciudad,
      pais: factura.configuracion_clinica.pais
    } : null,
    items: (factura.detalle_factura || []).map((det) => ({
      id: det.id_detalle.toString(),
      idDetalle: det.id_detalle.toString(),
      idServicio: det.id_servicio ? det.id_servicio.toString() : null,
      descripcion: det.descripcion,
      cantidad: det.cantidad,
      precioUnitario: Number(det.precio_unitario),
      subtotal: Number(det.subtotal)
    }))
  };
}

class FacturacionService {
  constructor(sinProvider = null) {
    this.sinProvider = sinProvider || SinProviderFactory.getProvider();
  }

  /**
   * Obtiene la configuración activa de la clínica para facturación y cabecera de ticket 80mm
   */
  async obtenerConfiguracionClinica() {
    let config = await prisma.configuracion_clinica.findFirst({
      where: { activa: true },
      orderBy: { id_configuracion: 'asc' }
    });

    if (!config) {
      config = await prisma.configuracion_clinica.create({
        data: {
          nombre_comercial: 'MedicalSys - Clínica Especializada',
          razon_social: 'MedicalSys Salud Integral S.R.L.',
          nit: '1028472021',
          direccion: 'Av. Arce #2435, Edificio Los Pinos, PB',
          telefono: '+591 2 2441234',
          email: 'facturacion@medicalsys.bo',
          ciudad: 'La Paz',
          pais: 'Bolivia',
          activa: true
        }
      });
    }

    return {
      id: config.id_configuracion.toString(),
      nombreComercial: config.nombre_comercial,
      razonSocial: config.razon_social,
      nit: config.nit,
      direccion: config.direccion,
      telefono: config.telefono,
      email: config.email,
      ciudad: config.ciudad,
      pais: config.pais
    };
  }

  /**
   * Genera el siguiente número secuencial de factura
   * @private
   */
  async generarNumeroFactura() {
    const totalCount = await prisma.factura.count();
    const siguienteSecuencia = totalCount + 1;
    const numeroStr = String(siguienteSecuencia).padStart(6, '0');
    return `FAC-${numeroStr}`;
  }

  /**
   * Crea una nueva factura en estado BORRADOR (o la prepara para emisión)
   * 
   * @param {Object} data
   * @param {string|number} data.idPaciente
   * @param {string|number} [data.idCita]
   * @param {string} data.nitCi
   * @param {string} [data.complemento]
   * @param {string} data.razonSocial
   * @param {string} [data.emailReceptor]
   * @param {string} data.metodoPago
   * @param {Array<Object>} data.items
   * @param {string|number} idUsuarioEmisor
   */
  async crearFactura(data, idUsuarioEmisor) {
    if (!data.idPaciente) {
      throw new FacturacionError(400, 'El paciente es obligatorio.');
    }

    const nitCi = String(data.nitCi || '').trim();
    const razonSocial = String(data.razonSocial || '').trim();

    if (!nitCi) {
      throw new FacturacionError(400, 'El NIT o Documento de Identidad del receptor es obligatorio.');
    }
    if (!razonSocial) {
      throw new FacturacionError(400, 'La Razón Social o Nombre del receptor es obligatorio.');
    }

    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new FacturacionError(400, 'La factura debe contener al menos un ítem o prestación médica.');
    }

    const paciente = await prisma.paciente.findUnique({
      where: { id_paciente: BigInt(data.idPaciente) }
    });
    if (!paciente) {
      throw new FacturacionError(404, 'El paciente especificado no existe.');
    }

    // Configuración clínica
    const clinica = await this.obtenerConfiguracionClinica();

    // Validar y calcular ítems
    let totalFactura = 0;
    const itemsParaGuardar = data.items.map((item, index) => {
      const descripcion = String(item.descripcion || item.nombre || '').trim();
      const cantidad = parseInt(item.cantidad, 10);
      const precioUnitario = parseFloat(item.precioUnitario || item.precioBase || 0);

      if (!descripcion) {
        throw new FacturacionError(400, `El ítem en la posición ${index + 1} no cuenta con descripción.`);
      }
      if (isNaN(cantidad) || cantidad <= 0) {
        throw new FacturacionError(400, `La cantidad del ítem '${descripcion}' debe ser mayor a 0.`);
      }
      if (isNaN(precioUnitario) || precioUnitario < 0) {
        throw new FacturacionError(400, `El precio del ítem '${descripcion}' no puede ser negativo.`);
      }

      const subtotal = Math.round(cantidad * precioUnitario * 100) / 100;
      totalFactura += subtotal;

      return {
        id_servicio: item.idServicio ? BigInt(item.idServicio) : null,
        descripcion,
        cantidad,
        precio_unitario: precioUnitario,
        subtotal
      };
    });

    totalFactura = Math.round(totalFactura * 100) / 100;
    const numeroFactura = await this.generarNumeroFactura();
    const metodoPago = normalizarMetodoPago(data.metodoPago);

    const nuevaFactura = await prisma.factura.create({
      data: {
        id_configuracion_clinica: BigInt(clinica.id),
        id_paciente: BigInt(data.idPaciente),
        id_cita: data.idCita ? BigInt(data.idCita) : null,
        emitida_por: idUsuarioEmisor ? BigInt(idUsuarioEmisor) : null,
        numero_factura: numeroFactura,
        nit_ci: nitCi,
        complemento: String(data.complemento || '').trim(),
        razon_social: razonSocial,
        email_receptor: data.emailReceptor ? String(data.emailReceptor).trim() : null,
        metodo_pago: metodoPago,
        subtotal: totalFactura,
        total: totalFactura,
        estado: 'BORRADOR',
        sin_estado: 'NO_ENVIADA',
        detalle_factura: {
          create: itemsParaGuardar
        }
      },
      include: {
        detalle_factura: true,
        paciente: true,
        configuracion_clinica: true
      }
    });

    return serializeFactura(nuevaFactura);
  }

  /**
   * Emite una factura computarizada ante el SIN con garantía de Idempotencia y Transaccionalidad
   * (MED-185, MED-188, MED-189, MED-191, MED-192, MED-195, MED-196)
   * 
   * @param {string|number} idFactura
   * @param {string|number} idUsuarioEmisor
   * @returns {Promise<Object>} Factura emitida
   */
  async emitirFactura(idFactura, idUsuarioEmisor) {
    if (!idFactura) {
      throw new FacturacionError(400, 'Identificador de factura no proporcionado.');
    }

    const facturaIdBigInt = BigInt(idFactura);

    // 1. Cargar la factura existente con sus detalles
    const facturaExistente = await prisma.factura.findUnique({
      where: { id_factura: facturaIdBigInt },
      include: {
        detalle_factura: true,
        paciente: true,
        configuracion_clinica: true
      }
    });

    if (!facturaExistente) {
      throw new FacturacionError(404, 'Factura no encontrada.');
    }

    // 2. Control de Re-emisión e Idempotencia (MED-189, MED-196 / PA-06)
    if (facturaExistente.estado === 'EMITIDA') {
      throw new FacturacionError(400, 'Esta factura ya fue emitida previamente y no puede duplicarse.');
    }

    if (facturaExistente.estado === 'ANULADA') {
      throw new FacturacionError(400, 'Una factura anulada no puede ser emitida.');
    }

    // 3. Validación Inicial de Datos de Receptor e Ítems (MED-191 / PA-01)
    const nitCi = facturaExistente.nit_ci ? facturaExistente.nit_ci.trim() : '';
    const razonSocial = facturaExistente.razon_social ? facturaExistente.razon_social.trim() : '';

    if (!nitCi || !razonSocial) {
      throw new FacturacionError(400, 'Faltan datos del receptor: NIT/CI y Razón Social son obligatorios.');
    }

    if (!facturaExistente.detalle_factura || facturaExistente.detalle_factura.length === 0) {
      throw new FacturacionError(400, 'La factura debe tener al menos 1 ítem en el detalle para poder ser emitida.');
    }

    // 4. Invocación al SINProvider (MED-186, MED-187)
    const datosEmision = {
      numeroFactura: facturaExistente.numero_factura,
      nitCi: facturaExistente.nit_ci,
      complemento: facturaExistente.complemento,
      razonSocial: facturaExistente.razon_social,
      emailReceptor: facturaExistente.email_receptor,
      metodoPago: facturaExistente.metodo_pago,
      subtotal: Number(facturaExistente.subtotal),
      total: Number(facturaExistente.total),
      items: facturaExistente.detalle_factura.map((d) => ({
        descripcion: d.descripcion,
        cantidad: d.cantidad,
        precioUnitario: Number(d.precio_unitario),
        subtotal: Number(d.subtotal)
      })),
      clinica: facturaExistente.configuracion_clinica ? {
        nit: facturaExistente.configuracion_clinica.nit,
        razonSocial: facturaExistente.configuracion_clinica.razon_social,
        nombreComercial: facturaExistente.configuracion_clinica.nombre_comercial
      } : null
    };

    let resultadoSIN;
    try {
      resultadoSIN = await this.sinProvider.emitirFactura(datosEmision);
    } catch (sinError) {
      throw new FacturacionError(502, `Error al comunicar con el SIN: ${sinError.message || 'Fallo de emisión'}`);
    }

    if (!resultadoSIN || !resultadoSIN.exito || !resultadoSIN.cuf) {
      throw new FacturacionError(502, resultadoSIN?.mensaje || 'Respuesta inválida del proveedor de facturación SIN.');
    }

    // 5. Persistencia Transaccional (MED-188, MED-192, MED-195 / PA-02, PA-05)
    // Preserva inalterables los ítems y totales previamente confirmados.
    const facturaActualizada = await prisma.$transaction(async (tx) => {
      // Re-verificar estado dentro de la transacción por seguridad concurrente
      const actual = await tx.factura.findUnique({
        where: { id_factura: facturaIdBigInt }
      });

      if (actual.estado === 'EMITIDA') {
        throw new FacturacionError(400, 'Esta factura ya fue emitida previamente y no puede duplicarse.');
      }

      return tx.factura.update({
        where: { id_factura: facturaIdBigInt },
        data: {
          estado: 'EMITIDA',
          sin_estado: 'EMITIDA',
          cuf: resultadoSIN.cuf,
          sin_referencia: resultadoSIN.referenciaSin,
          codigo_autorizacion: resultadoSIN.codigoAutorizacion || resultadoSIN.referenciaSin,
          fecha_emision: resultadoSIN.fechaEmision || new Date(),
          qr_payload: resultadoSIN.qrPayload,
          emitida_por: idUsuarioEmisor ? BigInt(idUsuarioEmisor) : actual.emitida_por
        },
        include: {
          detalle_factura: true,
          paciente: true,
          configuracion_clinica: true
        }
      });
    });

    return serializeFactura(facturaActualizada);
  }

  /**
   * Obtiene el detalle de una factura por su ID
   * @param {string|number} idFactura
   */
  async obtenerFactura(idFactura) {
    if (!idFactura) {
      throw new FacturacionError(400, 'Identificador de factura no proporcionado.');
    }

    const factura = await prisma.factura.findUnique({
      where: { id_factura: BigInt(idFactura) },
      include: {
        detalle_factura: true,
        paciente: true,
        configuracion_clinica: true
      }
    });

    if (!factura) {
      throw new FacturacionError(404, 'Factura no encontrada.');
    }

    return serializeFactura(factura);
  }

  /**
   * Lista facturas con filtros y orden descendente
   * @param {Object} filters
   */
  async listarFacturas(filters = {}) {
    const where = {};

    if (filters.estado) {
      where.estado = filters.estado;
    }
    if (filters.idPaciente) {
      where.id_paciente = BigInt(filters.idPaciente);
    }
    if (filters.search) {
      const q = String(filters.search).trim();
      where.OR = [
        { numero_factura: { contains: q, mode: 'insensitive' } },
        { nit_ci: { contains: q, mode: 'insensitive' } },
        { razon_social: { contains: q, mode: 'insensitive' } },
        { cuf: { contains: q, mode: 'insensitive' } }
      ];
    }

    const facturas = await prisma.factura.findMany({
      where,
      include: {
        detalle_factura: true,
        paciente: true,
        configuracion_clinica: true
      },
      orderBy: {
        fecha_creacion: 'desc'
      },
      take: filters.limit ? parseInt(filters.limit, 10) : 50
    });

    return facturas.map(serializeFactura);
  }
}

module.exports = new FacturacionService();
module.exports.FacturacionService = FacturacionService;
module.exports.FacturacionError = FacturacionError;
