const prisma = require('../prisma');
const cache = require('../utils/cache');

const safeFind = async (args) => {
  try { return await prisma.order.findMany(args); } catch { return []; }
};

const EMPTY_RESPONSE = {
  summary: { totalOrders: 0, deliveredOrders: 0, returnedOrders: 0, pendingOrders: 0 },
  deliveredBreakdown: { cod: { count: 0, amount: 0 }, online: { count: 0, amount: 0 }, prepaid: { count: 0, amount: 0 } },
  returnsAnalytics: { paidReturns: { count: 0, refundAmount: 0, completedRefunds: 0, pendingRefunds: 0 }, codReturns: { count: 0, amountImpact: 0 }, financialImpact: { totalRefunded: 0, netRevenueLoss: 0 } },
  pendingAnalytics: { count: 0, totalValue: 0, byStage: {} },
  financials: { totalRevenue: 0, codRevenue: 0, onlineRevenue: 0, prepaidRevenue: 0, totalRefunded: 0, refundedCount: 0, pendingRefundCount: 0, netRevenue: 0 },
  trends: { monthly: [] }
};

// Build WHERE clause for source filtering
const buildSourceFilter = (sourceId) => {
  if (!sourceId || sourceId === 'all') return {};
  if (sourceId === 'online') {
    // Online orders may be stored with source='ONLINE'/'INTERNAL' OR outletName containing 'ONLINE'
    return {
      OR: [
        { source: { in: ['ONLINE', 'INTERNAL'] } },
        { outletName: { contains: 'online', mode: 'insensitive' } }
      ]
    };
  }
  const name = sourceId.replace(/_/g, ' ');
  return { outletName: { contains: name, mode: 'insensitive' } };
};

// Build date range filter
const buildDateFilter = (start, end) => {
  const f = {};
  if (start) f.gte = new Date(start);
  if (end) f.lte = new Date(end.includes('T') ? (new Date(end)).getTime() - 1 : end + 'T23:59:59.999Z');
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
    // OUTLET role only sees their own source
    if (req.user?.role === 'OUTLET') {
      const outletName = req.user.name;
      if (!outletName) return res.json([]);
      const id = outletNameToSourceId(outletName);
      return res.json([
        { id, label: `Outlet - ${outletName}`, type: 'OUTLET', outletName }
      ]);
    }

    const outletNames = await prisma.order.findMany({
      where: { outletName: { not: null } },
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

const outletNameToSourceId = (name) => name?.toLowerCase().replace(/\s+/g, '_') || '';

// GET /api/analytics/source/:sourceId — full analytics for one source
const getSourceAnalytics = async (req, res) => {
  try {
    let sourceId = req.params.sourceId || req.query.branch || 'all';

    // Role-based enforcement: OUTLET role can only see their own outlet
    if (req.user?.role === 'OUTLET') {
      const userOutlet = req.user.name;
      if (!userOutlet) return res.json(EMPTY_RESPONSE);
      sourceId = outletNameToSourceId(userOutlet);
    }

    const cacheKey = `analytics:${sourceId}:${JSON.stringify(req.query)}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const where = buildFilters(req.query, sourceId);
    const result = await computeAnalytics(where);
    // Cache for 2 minutes
    cache.set(cacheKey, result, 120);
    res.json(result);
  } catch (err) {
    console.error('[analytics] getSourceAnalytics error:', err);
    res.json(EMPTY_RESPONSE);
  }
};

const computeAnalytics = async (where) => {
  const orders = await prisma.order.findMany({
    where,
    select: {
      totalPrice: true, paymentMethod: true, paymentStatus: true,
      status: true, currentStage: true, refundStatus: true, createdAt: true
    },
    orderBy: { createdAt: 'asc' }
  });

  let totalOrders = 0, completedOrders = 0, returnedOrders = 0;
  let pendingOrders = 0, refundedCount = 0, pendingRefundCount = 0;
  let deliveredCod = 0, deliveredOnline = 0, deliveredPrepaid = 0;
  let totalRevenue = 0, codRevenue = 0, onlineRevenue = 0, prepaidRevenue = 0;
  let refundedTotal = 0, returnedPaidRefunded = 0, pendingValue = 0, codReturnedAmount = 0;
  let returnedPaidCount = 0, returnedAllCod = 0, completedRefunds = 0, pendingRefunds = 0;
  const stageCounts = {};
  const monthlyMap = {};

  const COMPLETED = ['COMPLETED', 'DELIVERED'];
  const ONLINE_METHODS = ['ONLINE', 'ONLINE_TRANSFER'];
  const PAID_STATUSES = ['PAID', 'FULL_PAID'];
  const REFUNDED_STATUSES = ['REFUNDED', 'PARTIAL'];
  const REFUND_PENDING = ['REQUESTED', 'PROCESSING'];
  const NOT_PENDING = ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED'];
  const stageOrder = ['ORDER_ENTRY', 'STORE', 'LOGO_DESIGN', 'WORKERS', 'PRODUCTION_ACCEPTANCE', 'PRODUCTION', 'STORE_RECEIVE', 'DISPATCH', 'OUT_FOR_DELIVERY'];

  for (const o of orders) {
    totalOrders++;
    const price = o.totalPrice || 0;
    const isCompleted = COMPLETED.includes(o.status);
    const isPending = !NOT_PENDING.includes(o.status);
    const isRefunded = REFUNDED_STATUSES.includes(o.refundStatus);
    const isAnyRefund = o.refundStatus !== 'NONE';

    if (isCompleted) completedOrders++;
    if (isPending) { pendingOrders++; pendingValue += price; }
    if (isAnyRefund) returnedOrders++;
    if (isRefunded) { refundedCount++; refundedTotal += price; }
    if (REFUND_PENDING.includes(o.refundStatus)) pendingRefundCount++;

    totalRevenue += price;
    if (o.paymentMethod === 'CASH') codRevenue += price;
    if (ONLINE_METHODS.includes(o.paymentMethod)) onlineRevenue += price;
    if (PAID_STATUSES.includes(o.paymentStatus)) prepaidRevenue += price;

    if (isCompleted && o.paymentMethod === 'CASH') deliveredCod++;
    if (isCompleted && ONLINE_METHODS.includes(o.paymentMethod)) deliveredOnline++;
    if (isCompleted && PAID_STATUSES.includes(o.paymentStatus)) deliveredPrepaid++;

    if (isRefunded && PAID_STATUSES.includes(o.paymentStatus)) {
      returnedPaidCount++;
      returnedPaidRefunded += price;
    }
    if (isAnyRefund && o.paymentMethod === 'CASH') {
      returnedAllCod++;
      codReturnedAmount += price;
    }
    if (isRefunded && PAID_STATUSES.includes(o.paymentStatus)) completedRefunds++;
    if (REFUND_PENDING.includes(o.refundStatus) && PAID_STATUSES.includes(o.paymentStatus)) pendingRefunds++;

    if (isPending && o.currentStage && !COMPLETED.includes(o.currentStage)) {
      stageCounts[o.currentStage] = (stageCounts[o.currentStage] || 0) + 1;
    }

    const m = new Date(o.createdAt).toLocaleString('en-US', { month: 'short', year: '2-digit' });
    if (!monthlyMap[m]) monthlyMap[m] = { month: m, orders: 0, revenue: 0, returns: 0 };
    monthlyMap[m].orders++;
    monthlyMap[m].revenue += price;
    if (isAnyRefund) monthlyMap[m].returns++;
  }

  const returnedCodCount = Math.max(0, returnedAllCod - returnedPaidCount);
  const monthlyTrend = Object.values(monthlyMap);
  const pendingByStage = {};
  for (const s of stageOrder) pendingByStage[s] = stageCounts[s] || 0;

  return {
    summary: { totalOrders, deliveredOrders: completedOrders, returnedOrders: Math.max(0, returnedOrders), pendingOrders },
    deliveredBreakdown: { cod: { count: deliveredCod, amount: codRevenue }, online: { count: deliveredOnline, amount: onlineRevenue }, prepaid: { count: deliveredPrepaid, amount: prepaidRevenue } },
    returnsAnalytics: { paidReturns: { count: returnedPaidCount, refundAmount: returnedPaidRefunded, completedRefunds, pendingRefunds }, codReturns: { count: returnedCodCount, amountImpact: codReturnedAmount }, financialImpact: { totalRefunded: refundedTotal, netRevenueLoss: refundedTotal } },
    pendingAnalytics: { count: pendingOrders, totalValue: pendingValue, byStage: pendingByStage },
    financials: { totalRevenue, codRevenue, onlineRevenue, prepaidRevenue, totalRefunded: refundedTotal, refundedCount, pendingRefundCount, netRevenue: totalRevenue - refundedTotal },
    trends: { monthly: monthlyTrend }
  };
};

// GET /api/analytics/source/:sourceId/orders — list orders for drill-down
const getSourceOrders = async (req, res) => {
  try {
    let { sourceId } = req.params;

    // OUTLET role constraint
    if (req.user?.role === 'OUTLET') {
      if (!req.user.name) return res.json([]);
      sourceId = outletNameToSourceId(req.user.name);
    }

    const { type, limit } = req.query;
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

const exportAnalyticsExcel = async (req, res) => {
  try {
    let sourceId = req.query.source || 'all';

    // OUTLET role constraint
    if (req.user?.role === 'OUTLET') {
      if (!req.user.name) return res.status(403).json({ message: 'Access denied' });
      sourceId = outletNameToSourceId(req.user.name);
    }

    const where = buildFilters(req.query, sourceId);

    // Fetch matching orders
    const orders = await prisma.order.findMany({
      where,
      select: {
        orderNumber: true,
        customerName: true,
        customerPhone: true,
        city: true,
        type: true,
        quantity: true,
        status: true,
        currentStage: true,
        paymentStatus: true,
        paymentMethod: true,
        totalPrice: true,
        advanceAmount: true,
        deliveryCharges: true,
        refundStatus: true,
        source: true,
        outletName: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Compute basic analytics
    const stats = await computeAnalytics(where);

    // Sheet 1: Summary / Overview
    const summaryRows = [
      { Metric: 'Total Orders', Value: stats.summary.totalOrders },
      { Metric: 'Delivered Orders', Value: stats.summary.deliveredOrders },
      { Metric: 'Returned Orders', Value: stats.summary.returnedOrders },
      { Metric: 'Pending Orders', Value: stats.summary.pendingOrders },
      { Metric: 'Total Revenue (₨)', Value: stats.financials.totalRevenue },
      { Metric: 'COD Revenue (₨)', Value: stats.financials.codRevenue },
      { Metric: 'Online Revenue (₨)', Value: stats.financials.onlineRevenue },
      { Metric: 'Prepaid Revenue (₨)', Value: stats.financials.prepaidRevenue },
      { Metric: 'Total Refunded (₨)', Value: stats.financials.totalRefunded },
      { Metric: 'Net Revenue (₨)', Value: stats.financials.netRevenue }
    ];

    // Sheet 2: Orders List
    const orderRows = orders.map(o => ({
      'Order Number': o.orderNumber || '',
      'Customer Name': o.customerName || '',
      'Customer Phone': o.customerPhone || '',
      'City': o.city || '',
      'Type': o.type || '',
      'Quantity': o.quantity,
      'Status': o.status || '',
      'Current Stage': o.currentStage || '',
      'Payment Status': o.paymentStatus || '',
      'Payment Method': o.paymentMethod || '',
      'Total Price (₨)': o.totalPrice || 0,
      'Advance Amount (₨)': o.advanceAmount || 0,
      'Delivery Charges (₨)': o.deliveryCharges || 0,
      'Refund Status': o.refundStatus || '',
      'Source': o.source || '',
      'Outlet Name': o.outletName || '',
      'Created At': o.createdAt ? new Date(o.createdAt).toISOString() : ''
    }));

    // Sheet 3: Branch Performance Comparison
    const branchPerformance = [];
    const branches = ['Johar Town', 'Jail Road', 'Abbottabad'];
    for (const b of branches) {
      const bWhere = { ...where, outletName: { contains: b, mode: 'insensitive' } };
      const bStats = await computeAnalytics(bWhere);
      branchPerformance.push({
        'Branch Name': b,
        'Total Orders': bStats.summary.totalOrders,
        'Completed Orders': bStats.summary.deliveredOrders,
        'Returned Orders': bStats.summary.returnedOrders,
        'Total Revenue (₨)': bStats.financials.totalRevenue,
        'Total Refunded (₨)': bStats.financials.totalRefunded,
        'Net Revenue (₨)': bStats.financials.netRevenue
      });
    }

    const XLSX = require('xlsx');
    const wb = XLSX.utils.book_new();
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    const wsOrders = XLSX.utils.json_to_sheet(orderRows);
    const wsBranch = XLSX.utils.json_to_sheet(branchPerformance);

    XLSX.utils.book_append_sheet(wb, wsSummary, 'Overview');
    XLSX.utils.book_append_sheet(wb, wsOrders, 'Orders Report');
    XLSX.utils.book_append_sheet(wb, wsBranch, 'Branch Performance');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `analytics_report_${Date.now()}.xlsx`;

    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (error) {
    console.error('ANALYTICS EXPORT ERROR:', error);
    res.status(500).json({ message: 'Failed to export analytics report', error: error.message });
  }
};

module.exports = { getSources, getSourceAnalytics, getSourceOrders, getUnifiedAnalytics: getSourceAnalytics, exportAnalyticsExcel };
