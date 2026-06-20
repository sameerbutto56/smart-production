const prisma = require('../prisma');

const safeCount = async (where) => {
  try { return await prisma.order.count({ where }); } catch { return 0; }
};
const safeSum = async (where, field) => {
  try {
    const r = await prisma.order.aggregate({ where, _sum: { [field]: true } });
    return r._sum[field] || 0;
  } catch { return 0; }
};
const safeFind = async (args) => {
  try { return await prisma.order.findMany(args); } catch { return []; }
};

// Build WHERE clause for source filtering
const buildSourceFilter = (sourceId) => {
  if (!sourceId || sourceId === 'all') return {};
  if (sourceId === 'online') return { source: 'ONLINE' };
  const name = sourceId.replace(/_/g, ' ').toUpperCase();
  return { source: 'OUTLET', outletName: { contains: name, mode: 'insensitive' } };
};

// Build date range filter
const buildDateFilter = (start, end) => {
  const f = {};
  if (start) f.gte = new Date(start);
  if (end) f.lte = new Date(end + 'T23:59:59.999Z');
  return Object.keys(f).length ? { createdAt: f } : {};
};

// Build generic filter from query params
const buildFilters = (query, sourceId) => {
  const { startDate, endDate, paymentMethod, paymentStatus, status: statusFilter, city, deliveryStatus } = query;
  const where = { ...buildSourceFilter(sourceId), ...buildDateFilter(startDate, endDate) };
  if (paymentMethod && paymentMethod !== 'all') where.paymentMethod = paymentMethod;
  if (paymentStatus && paymentStatus !== 'all') {
    if (paymentStatus === 'paid') where.paymentStatus = { in: ['PAID', 'FULL_PAID'] };
    else if (paymentStatus === 'unpaid') where.paymentStatus = { notIn: ['PAID', 'FULL_PAID'] };
    else where.paymentStatus = paymentStatus;
  }
  if (city) where.city = { contains: city, mode: 'insensitive' };
  if (statusFilter && statusFilter !== 'all') {
    if (statusFilter === 'active') where.status = { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED'] };
    else where.status = statusFilter;
  }
  if (deliveryStatus && deliveryStatus !== 'all') {
    if (deliveryStatus === 'out_for_delivery') where.currentStage = 'OUT_FOR_DELIVERY';
    else if (deliveryStatus === 'delivered') where.currentStage = 'DELIVERED';
    else if (deliveryStatus === 'returned') where.refundStatus = { not: 'NONE' };
  }
  return where;
};

const SOURCE_LABELS = {
  online: 'Online Orders',
  jail_road: 'Outlet - Jail Road',
  johar_town: 'Outlet - Johar Town',
  abbottabad: 'Outlet - Abbottabad'
};

// GET /api/analytics/sources — list all available sources
const getSources = async (req, res) => {
  try {
    const outletNames = await prisma.order.findMany({
      where: { source: 'OUTLET', outletName: { not: null } },
      distinct: ['outletName'],
      select: { outletName: true }
    });
    const sources = [
      { id: 'all', label: 'All Sources', type: 'ALL' },
      { id: 'online', label: 'Online Orders', type: 'ONLINE' }
    ];
    for (const o of outletNames) {
      const id = o.outletName.toLowerCase().replace(/\s+/g, '_');
      sources.push({ id, label: `Outlet - ${o.outletName}`, type: 'OUTLET', outletName: o.outletName });
    }
    res.json(sources);
  } catch (err) {
    console.error('getSources error:', err);
    res.json([
      { id: 'all', label: 'All Sources', type: 'ALL' },
      { id: 'online', label: 'Online Orders', type: 'ONLINE' },
      { id: 'jail_road', label: 'Outlet - Jail Road', type: 'OUTLET', outletName: 'JAIL ROAD' },
      { id: 'johar_town', label: 'Outlet - Johar Town', type: 'OUTLET', outletName: 'JOHAR TOWN' }
    ]);
  }
};

// GET /api/analytics/source/:sourceId — full analytics for one source
const getSourceAnalytics = async (req, res) => {
  try {
    // Support both route param (source/:sourceId) and query param (unified?branch=)
    const sourceId = req.params.sourceId || req.query.branch || 'all';
    const where = buildFilters(req.query, sourceId);

    // Sequential queries to avoid connection pool exhaustion (Vercel limit=1)
    const whereCompleted = { ...where, status: { in: ['COMPLETED', 'DELIVERED'] } };
    const wherePending = { ...where, status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED'] } };
    const whereRefunded = { ...where, refundStatus: { in: ['REFUNDED', 'PARTIAL'] } };
    const whereRefundPending = { ...where, refundStatus: { in: ['REQUESTED', 'PROCESSING'] } };
    const whereAllRefunded = { ...where, refundStatus: { not: 'NONE' } };

    const totalOrders = await safeCount(where);
    const completedOrders = await safeCount(whereCompleted);
    const returnedOrders = await safeCount(whereAllRefunded);

    const deliveredCod = await safeCount({ ...whereCompleted, paymentMethod: 'CASH' });
    const deliveredOnline = await safeCount({ ...whereCompleted, paymentMethod: { in: ['ONLINE', 'ONLINE_TRANSFER'] } });
    const deliveredPrepaid = await safeCount({ ...whereCompleted, paymentStatus: { in: ['PAID', 'FULL_PAID'] } });

    const pendingOrders = await safeCount(wherePending);

    const totalRevenue = await safeSum(where, 'totalPrice');
    const codRevenue = await safeSum({ ...where, paymentMethod: 'CASH' }, 'totalPrice');
    const onlineRevenue = await safeSum({ ...where, paymentMethod: { in: ['ONLINE', 'ONLINE_TRANSFER'] } }, 'totalPrice');
    const prepaidRevenue = await safeSum({ ...where, paymentStatus: { in: ['PAID', 'FULL_PAID'] } }, 'totalPrice');

    const refundedTotal = await safeSum(whereRefunded, 'totalPrice');
    const refundedCount = await safeCount(whereRefunded);
    const pendingRefundCount = await safeCount(whereRefundPending);

    const returnedPaidCount = await safeCount({
      ...where, refundStatus: { in: ['REFUNDED', 'PARTIAL'] }, paymentStatus: { in: ['PAID', 'FULL_PAID'] }
    });
    const returnedAllCod = await safeCount({ ...whereAllRefunded, paymentMethod: 'CASH' });
    const returnedCodCount = Math.max(0, returnedAllCod - returnedPaidCount);
    const returnedPaidRefunded = await safeSum({
      ...where, refundStatus: { in: ['REFUNDED', 'PARTIAL'] }, paymentStatus: { in: ['PAID', 'FULL_PAID'] }
    }, 'totalPrice');

    const pendingValue = await safeSum(wherePending, 'totalPrice');

    const completedRefunds = await safeCount({ ...where, refundStatus: 'REFUNDED', paymentStatus: { in: ['PAID', 'FULL_PAID'] } });
    const pendingRefunds = await safeCount({
      ...where, refundStatus: { in: ['REQUESTED', 'PROCESSING'] }, paymentStatus: { in: ['PAID', 'FULL_PAID'] }
    });
    const codReturnedAmount = await safeSum({ ...whereAllRefunded, paymentMethod: 'CASH' }, 'totalPrice');

    // Stage breakdown (single query)
    let stageGroups = [];
    try {
      stageGroups = await prisma.order.groupBy({
        by: ['currentStage'],
        where: { ...where, currentStage: { notIn: ['DELIVERED', 'COMPLETED'] } },
        _count: { id: true }
      });
    } catch {}

    // Monthly trends (single query)
    const recentOrders = await safeFind({
      where,
      select: { createdAt: true, totalPrice: true, refundStatus: true },
      orderBy: { createdAt: 'asc' }
    });
    const monthlyMap = {};
    for (const o of recentOrders) {
      const m = new Date(o.createdAt).toLocaleString('en-US', { month: 'short', year: '2-digit' });
      if (!monthlyMap[m]) monthlyMap[m] = { month: m, orders: 0, revenue: 0, returns: 0 };
      monthlyMap[m].orders++;
      monthlyMap[m].revenue += o.totalPrice || 0;
      if (o.refundStatus !== 'NONE') monthlyMap[m].returns++;
    }
    const monthlyTrend = Object.values(monthlyMap);

    const stageCounts = {};
    for (const g of stageGroups) stageCounts[g.currentStage] = g._count.id;

    const pendingByStage = {};
    const stageOrder = ['ORDER_ENTRY', 'STORE', 'LOGO_DESIGN', 'PRODUCTION_ACCEPTANCE', 'PRODUCTION', 'STORE_RECEIVE', 'DISPATCH', 'OUT_FOR_DELIVERY'];
    for (const s of stageOrder) pendingByStage[s] = stageCounts[s] || 0;

    res.json({
      summary: {
        totalOrders,
        deliveredOrders: completedOrders,
        returnedOrders: Math.max(0, returnedOrders),
        pendingOrders
      },
      deliveredBreakdown: {
        cod: { count: deliveredCod, amount: codRevenue },
        online: { count: deliveredOnline, amount: onlineRevenue },
        prepaid: { count: deliveredPrepaid, amount: prepaidRevenue }
      },
      returnsAnalytics: {
        paidReturns: { count: returnedPaidCount, refundAmount: returnedPaidRefunded, completedRefunds, pendingRefunds },
        codReturns: { count: returnedCodCount, amountImpact: codReturnedAmount },
        financialImpact: { totalRefunded: refundedTotal, netRevenueLoss: refundedTotal }
      },
      pendingAnalytics: { count: pendingOrders, totalValue: pendingValue, byStage: pendingByStage },
      financials: {
        totalRevenue, codRevenue, onlineRevenue, prepaidRevenue,
        totalRefunded: refundedTotal, refundedCount, pendingRefundCount,
        netRevenue: totalRevenue - refundedTotal
      },
      trends: { monthly: monthlyTrend }
    });
  } catch (err) {
    console.error('getSourceAnalytics error:', err);
    res.json({
      summary: { totalOrders: 0, deliveredOrders: 0, returnedOrders: 0, pendingOrders: 0 },
      deliveredBreakdown: { cod: { count: 0, amount: 0 }, online: { count: 0, amount: 0 }, prepaid: { count: 0, amount: 0 } },
      returnsAnalytics: { paidReturns: { count: 0, refundAmount: 0, completedRefunds: 0, pendingRefunds: 0 }, codReturns: { count: 0, amountImpact: 0 }, financialImpact: { totalRefunded: 0, netRevenueLoss: 0 } },
      pendingAnalytics: { count: 0, totalValue: 0, byStage: {} },
      financials: { totalRevenue: 0, codRevenue: 0, onlineRevenue: 0, prepaidRevenue: 0, totalRefunded: 0, refundedCount: 0, pendingRefundCount: 0, netRevenue: 0 },
      trends: { monthly: [] }
    });
  }
};

// GET /api/analytics/source/:sourceId/orders — list orders for drill-down
const getSourceOrders = async (req, res) => {
  try {
    const { sourceId } = req.params;
    const { type, limit } = req.query; // type: delivered-cod, delivered-online, delivered-prepaid, returned-paid, returned-cod, pending
    const where = buildFilters(req.query, sourceId);

    if (type === 'delivered-cod') {
      where.status = { in: ['COMPLETED', 'DELIVERED'] };
      where.paymentMethod = 'CASH';
    } else if (type === 'delivered-online') {
      where.status = { in: ['COMPLETED', 'DELIVERED'] };
      where.paymentMethod = { in: ['ONLINE', 'ONLINE_TRANSFER'] };
    } else if (type === 'delivered-prepaid') {
      where.status = { in: ['COMPLETED', 'DELIVERED'] };
      where.paymentStatus = { in: ['PAID', 'FULL_PAID'] };
    } else if (type === 'returned-paid') {
      where.refundStatus = { in: ['REFUNDED', 'PARTIAL'] };
      where.paymentStatus = { in: ['PAID', 'FULL_PAID'] };
    } else if (type === 'returned-cod') {
      where.refundStatus = { not: 'NONE' };
      where.paymentMethod = 'CASH';
    } else if (type === 'pending') {
      where.status = { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED'] };
    }

    const orders = await safeFind({
      where,
      select: {
        id: true, orderNumber: true, customerName: true, customerPhone: true,
        totalPrice: true, paymentMethod: true, paymentStatus: true,
        currentStage: true, status: true, refundStatus: true,
        city: true, createdAt: true, source: true, outletName: true,
        deliveryMethod: true
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit) || 50
    });

    res.json(orders);
  } catch (err) {
    console.error('getSourceOrders error:', err);
    res.json([]);
  }
};

module.exports = { getSources, getSourceAnalytics, getSourceOrders, getUnifiedAnalytics: getSourceAnalytics };
