const prisma = require('../prisma');

const LOCATIONS = ['Johar Town', 'Jail Road', 'Abbottabad'];

const getDashboard = async (req, res) => {
  try {
    const { startDate, endDate, source, branch, category } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate.includes('T') ? (new Date(endDate)).getTime() - 1 : endDate + 'T23:59:59.999Z');
    const createdAtFilter = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};
    const sourceFilter = source && source !== 'all' ? { source } : {};

    // Branch filter for per-location breakdown
    const branchFilter = branch && branch !== 'all' ? { outletName: branch } : {};

    // 1. INVENTORY VALUATION — Master warehouse
    const inventoryItems = await prisma.inventoryItem.findMany({
      select: { id: true, name: true, category: true, stock: true, price: true, variants: true }
    });

    let totalValue = 0, totalQuantity = 0, totalProducts = 0, totalVariants = 0;
    const categoryValues = {};

    for (const item of inventoryItems) {
      totalProducts++;
      const variants = typeof item.variants === 'string' ? JSON.parse(item.variants) : (item.variants || []);
      let itemValue = 0, itemQty = 0;

      if (Array.isArray(variants) && variants.length > 0) {
        totalVariants += variants.length;
        for (const v of variants) {
          const qty = parseInt(v.stock) || 0;
          const p = parseFloat(v.price) || 0;
          itemQty += qty;
          itemValue += qty * p;
        }
      } else {
        itemQty = item.stock || 0;
        itemValue = itemQty * (item.price || 0);
      }
      totalQuantity += itemQty;
      totalValue += itemValue;
      categoryValues[item.category] = (categoryValues[item.category] || 0) + itemValue;
    }

    const avgPrice = totalQuantity > 0 ? totalValue / totalQuantity : 0;

    // 2. PER-LOCATION INVENTORY (OutletInventory)
    const outletInvItems = await prisma.outletInventory.findMany({
      select: { outletName: true, stock: true, price: true, name: true, category: true }
    });
    const perLocationInventory = {};
    for (const loc of LOCATIONS) {
      const locItems = outletInvItems.filter(i => i.outletName && i.outletName.toLowerCase().includes(loc.toLowerCase()));
      let locValue = 0, locQty = 0;
      const locCategoryMap = {};
      for (const item of locItems) {
        const qty = item.stock || 0;
        const val = qty * (item.price || 0);
        locQty += qty;
        locValue += val;
        locCategoryMap[item.category] = (locCategoryMap[item.category] || 0) + val;
      }
      perLocationInventory[loc] = { value: locValue, quantity: locQty, categoryDistribution: Object.entries(locCategoryMap).filter(([, v]) => v > 0).map(([name, v]) => ({ name, value: v })).sort((a, b) => b.value - a.value) };
    }

    // 3. ORDER CONSUMPTION
    const sourceOrderConsumption = async (sourceVal) => {
      const sourceWhere = {};
      if (sourceVal) {
        if (Array.isArray(sourceVal)) sourceWhere.source = { in: sourceVal };
        else sourceWhere.source = sourceVal;
      }
      const orders = await prisma.order.findMany({
        where: { ...createdAtFilter, ...sourceWhere, productDetails: { not: null } },
        select: { productDetails: true, source: true }
      });
      let qty = 0, val = 0;
      for (const o of orders) {
        const details = o.productDetails || [];
        if (Array.isArray(details)) {
          for (const item of details) {
            if (item.inventoryDeducted) {
              const iq = parseInt(item.quantity) || 0;
              qty += iq;
              val += iq * (parseFloat(item.price) || 0);
            }
          }
        }
      }
      return { quantity: qty, value: val };
    };

    // Per-location outlet consumption (from PosSale)
    const perLocationConsumption = {};
    for (const loc of LOCATIONS) {
      const locSales = await prisma.posSale.findMany({
        where: { ...createdAtFilter, outletName: { contains: loc, mode: 'insensitive' }, faisalTake: { not: true } },
        select: { grandTotal: true, subtotal: true, discountAmount: true, advanceAmount: true, id: true, orderId: true }
      });
      let consValue = 0, consQty = 0, rev = 0;
      for (const s of locSales) {
        const revAmount = s.orderId ? (s.advanceAmount >= s.grandTotal ? s.grandTotal : s.advanceAmount) : s.grandTotal;
        consValue += s.grandTotal || 0;
        consQty++;
        rev += revAmount;
      }
      perLocationConsumption[loc] = { consumption: consValue, orders: consQty, revenue: rev };
    }

    const [onlineConsumption, outletConsumption] = await Promise.all([
      sourceOrderConsumption(['ONLINE', 'INTERNAL']),
      sourceOrderConsumption('OUTLET')
    ]);

    // 4. ALLOCATION ANALYTICS
    const allocations = await prisma.allocation.findMany({
      where: { ...createdAtFilter, status: { notIn: ['CANCELLED'] } },
      select: { quantity: true, itemId: true, itemName: true, status: true, createdAt: true }
    });
    let allocQty = 0, allocVal = 0;
    const allocByStatus = { PENDING: 0, APPROVED: 0, COMPLETED: 0, REJECTED: 0 };
    for (const a of allocations) {
      const q = a.quantity || 0;
      allocQty += q;
      if (a.itemId) {
        const item = inventoryItems.find(i => i.id === a.itemId);
        if (item) {
          const variants = typeof item.variants === 'string' ? JSON.parse(item.variants) : (item.variants || []);
          if (Array.isArray(variants) && variants.length > 0) {
            allocVal += q * (parseFloat(variants[0].price) || avgPrice);
          } else {
            allocVal += q * (item.price || avgPrice);
          }
        } else {
          allocVal += q * avgPrice;
        }
      } else {
        allocVal += q * avgPrice;
      }
      if (allocByStatus[a.status] !== undefined) allocByStatus[a.status] += q;
    }

    // 5. DEMAND ANALYTICS
    const demands = await prisma.outletDemandRequest.findMany({
      where: { ...createdAtFilter, status: { in: ['APPROVED', 'COMPLETED'] } },
      select: { items: true, status: true, outletName: true }
    });
    let demandQty = 0, demandVal = 0;
    const demandByLocation = {};
    const demandByStatus = { PENDING: 0, APPROVED: 0, COMPLETED: 0, REJECTED: 0 };
    for (const d of demands) {
      const items = typeof d.items === 'string' ? JSON.parse(d.items) : (d.items || []);
      if (Array.isArray(items)) {
        for (const item of items) {
          const q = parseInt(item.quantity) || 0;
          demandQty += q;
          demandVal += q * (parseFloat(item.price) || avgPrice);
          const loc = d.outletName || 'Unknown';
          if (!demandByLocation[loc]) demandByLocation[loc] = 0;
          demandByLocation[loc] += q;
        }
      }
      if (demandByStatus[d.status] !== undefined) demandByStatus[d.status] += 1;
    }

    // 6. REJECTED INVENTORY
    const rejectedRecords = await prisma.productionRecord.findMany({
      where: { ...createdAtFilter },
      select: { quantity: true, totalCost: true }
    });
    const rejectedQty = rejectedRecords.reduce((s, r) => s + (r.quantity || 0), 0);
    const rejectedVal = rejectedRecords.reduce((s, r) => s + (r.totalCost || 0), 0);

    // 7. PROFIT TRACKING — per location
    const revenueRecords = await prisma.revenueRecord.findMany({
      where: createdAtFilter,
      select: { totalRevenue: true, totalProfit: true, productCost: true, source: true }
    });

    let totalRevenue = 0, totalCost = 0, totalProfit = 0;
    let onlineRevenue = 0, outletRevenue = 0;
    for (const r of revenueRecords) {
      totalRevenue += r.totalRevenue || 0;
      totalCost += r.productCost || 0;
      totalProfit += r.totalProfit || 0;
      if (r.source === 'ONLINE' || r.source === 'INTERNAL') onlineRevenue += r.totalRevenue || 0;
      else outletRevenue += r.totalRevenue || 0;
    }
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    // Per-location financials from PosSale
    const perLocationFinancials = {};
    for (const loc of LOCATIONS) {
      const locSalesAll = await prisma.posSale.findMany({
        where: { ...createdAtFilter, outletName: { contains: loc, mode: 'insensitive' }, faisalTake: { not: true } },
        select: { grandTotal: true, subtotal: true, discountAmount: true, advanceAmount: true, orderId: true }
      });
      let rev = 0, cost = 0, count = 0;
      for (const s of locSalesAll) {
        const revAmount = s.orderId ? (s.advanceAmount >= s.grandTotal ? s.grandTotal : s.advanceAmount) : s.grandTotal;
        rev += revAmount;
        cost += (s.subtotal || 0);
        count++;
      }
      perLocationFinancials[loc] = { revenue: rev, cost, profit: rev - cost, orders: count };
    }

    // 8. INVENTORY STATUS SUMMARY
    const totalConsumedValue = onlineConsumption.value + outletConsumption.value + allocVal + demandVal;
    const remainingValue = Math.max(0, totalValue);
    const totalInventoryEverAdded = totalValue + totalConsumedValue + rejectedVal;

    // 9. CHARTS
    const inventoryDistribution = Object.entries(categoryValues)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const revenueSources = [
      { name: 'Online Orders', value: onlineRevenue },
      { name: 'Outlet Orders', value: outletRevenue }
    ].filter(r => r.value > 0);

    // Branch-filtered profit trend
    const revenueWhere = { ...createdAtFilter };
    if (branch && branch !== 'all') {
      revenueWhere.OR = [
        { source: { contains: branch, mode: 'insensitive' } },
        { source: branch === 'Jail Road' ? 'OUTLET' : branch === 'Johar Town' ? 'OUTLET' : branch }
      ];
    }

    const monthlyRecords = await prisma.revenueRecord.findMany({
      where: revenueWhere,
      select: { totalRevenue: true, totalProfit: true, createdAt: true }
    });
    const monthlyTrend = {};
    for (const r of monthlyRecords) {
      const month = r.createdAt.toISOString().substring(0, 7);
      if (!monthlyTrend[month]) monthlyTrend[month] = { revenue: 0, profit: 0 };
      monthlyTrend[month].revenue += r.totalRevenue || 0;
      monthlyTrend[month].profit += r.totalProfit || 0;
    }
    const profitTrend = Object.entries(monthlyTrend)
      .map(([date, d]) => ({ date, revenue: d.revenue, cost: d.revenue - d.profit, profit: d.profit }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      inventoryValuation: { totalValue, totalQuantity, totalProducts, totalVariants },
      perLocationInventory,
      consumption: {
        onlineOrders: onlineConsumption,
        outletOrders: outletConsumption,
        demandOrders: { quantity: demandQty, value: demandVal },
        allocation: { quantity: allocQty, value: allocVal },
        rejected: { quantity: rejectedQty, value: rejectedVal },
        totalConsumed: { quantity: onlineConsumption.quantity + outletConsumption.quantity + demandQty + allocQty, value: totalConsumedValue },
        perLocationConsumption
      },
      allocationAnalytics: {
        totalQuantity: allocQty,
        totalValue: allocVal,
        byStatus: allocByStatus
      },
      demandAnalytics: {
        totalQuantity: demandQty,
        totalValue: demandVal,
        byStatus: demandByStatus,
        byLocation: demandByLocation
      },
      remainingValue,
      profitAnalytics: { totalRevenue, totalCost, grossProfit: totalProfit, profitMargin },
      perLocationFinancials,
      charts: { inventoryDistribution, revenueSources, profitTrend },
      perLocationCharts: {
        inventoryDistribution: Object.fromEntries(LOCATIONS.map(loc => [loc, perLocationInventory[loc]?.categoryDistribution || []])),
        revenueSources: Object.fromEntries(LOCATIONS.map(loc => {
          const fin = perLocationFinancials[loc] || { revenue: 0 };
          return [loc, [
            { name: 'POS Sales', value: fin.revenue || 0 }
          ].filter(r => r.value > 0)];
        }))
      }
    });

  } catch (error) {
    console.error('BI Dashboard error:', error);
    res.status(500).json({ message: 'Error fetching BI dashboard', error: error.message });
  }
};

module.exports = { getDashboard };
