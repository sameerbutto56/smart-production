const prisma = require('../prisma');

const getDashboard = async (req, res) => {
  try {
    const { startDate, endDate, source, category } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate + 'T23:59:59.999Z');
    const createdAtFilter = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};
    const sourceFilter = source && source !== 'all' ? { source } : {};

    // 1. INVENTORY VALUATION
    const inventoryItems = await prisma.inventoryItem.findMany({
      select: { id: true, name: true, category: true, stock: true, price: true, variants: true }
    });

    let totalValue = 0, totalQuantity = 0, totalProducts = 0, totalVariants = 0;
    const categoryValues = {};
    const itemPrices = {};

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
      itemPrices[item.id] = totalQuantity > 0 ? totalValue / totalQuantity : 0;
    }

    const avgPrice = totalQuantity > 0 ? totalValue / totalQuantity : 0;

    // 2. ORDER CONSUMPTION (from productDetails where inventoryDeducted)
    const sourceOrderFilter = { ...createdAtFilter, ...sourceFilter };
    if (source && source !== 'all' && !['ONLINE', 'INTERNAL', 'OUTLET'].includes(source)) {
      delete sourceOrderFilter.source;
    }
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
        const details = typeof o.productDetails === 'string' ? JSON.parse(o.productDetails) : (o.productDetails || []);
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

    const [onlineConsumption, outletConsumption] = await Promise.all([
      sourceOrderConsumption(['ONLINE', 'INTERNAL']),
      sourceOrderConsumption('OUTLET')
    ]);

    // 3. ALLOCATION CONSUMPTION
    const allocations = await prisma.allocation.findMany({
      where: { ...createdAtFilter, status: { notIn: ['CANCELLED'] } },
      select: { quantity: true, itemId: true, itemName: true }
    });
    let allocQty = 0, allocVal = 0;
    for (const a of allocations) {
      const q = a.quantity || 0;
      allocQty += q;
      if (a.itemId) {
        const item = inventoryItems.find(i => i.id === a.itemId);
        if (item) {
          const variants = typeof item.variants === 'string' ? JSON.parse(item.variants) : (item.variants || []);
          if (Array.isArray(variants) && variants.length > 0) {
            const vPrice = parseFloat(variants[0].price) || avgPrice;
            allocVal += q * vPrice;
          } else {
            allocVal += q * (item.price || avgPrice);
          }
        } else {
          allocVal += q * avgPrice;
        }
      } else {
        allocVal += q * avgPrice;
      }
    }

    // 4. DEMAND CONSUMPTION
    const demands = await prisma.outletDemandRequest.findMany({
      where: { ...createdAtFilter, status: { in: ['APPROVED', 'COMPLETED'] } },
      select: { items: true }
    });
    let demandQty = 0, demandVal = 0;
    for (const d of demands) {
      const items = typeof d.items === 'string' ? JSON.parse(d.items) : (d.items || []);
      if (Array.isArray(items)) {
        for (const item of items) {
          const q = parseInt(item.quantity) || 0;
          demandQty += q;
          demandVal += q * (parseFloat(item.price) || avgPrice);
        }
      }
    }

    // 5. REJECTED INVENTORY
    const rejectedRecords = await prisma.productionRecord.findMany({
      where: { ...createdAtFilter },
      select: { quantity: true, totalCost: true }
    });
    const rejectedQty = rejectedRecords.reduce((s, r) => s + (r.quantity || 0), 0);
    const rejectedVal = rejectedRecords.reduce((s, r) => s + (r.totalCost || 0), 0);

    // 6. PROFIT TRACKING
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

    // 7. INVENTORY STATUS SUMMARY
    const totalConsumedValue = onlineConsumption.value + outletConsumption.value + allocVal + demandVal;
    const remainingValue = Math.max(0, totalValue);
    const totalInventoryEverAdded = totalValue + totalConsumedValue + rejectedVal;

    // 8. CHARTS
    const inventoryDistribution = Object.entries(categoryValues)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const revenueSources = [
      { name: 'Online Orders', value: onlineRevenue },
      { name: 'Outlet Orders', value: outletRevenue }
    ].filter(r => r.value > 0);

    const monthlyRecords = await prisma.revenueRecord.findMany({
      where: createdAtFilter,
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
      consumption: {
        onlineOrders: onlineConsumption,
        outletOrders: outletConsumption,
        demandOrders: { quantity: demandQty, value: demandVal },
        allocation: { quantity: allocQty, value: allocVal },
        rejected: { quantity: rejectedQty, value: rejectedVal },
        totalConsumed: { quantity: onlineConsumption.quantity + outletConsumption.quantity + demandQty + allocQty, value: totalConsumedValue }
      },
      remainingValue,
      profitAnalytics: { totalRevenue, totalCost, grossProfit: totalProfit, profitMargin },
      charts: { inventoryDistribution, revenueSources, profitTrend }
    });

  } catch (error) {
    console.error('BI Dashboard error:', error);
    res.status(500).json({ message: 'Error fetching BI dashboard', error: error.message });
  }
};

module.exports = { getDashboard };
