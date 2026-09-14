const database = require('../config/prisma');

async function checkConnection() {
  await database.$queryRaw`SELECT 1`;
}

module.exports = { checkConnection };
