const { PrismaClient } = require('@prisma/client');

const globalForPrisma = global;

const rawUrl = process.env.DATABASE_URL || '';
const datasourceUrl = rawUrl.replace(/(\?|&)pgbouncer=[^&]*/g, '').replace(/[&?]$/, '') || undefined;

const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  ...(datasourceUrl ? { datasourceUrl } : {}),
});

if (typeof globalThis !== 'undefined') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
