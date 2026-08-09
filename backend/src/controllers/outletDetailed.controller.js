const prisma = require('../prisma');
const { computeUnifiedSalesSummary } = require('../utils/posUnified');
const saleRevenue = (s) => s.advanceAmount > 0 ? Math.min(s.advanceAmount, s.grandTotal) : s.grandTotal;

const getOutletDetailed = async (req, res) => {
  try {
    const outlet = req.params.outletName;
    if (!outlet) return res.status(400).json({ message: 'outletName param required' });

    const { range = 'all', dateFrom, dateTo } = req.query;

    const now = new Date();
    let startLimit = new Date(0);
    if (dateFrom) startLimit = new Date(dateFrom);
    else if (range === 'today') { startLimit = new Date(now); startLimit.setHours(0,0,0,0); }
    else if (range === 'yesterday') { startLimit = new Date(now); startLimit.setDate(startLimit.getDate()-1); startLimit.setHours(0,0,0,0); }
    else if (range === 'week') { startLimit = new Date(now); startLimit.setDate(startLimit.getDate()-7); }
    else if (range === 'month') { startLimit = new Date(now); startLimit.setMonth(startLimit.getMonth()-1); }
    const endLimit = dateTo ? new Date(dateTo.includes('T') ? (new Date(dateTo)).getTime() - 1 : dateTo + 'T23:59:59.999Z') : now;

    const dateWhere = { gte: startLimit, lte: endLimit };

    const [
      salesAgg, salesAll, returnsAgg, returnsAll, discountAgg,
      balancePayments, orders, orderStages, clients,
      transfers, stockRequests, alterations,
      journalEntries, inventory, bestSelling,
      faisalTakes
    ] = await Promise.allSettled([
      prisma.posSale.aggregate({ where: { outletName: outlet, createdAt: dateWhere, faisalTake: { not: true } }, _sum: { discountAmount: true }, _count: true }),
      prisma.posSale.findMany({ where: { outletName: outlet, createdAt: dateWhere }, select: { id: true, receiptNumber: true, customerName: true, grandTotal: true, advanceAmount: true, paymentMethod: true, cashAmount: true, onlineAmount: true, faisalTake: true, createdAt: true, refundedAt: true, cashierName: true, items: { select: { productName: true, quantity: true, unitPrice: true, lineTotal: true, size: true, color: true } }, returns: { select: { id: true, refundAmount: true, createdAt: true, reason: true, quantity: true, refundPaymentMethod: true } }, balancePayments: { select: { amountPaidNow: true, paymentMethod: true, paidAt: true } } }, orderBy: { createdAt: 'desc' } }),
      prisma.posReturn.aggregate({ where: { outletName: outlet, createdAt: dateWhere }, _sum: { refundAmount: true }, _count: true }),
      prisma.posReturn.findMany({ where: { outletName: outlet, createdAt: dateWhere }, include: { sale: { select: { id: true, receiptNumber: true, customerName: true, paymentMethod: true, grandTotal: true, cashAmount: true, onlineAmount: true, items: { select: { productName: true, quantity: true, unitPrice: true, size: true, color: true } } } } }, orderBy: { createdAt: 'desc' } }),
      prisma.posSale.aggregate({ where: { outletName: outlet, createdAt: dateWhere, faisalTake: { not: true } }, _sum: { discountAmount: true } }),
      prisma.posBalancePayment.findMany({ where: { posSale: { outletName: outlet }, paidAt: dateWhere }, select: { id: true, receiptNumber: true, originalInvoiceNumber: true, originalInvoiceTotal: true, previouslyPaidAmount: true, remainingBalanceBeforePayment: true, amountPaidNow: true, outstandingBalanceAfterPayment: true, paymentMethod: true, cashierName: true, paidAt: true, posSale: { select: { customerName: true, receiptNumber: true, grandTotal: true } } }, orderBy: { paidAt: 'desc' } }),
      prisma.order.findMany({ where: { source: 'OUTLET', outletName: outlet, createdAt: dateWhere }, select: { id: true, orderNumber: true, invoiceNumber: true, customerName: true, customerPhone: true, totalPrice: true, advanceAmount: true, currentStage: true, status: true, priority: true, createdAt: true, deliveredAt: true, paymentStatus: true, productDetails: true, orderDestination: true, urgent: true, _count: { select: { stages: true } } }, orderBy: { createdAt: 'desc' } }),
      prisma.orderStage.findMany({ where: { order: { source: 'OUTLET', outletName: outlet } }, select: { stageName: true, status: true, startedAt: true, completedAt: true } }),
      prisma.client.findMany({ where: { outletName: outlet, isActive: true }, select: { id: true, clientNumber: true, name: true, phone: true, gender: true, city: true, createdAt: true }, orderBy: { createdAt: 'desc' } }),
      prisma.outletTransfer.findMany({ where: { OR: [{ fromOutlet: outlet }, { toOutlet: outlet }], createdAt: dateWhere }, include: { items: true }, orderBy: { createdAt: 'desc' } }),
      prisma.stockRequest.findMany({ where: { outletName: outlet, createdAt: dateWhere }, select: { id: true, itemName: true, itemCategory: true, quantity: true, approvedQty: true, status: true, notes: true, createdAt: true }, orderBy: { createdAt: 'desc' } }),
      prisma.alteration.findMany({ where: { sourceOutlet: outlet, createdAt: dateWhere }, select: { id: true, alterationNumber: true, sourceModule: true, customerName: true, status: true, currentStage: true, products: true, createdAt: true, acceptedAt: true, completedAt: true, doneAt: true }, orderBy: { createdAt: 'desc' } }),
      prisma.journalEntry.findMany({ where: { outletName: outlet, createdAt: dateWhere }, select: { id: true, employeeName: true, expenseTitle: true, amount: true, notes: true, createdAt: true }, orderBy: { createdAt: 'desc' } }),
      prisma.outletInventory.findMany({ where: { outletName: outlet }, select: { id: true, name: true, category: true, color: true, size: true, stock: true, price: true, barcode: true } }),
      prisma.posSaleItem.findMany({ where: { sale: { outletName: outlet, createdAt: dateWhere, refundedAt: null } }, select: { productName: true, quantity: true, unitPrice: true }, orderBy: { createdAt: 'desc' } }),
      prisma.posSale.findMany({ where: { outletName: outlet, faisalTake: true, createdAt: dateWhere }, select: { id: true, receiptNumber: true, grandTotal: true, cashierName: true, createdAt: true, faisalTakenAt: true, items: { select: { productName: true, quantity: true, size: true, color: true, unitPrice: true } } }, orderBy: { createdAt: 'desc' } }),
    ]);

    const safeSalesAll = salesAll.status === 'fulfilled' ? salesAll.value : [];
    const safeOrders = orders.status === 'fulfilled' ? orders.value : [];
    const safeClients = clients.status === 'fulfilled' ? clients.value : [];
    const safeTransfers = transfers.status === 'fulfilled' ? transfers.value : [];
    const safeReturns = returnsAll.status === 'fulfilled' ? returnsAll.value : [];
    const safeBalancePayments = balancePayments.status === 'fulfilled' ? balancePayments.value : [];
    const safeJournal = journalEntries.status === 'fulfilled' ? journalEntries.value : [];
    const safeAlterations = alterations.status === 'fulfilled' ? alterations.value : [];
    const safeStockRequests = stockRequests.status === 'fulfilled' ? stockRequests.value : [];
    const safeInventory = inventory.status === 'fulfilled' ? inventory.value : [];
    const safeFaisalTakes = faisalTakes.status === 'fulfilled' ? faisalTakes.value : [];
    const safeBestSelling = bestSelling.status === 'fulfilled' ? bestSelling.value : [];
    const safeOrderStages = orderStages.status === 'fulfilled' ? orderStages.value : [];

    const nonFaisalSales = safeSalesAll.filter(s => !s.faisalTake);

    // UNIFIED sales calculation — single source of truth shared by POS Dashboard,
    // Outlet Dashboard (POS Sales card), Admin Outlet Detailed, and Register Close
    // Book. Faisal Takes excluded; balance payments counted on their paidAt date.
    const unified = await computeUnifiedSalesSummary(prisma, {
      outlet,
      start: startLimit,
      end: endLimit,
    });
    const totalSales = unified.totalSales;
    const totalReturns = unified.refundAmount;
    const returnCount = unified.returns.length;
    const totalDiscount = unified.totalDiscount;
    const totalSalesCount = unified.totalOrders;
    const netRevenue = unified.netRevenue;
    const totalRefunds = unified.refundAmount;
    const totalJournalExpenses = unified.totalJournalExpenses;

    // Same non-overlapping payment breakdown as the POS Dashboard (object form kept
    // for backward compatibility with the Admin card consumers).
    const paymentBreakdown = {};
    unified.paymentBreakdown.forEach(p => {
      paymentBreakdown[p.method] = { gross: p.gross, returns: p.returns, net: p.net };
    });

    let highestSale = null;
    let highestInvoice = null;
    nonFaisalSales.forEach(s => {
      const rev = saleRevenue(s);
      if (!highestSale || rev > (highestSale.amount || 0)) highestSale = { receiptNumber: s.receiptNumber, amount: rev, date: s.createdAt };
      if (!highestInvoice || s.grandTotal > (highestInvoice.amount || 0)) highestInvoice = { receiptNumber: s.receiptNumber, amount: s.grandTotal, customerName: s.customerName, date: s.createdAt };
    });

    const productMap = {};
    safeBestSelling.forEach(item => {
      const name = item.productName;
      if (!productMap[name]) productMap[name] = { name, qty: 0, revenue: 0 };
      productMap[name].qty += item.quantity || 0;
      productMap[name].revenue += (item.unitPrice || 0) * (item.quantity || 0);
    });
    const bestSellingProducts = Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    const salesTrend = Object.keys(unified.salesByDay)
      .sort((a, b) => a.localeCompare(b))
      .map(date => ({ date, label: date, sales: unified.salesByDay[date], count: unified.ordersByDay[date] || 0 }));

    const balanceInvoices = nonFaisalSales.filter(s => {
      const paid = (s.advanceAmount || 0) + (s.balancePayments || []).reduce((sum, bp) => sum + (bp.amountPaidNow || 0), 0);
      const remaining = (s.advanceAmount === 0 && (!s.balancePayments || s.balancePayments.length === 0)) ? 0 : Math.max(0, s.grandTotal - paid);
      return remaining > 0.01;
    }).map(s => {
      const paid = (s.advanceAmount || 0) + (s.balancePayments || []).reduce((sum, bp) => sum + (bp.amountPaidNow || 0), 0);
      const remaining = (s.advanceAmount === 0 && (!s.balancePayments || s.balancePayments.length === 0)) ? 0 : Math.max(0, s.grandTotal - paid);
      return { id: s.id, receiptNumber: s.receiptNumber, customerName: s.customerName, grandTotal: s.grandTotal, advanceAmount: s.advanceAmount, totalPaid: paid, remaining, paymentMethod: s.paymentMethod, createdAt: s.createdAt };
    });

    const orderStatusCounts = { total: safeOrders.length, pending: 0, inProgress: 0, completed: 0, delivered: 0, cancelled: 0, waitingPayment: 0 };
    safeOrders.forEach(o => {
      const st = (o.status || '').toUpperCase();
      if (st === 'PENDING' || st === 'CREATED') orderStatusCounts.pending++;
      else if (st === 'IN_PROGRESS') orderStatusCounts.inProgress++;
      else if (st === 'COMPLETED') orderStatusCounts.completed++;
      else if (st === 'DELIVERED') orderStatusCounts.delivered++;
      else if (st === 'CANCELLED' || st === 'REJECTED') orderStatusCounts.cancelled++;
      else if (st === 'WAITING_PAYMENT') orderStatusCounts.waitingPayment++;
    });

    const orderStageCounts = {};
    safeOrderStages.forEach(os => {
      if (os.status === 'PENDING' || os.status === 'IN_PROGRESS') {
        orderStageCounts[os.stageName] = (orderStageCounts[os.stageName] || 0) + 1;
      }
    });
    const stageLabels = { ORDER_ENTRY: 'Order Entry', STORE: 'Store', LOGO_DESIGN: 'Logo Design', PRODUCTION_ACCEPTANCE: 'Production Acceptance', PRODUCTION: 'Production', WORKERS: 'Workers', STORE_RECEIVE: 'Store Receive', DISPATCH: 'Dispatch', OUT_FOR_DELIVERY: 'Out for Delivery', DELIVERED: 'Delivered', OUTLET_RECEIVE: 'Outlet Receive', CANCELLED: 'Cancelled' };
    const stageWiseTracking = Object.entries(orderStageCounts).map(([stage, count]) => ({ stage, label: stageLabels[stage] || stage, count }));

    const invStats = { inStock: 0, lowStock: 0, outOfStock: 0, total: safeInventory.length, totalValue: 0 };
    safeInventory.forEach(v => {
      invStats.totalValue += (v.stock || 0) * (v.price || 0);
      if ((v.stock || 0) === 0) invStats.outOfStock++;
      else if ((v.stock || 0) <= 5) invStats.lowStock++;
      else invStats.inStock++;
    });

    const transferStats = { total: safeTransfers.length, incoming: 0, outgoing: 0, pending: 0, completed: 0 };
    safeTransfers.forEach(t => {
      if (t.toOutlet === outlet) transferStats.incoming++;
      if (t.fromOutlet === outlet) transferStats.outgoing++;
      if (t.status === 'PENDING') transferStats.pending++;
      if (t.status === 'COMPLETED' || t.status === 'ACCEPTED') transferStats.completed++;
    });

    const reqStats = { total: safeStockRequests.length, pending: 0, approved: 0, rejected: 0 };
    safeStockRequests.forEach(r => {
      if (r.status === 'PENDING') reqStats.pending++;
      else if (r.status === 'APPROVED' || r.status === 'COMPLETED') reqStats.approved++;
      else if (r.status === 'REJECTED') reqStats.rejected++;
    });

    const altStats = { total: safeAlterations.length, pending: 0, accepted: 0, inProgress: 0, completed: 0, done: 0, rejected: 0 };
    safeAlterations.forEach(a => {
      if (a.status === 'PENDING') altStats.pending++;
      else if (a.status === 'ACCEPTED') altStats.accepted++;
      else if (a.status === 'IN_PROGRESS') altStats.inProgress++;
      else if (a.status === 'COMPLETED') altStats.completed++;
      else if (a.status === 'DONE') altStats.done++;
      else if (a.status === 'REJECTED') altStats.rejected++;
    });

    const journalStats = { total: safeJournal.length, totalAmount: totalJournalExpenses, employees: [...new Set(safeJournal.map(j => j.employeeName))] };

    const pendingOrders = safeOrders.filter(o => ['PENDING', 'IN_PROGRESS', 'WAITING_PAYMENT', 'CREATED'].includes(o.status)).length;
    const completedOrders = safeOrders.filter(o => o.status === 'COMPLETED' || o.status === 'DELIVERED').length;
    const cancelledOrders = safeOrders.filter(o => o.status === 'CANCELLED' || o.status === 'REJECTED').length;

    const completedInvoices = nonFaisalSales.filter(s => !s.refundedAt).length;
    const generatedInvoices = nonFaisalSales.length;

    const totalInvoices = generatedInvoices;

    const topInventoryProducts = {};
    safeInventory.forEach(v => {
      if (!topInventoryProducts[v.name]) topInventoryProducts[v.name] = { name: v.name, stock: 0, value: 0 };
      topInventoryProducts[v.name].stock += v.stock || 0;
      topInventoryProducts[v.name].value += (v.stock || 0) * (v.price || 0);
    });
    const topInvProducts = Object.values(topInventoryProducts).sort((a, b) => b.value - a.value).slice(0, 10);

    res.json({
      outlet,
      overview: {
        totalSales,
        netRevenue,
        totalDiscount,
        totalReturns,
        returnCount,
        completedInvoices,
        generatedInvoices,
        totalInvoices,
        totalSalesCount,
        pendingOrders,
        completedOrders,
        cancelledOrders,
        totalJournalExpenses,
        totalOrderCount: safeOrders.length,
        orderStatusCounts,
      },
      paymentBreakdown,
      totalRefunds,
      salesAnalytics: {
        highestSale,
        highestInvoice,
        salesTrend,
        bestSellingProducts,
      },
      balanceInvoices,
      faisalTakes: safeFaisalTakes,
      returns: safeReturns,
      invoices: safeSalesAll,
      orders: safeOrders,
      stageWiseTracking,
      revenueAndInventory: { netRevenue, inventory: invStats, topProducts: topInvProducts, items: safeInventory },
      customers: safeClients,
      transfers: safeTransfers,
      transferStats,
      stockRequests: safeStockRequests,
      requestStats: reqStats,
      alterations: safeAlterations,
      alterationStats: altStats,
      journalEntries: safeJournal,
      journalStats,
    });
  } catch (error) {
    console.error('getOutletDetailed error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getOutletDetailed };
