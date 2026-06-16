const { PrismaClient } = require('@prisma/client');

const globalForPrisma = global;

// Use DIRECT_URL for serverless (direct DB connection, bypasses PgBouncer)
const datasourceUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || undefined;

const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  ...(datasourceUrl ? { datasourceUrl } : {}),
});

if (typeof globalThis !== 'undefined') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
