const { PrismaClient } = require('@prisma/client');

const globalForPrisma = global;

/**
 * Sanitize and harden DATABASE_URL for serverless concurrency and Supabase Supavisor / PgBouncer.
 * In serverless environments (Vercel, AWS Lambda), each container processes requests independently.
 * Enforcing connection_limit=1 (max 2) prevents container scale-out from exhausting the 200 client
 * connection pool limit on Supavisor (FATAL: EMAXCONN).
 * Also ensures port 6543 (transaction mode pooler) and pgbouncer=true are always used.
 */
function getSanitizedDatabaseUrl(rawUrl) {
  if (!rawUrl) return undefined;

  try {
    const url = new URL(rawUrl);

    // 1. Supabase pooler handling: ensure port 6543 (transaction pooler) instead of 5432 (session/direct)
    if (url.hostname.includes('pooler.supabase.com')) {
      if (url.port === '5432') {
        url.port = '6543';
      }
      url.searchParams.set('pgbouncer', 'true');
    }

    // 2. Strict connection limit for serverless execution
    // Default to 1 connection per container so up to 180+ serverless instances can scale safely.
    const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NODE_ENV === 'production');
    let targetLimit = isServerless ? '1' : '5';
    if (process.env.PRISMA_CONNECTION_LIMIT) {
      const parsed = parseInt(process.env.PRISMA_CONNECTION_LIMIT, 10);
      if (!isNaN(parsed) && parsed > 0) {
        targetLimit = String(isServerless ? Math.min(parsed, 2) : parsed);
      }
    }
    url.searchParams.set('connection_limit', targetLimit);

    // 3. Pool timeout: 20 seconds so requests queue gracefully rather than failing immediately
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', '20');
    }

    // 4. Ensure SSL mode is set
    if (!url.searchParams.has('sslmode')) {
      url.searchParams.set('sslmode', 'require');
    }

    return url.toString();
  } catch (err) {
    console.warn('[Prisma] Could not parse DATABASE_URL, using as-is:', err?.message);
    return rawUrl;
  }
}

let prismaInstance = globalForPrisma.prisma;

if (!prismaInstance) {
  const sanitizedUrl = getSanitizedDatabaseUrl(process.env.DATABASE_URL);
  const clientOptions = {
    log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  };

  if (sanitizedUrl) {
    clientOptions.datasources = {
      db: {
        url: sanitizedUrl,
      },
    };
  }

  const basePrisma = new PrismaClient(clientOptions);

  // Centralized query hardening with automatic retry for transient connection exhaustion (EMAXCONN / pool timeout)
  prismaInstance = basePrisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          let lastError;
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              return await query(args);
            } catch (err) {
              lastError = err;
              const msg = String(err?.message || '');
              const isTransientConnError =
                msg.includes('EMAXCONN') ||
                msg.includes('max client connections reached') ||
                msg.includes('Connection pool timeout') ||
                msg.includes('Timed out fetching a new connection') ||
                msg.includes('Can\'t reach database server') ||
                msg.includes('connection closed') ||
                msg.includes('Transaction not found');

              if (isTransientConnError && attempt < 3) {
                const backoff = (attempt * 250) + Math.floor(Math.random() * 150);
                console.warn(`[Prisma Query Retry] ${model}.${operation} failed with connection error (attempt ${attempt}/3). Retrying in ${backoff}ms... Error: ${msg.slice(0, 150)}`);
                await new Promise((r) => setTimeout(r, backoff));
                continue;
              }
              throw err;
            }
          }
          throw lastError;
        },
      },
    },
  });

  // Preserve underlying disconnect/connect capabilities
  prismaInstance.$disconnect = basePrisma.$disconnect.bind(basePrisma);
  prismaInstance.$connect = basePrisma.$connect.bind(basePrisma);

  // Centralized transaction hardening for Supabase PgBouncer & remote PostgreSQL:
  const rawTransaction = prismaInstance.$transaction.bind(prismaInstance);

  prismaInstance.$transaction = async function (arg, options = {}) {
    if (typeof arg === 'function') {
      const txOptions = {
        maxWait: 20000,
        timeout: 60000,
        ...options,
      };

      let lastError;
      for (let attempt = 1; attempt <= 3; attempt++) {
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
            msg.includes('Connection pool timeout') ||
            msg.includes('EMAXCONN') ||
            msg.includes('max client connections reached');

          if (isTransientTxError && attempt < 3) {
            const backoff = (attempt * 300) + Math.floor(Math.random() * 200);
            console.warn(`[Prisma $transaction] Transient transaction error on attempt ${attempt}/3. Retrying in ${backoff}ms... Error: ${msg.slice(0, 150)}`);
            await new Promise((r) => setTimeout(r, backoff));
            continue;
          }
          throw err;
        }
      }
      throw lastError;
    }
    return rawTransaction(arg, options);
  };

  if (typeof globalThis !== 'undefined') {
    globalForPrisma.prisma = prismaInstance;
  }
}

module.exports = prismaInstance;
