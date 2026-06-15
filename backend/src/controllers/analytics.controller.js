const prisma = require('../prisma');

const buildBranchFilter = (branch) => {
  if (!branch || branch === 'all') return {};
  const sourceMap = { online: 'ONLINE', internal: 'ONLINE' };
  const source = sourceMap[branch];
  if (source === 'ONLINE') {
    return { source: 'ONLINE' };
  }
  const branchName = branch.replace(/_/g, ' ').toUpperCase();
  return { source: 'OUTLET', outletName: { contains: branchName, mode: 'insensitive' } };
};

const safeCount = async (model, where) => {
  try { return await prisma[model].count({ where }); } catch { return 0; }
};

const safeFind = async (model, args) => {
  try { return await prisma[model].findMany(args); } catch { return []; }
};

const safeAggregate = async (model, args) => {
  try { return await prisma[model].aggregate(args); } catch { return { _sum: {}, _avg: {} }; }
};

const getUnifiedAnalytics = async (req, res) => {
  try {
    const { branch, paymentStatus } = req.query;
    const filter = buildBranchFilter(branch?.toLowerCase());

    let paymentFilter = {};
    if (paymentStatus === 'paid') {
      paymentFilter = { paymentStatus: { in: ['PAID', 'FULL_PAID'] } };
    } else if (paymentStatus === 'unpaid') {
      paymentFilter = { paymentStatus: { notIn: ['PAID', 'FULL_PAID'] } };
    }

    // Orders analytics
    const totalOrders = await safeCount('order', { ...filter, ...paymentFilter });
    const completedOrders = await safeCount('order', { ...filter, ...paymentFilter, status: { in: ['COMPLETED', 'DELIVERED'] } });
    const inProgressOrders = await safeCount('order', { ...filter, ...paymentFilter, status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED', 'PENDING'] } });
    const pendingOrders = await safeCount('order', { ...filter, ...paymentFilter, status: 'PENDING' });
    const cancelledOrders = await safeCount('order', { ...filter, ...paymentFilter, status: { in: ['CANCELLED', 'REJECTED'] } });
    const paidOrders = await safeCount('order', { ...filter, paymentStatus: { in: ['PAID', 'FULL_PAID'] } });
    const unpaidOrders = await safeCount('order', { ...filter, paymentStatus: { notIn: ['PAID', 'FULL_PAID'] } });

    const revenueAgg = await safeAggregate('order', { where: { ...filter, ...paymentFilter }, _sum: { totalPrice: true, productionCost: true, productCost: true, grossProfit: true, netProfit: true, logoCharges: true, namePrintingCharges: true } });
    const totalRevenue = revenueAgg._sum.totalPrice || 0;
    const totalProductionCost = revenueAgg._sum.productionCost || 0;
    const totalProductCost = revenueAgg._sum.productCost || 0;
    const totalGrossProfit = revenueAgg._sum.grossProfit || 0;
    const totalNetProfit = revenueAgg._sum.netProfit || 0;

    // Stage breakdown — single groupBy query instead of 7 sequential queries
    const stageCounts = { ORDER_ENTRY: 0, STORE: 0, LOGO_DESIGN: 0, PRODUCTION: 0, STORE_RECEIVE: 0, DISPATCH: 0, OUT_FOR_DELIVERY: 0 };
    const stageGroups = await prisma.order.groupBy({
      by: ['currentStage'],
      where: { ...filter, ...paymentFilter, currentStage: { in: ['ORDER_ENTRY', 'STORE', 'LOGO_DESIGN', 'PRODUCTION', 'STORE_RECEIVE', 'DISPATCH', 'OUT_FOR_DELIVERY'] } },
      _count: { id: true }
    });
    for (const g of stageGroups) {
      stageCounts[g.currentStage] = g._count.id;
    }

    // Production analytics
    const productionFilter = {};
    if (branch && branch !== 'all') {
      const src = branch === 'online' ? 'ONLINE' : 'OUTLET';
      productionFilter.source = src;
    }
    const prodRecords = await safeFind('productionRecord', { where: productionFilter });
    const totalProduced = prodRecords.reduce((s, r) => s + (r.quantity || 0), 0);
    const prodCost = prodRecords.reduce((s, r) => s + (r.totalCost || 0), 0);
    const rawMaterialCost = prodRecords.reduce((s, r) => s + (r.rawMaterialCost || 0), 0);
    const prodEarnings = prodRecords.reduce((s, r) => s + (r.sellingValue || 0), 0);
    const prodProfit = prodRecords.reduce((s, r) => s + (r.profit || 0), 0);

    // Product breakdown
    const productMap = {};
    prodRecords.forEach(r => {
      if (!productMap[r.productName]) {
        productMap[r.productName] = { productName: r.productName, quantity: 0, totalCost: 0, sellingValue: 0, profit: 0 };
      }
      productMap[r.productName].quantity += r.quantity || 0;
      productMap[r.productName].totalCost += r.totalCost || 0;
      productMap[r.productName].sellingValue += r.sellingValue || 0;
      productMap[r.productName].profit += r.profit || 0;
    });

    // Monthly production trend
    const monthlyProd = {};
    prodRecords.forEach(r => {
      const m = new Date(r.productionDate).toLocaleString('en-US', { month: 'short', year: '2-digit' });
      if (!monthlyProd[m]) monthlyProd[m] = { name: m, quantity: 0, profit: 0 };
      monthlyProd[m].quantity += r.quantity || 0;
      monthlyProd[m].profit += r.profit || 0;
    });

    // Inventory analytics
    const invItems = await safeFind('inventoryItem', {});
    const totalInventoryItems = invItems.length;
    const lowStockItems = invItems.filter(i => i.stock > 0 && i.stock <= 5).length;
    const outOfStockItems = invItems.filter(i => !i.stock || i.stock <= 0).length;
    const totalInventoryValue = invItems.reduce((s, i) => s + ((i.stock || 0) * (i.price || 0)), 0);

    // Dispatch analytics
    const dispatchFilter = {};
    if (branch === 'online') dispatchFilter.source = 'ONLINE';
    else if (branch && branch !== 'all') {
      dispatchFilter.source = 'OUTLET';
      const branchName = branch.replace(/_/g, ' ').toUpperCase();
      dispatchFilter.outletName = { contains: branchName, mode: 'insensitive' };
    }
    const dispatchPending = await safeCount('order', { ...dispatchFilter, ...paymentFilter, currentStage: 'DISPATCH' });
    const outForDelivery = await safeCount('order', { ...dispatchFilter, ...paymentFilter, currentStage: 'OUT_FOR_DELIVERY' });
    const deliveredOrders = await safeCount('order', { ...dispatchFilter, ...paymentFilter, currentStage: 'DELIVERED' });

    // Revenue by source
    const onlineOrders = await safeCount('order', { ...filter, ...paymentFilter, source: 'ONLINE' });
    const outletOrders = totalOrders - onlineOrders;
    const onlineRevenueAgg = await safeAggregate('order', { where: { ...filter, ...paymentFilter, source: 'ONLINE' }, _sum: { totalPrice: true, netProfit: true } });
    const outletRevenueAgg = await safeAggregate('order', { where: { ...filter, ...paymentFilter, source: 'OUTLET' }, _sum: { totalPrice: true, netProfit: true } });

    res.json({
      summary: {
        totalOrders, completedOrders, inProgressOrders, pendingOrders, cancelledOrders, paidOrders, unpaidOrders,
        totalRevenue, totalProductionCost, totalProductCost,
        totalGrossProfit, totalNetProfit,
        totalInventoryItems, lowStockItems, outOfStockItems,
        totalInventoryValue,
        totalProduced, prodCost, rawMaterialCost, prodEarnings, prodProfit,
        dispatchPending, outForDelivery, deliveredOrders,
        onlineOrders, outletOrders,
        onlineRevenue: onlineRevenueAgg._sum.totalPrice || 0,
        onlineProfit: onlineRevenueAgg._sum.netProfit || 0,
        outletRevenue: outletRevenueAgg._sum.totalPrice || 0,
        outletProfit: outletRevenueAgg._sum.netProfit || 0
      },
      stageCounts,
      production: {
        totalProduced, productionCost: prodCost, rawMaterialCost,
        earnings: prodEarnings, profit: prodProfit,
        byProduct: Object.values(productMap).sort((a, b) => b.profit - a.profit),
        monthlyTrend: Object.values(monthlyProd).sort((a, b) => {
          const da = new Date(a.name + ' 2000'), db = new Date(b.name + ' 2000');
          return da - db;
        })
      }
    });
  } catch (error) {
    console.error('Unified analytics error:', error);
    res.json({
      summary: {
        totalOrders: 0, completedOrders: 0, inProgressOrders: 0, pendingOrders: 0, cancelledOrders: 0, paidOrders: 0, unpaidOrders: 0,
        totalRevenue: 0, totalProductionCost: 0, totalProductCost: 0,
        totalGrossProfit: 0, totalNetProfit: 0,
        totalInventoryItems: 0, lowStockItems: 0, outOfStockItems: 0,
        totalInventoryValue: 0,
        totalProduced: 0, prodCost: 0, rawMaterialCost: 0, prodEarnings: 0, prodProfit: 0,
        dispatchPending: 0, outForDelivery: 0, deliveredOrders: 0,
        onlineOrders: 0, outletOrders: 0, onlineRevenue: 0, onlineProfit: 0, outletRevenue: 0, outletProfit: 0
      },
      stageCounts: {},
      production: { totalProduced: 0, productionCost: 0, rawMaterialCost: 0, earnings: 0, profit: 0, byProduct: [], monthlyTrend: [] }
    });
  }
};

module.exports = { getUnifiedAnalytics };
