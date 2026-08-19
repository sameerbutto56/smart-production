const prisma = require('../prisma');
const notify = require('../utils/notify');
const cache = require('../utils/cache');
const { createAuditLog, syncReplacementCaseOnOrderCompletion } = require('./order-helpers');
const { generateBalanceReceiptNumber } = require('./pos.controller');
const { recordAssignment } = require('./tahirSheet.controller');

// Dedicated In Dispatch module — JOHAR TOWN outlet only.
// Completely isolated from the existing Dispatch (dispatch officer) workflow.
// Only orders explicitly routed to the IN_DISPATCH stage appear here.

const getOutletName = (req) => {
  const name = req.user?.name || '';
  const n = name.toLowerCase();
  if (n.includes('johar')) return 'Johar Town';
  if (n.includes('jail')) return 'Jail Road';
  if (n.includes('abbottabad')) return 'Abbottabad';
  return name;
};

const isJoharTownUser = (req) => {
  const outletName = getOutletName(req);
  return outletName === 'Johar Town';
};

const requireJoharTown = (req, res) => {
  if (String(req.user?.role || '').toUpperCase() !== 'OUTLET') {
    res.status(403).json({ message: 'In Dispatch module is only available to the JOHAR TOWN outlet' });
    return false;
  }
  if (!isJoharTownUser(req)) {
    res.status(403).json({ message: 'In Dispatch module is only available to the JOHAR TOWN outlet' });
    return false;
  }
  return true;
};

const orderInclude = {
  stages: {
    orderBy: { createdAt: 'desc' },
    select: { id: true, stageName: true, status: true, deadlineAt: true, completedAt: true, startedAt: true, createdAt: true }
  },
  createdBy: { select: { name: true } }
};

// GET /api/in-dispatch/orders — orders currently at IN_DISPATCH stage
const getInDispatchOrders = async (req, res) => {
  if (!requireJoharTown(req, res)) return;
  try {
    const orders = await prisma.order.findMany({
      where: {
        currentStage: 'IN_DISPATCH',
        status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED'] },
        stages: { some: { stageName: 'IN_DISPATCH', status: { in: ['PENDING', 'IN_PROGRESS'] } } }
      },
      include: orderInclude,
      orderBy: { createdAt: 'desc' }
    });

    const routeOrders = await prisma.inDispatchRoute.findMany({
      where: { status: 'ACTIVE' },
      select: { orderIds: true }
    });
    const assignedIds = new Set();
    routeOrders.forEach(r => {
      try { JSON.parse(r.orderIds).forEach(id => assignedIds.add(id)); } catch (_) {}
    });

    // Payment enrichment — the Order Number is the primary link to the POS sale
    // (falls back to the orderId FK for older sales). This is the exact data the
    // Dispatch Slip shows, so it must always mirror the original POS transaction.
    const orderIds = orders.map(o => o.id);
    const orderNumbers = orders.map(o => o.orderNumber).filter(Boolean);
    const linkedPos = await prisma.posSale.findMany({
      where: {
        OR: [
          { orderId: { in: orderIds } },
          ...(orderNumbers.length ? [{ orderNumber: { in: orderNumbers } }] : [])
        ]
      },
      select: {
        id: true, orderId: true, orderNumber: true, receiptNumber: true,
        grandTotal: true, advanceAmount: true, paymentMethod: true,
        cashAmount: true, onlineAmount: true, createdAt: true,
        items: {
          select: {
            productName: true, color: true, size: true, quantity: true,
            unitPrice: true, lineTotal: true
          }
        }
      }
    });
    const posById = {};
    const posByNumber = {};
    linkedPos.forEach(ps => {
      if (ps.orderId) posById[ps.orderId] = ps;
      if (ps.orderNumber) posByNumber[ps.orderNumber] = ps;
    });
    const bpAgg = await prisma.posBalancePayment.groupBy({
      by: ['posSaleId'],
      where: { posSaleId: { in: linkedPos.map(p => p.id) } },
      _sum: { amountPaidNow: true }
    });
    const bpMap = {};
    bpAgg.forEach(b => { bpMap[b.posSaleId] = Number(b._sum.amountPaidNow || 0); });
    const refundAgg = await prisma.posReturn.groupBy({
      by: ['saleId'],
      where: { saleId: { in: linkedPos.map(p => p.id) } },
      _sum: { refundAmount: true }
    });
    const refundMap = {};
    refundAgg.forEach(r => { refundMap[r.saleId] = Number(r._sum.refundAmount || 0); });

    const items = orders.map(order => {
      const ps = posById[order.id] || posByNumber[order.orderNumber] || null;
      const total = ps ? Number(ps.grandTotal || 0) : (Number(order.totalPrice || 0) + Number(order.deliveryCharges || 0));
      const advance = ps ? Number(ps.advanceAmount || 0) : Number(order.advanceAmount || 0);
      const refunded = ps ? Number(refundMap[ps.id] || 0) : 0;
      // Same convention as getSalesDashboard / getSales `_amountReceived`:
      // a regular fully-paid-at-checkout sale (advance 0, no balance payments)
      // has already collected the full grandTotal; advance/balance sales count
      // only what was actually received so far.
      const receivedAtCheckout = ps ? (advance > 0 ? Math.min(advance, total) : total) : advance;
      const balanceCollected = ps ? Number(bpMap[ps.id] || 0) : 0;
      const paid = Math.max(0, Math.round((receivedAtCheckout + balanceCollected - refunded) * 100) / 100);
      const remaining = Math.max(0, Math.round((total - paid) * 100) / 100);
      const status = remaining <= 0.01 ? 'Paid' : (paid > 0 ? 'Partially Paid' : 'Unpaid');
      const method = paid > 0 ? (ps?.paymentMethod || order.paymentMethod || 'CASH') : 'COD';
      const inStage = (order.stages || []).find(s => s.stageName === 'IN_DISPATCH');
      // Per-product pricing from the original POS transaction. Outlet orders'
      // productDetails often store unitPrice 0 (price lives only on the POS
      // sale), so the Dispatch Slip must read these to show real UNIT/TOTAL.
      const posItems = (ps && Array.isArray(ps.items) ? ps.items : []).map(it => ({
        productName: it.productName,
        color: it.color || null,
        size: it.size || null,
        quantity: Number(it.quantity || 0),
        unitPrice: Number(it.unitPrice || 0),
        lineTotal: Number(it.lineTotal || 0)
      }));
      return {
        ...order,
        _posItems: posItems,
        _payment: {
          total, advance, paid, remaining, status, method,
          posSaleId: ps?.id || null,
          receiptNumber: ps?.receiptNumber || null,
          posDate: ps?.createdAt || null,
          cashAmount: ps ? Number(ps.cashAmount || 0) : 0,
          onlineAmount: ps ? Number(ps.onlineAmount || 0) : 0,
          refunded,
          linked: !!ps,
          linkedBy: ps ? (ps.orderId === order.id ? 'orderId' : 'orderNumber') : null
        },
        _dispatchDate: inStage?.startedAt || inStage?.createdAt || order.createdAt,
        _assignedToRoute: assignedIds.has(order.id)
      };
    });

    res.json(items);
  } catch (error) {
    console.error('in-dispatch getOrders error:', error);
    res.status(500).json({ message: 'Error fetching In Dispatch orders', error: error.message });
  }
};

const resolveRouteOrders = async (route) => {
  let ids = [];
  try { ids = JSON.parse(route.orderIds || '[]'); } catch (_) {}
  let orders = [];
  if (ids.length) {
    orders = await prisma.order.findMany({
      where: { id: { in: ids } },
      select: {
        id: true, orderNumber: true, customerName: true, customerPhone: true,
        outletName: true, totalPrice: true, createdAt: true, currentStage: true,
        productDetails: true
      }
    });
  }
  return { route, orders };
};

// GET /api/in-dispatch/routes — delivery routes for the JOHAR TOWN outlet
const getRoutes = async (req, res) => {
  if (!requireJoharTown(req, res)) return;
  try {
    const routes = await prisma.inDispatchRoute.findMany({
      where: { outletName: 'Johar Town' },
      orderBy: { createdAt: 'desc' }
    });
    const resolved = await Promise.all(routes.map(resolveRouteOrders));
    res.json(resolved);
  } catch (error) {
    console.error('in-dispatch getRoutes error:', error);
    res.status(500).json({ message: 'Error fetching In Dispatch routes', error: error.message });
  }
};

// POST /api/in-dispatch/routes — create a delivery route from selected In Dispatch orders
const createRoute = async (req, res) => {
  if (!requireJoharTown(req, res)) return;
  try {
    const { routeName, area, deliveryPerson, notes, orderIds } = req.body || {};
    const ids = Array.isArray(orderIds) ? orderIds : [];

    if (!routeName || !routeName.trim()) {
      return res.status(400).json({ message: 'Route name is required' });
    }
    if (ids.length === 0) {
      return res.status(400).json({ message: 'Select at least one order for the route' });
    }

    const existing = await prisma.order.findMany({
      where: {
        id: { in: ids },
        currentStage: 'IN_DISPATCH',
        status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED'] }
      },
      select: { id: true }
    });
    if (existing.length !== ids.length) {
      return res.status(400).json({ message: 'Some selected orders are no longer in In Dispatch' });
    }

    const route = await prisma.inDispatchRoute.create({
      data: {
        outletName: 'Johar Town',
        routeName: routeName.trim(),
        area: area || null,
        deliveryPerson: deliveryPerson || null,
        notes: notes || null,
        orderIds: JSON.stringify(ids),
        status: 'ACTIVE',
        createdBy: req.user?.name || 'Outlet Staff'
      }
    });

    for (const orderId of ids) {
      await createAuditLog(orderId, 'IN_DISPATCH_ROUTE',
        `Added to delivery route "${routeName.trim()}"${area ? ` (${area})` : ''}${deliveryPerson ? ` — ${deliveryPerson}` : ''} by ${req.user?.name}`,
        req.user?.id || 'SYSTEM');
    }

    const io = req.app?.get('io');
    if (io) io.emit('order-updated', { module: 'in-dispatch' });

    res.status(201).json({ message: 'Delivery route created', route });
  } catch (error) {
    console.error('in-dispatch createRoute error:', error);
    res.status(500).json({ message: 'Error creating delivery route', error: error.message });
  }
};

// POST /api/in-dispatch/routes/:id/complete — mark a delivery route completed
const completeRoute = async (req, res) => {
  if (!requireJoharTown(req, res)) return;
  try {
    const route = await prisma.inDispatchRoute.findUnique({ where: { id: req.params.id } });
    if (!route) return res.status(404).json({ message: 'Route not found' });
    if (route.outletName !== 'Johar Town') return res.status(403).json({ message: 'Route not found for this outlet' });

    const updated = await prisma.inDispatchRoute.update({
      where: { id: route.id },
      data: { status: 'COMPLETED', completedAt: new Date(), completedBy: req.user?.name || 'Outlet Staff' }
    });

    const io = req.app?.get('io');
    if (io) io.emit('order-updated', { module: 'in-dispatch' });

    res.json({ message: 'Delivery route completed', route: updated });
  } catch (error) {
    console.error('in-dispatch completeRoute error:', error);
    res.status(500).json({ message: 'Error completing delivery route', error: error.message });
  }
};

// POST /api/in-dispatch/routes/:id/cancel — cancel a delivery route (orders return to queue)
const cancelRoute = async (req, res) => {
  if (!requireJoharTown(req, res)) return;
  try {
    const route = await prisma.inDispatchRoute.findUnique({ where: { id: req.params.id } });
    if (!route) return res.status(404).json({ message: 'Route not found' });
    if (route.outletName !== 'Johar Town') return res.status(403).json({ message: 'Route not found for this outlet' });
    if (route.status !== 'ACTIVE') return res.status(400).json({ message: 'Only active routes can be cancelled' });

    const updated = await prisma.inDispatchRoute.update({
      where: { id: route.id },
      data: { status: 'CANCELLED' }
    });

    const io = req.app?.get('io');
    if (io) io.emit('order-updated', { module: 'in-dispatch' });

    res.json({ message: 'Delivery route cancelled', route: updated });
  } catch (error) {
    console.error('in-dispatch cancelRoute error:', error);
    res.status(500).json({ message: 'Error cancelling delivery route', error: error.message });
  }
};

// POST /api/in-dispatch/orders/:id/route — route an order out of In Dispatch
// actions: sendToEnamelsDelivery | sendToOutlet | customerTakeDeliver | sendToDispatch
const routeOrder = async (req, res) => {
  if (!requireJoharTown(req, res)) return;
  const { action, targetOutlet, remarks } = req.body || {};

  const validActions = ['sendToEnamelsDelivery', 'sendToOutlet', 'customerTakeDeliver', 'sendToDispatch'];
  if (!validActions.includes(action)) {
    return res.status(400).json({ message: `Invalid action. Valid: ${validActions.join(', ')}` });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { stages: true }
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.source !== 'OUTLET') return res.status(400).json({ message: 'Only outlet orders can be routed' });

    const currentStage = order.stages.find(s =>
      ['PENDING', 'IN_PROGRESS'].includes(s.status) &&
      s.stageName === 'IN_DISPATCH'
    );
    if (!currentStage) return res.status(400).json({ message: 'No active In Dispatch stage found for routing' });

    const actionStageMap = {
      sendToEnamelsDelivery: 'ENAMELS_DELIVERY',
      sendToOutlet: 'OUTLET_RECEIVE',
      sendToDispatch: 'DISPATCH',
      customerTakeDeliver: null
    };
    const destinationStage = actionStageMap[action];
    const outletName = 'Johar Town';

    // Complete current In Dispatch stage
    await prisma.orderStage.update({
      where: { id: currentStage.id },
      data: { status: 'COMPLETED', completedAt: new Date() }
    });

    if (action === 'customerTakeDeliver') {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          currentStage: 'ORDER_ENTRY',
          status: 'COMPLETED',
          customerTakenAt: new Date(),
          orderTakenBy: req.user?.name || 'Outlet Staff',
          deliveredAt: new Date()
        }
      });

      await createAuditLog(order.id, 'CUSTOMER_TAKEN',
        `Customer taken from In Dispatch by ${outletName}`,
        req.user?.id || 'SYSTEM');
      await syncReplacementCaseOnOrderCompletion(order);

      await prisma.routingHistory.create({
        data: {
          orderId: order.id, sentByUserId: req.user?.id || null,
          previousStage: 'IN_DISPATCH', newStage: 'DELIVERED',
          sentToStage: 'DELIVERED',
          remarks: remarks || 'Customer picked up order (In Dispatch)'
        }
      });

      await notify.create(req, {
        type: 'order_completed', moduleName: 'Orders', path: '/orders',
        role: 'FAISAL', title: 'Order Completed',
        message: `Order #${order.orderNumber} taken by customer`,
        orderId: order.id, orderNumber: order.orderNumber,
        customerName: order.customerName, action: 'Customer Taken',
        employeeName: req.user?.name
      }).catch(() => {});

      const io = req.app?.get('io');
      if (io) io.emit('order-updated', { orderId: order.id });

      return res.json({ message: 'Order completed: Customer Take & Deliver', nextStage: 'DELIVERED' });
    }

    // Target outlet validation for sendToOutlet
    let targetOutletName = null;
    if (action === 'sendToOutlet') {
      const target = (targetOutlet || 'Jail Road').trim();
      if (!target) return res.status(400).json({ message: 'Target outlet is required' });
      targetOutletName = target;
    }

    // Create destination stage
    const durations = await require('./order-helpers').getStageDurations?.() || {};
    const deadline = new Date(Date.now() + ((durations[destinationStage] || 48) * 60 * 60 * 1000));
    await prisma.orderStage.create({
      data: { orderId: order.id, stageName: destinationStage, status: 'PENDING', deadlineAt: deadline }
    });

    const orderUpdateData = { currentStage: destinationStage, status: 'PENDING' };
    if (destinationStage === 'ENAMELS_DELIVERY') {
      orderUpdateData.deliveryType = 'ENAMELS';
      orderUpdateData.deliveryMethod = 'Enamels Delivery';
    } else if (destinationStage === 'DISPATCH') {
      orderUpdateData.dispatchOfficer = null;
      orderUpdateData.dispatchStatus = 'PENDING';
    }
    await prisma.order.update({
      where: { id: order.id },
      data: orderUpdateData
    });

    // Record delivery assignment for Gate Pass
    const deliveryBoyNames = {
      sendToEnamelsDelivery: 'Enamels Delivery',
      sendToDispatch: 'Dispatch Courier',
      customerTakeDeliver: 'Customer Pickup',
      sendToOutlet: `Outlet → ${targetOutletName || 'Other'}`,
    };
    recordAssignment({ orderId: order.id, deliveryBoyName: deliveryBoyNames[action] || action, routedBy: req.user?.name, outletName: order.outletName }).catch(() => {});

    // Recipient users
    const roles = destinationStage === 'ENAMELS_DELIVERY' ? ['DELIVERY_BOY'] : (destinationStage === 'DISPATCH' ? ['DISPATCH', 'STORE_EMPLOYEE'] : ['OUTLET']);
    const whereUsers = { role: { in: roles } };
    if (destinationStage === 'OUTLET_RECEIVE' && targetOutletName) {
      const searchName = String(targetOutletName).replace(/\s*Outlet\s*$/i, '').trim();
      whereUsers.name = { contains: searchName, mode: 'insensitive' };
    }
    const recipientUsers = await prisma.user.findMany({
      where: whereUsers,
      select: { id: true }
    });

    await prisma.routingHistory.create({
      data: {
        orderId: order.id, sentByUserId: req.user?.id,
        sentToStage: destinationStage,
        sentToUserIds: JSON.stringify(recipientUsers.map(u => u.id)),
        previousStage: 'IN_DISPATCH',
        newStage: destinationStage,
        remarks: remarks || `Routed from In Dispatch to ${destinationStage}${targetOutletName ? ` (${targetOutletName})` : ''}`,
        createdAt: new Date()
      }
    });

    await prisma.seenTask.deleteMany({
      where: { userId: { in: recipientUsers.map(u => u.id) }, orderId: order.id, stageName: destinationStage }
    }).catch(() => {});

    await createAuditLog(order.id, 'IN_DISPATCH_ROUTED',
      `Routed from In Dispatch to ${destinationStage}${targetOutletName ? ` (${targetOutletName})` : ''} by ${req.user?.name}`,
      req.user?.id || 'SYSTEM');

    const io = req.app?.get('io');
    if (io) io.emit('order-updated', { orderId: order.id });

    const destRole = destinationStage === 'ENAMELS_DELIVERY' ? 'DELIVERY_BOY' : 'OUTLET';
    await notify.create(req, {
      type: 'manual_route', moduleName: 'My Tasks', path: '/tasks',
      role: destRole, title: 'Order Routed',
      message: `Order #${order.orderNumber} routed to ${destinationStage}${targetOutletName ? ` (${targetOutletName})` : ''}`,
      orderId: order.id, orderNumber: order.orderNumber,
      customerName: order.customerName,
      action: `Routed → ${destinationStage.replace(/_/g, ' ')}${targetOutletName ? ` (${targetOutletName})` : ''}`,
      employeeName: req.user?.name
    }).catch(() => {});

    res.json({ message: `Order routed to ${destinationStage}`, nextStage: destinationStage });
  } catch (error) {
    console.error('in-dispatch routeOrder error:', error);
    res.status(500).json({ message: 'Error routing In Dispatch order', error: error.message });
  }
};

// POST /api/in-dispatch/orders/:id/clear-balance
// Collect the remaining balance at dispatch time. The order number (or legacy
// orderId FK) links the POS sale; the payment is recorded as a PosBalancePayment
// exactly like the POS "Pay Remaining Balance" flow, so the POS Dashboard balance
// section clears automatically. Safe-guards mirror pos.controller payBalance.
const clearBalance = async (req, res) => {
  if (!requireJoharTown(req, res)) return;
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      select: { id: true, orderNumber: true, customerName: true }
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const posSale = await prisma.posSale.findFirst({
      where: {
        OR: [
          { orderId: order.id },
          ...(order.orderNumber ? [{ orderNumber: order.orderNumber }] : [])
        ]
      },
      include: { balancePayments: { select: { amountPaidNow: true } } }
    });
    if (!posSale) {
      return res.status(400).json({ message: 'No linked POS sale found for this order — balance cannot be cleared. The POS sale must use the same Order Number.' });
    }
    if (posSale.faisalTake) return res.status(400).json({ message: 'Cannot clear balance on Faisal Take' });

    const { amountPaidNow, paymentMethod, cashAmount: cashSplit, onlineAmount: onlineSplit } = req.body || {};

    if (!amountPaidNow || amountPaidNow <= 0) return res.status(400).json({ message: 'Amount must be greater than 0' });
    if (paymentMethod === 'CASH_ONLINE') {
      const total = (cashSplit || 0) + (onlineSplit || 0);
      if (Math.abs(total - amountPaidNow) > 0.01) {
        return res.status(400).json({ message: `Cash (${cashSplit || 0}) + Online (${onlineSplit || 0}) must equal total amount (${amountPaidNow})` });
      }
    }

    const totalPaidFromPayments = posSale.balancePayments.reduce((sum, bp) => sum + bp.amountPaidNow, 0);
    const totalPaid = posSale.advanceAmount + totalPaidFromPayments;
    const remaining = posSale.grandTotal - totalPaid;

    if (remaining <= 0.01) return res.status(400).json({ message: 'Invoice is already fully paid' });
    if (amountPaidNow > remaining + 0.01) return res.status(400).json({ message: `Amount exceeds remaining balance of ₨${remaining.toFixed(2)}` });

    const receiptNumber = await generateBalanceReceiptNumber();
    const outstandingAfter = Math.max(0, remaining - amountPaidNow);

    const payment = await prisma.posBalancePayment.create({
      data: {
        posSaleId: posSale.id,
        receiptNumber,
        originalInvoiceNumber: posSale.receiptNumber,
        originalInvoiceTotal: posSale.grandTotal,
        previouslyPaidAmount: totalPaid,
        remainingBalanceBeforePayment: remaining,
        amountPaidNow,
        outstandingBalanceAfterPayment: outstandingAfter,
        paymentMethod: paymentMethod || 'CASH',
        cashAmount: paymentMethod === 'CASH_ONLINE' ? (cashSplit || 0) : (paymentMethod === 'CASH' ? amountPaidNow : 0),
        onlineAmount: paymentMethod === 'CASH_ONLINE' ? (onlineSplit || 0) : (paymentMethod === 'ONLINE' ? amountPaidNow : 0),
        cashierName: req.user?.name || 'Outlet Staff',
        paidAt: new Date()
      }
    });

    await createAuditLog(order.id, 'BALANCE_CLEARED',
      `Balance cleared on In Dispatch — ${paymentMethod || 'CASH'} ₨${amountPaidNow}${receiptNumber ? ` (${receiptNumber})` : ''} by ${req.user?.name}`,
      req.user?.id || 'SYSTEM');

    // Invalidate POS caches so the Dashboard balance section reflects immediately.
    cache.delPattern('pos:');
    const io = req.app?.get('io');
    if (io) io.emit('inventory-updated', { source: 'in-dispatch', outletName: 'Johar Town', balancePayment: true });

    res.status(201).json(payment);
  } catch (error) {
    console.error('in-dispatch clearBalance error:', error);
    res.status(500).json({ message: 'Error clearing balance', error: error.message });
  }
};

module.exports = {
  getInDispatchOrders,
  getRoutes,
  createRoute,
  completeRoute,
  cancelRoute,
  routeOrder,
  clearBalance
};
