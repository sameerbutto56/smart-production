const prisma = require('../prisma');
const { calculateDeadline } = require('../utils/deadline');
const { recordAssignment } = require('./tahirSheet.controller');
const postexService = require('../services/postex.service');

// A dispatcher = an OutletEmployee whose `profiles` array contains "DISPATCH" AND
// whose `isActive` is still true. This replaces the old hardcoded ['Khawar','Faisal']
// allow-list so that ANY employee created/activated via Software Settings → Employees
// works immediately (e.g. Numan), and a deactivated employee is automatically excluded
// from new tasks / counts without deleting any history.
const getActiveDispatchers = async () => {
  const employees = await prisma.outletEmployee.findMany({
    where: { isActive: true },
    select: { name: true, profiles: true }
  });
  return employees
    .filter(e => Array.isArray(e.profiles) && e.profiles.includes('DISPATCH'))
    .map(e => e.name);
};

const isActiveDispatcher = async (name) => {
  if (!name) return false;
  const dispatchers = await getActiveDispatchers();
  return dispatchers.includes(name);
};

const DISPATCH_METHODS = ['ENAMELS', 'TCS', 'POST_EX', 'CUSTOMER_TAKEAWAY'];
const ALLOWED_ACTIONS = [...DISPATCH_METHODS, 'FORWARD_TO_FAISAL'];

const createAuditLog = async (orderId, action, details, userId, tx) => {
  try {
    if (!userId) return;
    const db = tx || prisma;
    await db.auditLog.create({
      data: { orderId, action, details, performedBy: userId, timestamp: new Date() }
    });
  } catch (error) {
    console.error('Audit Log Error:', error);
  }
};

const createDispatchLog = async (data, tx) => {
  try {
    const db = tx || prisma;
    await db.dispatchLog.create({ data });
  } catch (error) {
    console.error('Dispatch Log Error:', error);
  }
};

const getStageDurations = async (priority = 'NORMAL') => {
  const setting = await prisma.systemSetting.findUnique({ where: { key: 'DEADLINE_CONFIG' } });
  let config = {
    stageDurations: { STORE: 24, PRODUCTION_ACCEPTANCE: 4, PRODUCTION: 48, LOGO_DESIGN: 24, DISPATCH: 12, OUT_FOR_DELIVERY: 12 },
    slaMultipliers: { NORMAL: 1, URGENT: 0.75, SUPER_URGENT: 0.5 }
  };
  if (setting) {
    try { config = { ...config, ...JSON.parse(setting.value) }; } catch (e) {}
  }
  const slaMultiplier = config.slaMultipliers?.[priority] ?? 1;
  const durations = config.stageDurations || {};
  const adjusted = {};
  for (const [stage, hours] of Object.entries(durations)) {
    adjusted[stage] = Math.round((hours * slaMultiplier) * 100) / 100;
  }
  return adjusted;
};

// GET /api/dispatch-profile/orders?employeeName=Khawar&cityFilter=all
const getDispatchProfileOrders = async (req, res) => {
  try {
    const { employeeName } = req.query;
    if (!employeeName || !(await isActiveDispatcher(employeeName))) {
      return res.status(400).json({ message: 'Unknown or inactive dispatcher employee' });
    }

    const baseSelect = {
      id: true, orderNumber: true, customerName: true, customerPhone: true,
      address: true, city: true, source: true, outletName: true,
      currentStage: true, status: true, dispatchStatus: true,
      deliveryType: true, deliveryMethod: true, priority: true,
      trackingNumber: true, courierDetails: true,
      totalPrice: true, paymentStatus: true, advanceAmount: true,
      type: true, productDetails: true, customization: true, sizeData: true,
      instructionNotes: true, dispatchOfficer: true, forwardedBy: true,
      deliveredAt: true, returnedAt: true, refundStatus: true,
      createdAt: true, updatedAt: true,
      stages: {
        orderBy: { createdAt: 'asc' },
        select: { stageName: true, status: true, deadlineAt: true, startedAt: true, rejectionReason: true, completedAt: true }
      },
      createdBy: { select: { name: true, role: true } },
      postexShipments: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, trackingNumber: true, shipmentNumber: true, status: true, integrationMode: true, totalAmount: true, codAmount: true, destinationCity: true, errorMessage: true, bookedAt: true, deliveredAt: true } }
    };

    const baseOrder = [{ priority: 'asc' }, { createdAt: 'desc' }];

    // A dispatched / delivered / completed order must permanently leave ALL
    // dispatcher queues (Unseen/Seen/Active) — never re-appear.
    const TERMINAL_DISPATCH = ['DELIVERED', 'RETURNED', 'REJECTED', 'PICKED_UP'];

    // Replacement (REP-...) orders flow through the normal pipeline once past STORE
    // (hub-managed only at STORE), so dispatch-stage replacements must appear here.
    // Orders handed to the Enamels Delivery Boy (deliveryType=ENAMELS /
    // deliveryMethod='Enamels Delivery' / currentStage=ENAMELS_DELIVERY) are owned by
    // the Enamel boy's profile and must NEVER appear in dispatcher queues.
    const NOT_ENAMELS = {
      NOT: [{
        OR: [
          { deliveryType: 'ENAMELS' },
          { deliveryMethod: 'Enamels Delivery' },
          { currentStage: 'ENAMELS_DELIVERY' }
        ]
      }]
    };

    const dispatchOrders = await prisma.order.findMany({
      where: {
        currentStage: { in: ['DISPATCH', 'OUT_FOR_DELIVERY'] },
        status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED', 'RETURNED'] },
        ...NOT_ENAMELS
      },
      select: baseSelect,
      orderBy: baseOrder
    });

    // The SAME 3-way split is used symmetrically for every dispatcher employee.
    //  - UNSEEN is SHARED / global: genuinely unaccepted orders (dispatchOfficer null)
    //    appear in EVERY dispatcher's Unseen; once one employee accepts it, it vanishes
    //    from everyone else's Unseen immediately.
    //  - SEEN is EMPLOYEE-SPECIFIC: only orders accepted by the logged-in employee.
    //  - ACTIVE is EMPLOYEE-SPECIFIC: only OUT_FOR_DELIVERY orders assigned to the
    //    logged-in employee.
    const unseen = [];
    const seen = [];
    const active = [];
    const alreadyStarted = [];

    // Orders routed to the Enamels Delivery Boy (or any delivery assignment) carry a
    // DeliveryAssignment row. Also a "work signal": an order with any assignment is
    // never new, even if dispatchOfficer was lost/cleared.
    const workedAssignmentIds = new Set();
    if (dispatchOrders.length) {
      const assignments = await prisma.deliveryAssignment.findMany({
        where: { orderId: { in: dispatchOrders.map(o => o.id) } },
        select: { orderId: true }
      });
      for (const a of assignments) workedAssignmentIds.add(a.orderId);
    }

    for (const order of dispatchOrders) {
      // Terminal stamps clear EVERY queue — even when dispatchStatus was never
      // flipped (an OUT_FOR_DELIVERY order returned by the delivery boy has
      // returnedAt set but dispatchStatus still 'BOOKED').
      const orderTerminal =
        TERMINAL_DISPATCH.includes(order.dispatchStatus) ||
        ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED', 'RETURNED'].includes(order.status) ||
        !!order.deliveredAt ||
        !!order.returnedAt;
      if (orderTerminal) continue;

      const owner = order.dispatchOfficer || null;
      const ownedByMe = owner === employeeName;

      if (order.currentStage === 'OUT_FOR_DELIVERY') {
        // Active is employee-specific — only the officer assigned to the delivery.
        if (ownedByMe) active.push(order);
        continue;
      }

      // currentStage === 'DISPATCH'
      if (owner === null) {
        // "Work signal": the DISPATCH was actually started or completed — a non-PENDING
        // DISPATCH stage (IN_PROGRESS/WAITING_APPROVAL/COMPLETED), a delivery
        // assignment, a courier booking, a dispatch method, or a delivery/return stamp.
        const dispatchStages = (order.stages || []).filter(s => s.stageName === 'DISPATCH');
        const latestDispatch = dispatchStages[dispatchStages.length - 1];
        const dispatchCompleted = !!latestDispatch && latestDispatch.status === 'COMPLETED';
        const dispatchStarted =
          !!latestDispatch &&
          ['IN_PROGRESS', 'WAITING_APPROVAL'].includes(latestDispatch.status);
        const hasWorkSignal =
          dispatchStarted ||
          dispatchCompleted ||
          workedAssignmentIds.has(order.id) ||
          !!order.trackingNumber ||
          !!order.courierDetails ||
          !!order.deliveredAt ||
          !!order.returnedAt ||
          (order.dispatchStatus && order.dispatchStatus !== 'PENDING' && order.dispatchStatus !== 'OUT_FOR_DELIVERY');

        if (dispatchCompleted) {
          // DISPATCH stage fully completed but dispatchOfficer lost — already worked.
          // Must NOT re-surface as new in every dispatcher's Unseen.
          continue;
        }

        if (hasWorkSignal) {
          // Started in the past (legacy accepts, courier booked, EDB-assigned, etc.)
          // but currently unassigned — not genuinely new. Review list, not Unseen.
          alreadyStarted.push(order);
          continue;
        }

        // Genuinely unaccepted — SHARED unseen: every dispatcher sees the same set.
        unseen.push(order);
      } else if (ownedByMe) {
        // Accepted by me (or forwarded to me) — my seen only.
        seen.push(order);
      }
      // else: accepted by the other dispatcher — hidden from me entirely.
    }

    res.json({
      unseen, seen, active, alreadyStarted,
      counts: { unseen: unseen.length, seen: seen.length, active: active.length, alreadyStarted: alreadyStarted.length }
    });

  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch dispatch profile orders', error: error.message });
  }
};

// POST /api/dispatch-profile/:orderId/accept
// Atomic, unilateral claim of a SHARED Unseen order.
//
// The claim is a single `updateMany` keyed on `dispatchOfficer: null`:
//  - exactly one of two concurrent employees wins (the loser's updateMany matches 0
//    rows -> 409, so a simultaneous double-accept is impossible);
//  - an order already accepted by the SAME employee is idempotent (their re-accept or
//    a refresh/retry succeeds);
//  - an order accepted by the OTHER employee is a 409 -> it stays in their Seen and
//    never appears in the other employee's queues.
const acceptDispatchOrder = async (req, res) => {
  const { orderId } = req.params;
  const { employeeName } = req.body;

  if (!employeeName || !(await isActiveDispatcher(employeeName))) {
    return res.status(400).json({ message: 'Unknown or inactive dispatcher employee' });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { stages: { where: { stageName: 'DISPATCH' }, orderBy: { createdAt: 'asc' } } }
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.currentStage !== 'DISPATCH' || order.status === 'COMPLETED' || order.status === 'DELIVERED') {
      return res.status(400).json({ message: 'Order is not in an accept-able DISPATCH state' });
    }
    if (order.dispatchOfficer && order.dispatchOfficer !== employeeName) {
      return res.status(409).json({ message: `This order has already been accepted by another dispatcher (${order.dispatchOfficer}).` });
    }

    // Atomically claim the order for this employee (only when currently unassigned).
    const claim = await prisma.order.updateMany({
      where: {
        id: orderId,
        currentStage: 'DISPATCH',
        OR: [{ dispatchOfficer: null }, { dispatchOfficer: employeeName }]
      },
      data: { dispatchOfficer: employeeName }
    });

    if (claim.count === 0) {
      // Lost the race (another employee accepted concurrently) OR the order moved on.
      const fresh = await prisma.order.findUnique({ where: { id: orderId }, select: { dispatchOfficer: true, currentStage: true } });
      if (fresh && fresh.dispatchOfficer && fresh.dispatchOfficer !== employeeName) {
        return res.status(409).json({ message: `This order has already been accepted by another dispatcher (${fresh.dispatchOfficer}).` });
      }
      return res.status(409).json({ message: 'This order can no longer be accepted (it has moved out of the shared queue).' });
    }

    // Update the latest DISPATCH stage to IN_PROGRESS (idempotent for re-accept).
    const dispatchStages = order.stages || [];
    const latestStage = dispatchStages[dispatchStages.length - 1];
    if (latestStage && latestStage.status === 'PENDING') {
      await prisma.orderStage.update({
        where: { id: latestStage.id },
        data: { status: 'IN_PROGRESS', startedAt: new Date() }
      });
    }

    // Audit + Dispatch log (only when this call actually claimed the order).
    await createAuditLog(orderId, 'DISPATCH_ACCEPTED', `Dispatch accepted by ${employeeName}`, req.user?.id);
    await createDispatchLog({
      orderId,
      officerName: employeeName,
      action: 'ACCEPTED',
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      city: order.city
    });

    const io = req.app?.get('io');
    if (io) io.emit('order-updated', { orderId, createdById: order.createdById });

    res.json({ message: `Dispatch accepted by ${employeeName}` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to accept dispatch order', error: error.message });
  }
};

// POST /api/dispatch-profile/:orderId/dispatch
const dispatchFromProfile = async (req, res) => {
  const { orderId } = req.params;
  const { employeeName, dispatchMethod, trackingUrl } = req.body;

  if (!employeeName || !(await isActiveDispatcher(employeeName))) {
    return res.status(400).json({ message: 'Unknown or inactive dispatcher employee' });
  }

  if (!ALLOWED_ACTIONS.includes(dispatchMethod)) {
    return res.status(400).json({ message: `Allowed dispatch methods: ${DISPATCH_METHODS.join(', ')}` });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { stages: true }
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.currentStage !== 'DISPATCH' || order.status === 'COMPLETED' || order.status === 'DELIVERED') {
      return res.status(400).json({ message: 'Order is not in a dispatch-able DISPATCH state' });
    }

    // Ownership enforcement: the ONLY dispatcher who may dispatch/forward this order is
    // the employee who accepted it (dispatchOfficer), or an unclaimed shared order
    // (dispatchOfficer still null -> accept first). Prevents any dispatcher from
    // dispatching another employee's order.
    if (order.dispatchOfficer && order.dispatchOfficer !== employeeName) {
      return res.status(409).json({ message: `This order is assigned to ${order.dispatchOfficer} and cannot be dispatched by you.` });
    }

    if (dispatchMethod === 'FORWARD_TO_FAISAL') {
      // Keep order at DISPATCH, assign to Faisal (atomic + idempotent; only the current
      // owner may forward, and only while the order is still unforwarded).
      const claim = await prisma.order.updateMany({
        where: {
          id: orderId,
          currentStage: 'DISPATCH',
          dispatchOfficer: { in: [null, employeeName] }
        },
        data: { dispatchOfficer: 'Faisal', forwardedBy: employeeName }
      });

      if (claim.count === 0) {
        const fresh = await prisma.order.findUnique({ where: { id: orderId }, select: { dispatchOfficer: true, currentStage: true } });
        if (fresh && fresh.dispatchOfficer && fresh.dispatchOfficer !== 'Faisal') {
          return res.status(409).json({ message: `This order is assigned to ${fresh.dispatchOfficer} and cannot be forwarded by you.` });
        }
        return res.status(409).json({ message: 'This order can no longer be forwarded (it has moved out of DISPATCH).' });
      }

      await prisma.$transaction(async (tx) => {
        await createAuditLog(orderId, 'FORWARDED_TO_FAISAL', `Order forwarded from ${employeeName} to Faisal dispatch`, req.user?.id, tx);
        await createDispatchLog({
          orderId,
          officerName: employeeName,
          action: 'FORWARDED',
          dispatchMethod: 'FORWARD_TO_FAISAL',
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          city: order.city
        }, tx);
      }, { timeout: 30000 });

      const io = req.app?.get('io');
      if (io) io.emit('order-updated', { orderId, createdById: order.createdById });

      return res.json({ message: 'Order forwarded to Faisal for dispatch' });
    }

    // For ENAMELS (Khawar) or TCS/POST/CUSTOMER_TAKEAWAY (Faisal) — dispatch the order
    const updateData = {};

    // Map dispatch methods
    const deliveryTypeMap = {
      'ENAMELS': 'ENAMELS',
      'TCS': 'TCS',
      'POST': 'POST_EX',
      'POST_EX': 'POST_EX',
      'CUSTOMER_TAKEAWAY': 'WALK_IN'
    };
    const mappedDeliveryType = deliveryTypeMap[dispatchMethod];
    updateData.deliveryType = mappedDeliveryType;
    if (trackingUrl) updateData.trackingNumber = trackingUrl;

    updateData.currentStage = 'OUT_FOR_DELIVERY';
    updateData.status = 'IN_PROGRESS';
    updateData.dispatchStatus = mappedDeliveryType === 'WALK_IN' ? 'DELIVERED' : 'BOOKED';
    if (mappedDeliveryType === 'WALK_IN') {
      updateData.deliveredAt = new Date();
    }

    // Complete the DISPATCH stage → create OUT_FOR_DELIVERY → update order →
    // routing history → reset seen → audit + dispatch log, all in ONE transaction so
    // the order can never be left half-dispatched.
    const currentStage = order.stages.find(s =>
      ['PENDING', 'IN_PROGRESS', 'WAITING_APPROVAL'].includes(s.status)
    );
    const durations = await getStageDurations(order.priority);
    const deadline = calculateDeadline(new Date(), durations['OUT_FOR_DELIVERY'] || 24);

    // Routing history for delivery users
    const getRolesForStage = (stage) => {
      const map = {
        'OUT_FOR_DELIVERY': ['OUT_FOR_DELIVERY', 'DELIVERY_BOY']
      };
      return map[stage] || ['ADMIN', 'FAISAL'];
    };

    const recipientUsers = await prisma.user.findMany({
      where: { role: { in: getRolesForStage('OUT_FOR_DELIVERY') } },
      select: { id: true }
    });

    const auditAction = dispatchMethod === 'ENAMELS' ? 'DISPATCHED_ENAMELS' : 'DISPATCHED_COURIER';
    const dispatchRemarks = `Dispatched via ${dispatchMethod} by ${employeeName}. Tracking: ${trackingUrl || 'N/A'}`;

    // Atomic claim of the DISPATCH -> OUT_FOR_DELIVERY transition. Only the recording
    // employee (dispatchOfficer === employeeName) may dispatch, and only while the order
    // is still at DISPATCH for that officer. A concurrent or duplicate dispatch attempt
    // matches 0 rows -> the whole transaction is skipped and no duplicate OUT_FOR_DELIVERY
    // stage / admin assignment / log is ever created.
    const claimed = await prisma.order.updateMany({
      where: { id: orderId, currentStage: 'DISPATCH', dispatchOfficer: employeeName },
      data: { dispatchOfficer: employeeName }
    });
    if (claimed.count === 0) {
      const fresh = await prisma.order.findUnique({ where: { id: orderId }, select: { currentStage: true, dispatchOfficer: true } });
      return res.status(409).json({ message: (fresh && fresh.currentStage !== 'DISPATCH')
        ? 'This order has already been dispatched or moved out of the dispatch queue.'
        : 'This order is assigned to another dispatcher and cannot be dispatched by you.' });
    }

    await prisma.$transaction(async (tx) => {
      if (currentStage) {
        await tx.orderStage.update({
          where: { id: currentStage.id },
          data: { status: 'COMPLETED', completedAt: new Date(), rejectionReason: `Dispatched via ${dispatchMethod} by ${employeeName}` }
        });
      }

      // Create OUT_FOR_DELIVERY stage with appropriate deadline
      await tx.orderStage.create({
        data: { orderId, stageName: 'OUT_FOR_DELIVERY', status: 'PENDING', deadlineAt: deadline }
      });

      await tx.order.update({ where: { id: orderId }, data: updateData });

      await tx.routingHistory.create({
        data: {
          orderId,
          sentByUserId: req.user?.id || 'system',
          sentToStage: 'OUT_FOR_DELIVERY',
          sentToUserIds: JSON.stringify(recipientUsers.map(u => u.id)),
          previousStage: 'DISPATCH',
          newStage: 'OUT_FOR_DELIVERY',
          remarks: dispatchRemarks,
          createdAt: new Date()
        }
      }).catch(() => {});
      await tx.seenTask.deleteMany({
        where: { userId: { in: recipientUsers.map(u => u.id) }, orderId, stageName: 'OUT_FOR_DELIVERY' }
      }).catch(() => {});

      // Audit + Dispatch log
      await createAuditLog(orderId, auditAction, `Dispatched via ${dispatchMethod} by ${employeeName}. Tracking: ${trackingUrl || 'N/A'}`, req.user?.id, tx);
      await createDispatchLog({
        orderId,
        officerName: employeeName,
        action: 'DISPATCHED',
        dispatchMethod,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        city: order.city
      }, tx);
    }, { timeout: 30000 });

    const io = req.app?.get('io');
    if (io) io.emit('order-updated', { orderId, createdById: order.createdById });

    recordAssignment({ orderId, deliveryBoyName: dispatchMethod, routedBy: employeeName, outletName: order.outletName }).catch(() => {});

    // ── PostEx shipment creation ──
    if (dispatchMethod === 'POST_EX') {
      postexService.createPostExShipment({
        orderId,
        userId: req.user?.id,
        userName: employeeName,
        notes: `Dispatched via ${employeeName} (PostEx). Tracking: ${trackingUrl || 'N/A'}`
      }).catch(err => console.error('PostEx shipment creation failed (non-blocking):', err.message));
    }

    res.json({ message: `Order dispatched via ${dispatchMethod} by ${employeeName}` });
  } catch (error) {
    res.status(500).json({ message: 'Error dispatching order', error: error.message });
  }
};

// GET /api/dispatch-profile/stats?employeeName=Khawar
const getDispatchProfileStats = async (req, res) => {
  try {
    const { employeeName, dateFrom, dateTo } = req.query;
    if (!employeeName || !(await isActiveDispatcher(employeeName))) {
      return res.status(400).json({ message: 'Unknown or inactive dispatcher employee' });
    }

    const whereClause = { officerName: employeeName };
    if (dateFrom || dateTo) {
      whereClause.createdAt = {};
      if (dateFrom) whereClause.createdAt.gte = new Date(dateFrom);
      if (dateTo) whereClause.createdAt.lte = new Date(dateTo);
    }

    const logs = await prisma.dispatchLog.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });

    const accepted = logs.filter(l => l.action === 'ACCEPTED').length;
    const dispatched = logs.filter(l => l.action === 'DISPATCHED').length;
    const forwarded = logs.filter(l => l.action === 'FORWARDED').length;

    const methodBreakdown = {};
    for (const l of logs) {
      if (l.dispatchMethod) {
        methodBreakdown[l.dispatchMethod] = (methodBreakdown[l.dispatchMethod] || 0) + 1;
      }
    }

    res.json({
      totalActions: logs.length,
      accepted,
      dispatched,
      forwarded,
      methodBreakdown,
      recentLogs: logs.slice(0, 20)
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch dispatch profile stats', error: error.message });
  }
};

// GET /api/dispatch-profile/dashboard?dateFrom=&dateTo=&employee=&city=&status=&payment=
const getDispatchDashboard = async (req, res) => {
  try {
    const { dateFrom, dateTo, employee, city, status, payment, period } = req.query;

    const activeDispatchers = await getActiveDispatchers();

    const dateFilter = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) dateFilter.lte = new Date(dateTo);

    // Base order query for dispatch-related orders
    // Exclude Enamel Delivery Boy orders (they live in the DELIVERY_BOY profile, never the dispatcher dashboard)
    const orderWhere = {
      OR: [
        { currentStage: { in: ['DISPATCH', 'OUT_FOR_DELIVERY'] } },
        { dispatchStatus: { not: 'PENDING' } },
        { dispatchOfficer: { not: null } }
      ],
      NOT: [
        { OR: [{ deliveryType: 'ENAMELS' }, { deliveryMethod: 'Enamels Delivery' }, { currentStage: 'ENAMELS_DELIVERY' }] }
      ]
    };
    if (dateFrom || dateTo) {
      orderWhere.createdAt = { ...dateFilter };
    }
    if (city) {
      orderWhere.city = { contains: city, mode: 'insensitive' };
    }
    if (employee) {
      orderWhere.dispatchOfficer = employee;
    }
    if (status === 'pending') {
      orderWhere.currentStage = 'DISPATCH';
      orderWhere.dispatchStatus = { in: ['PENDING', 'COURIER_REQUIRED'] };
    } else if (status === 'active') {
      orderWhere.currentStage = 'OUT_FOR_DELIVERY';
    } else if (status === 'delivered') {
      orderWhere.dispatchStatus = 'DELIVERED';
    } else if (status === 'returned') {
      orderWhere.dispatchStatus = 'RETURNED';
    } else if (status === 'rejected') {
      orderWhere.status = 'REJECTED';
    }
    if (payment === 'paid') {
      orderWhere.paymentStatus = 'PAID';
    } else if (payment === 'cod') {
      orderWhere.paymentStatus = { notIn: ['PAID', 'REFUNDED'] };
    }

    const orders = await prisma.order.findMany({
      where: orderWhere,
      select: {
        id: true, orderNumber: true, customerName: true, customerPhone: true,
        address: true, city: true, source: true, outletName: true,
        currentStage: true, status: true, dispatchStatus: true,
        deliveryType: true, deliveryMethod: true, priority: true,
        trackingNumber: true, totalPrice: true, paymentStatus: true,
        dispatchOfficer: true, forwardedBy: true,
        createdAt: true, updatedAt: true, deliveredAt: true, returnedAt: true,
        stages: {
          orderBy: { createdAt: 'asc' },
          select: { stageName: true, status: true, startedAt: true, completedAt: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Summary stats
    const totalOrders = orders.length;
    const pending = orders.filter(o => o.currentStage === 'DISPATCH' && !o.dispatchStatus || o.dispatchStatus === 'PENDING' || o.dispatchStatus === 'COURIER_REQUIRED').length;
    const active = orders.filter(o => o.currentStage === 'OUT_FOR_DELIVERY' && o.dispatchStatus !== 'DELIVERED' && o.dispatchStatus !== 'RETURNED').length;
    const delivered = orders.filter(o => o.dispatchStatus === 'DELIVERED').length;
    const returned = orders.filter(o => o.dispatchStatus === 'RETURNED').length;
    const rejected = orders.filter(o => o.status === 'REJECTED').length;
    const cod = orders.filter(o => o.paymentStatus !== 'PAID' && o.paymentStatus !== 'REFUNDED').length;
    const paid = orders.filter(o => o.paymentStatus === 'PAID').length;

    // Dispatch log based stats for employee performance
    const logWhere = {};
    if (dateFrom) logWhere.createdAt = { ...logWhere.createdAt, gte: new Date(dateFrom) };
    if (dateTo) logWhere.createdAt = { ...logWhere.createdAt, lte: new Date(dateTo) };

    const allLogs = await prisma.dispatchLog.findMany({
      where: Object.keys(logWhere).length ? logWhere : undefined,
      orderBy: { createdAt: 'desc' }
    });

    const buildEmployeeStats = (name) => {
      const empLogs = allLogs.filter(l => l.officerName === name);
      const accepted = empLogs.filter(l => l.action === 'ACCEPTED').length;
      const dispatched = empLogs.filter(l => l.action === 'DISPATCHED').length;
      const forwarded = empLogs.filter(l => l.action === 'FORWARDED').length;
      const pendingCount = accepted - dispatched;
      const dispatchTimes = [];
      let lastDispatch = null;
      for (const l of empLogs) {
        if (l.action === 'DISPATCHED') {
          lastDispatch = l.createdAt;
          const acceptedLog = empLogs.find(al => al.action === 'ACCEPTED' && al.orderId === l.orderId);
          if (acceptedLog) {
            const diff = (new Date(l.createdAt) - new Date(acceptedLog.createdAt)) / (1000 * 60);
            if (diff > 0) dispatchTimes.push(diff);
          }
        }
      }
      const avgDispatchTime = dispatchTimes.length ? Math.round(dispatchTimes.reduce((a, b) => a + b, 0) / dispatchTimes.length) : null;
      const deliveredCount = empLogs.filter(l => l.action === 'DISPATCHED' && l.dispatchMethod === 'CUSTOMER_TAKEAWAY').length;
      const returnedFromLogs = 0;

      return {
        totalAssigned: accepted,
        totalDispatched: dispatched,
        forwarded,
        pending: Math.max(0, pendingCount),
        delivered: deliveredCount,
        returned: returnedFromLogs,
        rejected: 0,
        averageDispatchTime: avgDispatchTime ? `${avgDispatchTime} min` : 'N/A',
        lastDispatch: lastDispatch ? lastDispatch.toISOString() : null
      };
    };

    const employeeStats = {};
    for (const name of activeDispatchers) {
      employeeStats[name] = buildEmployeeStats(name);
    }

    // Tracking data for the table
    const trackingData = orders.map(o => {
      const dispatchStages = (o.stages || []).filter(s => s.stageName === 'DISPATCH');
      const dispatchStage = dispatchStages[dispatchStages.length - 1];
      const deliveryStage = o.stages.find(s => s.stageName === 'OUT_FOR_DELIVERY');
      const dispatchLogEntry = allLogs.find(l => l.orderId === o.id && l.action === 'DISPATCHED');
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        city: o.city,
        dispatchOfficer: o.dispatchOfficer,
        dispatchMethod: o.deliveryType || dispatchLogEntry?.dispatchMethod || '—',
        currentStage: o.currentStage,
        dispatchStatus: o.dispatchStatus,
        paymentStatus: o.paymentStatus,
        assignedAt: dispatchStage?.startedAt || null,
        dispatchedAt: dispatchStage?.completedAt || null,
        deliveredAt: o.deliveredAt || null,
        returnedAt: o.returnedAt || null,
        createdAt: o.createdAt
      };
    });

    // Monthly report
    const monthlyMap = {};
    for (const o of orders) {
      const m = new Date(o.createdAt).toISOString().slice(0, 7);
      if (!monthlyMap[m]) monthlyMap[m] = { month: m, total: 0, delivered: 0, returned: 0, rejected: 0, pending: 0, cod: 0, paid: 0 };
      monthlyMap[m].total++;
      if (o.dispatchStatus === 'DELIVERED') monthlyMap[m].delivered++;
      if (o.dispatchStatus === 'RETURNED') monthlyMap[m].returned++;
      if (o.status === 'REJECTED') monthlyMap[m].rejected++;
      if (o.currentStage === 'DISPATCH' && (!o.dispatchStatus || o.dispatchStatus === 'PENDING')) monthlyMap[m].pending++;
      if (o.paymentStatus !== 'PAID') monthlyMap[m].cod++;
      if (o.paymentStatus === 'PAID') monthlyMap[m].paid++;
    }
    const monthlyReport = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month));

    // Employee monthly breakdown
    const employeeMonthly = {};
    for (const name of activeDispatchers) {
      const empLogs = allLogs.filter(l => l.officerName === name);
      const empMonthlyMap = {};
      for (const l of empLogs) {
        const m = new Date(l.createdAt).toISOString().slice(0, 7);
        if (!empMonthlyMap[m]) empMonthlyMap[m] = { month: m, dispatches: 0, deliveries: 0, returns: 0, pending: 0 };
        if (l.action === 'DISPATCHED') empMonthlyMap[m].dispatches++;
        if (l.dispatchMethod === 'CUSTOMER_TAKEAWAY') empMonthlyMap[m].deliveries++;
      }
      // Also check order status from orders
      const empOrders = orders.filter(o => o.dispatchOfficer === name);
      for (const o of empOrders) {
        const m = new Date(o.createdAt).toISOString().slice(0, 7);
        if (!empMonthlyMap[m]) empMonthlyMap[m] = { month: m, dispatches: 0, deliveries: 0, returns: 0, pending: 0 };
        if (o.dispatchStatus === 'RETURNED') empMonthlyMap[m].returns++;
        if (o.currentStage === 'DISPATCH' && (!o.dispatchStatus || o.dispatchStatus === 'PENDING')) empMonthlyMap[m].pending++;
        if (o.dispatchStatus === 'DELIVERED') empMonthlyMap[m].deliveries++;
      }
      employeeMonthly[name] = Object.values(empMonthlyMap).sort((a, b) => a.month.localeCompare(b.month));
    }

    res.json({
      summary: { totalOrders, pending, active, delivered, returned, rejected, cod, paid },
      employeeStats,
      trackingData,
      monthlyReport,
      employeeMonthly
    });

  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch dispatch dashboard', error: error.message });
  }
};

// GET /api/dispatch-profile/activity-logs — full activity tracking table
const getAllActivityLogs = async (req, res) => {
  try {
    const { employeeName, dateFrom, dateTo, limit } = req.query;
    const where = {};
    if (employeeName) where.officerName = employeeName;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const logs = await prisma.dispatchLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit) : 200
    });

    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch activity logs', error: error.message });
  }
};

module.exports = { getDispatchProfileOrders, acceptDispatchOrder, dispatchFromProfile, getDispatchProfileStats, getDispatchDashboard, getAllActivityLogs };
