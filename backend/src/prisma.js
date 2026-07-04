const { PrismaClient } = require('@prisma/client');

const globalForPrisma = global;

// Limit connection pool for serverless to avoid exhausting Supabase pool (max 15)
const dbUrl = process.env.DATABASE_URL || '';
const limitedUrl = dbUrl.includes('connection_limit')
  ? dbUrl
  : dbUrl + (dbUrl.includes('?') ? '&' : '?') + 'connection_limit=2';

const prisma = globalForPrisma.prisma || new PrismaClient({
  datasources: { db: { url: limitedUrl } },
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
});

if (typeof globalThis !== 'undefined') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
