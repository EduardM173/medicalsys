const { test } = require('node:test');
const assert = require('node:assert/strict');

// Mock data
const mockCampaign = {
  id_campania: 1n,
  nombre: 'Campaña de Salud Cardiovascular',
  descripcion: 'Chequeo preventivo de presión arterial',
  fecha_inicio: new Date('2026-09-01T00:00:00.000Z'),
  fecha_fin: new Date('2026-09-30T00:00:00.000Z'),
  estado: 'ACTIVA',
  tipo_promocion: 'DESCUENTO_CONSULTA',
  descuento_porcentaje: '20.00',
  publico_objetivo: 'Pacientes mayores de 40 años',
  presupuesto: '2000.00',
  fecha_creacion: new Date('2026-09-01T00:00:00.000Z'),
  fecha_actualizacion: new Date('2026-09-01T00:00:00.000Z'),
  usuario: { id_usuario: 5n, nombres: 'Admin', apellidos: 'MedicalSys', email: 'admin@medicalsys.test' },
  _count: { notificacion: 3 }
};

const mockPatient = {
  id_paciente: 10n,
  nombres: 'Alejandro',
  apellidos: 'Morales Quiroga',
  documento_identidad: '4892104',
  complemento: '',
  email: 'alejandro@medicalsys.test',
  telefono: '72010001',
  activo: true,
  fidelizacion: {
    id_fidelizacion: 1n,
    id_paciente: 10n,
    estado: 'ACTIVO',
    nivel: 'PREMIUM',
    puntos_acumulados: 250,
    fecha_inscripcion: new Date('2026-08-01T00:00:00.000Z'),
    fecha_actualizacion: new Date('2026-08-01T00:00:00.000Z'),
    notas: 'Paciente frecuente'
  }
};

let capturedCampaignQuery = null;
let capturedLoyaltyQuery = null;

const db = {
  campania: {
    findMany: async (args) => {
      capturedCampaignQuery = args;
      return [mockCampaign];
    },
    groupBy: async () => [
      { estado: 'ACTIVA', _count: { id_campania: 1 } },
      { estado: 'PROGRAMADA', _count: { id_campania: 0 } },
      { estado: 'BORRADOR', _count: { id_campania: 0 } }
    ],
    findUnique: async ({ where }) => {
      if (where.id_campania === 1n) return mockCampaign;
      return null;
    },
    create: async ({ data }) => {
      return {
        ...mockCampaign,
        ...data,
        id_campania: 2n,
        usuario: { id_usuario: 5n, nombres: 'Admin', apellidos: 'MedicalSys', email: 'admin@medicalsys.test' },
        _count: { notificacion: 0 }
      };
    },
    update: async ({ where, data }) => {
      return {
        ...mockCampaign,
        ...data,
        id_campania: where.id_campania
      };
    },
    delete: async ({ where }) => {
      return { id_campania: where.id_campania };
    }
  },
  paciente: {
    findMany: async (args) => {
      capturedLoyaltyQuery = args;
      return [mockPatient];
    },
    count: async () => 5,
    findUnique: async ({ where }) => {
      if (where.id_paciente === 10n) return mockPatient;
      if (where.id_paciente === 20n) return { ...mockPatient, id_paciente: 20n, fidelizacion: null };
      return null;
    }
  },
  fidelizacion_paciente: {
    groupBy: async ({ by }) => {
      if (by.includes('estado')) {
        return [{ estado: 'ACTIVO', _count: { id_fidelizacion: 3 } }];
      }
      if (by.includes('nivel')) {
        return [
          { nivel: 'ESTANDAR', _count: { id_fidelizacion: 1 } },
          { nivel: 'FRECUENTE', _count: { id_fidelizacion: 1 } },
          { nivel: 'PREMIUM', _count: { id_fidelizacion: 1 } }
        ];
      }
      return [];
    },
    create: async ({ data }) => {
      return {
        id_fidelizacion: 2n,
        ...data,
        fecha_inscripcion: new Date(),
        fecha_actualizacion: new Date(),
        paciente: { ...mockPatient, id_paciente: data.id_paciente, fidelizacion: null }
      };
    },
    findUnique: async ({ where }) => {
      if (where.id_paciente === 10n) return mockPatient.fidelizacion;
      return null;
    },
    update: async ({ where, data }) => {
      return {
        ...mockPatient.fidelizacion,
        ...data,
        paciente: mockPatient
      };
    },
    delete: async ({ where }) => {
      return { id_fidelizacion: 1n };
    }
  }
};

require.cache[require.resolve('../src/config/prisma')] = { exports: db };

const campaignService = require('../src/services/campaign.service');
const loyaltyService = require('../src/services/loyalty.service');

// ==========================================
// HU-27: Campañas y Promociones de Salud
// ==========================================

test('HU-27: listar campañas aplica filtros por estado y término de búsqueda', async () => {
  const result = await campaignService.listCampaigns({ search: 'Cardio', estado: 'ACTIVA' });
  assert.equal(capturedCampaignQuery.where.estado, 'ACTIVA');
  assert.equal(capturedCampaignQuery.where.OR.length, 3);
  assert.equal(result.campaigns.length, 1);
  assert.equal(result.campaigns[0].nombre, 'Campaña de Salud Cardiovascular');
  assert.equal(result.campaigns[0].descuentoPorcentaje, 20);
  assert.equal(result.stats.activas, 1);
});

test('HU-27: crear campaña valida campos obligatorios y coherencia de fechas', async () => {
  await assert.rejects(
    async () => campaignService.createCampaign({ nombre: '' }),
    /El nombre de la campaña es obligatorio/
  );

  await assert.rejects(
    async () => campaignService.createCampaign({
      nombre: 'Campaña Fechas Inválidas',
      fechaInicio: '2026-10-15',
      fechaFin: '2026-10-01'
    }),
    /La fecha de fin no puede ser anterior a la fecha de inicio/
  );

  const created = await campaignService.createCampaign({
    nombre: 'Campaña Preventiva Escolar',
    descripcion: 'Control integral para niños',
    tipoPromocion: 'PAQUETE_PREVENTIVO',
    descuentoPorcentaje: 15,
    publicoObjetivo: 'Niños de 4 a 12 años'
  }, 5);

  assert.equal(created.nombre, 'Campaña Preventiva Escolar');
  assert.equal(created.estado, 'BORRADOR');
  assert.equal(created.descuentoPorcentaje, 15);
});

test('HU-27: actualizar campaña permite modificar datos y cambiar estado', async () => {
  const updated = await campaignService.updateCampaign(1, {
    estado: 'FINALIZADA',
    descuentoPorcentaje: 25
  });

  assert.equal(updated.estado, 'FINALIZADA');
  assert.equal(updated.descuentoPorcentaje, 25);
});

// ==========================================
// HU-28: Fidelización de Pacientes
// ==========================================

test('HU-28: listar pacientes incluye estado de fidelización y métricas globales', async () => {
  const result = await loyaltyService.listPatientsWithLoyalty({ search: 'Alejandro' });
  assert.equal(result.patients.length, 1);
  assert.equal(result.patients[0].nombres, 'Alejandro');
  assert.equal(result.patients[0].esMiembro, true);
  assert.equal(result.patients[0].fidelizacion.nivel, 'PREMIUM');
  assert.equal(result.stats.totalPacientes, 5);
  assert.equal(result.stats.activos, 3);
});

test('HU-28: afiliar paciente valida existencia y previene doble inscripción', async () => {
  // Paciente ya afiliado (id: 10)
  await assert.rejects(
    async () => loyaltyService.enrollPatient({ patientId: 10, nivel: 'FRECUENTE' }),
    /ya se encuentra afiliado/
  );

  // Paciente nuevo (id: 20)
  const result = await loyaltyService.enrollPatient({
    patientId: 20,
    nivel: 'FRECUENTE',
    puntos: 50,
    notas: 'Inscripción en ventanilla'
  });

  assert.equal(result.member.estado, 'ACTIVO');
  assert.equal(result.member.nivel, 'FRECUENTE');
  assert.equal(result.member.puntosAcumulados, 50);
});

test('HU-28: actualizar estado de fidelización valida valores permitidos', async () => {
  await assert.rejects(
    async () => loyaltyService.updatePatientLoyalty(10, { estado: 'ESTADO_INVENTADO' }),
    /Estado inválido/
  );

  const updated = await loyaltyService.updatePatientLoyalty(10, {
    estado: 'SUSPENDIDO',
    nivel: 'PREMIUM',
    puntosAcumulados: 300,
    notas: 'Suspendido temporalmente a solicitud'
  });

  assert.equal(updated.member.estado, 'SUSPENDIDO');
  assert.equal(updated.member.puntosAcumulados, 300);
});
