const prisma = require('../prisma');

const getDateRange = (range) => {
  const now = new Date();
  const start = new Date(now);
  if (range === 'daily') start.setHours(0, 0, 0, 0);
  else if (range === 'weekly') start.setDate(start.getDate() - 7);
  else if (range === 'monthly') start.setMonth(start.getMonth() - 1);
  else if (range === 'yearly') start.setFullYear(start.getFullYear() - 1);
  else start.setFullYear(0);
  return { start, end: now };
};

const getSalesAnalytics = async (range) => {
  const { start, end } = getDateRange(range);
  const allSales = await prisma.posSale.findMany({
    where: { outletName: 'Warehouse', createdAt: { gte: start, lte: end } },
    include: { items: true, returns: true },
    orderBy: { createdAt: 'desc' }
  });
  const totalSales = allSales.length;
  const totalRevenue = allSales.reduce((s, sale) => s + (sale.grandTotal || 0), 0);
  const totalReturns = allSales.reduce((s, sale) => s + (sale.refundedAt ? 1 : 0), 0);
  const totalOrders = await prisma.order.count();

  // Trend by day
  const trendMap = {};
  for (const sale of allSales) {
    const day = sale.createdAt.toISOString().split('T')[0];
    if (!trendMap[day]) trendMap[day] = { count: 0, revenue: 0, returns: 0 };
    trendMap[day].count++;
    trendMap[day].revenue += sale.grandTotal || 0;
    if (sale.refundedAt) trendMap[day].returns++;
  }
  const salesTrend = Object.entries(trendMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, d]) => ({ date, ...d }));

  return { totalSales, totalRevenue, totalOrders, totalReturns, salesTrend };
};

const getInventoryAnalytics = async () => {
  const items = await prisma.inventoryItem.findMany();
  const totalItems = items.length;
  const totalWarehouseStock = items.reduce((s, i) => s + (i.stock || 0), 0);
  const totalStockValue = items.reduce((s, i) => s + ((i.stock || 0) * (i.price || 0)), 0);

  const lowStock = items.filter(i => i.stock > 0 && i.stock <= 5);
  const outOfStock = items.filter(i => i.stock === 0);

  // Outlet inventory
  const outletItems = await prisma.outletInventory.findMany();
  const totalOutletStock = outletItems.reduce((s, i) => s + (i.stock || 0), 0);

  return {
    totalItems,
    totalWarehouseStock,
    totalOutletStock,
    totalStockValue,
    lowStockCount: lowStock.length,
    lowStockItems: lowStock.sort((a, b) => a.stock - b.stock).slice(0, 20),
    outOfStockCount: outOfStock.length,
    outOfStockItems: outOfStock.slice(0, 20),
  };
};

const getTaskOverview = async () => {
  const unseenTasks = await prisma.orderStage.count({
    where: { stageName: 'STORE', status: 'PENDING' }
  });
  const activeTasks = await prisma.orderStage.count({
    where: { stageName: 'STORE', status: 'IN_PROGRESS' }
  });

  // Seen tasks: count distinct (orderId, stageName) from SeenTask where stageName = 'STORE'
  const seenTasks = await prisma.seenTask.count({
    where: { stageName: 'STORE' }
  });

  // Orders received from Production (currentStage = 'STORE')
  const ordersInStore = await prisma.order.count({
    where: { currentStage: 'STORE', status: { not: 'COMPLETED' } }
  });

  return { unseenTasks, seenTasks, activeTasks, ordersInStore };
};

const getInvoiceAndOrderTracking = async (search) => {
  const where = { outletName: 'Warehouse' };
  if (search) {
    where.receiptNumber = { contains: search, mode: 'insensitive' };
  }
  const sales = await prisma.posSale.findMany({
    where,
    include: { items: true, returns: true },
    orderBy: { createdAt: 'desc' },
    take: 100
  });

  // Order tracking
  const orderWhere = {};
  if (search) {
    orderWhere.OR = [
      { orderNumber: { contains: search, mode: 'insensitive' } },
      { customerName: { contains: search, mode: 'insensitive' } },
    ];
  }
  const orders = await prisma.order.findMany({
    where: orderWhere,
    include: { stages: { orderBy: { createdAt: 'desc' }, take: 10 } },
    orderBy: { createdAt: 'desc' },
    take: 50
  });

  return {
    totalInvoices: sales.length,
    invoices: sales,
    totalOrders: orders.length,
    orders
  };
};

const getProductAnalytics = async () => {
  const saleItems = await prisma.posSaleItem.findMany({
    where: { sale: { outletName: 'Warehouse' } },
    include: { sale: true }
  });

  // Product sales aggregation
  const productMap = {};
  for (const item of saleItems) {
    if (item.sale.refundedAt) continue;
    const key = `${item.productName}|${item.color || ''}|${item.size || ''}`;
    if (!productMap[key]) {
      productMap[key] = { name: item.productName, color: item.color, size: item.size, totalQty: 0, totalRevenue: 0, saleCount: 0 };
    }
    productMap[key].totalQty += item.quantity;
    productMap[key].totalRevenue += item.lineTotal || 0;
    productMap[key].saleCount++;
  }

  const productStats = Object.values(productMap).sort((a, b) => b.totalQty - a.totalQty);
  const bestSelling = productStats.slice(0, 5);
  const lowestSelling = productStats.slice(-5).reverse();
  const totalSoldQty = productStats.reduce((s, p) => s + p.totalQty, 0);

  // Most returned
  const returns = await prisma.posReturn.findMany({
    where: { sale: { outletName: 'Warehouse' } },
    include: { sale: true }
  });
  const returnMap = {};
  for (const r of returns) {
    const key = `${r.sale?.items?.[0]?.productName || 'Unknown'}`;
    if (!returnMap[key]) returnMap[key] = 0;
    returnMap[key] += r.quantity;
  }
  const mostReturned = Object.entries(returnMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, qty]) => ({ name, qty }));

  return {
    bestSelling,
    lowestSelling,
    mostReturned,
    productRanking: productStats.slice(0, 20),
    totalProductsSold: productStats.length,
    totalSoldQty,
  };
};

const getReturnAnalytics = async (range) => {
  const { start, end } = getDateRange(range);
  const returns = await prisma.posReturn.findMany({
    where: { sale: { outletName: 'Warehouse' }, createdAt: { gte: start, lte: end } },
    include: { sale: true },
    orderBy: { createdAt: 'desc' }
  });

  const totalReturns = returns.length;
  const totalSales = await prisma.posSale.count({ where: { outletName: 'Warehouse', createdAt: { gte: start, lte: end } } });
  const returnPercentage = totalSales > 0 ? ((totalReturns / totalSales) * 100).toFixed(1) : '0.0';

  return {
    totalReturns,
    returnPercentage,
    returnHistory: returns.slice(0, 50),
    recentReturns: returns.slice(0, 10),
  };
};

const getDelayMonitoring = async () => {
  const now = new Date();

  // All overdue stages
  const overdueStages = await prisma.orderStage.findMany({
    where: {
      deadlineAt: { lt: now, not: null },
      status: { in: ['PENDING', 'IN_PROGRESS'] }
    },
    include: {
      order: { select: { id: true, orderNumber: true, customerName: true, currentStage: true, createdAt: true } }
    },
    orderBy: { deadlineAt: 'asc' }
  });

  const delayedOrders = new Map();
  for (const stage of overdueStages) {
    if (!delayedOrders.has(stage.orderId)) {
      const durationMs = now.getTime() - new Date(stage.deadlineAt).getTime();
      const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
      delayedOrders.set(stage.orderId, {
        orderId: stage.orderId,
        orderNumber: stage.order?.orderNumber || 'N/A',
        customerName: stage.order?.customerName || 'N/A',
        currentStage: stage.order?.currentStage || stage.stageName,
        createdAt: stage.order?.createdAt,
        delayedStage: stage.stageName,
        deadlineAt: stage.deadlineAt,
        delayDurationHours: durationHours,
        status: stage.status,
      });
    }
  }

  const delayed = Array.from(delayedOrders.values());
  const totalDelayed = delayed.length;
  const delayedInStore = delayed.filter(d => d.delayedStage === 'STORE').length;
  const delayedInProduction = delayed.filter(d => d.delayedStage === 'PRODUCTION').length;
  const urgentOrders = delayed.filter(d => d.delayDurationHours >= 48);

  return {
    totalDelayed,
    delayedInStore,
    delayedInProduction,
    delayedInOther: totalDelayed - delayedInStore - delayedInProduction,
    delayedOrders: delayed.slice(0, 50),
    urgentOrders: urgentOrders.slice(0, 10),
  };
};

exports.getOverview = async (req, res) => {
  try {
    const range = req.query.range || 'monthly';
    const search = req.query.search || '';
    const [sales, inventory, tasks, invoiceTracking, products, returns, delays] = await Promise.all([
      getSalesAnalytics(range),
      getInventoryAnalytics(),
      getTaskOverview(),
      getInvoiceAndOrderTracking(search),
      getProductAnalytics(),
      getReturnAnalytics(range),
      getDelayMonitoring(),
    ]);

    // Warehouse performance metrics
    const performance = {
      salesPerDay: sales.salesTrend.length > 0
        ? (sales.totalRevenue / sales.salesTrend.length).toFixed(0)
        : '0',
      avgOrderValue: sales.totalSales > 0
        ? (sales.totalRevenue / sales.totalSales).toFixed(0)
        : '0',
      returnRate: sales.totalSales > 0
        ? ((sales.totalReturns / sales.totalSales) * 100).toFixed(1)
        : '0.0',
      stockTurnoverRate: inventory.totalWarehouseStock > 0 && products.totalSoldQty > 0
        ? (products.totalSoldQty / inventory.totalWarehouseStock).toFixed(2)
        : '0.00',
    };

    res.json({
      sales,
      inventory,
      tasks,
      invoiceTracking,
      products,
      returns,
      delays,
      performance,
    });
  } catch (error) {
    console.error('Store dashboard error:', error);
    res.status(500).json({ message: 'Failed to load store dashboard', error: error.message });
  }
};
