const prisma = require('../prisma');
const notify = require('../utils/notify');

// Shared helper: read the currently configured order range (best-effort).
async function getOrderRangeConfig() {
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: 'ORDER_RANGE_CONFIG' } });
    let config = { enabled: false, startNumber: '', endNumber: '' };
    if (setting && setting.value) {
      try { config = { ...config, ...JSON.parse(setting.value) }; } catch (e) {}
    }
    return config;
  } catch (err) {
    console.error('getOrderRangeConfig error:', err.message);
    return { enabled: false, startNumber: '', endNumber: '' };
  }
}

// Core helper: persist a blocked order-number attempt + fire the admin
// notification. Returns the created record (or null on failure) and never
// throws. Used by both the client-side log endpoint and the server-side
// createOrder range reject path.
async function recordWrongAttempt({ orderNumber, startNumber, endNumber, req }) {
  try {
    const attempted = String(orderNumber || '').replace(/^#/, '') || '';
    if (!attempted) return null;

    const user = req.user || {};
    const record = await prisma.wrongOrderNumberAttempt.create({
      data: {
        orderNumber: attempted,
        allowedRange: `${String(startNumber || '').replace(/^#/, '')} to ${String(endNumber || '').replace(/^#/, '')}`,
        userName: user.name || null,
        userId: user.id || null,
        role: user.role || null,
        status: 'Blocked',
        reason: 'Order Number Outside Allowed Range',
      },
    });

    // Real-time admin notification via the existing notification system.
    try {
      await notify.create(req, {
        type: 'wrong_order_attempt',
        moduleName: 'Wrong Attempt',
        path: '/admin-dashboard',
        role: ['SUPER_ADMIN', 'ADMIN', 'SOFTWARE_SETTINGS'],
        title: 'Invalid Order Number Attempt',
        message: `Order Number: ${attempted} / Attempted From: ${user.role || 'Unknown'} Profile / Time: ${new Date(record.attemptedAt).toLocaleString()} / Status: Blocked`,
        orderNumber: attempted,
        customerName: null,
        action: 'NOTIFY',
        employeeName: user.name || null,
      });
    } catch (notifyErr) {
      console.error('Wrong attempt notify error:', notifyErr.message);
    }

    return record;
  } catch (err) {
    console.error('recordWrongAttempt error:', err.message);
    return null;
  }
}

// POST /api/wrong-attempts/log — called by the frontend when its client-side
// range check blocks checkout before the createOrder POST is sent.
const logWrongAttempt = async (req, res) => {
  try {
    const { orderNumber } = req.body || {};
    const rangeConfig = await getOrderRangeConfig();
    const record = await recordWrongAttempt({
      orderNumber,
      startNumber: rangeConfig.startNumber,
      endNumber: rangeConfig.endNumber,
      req,
    });
    res.status(record ? 201 : 200).json({ ok: true, status: 'Blocked', reason: 'Order Number Outside Allowed Range', saved: !!record });
  } catch (error) {
    res.status(500).json({ message: 'Failed to log wrong attempt', error: error.message });
  }
};

// GET /api/wrong-attempts/stats — total, today, recent, blockedCount.
const getWrongAttemptStats = async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const [total, today, recent, blockedCount] = await Promise.all([
      prisma.wrongOrderNumberAttempt.count(),
      prisma.wrongOrderNumberAttempt.count({ where: { attemptedAt: { gte: startOfToday }, status: 'Blocked' } }),
      prisma.wrongOrderNumberAttempt.findFirst({ orderBy: { attemptedAt: 'desc' } }),
      prisma.wrongOrderNumberAttempt.count({ where: { status: 'Blocked' } }),
    ]);
    res.json({ total, today, blockedCount, recent: recent || null });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch wrong attempt stats', error: error.message });
  }
};

// GET /api/wrong-attempts — timeline history.
const getWrongAttempts = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const attempts = await prisma.wrongOrderNumberAttempt.findMany({ orderBy: { attemptedAt: 'desc' }, take: limit });
    res.json({ attempts, total: attempts.length });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch wrong attempts', error: error.message });
  }
};

module.exports = {
  logWrongAttempt,
  getWrongAttemptStats,
  getWrongAttempts,
  getOrderRangeConfig,
  recordWrongAttempt,
};
