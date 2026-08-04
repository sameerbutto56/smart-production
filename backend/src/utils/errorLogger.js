const prisma = require('../prisma');

const errorLogger = {
  logError: async ({ module, userId, userName, outletName, context, message, stack }) => {
    const msg = message || 'Unknown error';
    console.error(`[${new Date().toISOString()}][${module}] ${msg}`, {
      userId: userId || null,
      userName: userName || null,
      outletName: outletName || null,
      context: context || null,
      stack: stack ? String(stack).slice(0, 2000) : null
    });
    try {
      await prisma.systemLog.create({
        data: {
          module,
          level: 'ERROR',
          userId: userId || null,
          userName: userName || null,
          outletName: outletName || null,
          context: context || null,
          message: String(msg).slice(0, 1000),
          stack: stack ? String(stack).slice(0, 2000) : null
        }
      });
    } catch (e) {
      console.error('[errorLogger] failed to persist log:', e.message);
    }
  },

  logWarn: async (payload) => {
    try {
      await prisma.systemLog.create({
        data: {
          module: payload.module,
          level: 'WARN',
          userId: payload.userId || null,
          userName: payload.userName || null,
          outletName: payload.outletName || null,
          context: payload.context || null,
          message: String(payload.message || '').slice(0, 1000),
          stack: payload.stack ? String(payload.stack).slice(0, 2000) : null
        }
      });
    } catch (e) {
      console.error('[errorLogger] failed to persist warn:', e.message);
    }
  }
};

module.exports = errorLogger;
