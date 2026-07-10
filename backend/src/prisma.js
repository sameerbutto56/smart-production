const { PrismaClient } = require('@prisma/client');

const globalForPrisma = global;

// Use env DATABASE_URL directly (now set to Supabase PgBouncer port 6543
// transaction mode via Vercel env vars) to avoid pool exhaustion under
// serverless concurrency. Session mode (port 5432) caps at 15 connections;
// transaction mode handles many more by releasing connections between queries.
const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
});

if (typeof globalThis !== 'undefined') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
