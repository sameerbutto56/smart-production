const { PrismaClient } = require('@prisma/client');

const globalForPrisma = global;

// DATABASE_URL points to Supabase PgBouncer port 6543 (transaction mode)
// with connection_limit=5, pool_timeout=10 for serverless concurrency.
// DIRECT_URL (port 5432, session mode) is used only for Prisma migrations.
const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
});

// Centralized transaction hardening for Supabase PgBouncer & remote PostgreSQL:
// Prisma's default interactive transaction timeout is only 5s (5000ms) with 2s maxWait.
// When multi-item operations, network latency, or pool contention occur, the transaction
// exceeds 5s and Prisma marks the transaction dead, throwing:
// "Transaction API error: Transaction not found. Transaction ID is invalid, refers to an old closed transaction..."
// We raise default maxWait to 20s and timeout to 60s, plus automatic single retry for transient transaction disconnects.
if (!prisma.__hasTransactionWrapper) {
  const rawTransaction = prisma.$transaction.bind(prisma);

  prisma.$transaction = async function (arg, options = {}) {
    if (typeof arg === 'function') {
      const txOptions = {
        maxWait: 20000,
        timeout: 60000,
        ...options,
      };

      let lastError;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          return await rawTransaction(arg, txOptions);
        } catch (err) {
          lastError = err;
          const msg = String(err?.message || '');
          const isTransientTxError =
            msg.includes('Transaction not found') ||
            msg.includes('Transaction API error') ||
            msg.includes('refers to an old closed transaction') ||
            msg.includes('connection closed') ||
            msg.includes('Connection pool timeout');

          if (isTransientTxError && attempt < 2) {
            console.warn(`[Prisma $transaction] Transient transaction error on attempt ${attempt}/2. Retrying in 500ms... Error: ${msg}`);
            await new Promise((r) => setTimeout(r, 500));
            continue;
          }
          throw err;
        }
      }
      throw lastError;
    }
    return rawTransaction(arg, options);
  };

  prisma.__hasTransactionWrapper = true;
}

if (typeof globalThis !== 'undefined') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
