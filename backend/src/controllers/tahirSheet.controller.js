const prisma = require('../prisma');

// GET /api/gate-pass?date=YYYY-MM-DD
// Returns assignments for the given date PLUS all carry-forward (pending/active) orders
// from previous dates that are not yet delivered/returned.
// Backfill runs in the background (fire-and-forget) so the page always loads fast.
const FINAL_STATUSES = ['DELIVERED', 'RETURNED', 'COMPLETED', 'CANCELLED', 'REJECTED'];
const FINAL_STAGES = ['DELIVERED', 'RETURNED'];
const DELIVERY_STAGES = ['OUT_FOR_DELIVERY', 'ENAMELS_DELIVERY', 'IN_DISPATCH'];
const CUTOFF_DATE = new Date('2026-08-19T00:00:00.000Z');

let backfillInFlight = false;

const getTahirSheet = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ message: 'date query param is required (YYYY-MM-DD)' });
    }

    const dayStart = new Date(date + 'T00:00:00.000Z');
    const dayEnd = new Date(date + 'T23:59:59.999Z');

    // 1. Fetch today's assignments + previous assignments (carry-forward)
    //    Carry-forward: only from CUTOFF_DATE forward, exclude terminal orders at DB level.
    const [todayAssignments, previousAssignments] = await Promise.all([
      prisma.deliveryAssignment.findMany({
        where: { assignmentDate: { gte: dayStart, lte: dayEnd } },
        orderBy: { assignedAt: 'asc' },
      }),
      prisma.deliveryAssignment.findMany({
        where: {
          assignmentDate: { gte: CUTOFF_DATE, lt: dayStart },
          status: { notIn: FINAL_STATUSES },
          deliveredAt: null,
          returnedAt: null,
        },
        orderBy: { assignedAt: 'asc' },
      }),
    ]);

    // 2. Deduplicate — same orderId can appear in both; prefer the latest assignment
    const allRaw = [...previousAssignments, ...todayAssignments];
    const seen = new Map();
    for (const a of allRaw) {
      const existing = seen.get(a.orderId);
      if (!existing || new Date(a.assignmentDate) > new Date(existing.assignmentDate)) {
        seen.set(a.orderId, a);
      }
    }
    const allAssignments = Array.from(seen.values());
    const assignedOrderIds = new Set(allAssignments.map(a => a.orderId));

    // 3. Fire-and-forget backfill: runs in background, never blocks the response
    if (!backfillInFlight) {
      backfillInFlight = true;
      runBackfill(assignedOrderIds).finally(() => { backfillInFlight = false; });
    }

    // 4. Enrich with live order status
    const finalOrderIds = allAssignments.map(a => a.orderId);
    const orders = finalOrderIds.length ? await prisma.order.findMany({
      where: { id: { in: finalOrderIds } },
      select: {
        id: true, currentStage: true, status: true, deliveredAt: true,
        returnedAt: true, advanceAmount: true, advancePaid: true,
        paymentMethod: true, paymentStatus: true, productDetails: true,
        dispatchStatus: true,
      },
    }) : [];
    const orderMap = Object.fromEntries(orders.map(o => [o.id, o]));

    const enriched = allAssignments.map(a => {
      const live = orderMap[a.orderId] || {};
      const orderNotFound = !live.id;
      const stage = live.currentStage || a.currentStage;
      const status = live.status || a.status;
      const dStatus = live.dispatchStatus || '';
      const delivered = stage === 'DELIVERED' || status === 'COMPLETED' || !!a.deliveredAt;
      const returned = stage === 'RETURNED' || status === 'RETURNED' || dStatus === 'RETURNED' || !!a.returnedAt;
      const isFinal = orderNotFound || FINAL_STATUSES.includes(status) || FINAL_STAGES.includes(stage) || !!a.deliveredAt || !!a.returnedAt;
      const assignedDate = a.assignmentDate ? new Date(a.assignmentDate).toISOString().split('T')[0] : date;
      const isToday = assignedDate === date;
      return {
        ...a,
        currentStage: stage,
        status,
        delivered,
        returned,
        isFinal,
        isToday,
        assignedDate,
        advanceAmount: live.advanceAmount ?? a.advanceAmount,
        advancePaid: live.advancePaid ?? false,
        paymentMethod: live.paymentMethod || null,
        paymentStatus: live.paymentStatus || a.status,
        productDetails: live.productDetails || a.productDetails || null,
        dispatchStatus: dStatus,
      };
    });

    // 5. Separate today vs carry-forward
    //    Today: Only today's PENDING orders (exclude delivered/returned/completed/deleted)
    //    Carry-forward: ONLY genuinely incomplete orders from previous days (no delivered/returned/cancelled/deleted)
    const todayOrders = enriched.filter(e => e.isToday && !e.isFinal);
    const carryForwardOrders = enriched.filter(e => !e.isToday && !e.isFinal);

    const visibleOrders = [...todayOrders, ...carryForwardOrders];

    // Summary stats
    const total = visibleOrders.length;
    const deliveredCount = visibleOrders.filter(e => e.delivered).length;
    const pendingCount = visibleOrders.filter(e => !e.delivered && !e.returned).length;
    const returnedCount = visibleOrders.filter(e => e.returned).length;
    const carryForwardCount = carryForwardOrders.length;

    res.json({
      date,
      assignments: visibleOrders,
      summary: {
        total,
        delivered: deliveredCount,
        pending: pendingCount,
        returned: returnedCount,
        carryForward: carryForwardCount,
        todayAssigned: todayOrders.length,
      },
    });
  } catch (error) {
    console.error('getGatePass error:', error);
    res.status(500).json({ message: 'Error fetching Gate Pass', error: error.message });
  }
};

// Background backfill — creates DeliveryAssignment records for historical dispatched orders
// that were dispatched before the recordAssignment hooks were in place.
// Runs async, never blocks the API response. At most one concurrent run.
async function runBackfill(existingOrderIds) {
  try {
    const cutoff = new Date('2026-08-19T00:00:00.000Z');

    const unassignedOrders = await prisma.order.findMany({
      where: {
        id: { notIn: [...existingOrderIds] },
        createdAt: { gte: cutoff },
        // Never create assignment records for terminal orders
        status: { notIn: FINAL_STATUSES },
        OR: [
          { currentStage: { in: DELIVERY_STAGES } },
          { deliveryType: { in: ['ENAMELS', 'TCS', 'POST_EX'] } },
          { dispatchStatus: { in: ['BOOKED', 'DISPATCHED', 'IN_TRANSIT'] } },
        ],
      },
      select: {
        id: true, orderNumber: true, customerName: true, customerPhone: true,
        address: true, city: true, totalPrice: true, advanceAmount: true,
        deliveryCharges: true, outletName: true, source: true,
        currentStage: true, status: true, productDetails: true,
        deliveryMethod: true, deliveryType: true, courierDetails: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    if (unassignedOrders.length === 0) return;

    console.log(`Gate Pass backfill: creating ${unassignedOrders.length} missing assignment records`);

    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

    for (const order of unassignedOrders) {
      const deliveryBoyName = order.deliveryMethod
        || (order.courierDetails?.courierName)
        || (order.deliveryType === 'TCS' ? 'TCS' : order.deliveryType === 'POST_EX' ? 'PostEx' : 'Enamels Delivery');

      const orderDate = new Date(order.createdAt);
      const orderDayUTC = new Date(Date.UTC(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate()));
      const assignDate = orderDayUTC.getTime() >= todayUTC.getTime() ? todayUTC : orderDayUTC;

      try {
        await prisma.deliveryAssignment.upsert({
          where: {
            orderId_deliveryBoyName_assignmentDate: {
              orderId: order.id,
              deliveryBoyName,
              assignmentDate: assignDate,
            },
          },
          create: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            address: order.address,
            city: order.city,
            totalPrice: order.totalPrice || 0,
            advanceAmount: order.advanceAmount || 0,
            deliveryCharges: order.deliveryCharges || 0,
            outletName: order.outletName,
            source: order.source,
            assignedAt: order.createdAt,
            assignmentDate: assignDate,
            deliveryBoyName,
            routedBy: 'System (auto-backfill)',
            currentStage: order.currentStage,
            status: order.status,
            productDetails: order.productDetails || null,
          },
          update: {
            currentStage: order.currentStage,
            status: order.status,
          },
        });
      } catch (backfillErr) {
        console.error('Gate Pass backfill error for order', order.orderNumber, backfillErr.message);
      }
    }

    console.log(`Gate Pass backfill: done (${unassignedOrders.length} orders processed)`);
  } catch (err) {
    console.error('Gate Pass backfill failed:', err.message);
  }
}

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
        currentStage: true, status: true, productDetails: true,
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
        productDetails: order.productDetails || null,
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

// GET /api/gate-pass/available-dates?month=YYYY-MM
// Returns dates in the given month that have assignment records.
const getAvailableDates = async (req, res) => {
  try {
    const { month } = req.query;

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
      },
      select: { assignmentDate: true },
      distinct: ['assignmentDate'],
      orderBy: { assignmentDate: 'asc' },
    });

    const dates = rows.map(r => {
      const d = new Date(r.assignmentDate);
      return d.toISOString().split('T')[0];
    });

    res.json({ dates, month: month || null });
  } catch (error) {
    console.error('getAvailableDates error:', error);
    res.status(500).json({ message: 'Error fetching available dates', error: error.message });
  }
};

// Mark a DeliveryAssignment as delivered or returned so DB-level filtering
// excludes it from future carry-forward queries immediately (no enrichment needed).
const markAssignmentTerminal = async (orderId, { delivered = false, returned = false } = {}) => {
  try {
    if (!orderId || (!delivered && !returned)) return;
    const data = {};
    if (delivered) data.deliveredAt = new Date();
    if (returned) data.returnedAt = new Date();
    // Update ALL assignment records for this order (there may be multiple across dates/boys)
    await prisma.deliveryAssignment.updateMany({
      where: { orderId },
      data,
    });
  } catch (err) {
    console.error('markAssignmentTerminal error:', err);
  }
};

module.exports = { getTahirSheet, recordAssignment, getAvailableDates, markAssignmentTerminal };
