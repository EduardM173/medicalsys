const { Prisma } = require('@prisma/client');
const database = require('../config/prisma');

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
      const model = client[modelName];
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

  repository.transaction = (work, options) => client.$transaction(
    (transactionClient) => work(createRepository(modelNames, transactionClient, decorate)),
    options
  );

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
