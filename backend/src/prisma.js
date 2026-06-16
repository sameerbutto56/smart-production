const { PrismaClient } = require('@prisma/client');

const globalForPrisma = global;

// Use DIRECT_URL for serverless (direct DB connection, bypasses PgBouncer)
const baseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
const datasourceUrl = baseUrl
  ? (baseUrl.includes('?') ? `${baseUrl}&connection_limit=1` : `${baseUrl}?connection_limit=1`)
  : undefined;

const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  datasourceUrl,
});

if (typeof globalThis !== 'undefined') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
