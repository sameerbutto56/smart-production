const prisma = require('../prisma');

const LOCATIONS = ['Johar Town', 'Jail Road', 'Abbottabad'];
const ALL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'CEO'];

const getDateRange = (range, dateFrom, dateTo) => {
  const now = new Date();
  let start = null, end = now;
  if (dateFrom) start = new Date(dateFrom);
  if (dateTo) { end = new Date(dateTo); end.setHours(23, 59, 59, 999); }
  if (!start && range) {
    start = new Date(now);
    if (range === 'today') start.setHours(0, 0, 0, 0);
    else if (range === 'yesterday') { start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0); end = new Date(start); end.setHours(23, 59, 59, 999); }
    else if (range === 'week' || range === 'thisWeek') start.setDate(start.getDate() - start.getDay());
    else if (range === 'lastWeek') { start.setDate(start.getDate() - start.getDay() - 7); end = new Date(start); end.setDate(end.getDate() + 6); end.setHours(23, 59, 59, 999); }
    else if (range === 'month' || range === 'thisMonth') start.setDate(1);
    else if (range === 'lastMonth') { start.setMonth(start.getMonth() - 1); start.setDate(1); end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999); }
    else if (range === 'quarter') start.setMonth(Math.floor(now.getMonth() / 3) * 3);
    else if (range === 'year' || range === 'thisYear') start = new Date(now.getFullYear(), 0, 1);
    else start.setFullYear(0);
  }
  return { start, end };
};

const dateFilter = (range, dateFrom, dateTo) => {
  const { start, end } = getDateRange(range, dateFrom, dateTo);
  const f = {};
  if (start) f.gte = start;
  if (end) f.lte = end;
  return Object.keys(f).length ? { createdAt: f } : {};
};

const getPreviousPeriodRange = (range, dateFrom, dateTo) => {
  const { start, end } = getDateRange(range, dateFrom, dateTo);
  if (!start) return { start: null, end: null };
  const diff = end.getTime() - start.getTime();
  return { start: new Date(start.getTime() - diff), end: new Date(start.getTime() - 1) };
};

// =========================== OVERVIEW ===========================
exports.getOverview = async (req, res) => {
  try {
    const { range, dateFrom, dateTo, branch } = req.query;
    const df = dateFilter(range, dateFrom, dateTo);
    const branchFilter = branch && branch !== 'all' ? { outletName: { contains: branch, mode: 'insensitive' } } : {};

    const prevRange = getPreviousPeriodRange(range, dateFrom, dateTo);
    const prevDf = prevRange.start ? { createdAt: { gte: prevRange.start, lte: prevRange.end } } : {};

    const [currentSales, prevSales, totalOrders, totalProducts] = await Promise.all([
      prisma.posSale.findMany({ where: { ...df, ...branchFilter, faisalTake: { not: true } }, select: { grandTotal: true, advanceAmount: true, orderId: true, id: true } }),
      prisma.posSale.findMany({ where: { ...prevDf, ...branchFilter, faisalTake: { not: true } }, select: { grandTotal: true, advanceAmount: true, orderId: true, id: true } }),
      prisma.order.count({ where: { ...df, ...branchFilter } }),
      prisma.inventoryItem.count()
    ]);

    const saleRevenue = (sales) => sales.reduce((sum, s) => sum + (s.orderId ? Math.min(s.advanceAmount || 0, s.grandTotal || 0) : (s.grandTotal || 0)), 0);
    const currentRevenue = saleRevenue(currentSales);
    const prevRevenue = saleRevenue(prevSales);
    const salesGrowth = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : currentRevenue > 0 ? 100 : 0;

    const currentTotal = currentSales.reduce((s, x) => s + (x.grandTotal || 0), 0);
    const prevTotal = prevSales.reduce((s, x) => s + (x.grandTotal || 0), 0);
    const businessGrowth = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : currentTotal > 0 ? 100 : 0;

    const revenueRecords = await prisma.revenueRecord.findMany({ where: { ...df, ...branchFilter }, select: { totalRevenue: true, totalProfit: true, productCost: true } });
    const totalRevenue = revenueRecords.reduce((s, r) => s + (r.totalRevenue || 0), 0);
    const totalProfit = revenueRecords.reduce((s, r) => s + (r.totalProfit || 0), 0);
    const totalCost = revenueRecords.reduce((s, r) => s + (r.productCost || 0), 0);
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    const totalExpenses = await prisma.journalEntry.aggregate({ where: { ...df, ...branchFilter }, _sum: { amount: true } });
    const expenses = totalExpenses._sum.amount || 0;

    const bankDeposits = await prisma.bankDeposit.aggregate({ where: { ...df, ...branchFilter }, _sum: { amount: true } });
    const deposits = bankDeposits._sum.amount || 0;

    res.json({
      summary: { totalRevenue, totalProfit, totalCost, profitMargin, totalSales: currentSales.length, totalOrders, totalProducts, totalExpenses: expenses, totalDeposits: deposits },
      growth: { businessGrowth, salesGrowth, currentRevenue, prevRevenue, currentTotal, prevTotal },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ message: 'CEO overview error', error: error.message });
  }
};

// =========================== SALES ANALYTICS ===========================
exports.getSales = async (req, res) => {
  try {
    const { range, dateFrom, dateTo, branch, product, category, employee } = req.query;
    const df = dateFilter(range, dateFrom, dateTo);
    const branchFilter = branch && branch !== 'all' ? { outletName: { contains: branch, mode: 'insensitive' } } : {};

    const allSales = await prisma.posSale.findMany({
      where: { ...df, ...branchFilter, faisalTake: { not: true } },
      include: { items: true, balancePayments: { select: { amountPaidNow: true, paymentMethod: true, paidAt: true } } },
      orderBy: { createdAt: 'desc' }
    });

    const totalSales = allSales.length;
    const saleRevenue = (s) => s.orderId ? Math.min(s.advanceAmount || 0, s.grandTotal || 0) : (s.grandTotal || 0);
    const totalRevenue = allSales.reduce((sum, s) => sum + saleRevenue(s), 0);

    const branchSales = {};
    for (const s of allSales) {
      const name = s.outletName || 'Unknown';
      if (!branchSales[name]) branchSales[name] = { count: 0, revenue: 0, grandTotal: 0 };
      branchSales[name].count++;
      branchSales[name].revenue += saleRevenue(s);
      branchSales[name].grandTotal += s.grandTotal || 0;
    }
    const branchPerformance = Object.entries(branchSales).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.revenue - a.revenue);

    const dayMap = {};
    for (const s of allSales) {
      const day = s.createdAt.toISOString().split('T')[0];
      if (!dayMap[day]) dayMap[day] = { count: 0, revenue: 0 };
      dayMap[day].count++;
      dayMap[day].revenue += saleRevenue(s);
    }
    const salesTrend = Object.entries(dayMap).map(([date, d]) => ({ date, ...d })).sort((a, b) => a.date.localeCompare(b.date));

    const paymentMethodMap = {};
    for (const s of allSales) {
      const pm = s.paymentMethod || 'Unknown';
      if (!paymentMethodMap[pm]) paymentMethodMap[pm] = { count: 0, amount: 0 };
      paymentMethodMap[pm].count++;
      paymentMethodMap[pm].amount += saleRevenue(s);
    }
    const paymentBreakdown = Object.entries(paymentMethodMap).map(([name, d]) => ({ name, ...d }));

    const productMap = {};
    for (const s of allSales) {
      for (const item of (s.items || [])) {
        const key = item.productName || 'Unknown';
        if (!productMap[key]) productMap[key] = { name: key, totalQty: 0, totalRevenue: 0, saleCount: 0, category: item.category || '' };
        productMap[key].totalQty += item.quantity || 0;
        productMap[key].totalRevenue += item.lineTotal || 0;
        productMap[key].saleCount++;
      }
    }
    const productSales = Object.values(productMap).sort((a, b) => b.totalRevenue - a.totalRevenue);

    const onlineSales = {
      count: allSales.filter(s => s.paymentMethod === 'ONLINE' || s.onlineAmount > 0).length,
      revenue: allSales.filter(s => s.paymentMethod === 'ONLINE' || s.onlineAmount > 0).reduce((sum, s) => sum + saleRevenue(s), 0)
    };
    const outletSalesTotal = {
      count: allSales.filter(s => s.paymentMethod !== 'ONLINE' && !s.onlineAmount).length,
      revenue: allSales.filter(s => s.paymentMethod !== 'ONLINE' && !s.onlineAmount).reduce((sum, s) => sum + saleRevenue(s), 0)
    };

    res.json({ totalSales, totalRevenue, salesTrend, branchPerformance, paymentBreakdown, productSales: productSales.slice(0, 50), onlineSales, outletSales: outletSalesTotal, allSalesCount: allSales.length });
  } catch (error) {
    res.status(500).json({ message: 'CEO sales error', error: error.message });
  }
};

// =========================== FINANCIAL ANALYTICS ===========================
exports.getFinancial = async (req, res) => {
  try {
    const { range, dateFrom, dateTo, branch } = req.query;
    const df = dateFilter(range, dateFrom, dateTo);
    const branchFilter = branch && branch !== 'all' ? { ...(branch === 'online' ? { source: { in: ['ONLINE', 'INTERNAL'] } } : { outletName: { contains: branch, mode: 'insensitive' } }) } : {};

    const revenueRecords = await prisma.revenueRecord.findMany({ where: { ...df, ...branchFilter }, select: { totalRevenue: true, totalProfit: true, productCost: true, logoCharges: true, namePrintingCharges: true, customizationCharges: true, productionCost: true, outletName: true } });
    const grossProfit = revenueRecords.reduce((s, r) => s + (r.totalProfit || 0), 0);
    const netProfit = grossProfit;
    const totalRevenue = revenueRecords.reduce((s, r) => s + (r.totalRevenue || 0), 0);
    const totalCost = revenueRecords.reduce((s, r) => s + (r.productCost || 0), 0);

    const journals = await prisma.journalEntry.aggregate({ where: { ...df, ...branchFilter }, _sum: { amount: true } });
    const totalExpenses = journals._sum.amount || 0;

    const deposits = await prisma.bankDeposit.aggregate({ where: { ...df, ...branchFilter }, _sum: { amount: true } });
    const totalDeposits = deposits._sum.amount || 0;

    const withdrawals = 0;

    const ordersWithAdvance = await prisma.posSale.aggregate({ where: { ...df, ...branchFilter, orderId: { not: null } }, _sum: { advanceAmount: true } });
    const outstandingReceivables = ordersWithAdvance._sum.advanceAmount || 0;

    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    const expenseMap = {};
    const expenseEntries = await prisma.journalEntry.findMany({ where: { ...df, ...branchFilter }, select: { amount: true, description: true, category: true } });
    for (const e of expenseEntries) {
      const cat = e.category || 'Other';
      if (!expenseMap[cat]) expenseMap[cat] = 0;
      expenseMap[cat] += e.amount || 0;
    }
    const expenseBreakdown = Object.entries(expenseMap).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);

    const monthMap = {};
    for (const r of revenueRecords) {
      const key = 'all';
      if (!monthMap[key]) monthMap[key] = { revenue: 0, cost: 0, profit: 0 };
      monthMap[key].revenue += r.totalRevenue || 0;
      monthMap[key].cost += (r.productCost || 0) + (r.productionCost || 0);
      monthMap[key].profit += r.totalProfit || 0;
    }

    const branchProfitMap = {};
    for (const r of revenueRecords) {
      const loc = r.outletName || 'Unknown';
      if (!branchProfitMap[loc]) branchProfitMap[loc] = { revenue: 0, profit: 0, cost: 0 };
      branchProfitMap[loc].revenue += r.totalRevenue || 0;
      branchProfitMap[loc].profit += r.totalProfit || 0;
      branchProfitMap[loc].cost += r.productCost || 0;
    }
    const profitByBranch = Object.entries(branchProfitMap).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.profit - a.profit);

    res.json({ grossProfit, netProfit, totalRevenue, totalCost, totalExpenses, totalDeposits, withdrawals, outstandingReceivables, profitMargin, expenseBreakdown, profitByBranch });
  } catch (error) {
    res.status(500).json({ message: 'CEO financial error', error: error.message });
  }
};

// =========================== BRANCH PERFORMANCE ===========================
exports.getBranches = async (req, res) => {
  try {
    const { range, dateFrom, dateTo } = req.query;
    const df = dateFilter(range, dateFrom, dateTo);

    const branchData = [];
    for (const loc of LOCATIONS) {
      const [sales, ordersCount] = await Promise.all([
        prisma.posSale.findMany({ where: { ...df, outletName: { contains: loc, mode: 'insensitive' }, faisalTake: { not: true } }, select: { grandTotal: true, advanceAmount: true, orderId: true, id: true, paymentMethod: true } }),
        prisma.order.count({ where: { ...df, outletName: { contains: loc, mode: 'insensitive' } } })
      ]);
      const saleRevenue = (s) => s.orderId ? Math.min(s.advanceAmount || 0, s.grandTotal || 0) : (s.grandTotal || 0);
      const revenue = sales.reduce((sum, s) => sum + saleRevenue(s), 0);
      const grandTotal = sales.reduce((sum, s) => sum + (s.grandTotal || 0), 0);
      const orders = sales.length;
      branchData.push({ name: loc, revenue, grandTotal, orders: ordersCount || orders });
    }

    branchData.sort((a, b) => b.revenue - a.revenue);
    const best = branchData.length > 0 ? branchData[0] : null;
    const worst = branchData.length > 0 ? branchData[branchData.length - 1] : null;

    const onlineOrders = await prisma.order.count({ where: { ...df, source: { in: ['ONLINE', 'INTERNAL'] } } });
    const onlineRevenue = await prisma.revenueRecord.aggregate({ where: { ...df, source: { in: ['ONLINE', 'INTERNAL'] } }, _sum: { totalRevenue: true } });

    const growthData = [];
    for (let i = 5; i >= 0; i--) {
      const m = new Date(); m.setMonth(m.getMonth() - i);
      const start = new Date(m.getFullYear(), m.getMonth(), 1);
      const end = new Date(m.getFullYear(), m.getMonth() + 1, 0, 23, 59, 59, 999);
      const monthSales = await prisma.posSale.findMany({ where: { createdAt: { gte: start, lte: end }, faisalTake: { not: true } }, select: { grandTotal: true } });
      growthData.push({ month: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`, revenue: monthSales.reduce((s, x) => s + (x.grandTotal || 0), 0) });
    }

    res.json({ branches: branchData, bestPerforming: best, lowestPerforming: worst, onlineStore: { orders: onlineOrders, revenue: onlineRevenue._sum.totalRevenue || 0 }, growthData });
  } catch (error) {
    res.status(500).json({ message: 'CEO branches error', error: error.message });
  }
};

// =========================== ORDER ANALYTICS ===========================
exports.getOrders = async (req, res) => {
  try {
    const { range, dateFrom, dateTo, branch, status } = req.query;
    const df = dateFilter(range, dateFrom, dateTo);
    const branchFilter = branch && branch !== 'all' ? (branch === 'online' ? { source: { in: ['ONLINE', 'INTERNAL'] } } : { outletName: { contains: branch, mode: 'insensitive' } }) : {};

    const allOrders = await prisma.order.findMany({
      where: { ...df, ...branchFilter },
      select: { id: true, currentStage: true, status: true, priority: true, createdAt: true, outletName: true, source: true }
    });

    const totalOrders = allOrders.length;
    const onlineOrders = allOrders.filter(o => o.source === 'ONLINE' || o.source === 'INTERNAL').length;
    const outletOrders = allOrders.filter(o => o.source === 'OUTLET' || o.outletName).length;
    const delivered = allOrders.filter(o => o.currentStage === 'DELIVERED' || o.status === 'DELIVERED').length;
    const pending = allOrders.filter(o => !['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED'].includes(o.status || o.currentStage)).length;
    const cancelled = allOrders.filter(o => o.status === 'CANCELLED' || o.currentStage === 'CANCELLED').length;
    const returned = allOrders.filter(o => o.status === 'REJECTED' || o.currentStage === 'REJECTED').length;
    const superUrgent = allOrders.filter(o => o.priority === 'SUPER_URGENT').length;
    const completionRate = totalOrders > 0 ? ((delivered / totalOrders) * 100).toFixed(1) : '0.0';

    const branchOrderMap = {};
    for (const o of allOrders) {
      const name = o.outletName || o.source || 'Unknown';
      if (!branchOrderMap[name]) branchOrderMap[name] = { total: 0, delivered: 0, pending: 0 };
      branchOrderMap[name].total++;
      if (o.currentStage === 'DELIVERED' || o.status === 'DELIVERED') branchOrderMap[name].delivered++;
      else if (!['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED'].includes(o.status || o.currentStage)) branchOrderMap[name].pending++;
    }
    const ordersByBranch = Object.entries(branchOrderMap).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.total - a.total);

    const monthMap = {};
    for (const o of allOrders) {
      const month = o.createdAt.toISOString().substring(0, 7);
      if (!monthMap[month]) monthMap[month] = { total: 0, delivered: 0, pending: 0 };
      monthMap[month].total++;
      if (o.currentStage === 'DELIVERED' || o.status === 'DELIVERED') monthMap[month].delivered++;
      else monthMap[month].pending++;
    }
    const orderTrend = Object.entries(monthMap).map(([month, d]) => ({ month, ...d })).sort((a, b) => a.month.localeCompare(b.month));

    res.json({ totalOrders, onlineOrders, outletOrders, delivered, pending, cancelled, returned, superUrgent, completionRate: parseFloat(completionRate), ordersByBranch, orderTrend });
  } catch (error) {
    res.status(500).json({ message: 'CEO orders error', error: error.message });
  }
};

// =========================== PRODUCT ANALYTICS ===========================
exports.getProducts = async (req, res) => {
  try {
    const { range, dateFrom, dateTo, branch, category } = req.query;
    const df = dateFilter(range, dateFrom, dateTo);
    const branchFilter = branch && branch !== 'all' ? { outletName: { contains: branch, mode: 'insensitive' } } : {};

    const saleItems = await prisma.posSaleItem.findMany({
      where: { sale: { ...df, ...branchFilter, faisalTake: { not: true } } },
      include: { sale: { select: { grandTotal: true, createdAt: true, outletName: true, refundedAt: true } } }
    });

    const productMap = {};
    for (const item of saleItems) {
      if (item.sale?.refundedAt) continue;
      const name = item.productName || 'Unknown';
      if (!productMap[name]) productMap[name] = { name, totalQty: 0, totalRevenue: 0, saleCount: 0, category: item.category || '' };
      productMap[name].totalQty += item.quantity || 0;
      productMap[name].totalRevenue += item.lineTotal || 0;
      productMap[name].saleCount++;
    }
    const products = Object.values(productMap).sort((a, b) => b.totalRevenue - a.totalRevenue);
    const bestSelling = products.slice(0, 10);
    const lowestSelling = [...products].reverse().slice(0, 10);

    const returns = await prisma.posReturn.findMany({
      where: { sale: { ...df, ...branchFilter, faisalTake: { not: true } } },
      include: { sale: { include: { items: true } } }
    });
    const returnMap = {};
    for (const r of returns) {
      const items = r.sale?.items || [];
      for (const item of items) {
        const name = item.productName || 'Unknown';
        if (!returnMap[name]) returnMap[name] = { name, qty: 0 };
        returnMap[name].qty += r.quantity;
      }
    }
    const highReturn = Object.values(returnMap).sort((a, b) => b.qty - a.qty).slice(0, 10);

    const slowMoving = products.filter(p => p.saleCount <= 2 && p.totalQty < 5).slice(0, 10);

    res.json({ bestSelling, lowestSelling, slowMoving, highReturn, totalProducts: products.length, allProducts: products.slice(0, 100) });
  } catch (error) {
    res.status(500).json({ message: 'CEO products error', error: error.message });
  }
};

// =========================== INVENTORY ANALYTICS ===========================
exports.getInventory = async (req, res) => {
  try {
    const items = await prisma.inventoryItem.findMany({ orderBy: { createdAt: 'desc' } });
    const totalItems = items.length;
    let totalStock = 0, totalValue = 0;
    for (const item of items) {
      const vs = typeof item.variants === 'string' ? JSON.parse(item.variants) : (item.variants || []);
      if (Array.isArray(vs) && vs.length > 0) {
        for (const v of vs) {
          const q = parseInt(v.stock) || 0;
          totalStock += q;
          totalValue += q * (parseFloat(v.price) || 0);
        }
      } else {
        totalStock += item.stock || 0;
        totalValue += (item.stock || 0) * (item.price || 0);
      }
    }

    const lowStock = items.filter(i => {
      const vs = typeof i.variants === 'string' ? JSON.parse(i.variants) : (i.variants || []);
      if (Array.isArray(vs) && vs.length > 0) return vs.some(v => (parseInt(v.stock) || 0) > 0 && (parseInt(v.stock) || 0) <= 5);
      return i.stock > 0 && i.stock <= 5;
    });
    const outOfStock = items.filter(i => {
      const vs = typeof i.variants === 'string' ? JSON.parse(i.variants) : (i.variants || []);
      if (Array.isArray(vs) && vs.length > 0) return vs.every(v => (parseInt(v.stock) || 0) === 0);
      return i.stock === 0 || i.stock === null;
    });
    const overstock = items.filter(i => {
      const vs = typeof i.variants === 'string' ? JSON.parse(i.variants) : (i.variants || []);
      if (Array.isArray(vs) && vs.length > 0) return vs.some(v => (parseInt(v.stock) || 0) > 50);
      return i.stock > 50;
    });

    const outletInv = await prisma.outletInventory.findMany({ select: { outletName: true, stock: true, price: true } });
    const branchInvMap = {};
    for (const oi of outletInv) {
      const loc = oi.outletName || 'Unknown';
      if (!branchInvMap[loc]) branchInvMap[loc] = { stock: 0, value: 0 };
      branchInvMap[loc].stock += oi.stock || 0;
      branchInvMap[loc].value += (oi.stock || 0) * (oi.price || 0);
    }
    const branchInventory = Object.entries(branchInvMap).map(([name, d]) => ({ name, ...d }));

    const warehouseStock = totalStock;
    const warehouseValue = totalValue;

    const turnoverRatio = totalStock > 0 ? ((await prisma.posSaleItem.aggregate({ _sum: { quantity: true } }))._sum.quantity || 0) / totalStock : 0;

    res.json({ totalItems, totalStock: warehouseStock, totalValue: warehouseValue, lowStockCount: lowStock.length, outOfStockCount: outOfStock.length, overstockCount: overstock.length, turnoverRatio: parseFloat(turnoverRatio.toFixed(2)), branchInventory, lowStockItems: lowStock.slice(0, 20), outOfStockItems: outOfStock.slice(0, 20) });
  } catch (error) {
    res.status(500).json({ message: 'CEO inventory error', error: error.message });
  }
};

// =========================== PRODUCTION ANALYTICS ===========================
exports.getProduction = async (req, res) => {
  try {
    const { range, dateFrom, dateTo } = req.query;
    const df = dateFilter(range, dateFrom, dateTo);

    const [records, orders] = await Promise.all([
      prisma.productionRecord.findMany({ where: df, select: { quantity: true, totalCost: true, createdAt: true, productName: true } }),
      prisma.order.findMany({ where: { ...df, currentStage: { in: ['PRODUCTION', 'PRODUCTION_ACCEPTANCE', 'STORE_RECEIVE'] } }, select: { id: true, productDetails: true, createdAt: true } })
    ]);

    const totalUnits = records.reduce((s, r) => s + (r.quantity || 0), 0);
    const totalCost = records.reduce((s, r) => s + (r.totalCost || 0), 0);

    const warehouseReceipts = await prisma.inventoryItem.findMany({
      where: { ...df },
      select: { stock: true, name: true, createdAt: true }
    });
    const unitsReceived = warehouseReceipts.reduce((s, i) => s + (i.stock || 0), 0);

    const dayMap = {};
    for (const r of records) {
      const day = r.createdAt.toISOString().split('T')[0];
      if (!dayMap[day]) dayMap[day] = { units: 0, cost: 0 };
      dayMap[day].units += r.quantity || 0;
      dayMap[day].cost += r.totalCost || 0;
    }
    const dailyProduction = Object.entries(dayMap).map(([date, d]) => ({ date, ...d })).sort((a, b) => a.date.localeCompare(b.date));

    res.json({ totalUnits, totalCost, unitsReceived, dailyProduction });
  } catch (error) {
    res.status(500).json({ message: 'CEO production error', error: error.message });
  }
};

// =========================== EMPLOYEE ANALYTICS ===========================
exports.getEmployees = async (req, res) => {
  try {
    const { range, dateFrom, dateTo } = req.query;
    const df = dateFilter(range, dateFrom, dateTo);

    const sales = await prisma.posSale.findMany({ where: { ...df, cashierName: { not: null }, faisalTake: { not: true } }, select: { cashierName: true, grandTotal: true, advanceAmount: true, orderId: true } });
    const saleRevenue = (s) => s.orderId ? Math.min(s.advanceAmount || 0, s.grandTotal || 0) : (s.grandTotal || 0);

    const empMap = {};
    for (const s of sales) {
      const name = s.cashierName || 'Unknown';
      if (!empMap[name]) empMap[name] = { name, totalSales: 0, totalRevenue: 0, orderCount: 0 };
      empMap[name].totalSales += s.grandTotal || 0;
      empMap[name].totalRevenue += saleRevenue(s);
      empMap[name].orderCount++;
    }
    const employees = Object.values(empMap).sort((a, b) => b.totalRevenue - a.totalRevenue);
    const best = employees.length > 0 ? employees[0].name : null;
    const lowest = employees.length > 0 ? employees[employees.length - 1].name : null;

    const auditLogs = await prisma.auditLog.findMany({ where: { ...df, performedBy: { not: null } }, select: { performedBy: true, action: true, timestamp: true } });
    const perfMap = {};
    for (const log of auditLogs) {
      const name = log.performedBy || 'Unknown';
      if (!perfMap[name]) perfMap[name] = { name, actions: 0, lastAction: null };
      perfMap[name].actions++;
      perfMap[name].lastAction = log.timestamp;
    }
    const productivity = Object.values(perfMap).sort((a, b) => b.actions - a.actions);

    res.json({ employeeSalesRanking: employees, bestEmployee: best, lowestEmployee: lowest, employeeProductivity: productivity.slice(0, 50) });
  } catch (error) {
    res.status(500).json({ message: 'CEO employees error', error: error.message });
  }
};

// =========================== PAYMENT ANALYTICS ===========================
exports.getPayments = async (req, res) => {
  try {
    const { range, dateFrom, dateTo, branch } = req.query;
    const df = dateFilter(range, dateFrom, dateTo);
    const branchFilter = branch && branch !== 'all' ? { outletName: { contains: branch, mode: 'insensitive' } } : {};

    const allSales = await prisma.posSale.findMany({
      where: { ...df, ...branchFilter, faisalTake: { not: true } },
      select: { paymentMethod: true, grandTotal: true, advanceAmount: true, cashAmount: true, onlineAmount: true, orderId: true, id: true, createdAt: true }
    });

    const saleRevenue = (s) => s.orderId ? Math.min(s.advanceAmount || 0, s.grandTotal || 0) : (s.grandTotal || 0);

    let cashTotal = 0, cardTotal = 0, onlineTotal = 0, codTotal = 0;
    let cashCount = 0, cardCount = 0, onlineCount = 0, codCount = 0;
    let advanceTotal = 0;
    let paidTotal = 0, codTotalRevenue = 0;

    for (const s of allSales) {
      const rev = saleRevenue(s);
      if (s.paymentMethod === 'CASH' || s.cashAmount > 0) { cashTotal += s.cashAmount || rev; cashCount++; }
      if (s.paymentMethod === 'CARD') { cardTotal += rev; cardCount++; }
      if (s.paymentMethod === 'ONLINE' || s.onlineAmount > 0) { onlineTotal += s.onlineAmount || rev; onlineCount++; }
      if (s.paymentMethod === 'COD') { codTotal += rev; codCount++; }
      if (s.advanceAmount > 0) { advanceTotal += s.advanceAmount; }
      if (s.paymentMethod !== 'COD') { paidTotal += rev; } else { codTotalRevenue += rev; }
    }

    const pendingPayments = allSales.filter(s => s.paymentMethod === 'COD' || (s.advanceAmount > 0 && s.advanceAmount < s.grandTotal)).length;

    const dayMap = {};
    for (const s of allSales) {
      const day = s.createdAt.toISOString().split('T')[0];
      if (!dayMap[day]) dayMap[day] = { cash: 0, card: 0, online: 0, cod: 0, total: 0 };
      dayMap[day].cash += s.cashAmount || 0;
      dayMap[day].card += s.paymentMethod === 'CARD' ? saleRevenue(s) : 0;
      dayMap[day].online += s.onlineAmount || 0;
      dayMap[day].cod += s.paymentMethod === 'COD' ? saleRevenue(s) : 0;
      dayMap[day].total += saleRevenue(s);
    }
    const collectionTrend = Object.entries(dayMap).map(([date, d]) => ({ date, ...d })).sort((a, b) => a.date.localeCompare(b.date));

    res.json({ cashPayments: { total: cashTotal, count: cashCount }, cardPayments: { total: cardTotal, count: cardCount }, onlinePayments: { total: onlineTotal, count: onlineCount }, codPayments: { total: codTotal, count: codCount }, advancePayments: { total: advanceTotal, count: allSales.filter(s => s.advanceAmount > 0).length }, pendingPayments, paidOrders: { total: paidTotal, count: allSales.filter(s => s.paymentMethod !== 'COD').length }, codOrders: { total: codTotalRevenue, count: codCount }, collectionTrend });
  } catch (error) {
    res.status(500).json({ message: 'CEO payments error', error: error.message });
  }
};

// =========================== CUSTOMIZATION ANALYTICS ===========================
exports.getCustomization = async (req, res) => {
  try {
    const { range, dateFrom, dateTo } = req.query;
    const df = dateFilter(range, dateFrom, dateTo);

    const orders = await prisma.order.findMany({
      where: { ...df, customization: { not: null } },
      select: { id: true, customization: true, createdAt: true, status: true, currentStage: true }
    });

    const totalCustomized = orders.length;
    const pendingCustom = orders.filter(o => o.status !== 'COMPLETED' && o.status !== 'DELIVERED').length;
    const completedCustom = orders.filter(o => o.status === 'COMPLETED' || o.status === 'DELIVERED').length;

    const ordersWithEngraving = await prisma.order.count({ where: { ...df, engravingRequired: true } });

    res.json({ totalCustomized, pendingCustom, completedCustom, ordersWithEngraving });
  } catch (error) {
    res.status(500).json({ message: 'CEO customization error', error: error.message });
  }
};
