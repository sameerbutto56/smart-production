const prisma = require('../prisma');
const { createAuditLog } = require('./order-helpers');
const { calculateDeadline } = require('../utils/deadline');
const notify = require('../utils/notify');
const { recordAssignment } = require('./tahirSheet.controller');

// Mirrors order.controller.js constants so the control panel resolves real workflow
// structure instead of a plain status write.
const validAllStages = ['ORDER_ENTRY', 'STORE', 'WORKERS', 'LOGO_DESIGN', 'PRODUCTION_ACCEPTANCE', 'PRODUCTION', 'STORE_RECEIVE', 'DISPATCH', 'OUT_FOR_DELIVERY', 'OUTLET_RECEIVE', 'IN_DISPATCH', 'ENAMELS_DELIVERY'];

const TERMINAL_STATUSES = ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED'];
const ACTIVE_STAGE_STATUSES = ['PENDING', 'IN_PROGRESS', 'WAITING_APPROVAL'];

// Human queue label per stage (mirrors STAGE_LABELS).
const STAGE_LABELS = {
  ORDER_ENTRY: 'Order Entry',
  STORE: 'Store',
  WORKERS: 'Production Workers',
  LOGO_DESIGN: 'Logo Design',
  PRODUCTION_ACCEPTANCE: 'Production In (Acceptance)',
  PRODUCTION: 'Production',
  STORE_RECEIVE: 'Store Receive',
  DISPATCH: 'Dispatch',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  OUTLET_RECEIVE: 'Outlet Receive',
  IN_DISPATCH: 'In Dispatch',
  ENAMELS_DELIVERY: 'Enamels Delivery'
};

// Stage -> profile names that own the queue (mirrors getRolesForStage).
const STAGE_ROLES = {
  ORDER_ENTRY: ['OUTLET', 'FAISAL'],
  STORE: ['STORE', 'STORE_EMPLOYEE'],
  WORKERS: ['PRODUCTION', 'PRODUCTION_OUT'],
  LOGO_DESIGN: ['LOGO_DESIGN', 'LOGO_DESIGN_EMPLOYEE', 'LOGO_DESIGNER'],
  PRODUCTION_ACCEPTANCE: ['PRODUCTION_IN', 'PRODUCTION'],
  PRODUCTION: ['PRODUCTION', 'PRODUCTION_OUT'],
  STORE_RECEIVE: ['STORE', 'STORE_EMPLOYEE'],
  DISPATCH: ['DISPATCH', 'MAIN_EMPLOYEE'],
  OUT_FOR_DELIVERY: ['DELIVERY_BOY'],
  OUTLET_RECEIVE: ['OUTLET'],
  IN_DISPATCH: ['OUTLET'],
  ENAMELS_DELIVERY: ['DELIVERY_BOY']
};

// Stage -> human-friendly profile label for the resolved queue.
const STAGE_PROFILE_LABELS = {
  ORDER_ENTRY: 'Faisal / Outlet Order Entry',
  STORE: 'Store Keeper / Store Employee',
  WORKERS: 'Production Out',
  LOGO_DESIGN: 'Logo Design',
  PRODUCTION_ACCEPTANCE: 'Production In',
  PRODUCTION: 'Production Out',
  STORE_RECEIVE: 'Store Receive (Store)',
  DISPATCH: 'Dispatch Officer',
  OUT_FOR_DELIVERY: 'Enamels Delivery Boy',
  OUTLET_RECEIVE: 'Johar Town Outlet — Come From Production',
  IN_DISPATCH: 'Johar Town Outlet — In Dispatch',
  ENAMELS_DELIVERY: 'Enamels Delivery Boy'
};

// Same manDestRoleMap convention used by manualRouteOrder for notifications.
const manDestRoleMap = { 'STORE': 'STORE', 'PRODUCTION': 'PRODUCTION', 'LOGO_DESIGN': 'LOGO_DESIGN', 'DISPATCH': 'DISPATCH', 'OUT_FOR_DELIVERY': 'DELIVERY_BOY', 'OUTLET_RECEIVE': 'OUTLET', 'ENAMELS_DELIVERY': 'DELIVERY_BOY' };

const getTrackingStatus = (order) => {
  if (!order) return null;
  if (order.goForVerification && !order.verifiedAt && !order.verificationReturnedAt) return 'VERIFICATION';
  if (order.verificationReturnedAt) return 'RETURNED_FROM_VERIFICATION';
  return order.currentStage;
};

// Mirrors order.controller.js getStageDurations (DEADLINE_CONFIG + SLA multipliers).
const getStageDurations = async (priority = 'NORMAL', db = prisma) => {
  let config = {
    stageDurations: { STORE: 24, WORKERS: 24, LOGO_DESIGN: 24, PRODUCTION_ACCEPTANCE: 4, PRODUCTION: 48, STORE_RECEIVE: 12, OUTLET_RECEIVE: 48, ENAMELS_DELIVERY: 24, DISPATCH: 12, OUT_FOR_DELIVERY: 12 },
    slaMultipliers: { NORMAL: 1, URGENT: 0.75, SUPER_URGENT: 0.5 }
  };
  try {
    const setting = await db.systemSetting.findUnique({ where: { key: 'DEADLINE_CONFIG' } });
    if (setting) config = { ...config, ...JSON.parse(setting.value) };
  } catch (e) {
    console.error('[orderControl] Error reading DEADLINE_CONFIG:', e.message);
  }
  const slaMultiplier = config.slaMultipliers?.[priority] ?? 1;
  const adjusted = {};
  for (const [stage, hours] of Object.entries(config.stageDurations || {})) {
    adjusted[stage] = Math.round((hours * slaMultiplier) * 100) / 100;
  }
  return adjusted;
};

// Resolve the exact live queue location for an order from its stage rows + seen tasks.
const resolveLocation = (order, seenCount) => {
  const currentStage = order.currentStage;
  const trackingStatus = getTrackingStatus(order);
  const stages = order.stages || [];

  const activeStage = stages.find(s => s.stageName === currentStage && ACTIVE_STAGE_STATUSES.includes(s.status))
    || stages.find(s => ACTIVE_STAGE_STATUSES.includes(s.status)) || null;

  const base = {
    currentStage,
    trackingStatus,
    label: STAGE_LABELS[currentStage] || currentStage,
    profile: STAGE_PROFILE_LABELS[currentStage] || null,
    roles: STAGE_ROLES[currentStage] || [],
    seenCount,
    activeStageStatus: activeStage?.status || null
  };

  if (order.status === 'CANCELLED') return { ...base, bucket: 'cancelled', queue: 'Cancelled', description: 'Order has been cancelled. It is blocked from all active queues.' };
  if (order.status === 'REJECTED') return { ...base, bucket: 'rejected', queue: 'Rejected', description: 'Order has been rejected and is not in any active queue.' };
  if (order.status === 'COMPLETED' || order.status === 'DELIVERED') return { ...base, bucket: 'completed', queue: 'Completed', description: 'Order workflow is complete (delivered/finished).' };

  if (trackingStatus === 'VERIFICATION') return { ...base, bucket: 'verification', queue: 'Inventory View — Verification', description: 'Waiting in the pending verification queue (goForVerification).' };
  if (trackingStatus === 'RETURNED_FROM_VERIFICATION') return { ...base, bucket: 'returned-to-faisal', queue: 'Returned from Verification', description: 'Returned to Faisal for correction — not yet re-submitted.' };

  if (activeStage) {
    const stageName = activeStage.stageName;
    let bucket = 'unseen';
    let queue = `${STAGE_PROFILE_LABELS[stageName] || stageName} — Unseen Tasks`;
    if (activeStage.status === 'IN_PROGRESS') {
      bucket = 'active';
      queue = `${STAGE_PROFILE_LABELS[stageName] || stageName} — Accepted / In Progress`;
    } else if (seenCount > 0) {
      bucket = 'seen';
      queue = `${STAGE_PROFILE_LABELS[stageName] || stageName} — Seen / Accepted`;
    }
    return {
      ...base,
      bucket,
      queue,
      activeStage: { stageName, status: activeStage.status, startedAt: activeStage.startedAt, deadlineAt: activeStage.deadlineAt, createdAt: activeStage.createdAt },
      description: `Order is at the ${stageName} stage in the ${queue}.`
    };
  }

  return { ...base, bucket: 'stuck', queue: 'No Active Task', description: 'currentStage is set but no PENDING/IN_PROGRESS/WAITING_APPROVAL stage row exists — the order may be stuck or awaiting manual re-route.' };
};

// Build a compact chronological timeline from routing history + audit logs + stage completions.
const buildTimeline = async (order) => {
  const entries = [];
  for (const rh of order.routingHistory || []) {
    entries.push({ ts: rh.createdAt, type: 'route', label: `${rh.previousStage} \u2192 ${rh.newStage}`, stage: rh.newStage, remarks: rh.remarks, sentByUserId: rh.sentByUserId });
  }
  for (const al of order.auditLogs || []) {
    entries.push({ ts: al.timestamp, type: 'audit', label: al.action, remarks: al.details, performedBy: al.performedBy });
  }
  for (const st of order.stages || []) {
    if (st.completedAt) entries.push({ ts: st.completedAt, type: 'stage', label: `${st.stageName} Completed`, stage: st.stageName, remarks: st.rejectionReason || null });
  }
  entries.sort((a, b) => new Date(a.ts) - new Date(b.ts));

  // Resolve actor names in one batch.
  const userIds = [...new Set(entries.map(e => e.sentByUserId || e.performedBy).filter(Boolean))];
  let userMap = {};
  if (userIds.length) {
    try {
      const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } });
      userMap = Object.fromEntries(users.map(u => [u.id, u.name]));
    } catch (e) { console.error('[orderControl] user name resolution failed:', e.message); }
  }
  return entries.map(e => ({ ...e, actor: userMap[e.sentByUserId || e.performedBy] || null, sentByUserId: undefined, performedBy: undefined }));
};

// Base relation includes for a locate payload (routingHistory is NOT a back-relation on
// Order — RoutingHistory.orderId is a plain indexed string — so it is fetched separately).
const ORDER_INCLUDES = {
  stages: { orderBy: { createdAt: 'asc' } },
  auditLogs: { orderBy: { timestamp: 'desc' }, take: 25 },
  createdBy: { select: { id: true, name: true } }
};

const findOrderWithHistory = async (where) => {
  const order = await prisma.order.findUnique({ where, include: ORDER_INCLUDES });
  if (!order) return null;
  order.routingHistory = await prisma.routingHistory.findMany({ where: { orderId: order.id }, orderBy: { createdAt: 'asc' } });
  return order;
};

// GET /api/order-control/locate/:query — resolve any order's exact current queue location.
const locateOrder = async (req, res) => {
  try {
    const query = (req.params.query || '').trim();
    if (!query) return res.status(400).json({ message: 'Order number or invoice number is required' });

    let order = await findOrderWithHistory({ orderNumber: query });
    if (!order) order = await findOrderWithHistory({ invoiceNumber: query });
    if (!order) {
      const matches = await prisma.order.findMany({
        where: { OR: [{ orderNumber: { contains: query } }, { invoiceNumber: { contains: query } }, { customerName: { contains: query, mode: 'insensitive' } }, { customerPhone: { contains: query } }] },
        include: ORDER_INCLUDES,
        orderBy: { createdAt: 'desc' },
        take: 5
      });
      if (!matches.length) return res.status(404).json({ message: 'Order not found' });
      order = matches[0];
      order.routingHistory = await prisma.routingHistory.findMany({ where: { orderId: order.id }, orderBy: { createdAt: 'asc' } });
    }

    const seenCount = await prisma.seenTask.count({ where: { orderId: order.id, stageName: order.currentStage } });
    const location = resolveLocation(order, seenCount);
    const timeline = await buildTimeline(order);

    // Valid destination stages for the control panel (real workflow tasks only).
    const destStages = validAllStages.map(stage => {
      const warning = [];
      if (stage === 'PRODUCTION' && ['STORE', 'STORE_RECEIVE', 'LOGO_DESIGN', 'NAME_LOGO', 'CUSTOM_LOGO'].includes(order.currentStage)) {
        warning.push('Routed to PRODUCTION_ACCEPTANCE (Production In) first — Production In gate.');
      }
      if (TERMINAL_STATUSES.includes(order.status)) warning.push('Order is in a terminal state.');
      return { stage, label: STAGE_LABELS[stage] || stage, roles: STAGE_ROLES[stage] || [], warning };
    });

    const lastActivity = timeline.length ? timeline[timeline.length - 1] : null;

    res.json({
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        invoiceNumber: order.invoiceNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        status: order.status,
        type: order.type,
        source: order.source,
        priority: order.priority,
        totalPrice: order.totalPrice,
        createdAt: order.createdAt,
        createdBy: order.createdBy?.name || null,
        replacementCaseId: order.replacementCaseId || null
      },
      location,
      lastActivity,
      destStages,
      timeline
    });
  } catch (error) {
    console.error('[orderControl] locateOrder error:', error.message);
    res.status(500).json({ message: 'Error locating order' });
  }
};

// POST /api/order-control/:orderId/reroute — transactional manual re-route (control override).
const rerouteOrder = async (req, res) => {
  const { orderId } = req.params;
  let { destinationStage } = req.body;
  const reason = (req.body.reason || '').trim();

  if (!reason) return res.status(400).json({ message: 'Reason is required for manual re-routing.' });
  if (destinationStage === 'LOGO') destinationStage = 'LOGO_DESIGN';
  if (!validAllStages.includes(destinationStage)) {
    return res.status(400).json({
      message: `Cannot route order. Destination route "${destinationStage}" does not exist. Please configure the workflow route first. Valid stages: ${validAllStages.join(', ')}.`
    });
  }

  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { stages: true } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const currentStage = order.stages.find(s => ACTIVE_STAGE_STATUSES.includes(s.status));

    // Production In split guard — same as manualRouteOrder.
    if (destinationStage === 'PRODUCTION' &&
        currentStage && ['STORE', 'STORE_RECEIVE', 'LOGO_DESIGN', 'NAME_LOGO', 'CUSTOM_LOGO'].includes(currentStage.stageName)) {
      destinationStage = 'PRODUCTION_ACCEPTANCE';
    }

    const result = await prisma.$transaction(async (tx) => {
      if (currentStage) {
        await tx.orderStage.updateMany({
          where: { orderId, stageName: currentStage.stageName, status: { in: ACTIVE_STAGE_STATUSES } },
          data: { status: 'COMPLETED', completedAt: new Date(), rejectionReason: `Re-routed to ${destinationStage} by ${req.user.name}. Reason: ${reason}` }
        });
      }

      const durations = await getStageDurations(order.priority, tx);
      const existingDestStage = await tx.orderStage.findFirst({
        where: { orderId, stageName: destinationStage, status: { in: ACTIVE_STAGE_STATUSES } }
      });
      if (!existingDestStage) {
        const deadline = calculateDeadline(new Date(), durations[destinationStage] || 24);
        await tx.orderStage.create({
          data: { orderId, stageName: destinationStage, status: 'PENDING', deadlineAt: deadline }
        });
      }

      // Clear verification state when admin manually reroutes — the manual override
      // takes precedence over any verification workflow the order was in.
      const verificationClear = {};
      if (order.goForVerification) {
        verificationClear.goForVerification = false;
      }
      if (order.verificationReturnedAt && destinationStage !== 'ORDER_ENTRY') {
        verificationClear.verificationReturnedAt = null;
        verificationClear.verificationReturnNote = null;
      }

      await tx.order.update({
        where: { id: orderId },
        data: { currentStage: destinationStage, status: 'PENDING', ...verificationClear }
      });

      const recipientUsers = await tx.user.findMany({
        where: { role: { in: STAGE_ROLES[destinationStage] || [] } },
        select: { id: true }
      });
      await tx.routingHistory.create({
        data: {
          orderId,
          sentByUserId: req.user.id,
          sentToStage: destinationStage,
          sentToUserIds: JSON.stringify(recipientUsers.map(u => u.id)),
          previousStage: currentStage?.stageName || 'UNKNOWN',
          newStage: destinationStage,
          remarks: `Re-routed by ${req.user.name}. Reason: ${reason}`,
          createdAt: new Date()
        }
      });

      await tx.seenTask.deleteMany({
        where: { userId: { in: recipientUsers.map(u => u.id) }, orderId, stageName: destinationStage }
      }).catch(() => {});

      await createAuditLog(orderId, 'MANUAL_RE_ROUTE', `Manually re-routed from ${currentStage?.stageName || 'UNKNOWN'} to ${destinationStage} by ${req.user.name}. Reason: ${reason}`, req.user.id, tx);

      return recipientUsers;
    }, { timeout: 30000 });

    const io = req.app.get('io');
    io.emit('order-updated', { orderId, createdById: order.createdById });

    // Record delivery assignment for Tahir Sheet
    if (destinationStage === 'ENAMELS_DELIVERY') {
      recordAssignment({ orderId, deliveryBoyName: 'Tahir', routedBy: req.user?.name, outletName: order.outletName }).catch(() => {});
    }

    const manRole = manDestRoleMap[destinationStage] || 'STORE';
    if (order?.customerName && order?.orderNumber) {
      await notify.create(req, { type: 'manual_route', moduleName: 'My Tasks', path: '/tasks', role: manRole, title: 'Order Re-routed (Control)', message: `Order #${order.orderNumber} re-routed to ${destinationStage} by Admin. Reason: ${reason}`, orderId: order.id, orderNumber: order.orderNumber, customerName: order.customerName, action: `Re-routed \u2192 ${destinationStage}`, employeeName: req.user?.name }).catch(() => {});
    }

    const seenCount = await prisma.seenTask.count({ where: { orderId, stageName: destinationStage } });
    const freshOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: ORDER_INCLUDES
    });
    if (freshOrder) freshOrder.routingHistory = await prisma.routingHistory.findMany({ where: { orderId }, orderBy: { createdAt: 'asc' } });

    res.json({
      message: `Order re-routed to ${destinationStage}`,
      nextStage: destinationStage,
      location: resolveLocation(freshOrder, seenCount)
    });
  } catch (error) {
    console.error('[orderControl] rerouteOrder error:', error.message);
    res.status(500).json({ message: 'Error re-routing order' });
  }
};

module.exports = { locateOrder, rerouteOrder };
