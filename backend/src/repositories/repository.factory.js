const { Prisma } = require('@prisma/client');
const database = require('../config/prisma');
const { getTenantContext } = require('../context/tenant.context');

const PUBLIC_MODELS = new Set([
  'usuario',
  'rol',
  'organizacion',
  'usuario_organizacion',
  'pago_suscripcion_tenant'
]);

function resolveClient(baseClient, modelName) {
  if (baseClient !== database) {
    return baseClient;
  }
  if (PUBLIC_MODELS.has(modelName)) {
    return database;
  }
  const context = getTenantContext();
  if (context && context.prisma) {
    return context.prisma;
  }
  return database;
}

const modelOperations = [
  'aggregate',
  'count',
  'create',
  'createMany',
  'delete',
  'deleteMany',
  'findFirst',
  'findMany',
  'findUnique',
  'groupBy',
  'update',
  'updateMany',
  'upsert'
];

function createModelGateway(client, modelName) {
  return Object.freeze(Object.fromEntries(modelOperations.map((operation) => [
    operation,
    (...args) => {
      const activeClient = resolveClient(client, modelName);
      const model = activeClient[modelName];
      if (!model || typeof model[operation] !== 'function') {
        throw new Error(`La operación ${modelName}.${operation} no está disponible en el repositorio.`);
      }
      return model[operation](...args);
    }
  ])));
}

function createRepository(modelNames, client = database, decorate = null) {
  const repository = {};
  for (const modelName of modelNames) {
    repository[modelName] = createModelGateway(client, modelName);
  }

  repository.transaction = (work, options) => {
    const isPlatform = modelNames.includes('usuario') || modelNames.includes('organizacion') || modelNames.includes('rol');
    const primaryModel = isPlatform ? 'usuario' : (modelNames.find((m) => !PUBLIC_MODELS.has(m)) || modelNames[0]);
    const activeClient = resolveClient(client, primaryModel);
    return activeClient.$transaction(
      (transactionClient) => work(createRepository(modelNames, transactionClient, decorate)),
      options
    );
  };

  if (decorate) Object.assign(repository, decorate(client));
  return Object.freeze(repository);
}

function isUniqueConstraintError(error) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function decimal(value) {
  return new Prisma.Decimal(value);
}

module.exports = { createRepository, decimal, isUniqueConstraintError };
