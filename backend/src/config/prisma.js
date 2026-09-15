const { PrismaClient } = require('@prisma/client');

/**
 * En producción (NODE_ENV=production) se fuerza sslmode=require para rechazar
 * conexiones PostgreSQL sin TLS/TLS (HU-31 / MED-301 / PA-09).
 */
function buildDatasourceUrl(schema = 'public') {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;

  let nextUrl = url;
  const configuredUrl = new URL(nextUrl);
  if (!configuredUrl.searchParams.has('connection_limit')) configuredUrl.searchParams.set('connection_limit', process.env.DB_POOL_SIZE || '3');
  if (!configuredUrl.searchParams.has('pool_timeout')) configuredUrl.searchParams.set('pool_timeout', process.env.DB_POOL_TIMEOUT || '10');
  if (!configuredUrl.searchParams.has('connect_timeout')) configuredUrl.searchParams.set('connect_timeout', '5');
  nextUrl = configuredUrl.toString();
  if (/schema=[^&\s]*/.test(nextUrl)) {
    nextUrl = nextUrl.replace(/schema=[^&\s]*/, `schema=${schema}`);
  } else {
    nextUrl += `${nextUrl.includes('?') ? '&' : '?'}schema=${schema}`;
  }

  if (process.env.NODE_ENV !== 'production') return nextUrl;

  const hasStrictSsl = /sslmode=(?:require|verify-ca|verify-full)/.test(nextUrl);
  if (hasStrictSsl) return nextUrl;

  if (/sslmode=[^&\s]*/.test(nextUrl)) {
    nextUrl = nextUrl.replace(/sslmode=[^&\s]*/, 'sslmode=require');
  } else {
    nextUrl += `${nextUrl.includes('?') ? '&' : '?'}sslmode=require`;
  }
  return nextUrl;
}

const defaultDatasourceUrl = buildDatasourceUrl('public');
const prisma = defaultDatasourceUrl
  ? new PrismaClient({ datasources: { db: { url: defaultDatasourceUrl } } })
  : new PrismaClient();

const tenantClients = new Map();

function getTenantPrisma(schemaName) {
  if (!schemaName || schemaName === 'public') {
    return prisma;
  }
  const cleanSchema = String(schemaName).trim().toLowerCase();
  if (tenantClients.has(cleanSchema)) {
    return tenantClients.get(cleanSchema);
  }
  const tenantUrl = buildDatasourceUrl(cleanSchema);
  const client = new PrismaClient({ datasources: { db: { url: tenantUrl } } });
  tenantClients.set(cleanSchema, client);
  return client;
}

module.exports = prisma;
module.exports.prisma = prisma;
module.exports.getTenantPrisma = getTenantPrisma;
module.exports.buildDatasourceUrl = buildDatasourceUrl;
module.exports.disconnectAll = () => Promise.allSettled([prisma, ...tenantClients.values()].map((client) => client.$disconnect()));
