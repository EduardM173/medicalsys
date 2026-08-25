const prisma = require('../config/prisma');

async function checkHealth() {
  await prisma.$queryRaw`SELECT 1`;

  return {
    status: 'ok',
    service: 'medicalsys-api',
    database: 'connected'
  };
}

module.exports = { checkHealth };
