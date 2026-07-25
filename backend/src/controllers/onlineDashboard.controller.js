const prisma = require('../prisma');

const getOnlineDashboardStats = async (req, res) => {
  try {
    const { dateFrom, dateTo, range } = req.query;

    const now = new Date();
    let createdAtFilter = {};
    if (dateFrom || dateTo) {
      createdAtFilter = {
        gte: dateFrom ? new Date(dateFrom) : new Date(0),
        lte: dateTo ? new Date(dateTo + 'T23:59:59') : now,
      };
    } else if (range === 'today') {
      const start = new Date(now); start.setHours(0, 0, 0, 0);
      createdAtFilter = { gte: start, lte: now };
    } else if (range === 'week') {
      const start = new Date(now); start.setDate(start.getDate() - 7);
      createdAtFilter = { gte: start, lte: now };
    } else if (range === 'month') {
      const start = new Date(now); start.setMonth(start.getMonth() - 1);
      createdAtFilter = { gte: start, lte: now };
    }

    const baseWhere = { source: { in: ['ONLINE', 'INTERNAL'] } };
    if (createdAtFilter.gte) baseWhere.createdAt = createdAtFilter;

    const [
      allOrders,
      ordersByStatus,
      ordersByStage,
      ordersByPriority,
      ordersByType,
    ] = await Promise.all([
      prisma.order.findMany({
        where: baseWhere,
        include: {
          createdBy: { select: { id: true, name: true } },
          stages: true,
          deliveryPayments: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: true,
      }),
      prisma.order.groupBy({
        by: ['currentStage'],
        where: baseWhere,
        _count: true,
      }),
      prisma.order.groupBy({
        by: ['priority'],
        where: baseWhere,
        _count: true,
      }),
      prisma.order.groupBy({
        by: ['type'],
        where: baseWhere,
        _count: true,
      }),
    ]);

    const statusMap = {};
    ordersByStatus.forEach(r => { statusMap[r.status] = r._count; });

    const stageMap = {};
    ordersByStage.forEach(r => { stageMap[r.currentStage] = r._count; });

    const priorityMap = {};
    ordersByPriority.forEach(r => { priorityMap[r.priority] = r._count; });

    const typeMap = {};
    ordersByType.forEach(r => { typeMap[r.type] = r._count; });

    const total = allOrders.length;

    const activeStages = ['ORDER_ENTRY', 'STORE', 'LOGO_DESIGN', 'PRODUCTION_ACCEPTANCE', 'PRODUCTION', 'STORE_RECEIVE', 'DISPATCH', 'OUT_FOR_DELIVERY'];
    const activeOrders = allOrders.filter(o => activeStages.includes(o.currentStage) && o.status !== 'CANCELLED').length;

    const deliveredCount = allOrders.filter(o => o.currentStage === 'DELIVERED' || o.status === 'DELIVERED' || o.status === 'COMPLETED').length;

    const summary = {
      total,
      activeOrders,
      pending: statusMap['PENDING'] || 0,
      inProgress: statusMap['IN_PROGRESS'] || 0,
      completed: statusMap['COMPLETED'] || 0,
      delivered: deliveredCount,
      returned: statusMap['RETURNED'] || 0,
      replaced: statusMap['REPLACED'] || 0,
      cancelled: statusMap['CANCELLED'] || 0,
    };

    const stages = {
      ORDER_ENTRY: stageMap['ORDER_ENTRY'] || 0,
      STORE: stageMap['STORE'] || 0,
      LOGO_DESIGN: stageMap['LOGO_DESIGN'] || 0,
      PRODUCTION_ACCEPTANCE: stageMap['PRODUCTION_ACCEPTANCE'] || 0,
      PRODUCTION: stageMap['PRODUCTION'] || 0,
      STORE_RECEIVE: stageMap['STORE_RECEIVE'] || 0,
      DISPATCH: stageMap['DISPATCH'] || 0,
      OUT_FOR_DELIVERY: stageMap['OUT_FOR_DELIVERY'] || 0,
      DELIVERED: stageMap['DELIVERED'] || 0,
    };

    const priorities = {
      NORMAL: priorityMap['NORMAL'] || 0,
      URGENT: priorityMap['URGENT'] || 0,
      SUPER_URGENT: priorityMap['SUPER_URGENT'] || 0,
      LOW: priorityMap['LOW'] || 0,
      HIGH: priorityMap['HIGH'] || 0,
    };

    const orderTypes = {
      STANDARD: typeMap['STANDARD'] || 0,
      READY_LOGO: typeMap['READY_LOGO'] || 0,
      CUSTOM_LOGO: typeMap['CUSTOM_LOGO'] || 0,
      FULL_CUSTOM: typeMap['FULL_CUSTOM'] || 0,
    };

    let totalRevenue = 0;
    let totalBilling = 0;
    let totalProfit = 0;
    let totalLoss = 0;
    let totalReturnsValue = 0;
    let cashReceived = 0;
    let onlineReceived = 0;
    let cardReceived = 0;
    let outstanding = 0;
    let codOrders = 0;
    let paidOrders = 0;

    const employeeMap = {};
    const customerMap = {};
    const productMap = {};

    for (const order of allOrders) {
      const tp = order.totalPrice || 0;
      const advance = order.advanceAmount || 0;
      const dc = order.deliveryCharges || 0;
      const billing = tp + dc;
      totalBilling += billing;

      const isDelivered = order.currentStage === 'DELIVERED' || order.status === 'DELIVERED' || order.status === 'COMPLETED';
      const isReturned = order.status === 'RETURNED';
      const isCancelled = order.status === 'CANCELLED';

      if (isDelivered) {
        totalRevenue += advance > 0 ? Math.min(advance, tp) : tp;
        const profit = order.netProfit || order.grossProfit || 0;
        if (profit > 0) totalProfit += profit;
        else if (tp > 0) totalProfit += tp * 0.25;
      }

      if (isReturned) totalReturnsValue += tp;
      if (isCancelled) totalLoss += tp * 0.1;

      const dp = order.deliveryPayments || [];
      for (const pay of dp) {
        if (pay.paymentMethod === 'CASH') cashReceived += (pay.amount || 0);
        else if (pay.paymentMethod === 'ONLINE') onlineReceived += (pay.amount || 0);
        else if (pay.paymentMethod === 'CARD') cardReceived += (pay.amount || 0);
        else {
          cashReceived += (pay.cashAmount || 0);
          onlineReceived += (pay.onlineAmount || 0);
        }
      }

      if (order.paymentStatus === 'PAID' || order.paymentStatus === 'FULL_PAID') paidOrders++;
      if (order.paymentStatus === 'PENDING' || order.paymentStatus === 'WAITING_PAYMENT') codOrders++;

      if (isDelivered) {
        outstanding += Math.max(0, tp - advance - dp.reduce((s, p) => s + (p.amount || p.cashAmount || 0) + (p.onlineAmount || 0), 0));
      }

      const empName = order.createdBy?.name || 'Unknown';
      if (!employeeMap[empName]) employeeMap[empName] = { name: empName, totalOrders: 0, deliveredOrders: 0, returnedOrders: 0, revenue: 0 };
      employeeMap[empName].totalOrders++;
      if (isDelivered) {
        employeeMap[empName].deliveredOrders++;
        employeeMap[empName].revenue += advance > 0 ? Math.min(advance, tp) : tp;
      }
      if (isReturned) employeeMap[empName].returnedOrders++;

      const custKey = order.customerName || 'Unknown';
      if (!customerMap[custKey]) customerMap[custKey] = { name: custKey, phone: order.customerPhone, orders: 0, totalSpent: 0, delivered: 0, returned: 0, lastOrderAt: order.createdAt };
      customerMap[custKey].orders++;
      if (isDelivered) {
        customerMap[custKey].delivered++;
        customerMap[custKey].totalSpent += tp;
      }
      if (isReturned) customerMap[custKey].returned++;
      if (order.createdAt > customerMap[custKey].lastOrderAt) customerMap[custKey].lastOrderAt = order.createdAt;

      let products = [];
      try {
        if (typeof order.productDetails === 'string') products = JSON.parse(order.productDetails);
        else if (Array.isArray(order.productDetails)) products = order.productDetails;
      } catch {}
      for (const p of products) {
        const name = p.productName || p.name || 'Unknown';
        if (!productMap[name]) productMap[name] = { name, totalOrders: 0, totalRevenue: 0, returned: 0, delivered: 0 };
        productMap[name].totalOrders++;
        if (isDelivered) {
          productMap[name].totalRevenue += tp / Math.max(products.length, 1);
          productMap[name].delivered++;
        }
        if (isReturned) productMap[name].returned++;
      }
    }

    const employees = Object.values(employeeMap)
      .sort((a, b) => b.revenue - a.revenue)
      .map((e, i) => ({ ...e, rank: i + 1 }));

    const productsArr = Object.values(productMap).sort((a, b) => b.totalRevenue - a.totalRevenue);
    const productPerformance = {
      topSelling: productsArr.slice(0, 10),
      leastSelling: productsArr.slice(-10).reverse(),
      mostReturned: [...productsArr].sort((a, b) => b.returned - a.returned).slice(0, 10),
      highestRevenue: productsArr.slice(0, 10),
    };

    const customers = Object.values(customerMap).sort((a, b) => b.orders - a.orders).slice(0, 100);

    const avgOrderValue = total > 0 ? Math.round(totalRevenue / total) : 0;

    const allOrdersList = allOrders.map(o => ({
      id: o.id,
      orderNumber: o.orderNumber,
      invoiceNumber: o.invoiceNumber,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      totalPrice: o.totalPrice,
      advanceAmount: o.advanceAmount,
      currentStage: o.currentStage,
      status: o.status,
      priority: o.priority,
      type: o.type,
      paymentStatus: o.paymentStatus,
      createdAt: o.createdAt,
      deliveredAt: o.deliveredAt,
      employeeName: o.createdBy?.name || 'Unknown',
    }));

    const dailyTrendMap = {};
    for (const order of allOrders) {
      const day = order.createdAt.toISOString().split('T')[0];
      if (!dailyTrendMap[day]) dailyTrendMap[day] = { date: day, orders: 0, revenue: 0, delivered: 0, returned: 0 };
      dailyTrendMap[day].orders++;
      const isDelivered = order.currentStage === 'DELIVERED' || order.status === 'DELIVERED' || order.status === 'COMPLETED';
      if (isDelivered) {
        dailyTrendMap[day].revenue += order.advanceAmount > 0 ? Math.min(order.advanceAmount, order.totalPrice || 0) : (order.totalPrice || 0);
        dailyTrendMap[day].delivered++;
      }
      if (order.status === 'RETURNED') dailyTrendMap[day].returned++;
    }
    const dailyTrend = Object.values(dailyTrendMap).sort((a, b) => a.date.localeCompare(b.date)).slice(-30);

    res.json({
      summary,
      stages,
      priorities,
      orderTypes,
      revenue: {
        totalRevenue,
        totalBilling,
        totalProfit,
        totalLoss,
        totalReturnsValue,
        avgOrderValue,
      },
      payments: {
        codOrders,
        paidOrders,
        cashReceived,
        onlineReceived,
        cardReceived,
        totalReceived: cashReceived + onlineReceived + cardReceived,
        outstanding: Math.max(0, outstanding),
      },
      employees,
      productPerformance,
      customers,
      allOrders: allOrdersList,
      recentOrders: allOrdersList.slice(0, 50),
      dailyTrend,
    });
  } catch (err) {
    console.error('Online Dashboard Stats Error:', err);
    res.status(500).json({ message: 'Failed to load online dashboard stats', error: err.message });
  }
};

module.exports = { getOnlineDashboardStats };
