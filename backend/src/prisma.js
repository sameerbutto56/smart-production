const { PrismaClient } = require('@prisma/client');

const globalForPrisma = global;

// DATABASE_URL points to Supabase PgBouncer port 6543 (transaction mode)
// with connection_limit=5, pool_timeout=10 for serverless concurrency.
// DIRECT_URL (port 5432, session mode) is used only for Prisma migrations.
const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
});

if (typeof globalThis !== 'undefined') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
