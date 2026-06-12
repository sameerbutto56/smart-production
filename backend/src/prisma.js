const { PrismaClient } = require('@prisma/client');

const globalForPrisma = global;

const rawUrl = process.env.DATABASE_URL || '';
let datasourceUrl;
try {
  const url = new URL(rawUrl);
  url.searchParams.delete('pgbouncer');
  url.searchParams.set('connection_limit', '3');
  url.searchParams.set('pool_timeout', '5');
  datasourceUrl = url.toString();
} catch {
  datasourceUrl = rawUrl || undefined;
}

const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  datasourceUrl,
});

if (typeof globalThis !== 'undefined') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
