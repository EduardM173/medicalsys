const { PrismaClient } = require('@prisma/client');

/**
 * En producción (NODE_ENV=production) se fuerza sslmode=require para rechazar
 * conexiones PostgreSQL sin TLS/TLS (HU-31 / MED-301 / PA-09).
 */
function buildDatasourceUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  if (process.env.NODE_ENV !== 'production') return url;

  const hasStrictSsl = /sslmode=(?:require|verify-ca|verify-full)/.test(url);
  if (hasStrictSsl) return url;

  let nextUrl = url;
  if (/sslmode=[^&\s]*/.test(nextUrl)) {
    nextUrl = nextUrl.replace(/sslmode=[^&\s]*/, 'sslmode=require');
  } else {
    nextUrl += `${nextUrl.includes('?') ? '&' : '?'}sslmode=require`;
  }
  return nextUrl;
}

const datasourceUrl = buildDatasourceUrl();
const prisma = datasourceUrl
  ? new PrismaClient({ datasources: { db: { url: datasourceUrl } } })
  : new PrismaClient();

module.exports = prisma;