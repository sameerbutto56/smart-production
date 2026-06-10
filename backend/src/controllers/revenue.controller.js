const prisma = require('../prisma');

const getRevenueAnalytics = async (req, res) => {
  try {
    const { dateFrom, dateTo, source, outletName } = req.query;

    const dateFilter = {};
    if (dateFrom || dateTo) {
      dateFilter.createdAt = {};
      if (dateFrom) dateFilter.createdAt.gte = new Date(dateFrom);
      if (dateTo) dateFilter.createdAt.lte = new Date(dateTo);
    }

    const revenueWhere = { ...dateFilter };
    if (source) revenueWhere.source = source;
    if (outletName) revenueWhere.outletName = outletName;

    const [records, summary, sourceBreakdown, typeBreakdown] = await Promise.all([
      prisma.revenueRecord.findMany({
        where: revenueWhere,
        orderBy: { createdAt: 'desc' },
        take: 500
      }),
      prisma.revenueRecord.aggregate({
        where: revenueWhere,
        _sum: { totalRevenue: true, totalProfit: true, orderAmount: true, productCost: true, productionCost: true, logoCharges: true, customizationCharges: true },
        _count: { id: true }
      }),
      prisma.revenueRecord.groupBy({
        by: ['source'],
        where: revenueWhere,
        _sum: { totalRevenue: true, totalProfit: true, productionCost: true },
        _count: { id: true }
      }),
      prisma.revenueRecord.groupBy({
        by: ['orderType'],
        where: revenueWhere,
        _sum: { totalRevenue: true, totalProfit: true },
        _count: { id: true }
      })
    ]);

    const outletBreakdown = await prisma.revenueRecord.groupBy({
      by: ['outletName'],
      where: { ...revenueWhere, outletName: { not: null }, source: 'OUTLET' },
      _sum: { totalRevenue: true, totalProfit: true },
      _count: { id: true },
      orderBy: { _sum: { totalRevenue: 'desc' } }
    });

    res.json({
      summary: {
        totalOrders: summary._count.id || 0,
        totalRevenue: summary._sum.totalRevenue || 0,
        totalProfit: summary._sum.totalProfit || 0,
        totalProductionCost: summary._sum.productionCost || 0,
        totalProductCost: summary._sum.productCost || 0,
        totalLogoCharges: summary._sum.logoCharges || 0,
        totalCustomizationCharges: summary._sum.customizationCharges || 0
      },
      bySource: sourceBreakdown.map(s => ({
        source: s.source,
        revenue: s._sum.totalRevenue || 0,
        profit: s._sum.totalProfit || 0,
        productionCost: s._sum.productionCost || 0,
        orders: s._count.id
      })),
      byType: typeBreakdown.map(t => ({
        type: t.orderType,
        revenue: t._sum.totalRevenue || 0,
        profit: t._sum.totalProfit || 0,
        orders: t._count.id
      })),
      byOutlet: outletBreakdown.map(o => ({
        outletName: o.outletName,
        revenue: o._sum.totalRevenue || 0,
        profit: o._sum.totalProfit || 0,
        orders: o._count.id
      })),
      recentRecords: records.slice(0, 20)
    });
  } catch (error) {
    console.error('Revenue analytics error:', error);
    res.status(500).json({ message: 'Error fetching revenue analytics', error: error.message });
  }
};

const getExecutiveSummary = async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const dateFilter = {};
    if (dateFrom || dateTo) {
      dateFilter.createdAt = {};
      if (dateFrom) dateFilter.createdAt.gte = new Date(dateFrom);
      if (dateTo) dateFilter.createdAt.lte = new Date(dateTo);
    }

    const [revenueAgg, orderCounts] = await Promise.all([
      prisma.revenueRecord.aggregate({
        where: dateFilter,
        _sum: { totalRevenue: true, totalProfit: true, productionCost: true },
        _count: { id: true }
      }),
      prisma.order.groupBy({
        by: ['type'],
        where: {
          ...dateFilter,
          status: { in: ['COMPLETED', 'DELIVERED'] }
        },
        _count: { id: true }
      })
    ]);

    const onlineAgg = await prisma.revenueRecord.aggregate({
      where: { ...dateFilter, source: 'ONLINE' },
      _sum: { totalRevenue: true, totalProfit: true },
      _count: { id: true }
    });

    const outletAgg = await prisma.revenueRecord.aggregate({
      where: { ...dateFilter, source: 'OUTLET' },
      _sum: { totalRevenue: true, totalProfit: true },
      _count: { id: true }
    });

    res.json({
      totalRevenue: revenueAgg._sum.totalRevenue || 0,
      totalProfit: revenueAgg._sum.totalProfit || 0,
      totalOrders: revenueAgg._count.id || 0,
      totalProductionRevenue: revenueAgg._sum.productionCost || 0,
      onlineRevenue: onlineAgg._sum.totalRevenue || 0,
      onlineProfit: onlineAgg._sum.totalProfit || 0,
      onlineOrders: onlineAgg._count.id || 0,
      outletRevenue: outletAgg._sum.totalRevenue || 0,
      outletProfit: outletAgg._sum.totalProfit || 0,
      outletOrders: outletAgg._count.id || 0,
      standardOrders: orderCounts.find(o => o.type === 'STANDARD')?._count.id || 0,
      logoOrders: orderCounts.find(o => o.type === 'READY_LOGO')?._count.id || 0,
      customOrders: orderCounts.find(o => o.type === 'FULL_CUSTOM')?._count.id || 0,
      productionCost: revenueAgg._sum.productionCost || 0
    });
  } catch (error) {
    console.error('Executive summary error:', error);
    res.status(500).json({ message: 'Error fetching executive summary', error: error.message });
  }
};

const getProductionAnalytics = async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const dateFilter = {};
    if (dateFrom || dateTo) {
      dateFilter.createdAt = {};
      if (dateFrom) dateFilter.createdAt.gte = new Date(dateFrom);
      if (dateTo) dateFilter.createdAt.lte = new Date(dateTo);
    }

    const productionWhere = { ...dateFilter, stageName: 'PRODUCTION', status: 'COMPLETED' };
    const productionStages = await prisma.orderStage.findMany({
      where: productionWhere,
      include: { order: { select: { type: true, totalPrice: true, productionCost: true } } },
      orderBy: { completedAt: 'desc' }
    });

    const totalProduced = productionStages.length;
    const totalProductionCost = productionStages.reduce((s, st) => s + (st.order?.productionCost || 0), 0);
    const totalProductionRevenue = productionStages.reduce((s, st) => s + (st.order?.totalPrice || 0), 0);

    const typeBreakdown = {};
    productionStages.forEach(st => {
      const t = st.order?.type || 'STANDARD';
      if (!typeBreakdown[t]) typeBreakdown[t] = { count: 0, cost: 0 };
      typeBreakdown[t].count++;
      typeBreakdown[t].cost += st.order?.productionCost || 0;
    });

    res.json({
      totalProduced,
      totalProductionCost,
      totalProductionRevenue,
      productionProfit: totalProductionRevenue - totalProductionCost,
      byType: Object.entries(typeBreakdown).map(([type, data]) => ({ type, ...data })),
      recentProduction: productionStages.slice(0, 30).map(st => ({
        orderId: st.orderId,
        stageName: st.stageName,
        completedAt: st.completedAt,
        type: st.order?.type
      }))
    });
  } catch (error) {
    console.error('Production analytics error:', error);
    res.status(500).json({ message: 'Error fetching production analytics', error: error.message });
  }
};

module.exports = { getRevenueAnalytics, getExecutiveSummary, getProductionAnalytics };