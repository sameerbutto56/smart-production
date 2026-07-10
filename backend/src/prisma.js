const { PrismaClient } = require('@prisma/client');

const globalForPrisma = global;

// Switch to Supabase PgBouncer port (6543) for transaction mode to avoid
// "max clients reached in session mode" errors under serverless concurrency.
// Session mode (port 5432) caps at 15 connections; transaction mode handles
// many more by releasing connections between transactions.
let dbUrl = process.env.DATABASE_URL || '';
if (!dbUrl.includes('pgbouncer=true') && dbUrl.includes('pooler.supabase.com')) {
  dbUrl = dbUrl
    .replace(/:5432\//, ':6543/')
    .replace(/:5432\?/, ':6543?');
  dbUrl += (dbUrl.includes('?') ? '&' : '?') + 'pgbouncer=true&connection_limit=3';
}

const prisma = globalForPrisma.prisma || new PrismaClient({
  datasources: { db: { url: dbUrl } },
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
});

if (typeof globalThis !== 'undefined') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
