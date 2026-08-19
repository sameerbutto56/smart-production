const prisma = require('../prisma');

// GET /api/tahir-sheet?date=YYYY-MM-DD&deliveryBoy=name
// Returns all orders assigned to the delivery boy on the given date.
const getTahirSheet = async (req, res) => {
  try {
    const { date, deliveryBoy } = req.query;
    const boyName = deliveryBoy || 'Tahir';

    if (!date) {
      return res.status(400).json({ message: 'date query param is required (YYYY-MM-DD)' });
    }

    const dayStart = new Date(date + 'T00:00:00.000Z');
    const dayEnd = new Date(date + 'T23:59:59.999Z');

    const assignments = await prisma.deliveryAssignment.findMany({
      where: {
        assignmentDate: { gte: dayStart, lte: dayEnd },
        deliveryBoyName: { contains: boyName, mode: 'insensitive' },
      },
      orderBy: { assignedAt: 'asc' },
    });

    // Enrich with live order status
    const orderIds = assignments.map(a => a.orderId);
    const orders = orderIds.length ? await prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: {
        id: true, currentStage: true, status: true, deliveredAt: true,
        returnedAt: true, advanceAmount: true, advancePaid: true,
        paymentMethod: true, paymentStatus: true, productDetails: true,
      },
    }) : [];
    const orderMap = Object.fromEntries(orders.map(o => [o.id, o]));

    const enriched = assignments.map(a => {
      const live = orderMap[a.orderId] || {};
      const delivered = live.currentStage === 'DELIVERED' || live.status === 'COMPLETED';
      const returned = live.currentStage === 'DISPATCH' && live.status === 'RETURNED';
      return {
        ...a,
        currentStage: live.currentStage || a.currentStage,
        status: live.status || a.status,
        delivered: delivered || !!a.deliveredAt,
        returned: returned || !!a.returnedAt,
        advanceAmount: live.advanceAmount ?? a.advanceAmount,
        advancePaid: live.advancePaid ?? false,
        paymentMethod: live.paymentMethod || null,
        paymentStatus: live.paymentStatus || a.status,
        productDetails: live.productDetails || null,
      };
    });

    // Summary stats
    const total = enriched.length;
    const deliveredCount = enriched.filter(e => e.delivered).length;
    const pendingCount = enriched.filter(e => !e.delivered && !e.returned).length;
    const returnedCount = enriched.filter(e => e.returned).length;
    const totalOrderValue = enriched.reduce((s, e) => s + (e.totalPrice || 0), 0);
    const totalAdvance = enriched.reduce((s, e) => s + (e.advanceAmount || 0), 0);
    const totalDeliveryCharges = enriched.reduce((s, e) => s + (e.deliveryCharges || 0), 0);

    res.json({
      date,
      deliveryBoy: boyName,
      assignments: enriched,
      summary: {
        total,
        delivered: deliveredCount,
        pending: pendingCount,
        returned: returnedCount,
        totalOrderValue,
        totalAdvance,
        totalDeliveryCharges,
      },
    });
  } catch (error) {
    console.error('getTahirSheet error:', error);
    res.status(500).json({ message: 'Error fetching Tahir Sheet', error: error.message });
  }
};

// POST /api/tahir-sheet/record — record an assignment (called by routing hooks)
const recordAssignment = async (data) => {
  try {
    const { orderId, deliveryBoyName, routedBy, outletName } = data;
    if (!orderId || !deliveryBoyName) return;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true, orderNumber: true, customerName: true, customerPhone: true,
        address: true, city: true, totalPrice: true, advanceAmount: true,
        deliveryCharges: true, outletName: true, source: true,
        currentStage: true, status: true,
      },
    });
    if (!order) return;

    const now = new Date();
    const assignmentDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

    await prisma.deliveryAssignment.upsert({
      where: {
        orderId_deliveryBoyName_assignmentDate: {
          orderId,
          deliveryBoyName,
          assignmentDate,
        },
      },
      create: {
        orderId,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        address: order.address,
        city: order.city,
        totalPrice: order.totalPrice || 0,
        advanceAmount: order.advanceAmount || 0,
        deliveryCharges: order.deliveryCharges || 0,
        outletName: order.outletName || outletName,
        source: order.source,
        assignedAt: now,
        assignmentDate,
        deliveryBoyName,
        routedBy,
        currentStage: order.currentStage,
        status: order.status,
      },
      update: {
        routedBy,
        currentStage: order.currentStage,
        status: order.status,
      },
    });
  } catch (err) {
    console.error('recordAssignment error:', err);
  }
};

// GET /api/tahir-sheet/available-dates?deliveryBoy=name&month=YYYY-MM
// Returns dates in the given month that have assignment records.
const getAvailableDates = async (req, res) => {
  try {
    const { deliveryBoy, month } = req.query;
    const boyName = deliveryBoy || 'Tahir';

    let start, end;
    if (month) {
      start = new Date(month + '-01T00:00:00.000Z');
      end = new Date(new Date(start).setUTCMonth(start.getUTCMonth() + 1));
      end = new Date(end.getTime() - 1);
    } else {
      const now = new Date();
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    }

    const rows = await prisma.deliveryAssignment.findMany({
      where: {
        assignmentDate: { gte: start, lte: end },
        deliveryBoyName: { contains: boyName, mode: 'insensitive' },
      },
      select: { assignmentDate: true },
      distinct: ['assignmentDate'],
      orderBy: { assignmentDate: 'asc' },
    });

    const dates = rows.map(r => {
      const d = new Date(r.assignmentDate);
      return d.toISOString().split('T')[0];
    });

    res.json({ dates, deliveryBoy: boyName, month: month || null });
  } catch (error) {
    console.error('getAvailableDates error:', error);
    res.status(500).json({ message: 'Error fetching available dates', error: error.message });
  }
};

module.exports = { getTahirSheet, recordAssignment, getAvailableDates };
