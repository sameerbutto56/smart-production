const prisma = require('../prisma');
const cache = require('../utils/cache');
const notify = require('../utils/notify');
const { calculateDeadline } = require('../utils/deadline');
const { classifyOrderItems, DISPATCH_RESET_FIELDS, ensureSingleActiveDispatchStage } = require('./order-helpers');
const { deductInventoryItems, getRolesForStage } = require('./order.controller');
const { getPendingAudit } = require('../utils/auditLock');

// Destinations a Store user can route a replacement order to once the new
// replacement goods are processed (availability ticks + in-stock deduction).
const REPLACEMENT_ROUTES = ['PRODUCTION_ACCEPTANCE', 'PRODUCTION', 'LOGO_DESIGN', 'WORKERS', 'DISPATCH'];

// A replacement counts as genuinely "in flight" only while its replacement
// ORDER (the instance) still has a live task. The original order's own status
// or its earlier passage through Store never counts — only the replacement
// instance's active task does. A missing/deleted REP order, or one that has
// reached a terminal state, is never an active task and must not block a fresh
// replacement from being created or sent to Store.
const REP_ORDER_TERMINAL_STATUSES = ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED'];
const isReplacementInFlight = async (caseRecord) => {
  if (!caseRecord || !caseRecord.replacementOrderId) return false;
  const repOrder = await prisma.order.findUnique({
    where: { id: caseRecord.replacementOrderId },
    select: { id: true, currentStage: true, status: true }
  });
  if (!repOrder) return false;
  const terminal = REP_ORDER_TERMINAL_STATUSES.includes(repOrder.status)
    || REP_ORDER_TERMINAL_STATUSES.includes(repOrder.currentStage);
  return !terminal;
};

const lookupOrder = async (req, res) => {
  try {
    const { query } = req.params;
    const q = String(query || '').trim();
    if (!q) return res.status(400).json({ message: 'Search query is required' });

    const include = {
      stages: { orderBy: { createdAt: 'asc' } },
      deliveryAttempts: { orderBy: { attemptNumber: 'desc' } },
      noResponseLogs: { orderBy: { createdAt: 'desc' } },
      deliveryPayments: { orderBy: { createdAt: 'desc' } },
      returnExchangeCases: { orderBy: { createdAt: 'desc' } }
    };

    let order = null;
    if (/^REP-/i.test(q)) {
      // Searching a replacement number → find the replacement order directly
      order = await prisma.order.findFirst({
        where: { source: 'REPLACEMENT', orderNumber: { equals: q, mode: 'insensitive' } },
        include
      });
    } else {
      // Original number / invoice / phone → prefer the original row (created
      // earliest) over any REP-<original> variant sharing the same tail.
      order = await prisma.order.findFirst({
        where: {
          OR: [
            { orderNumber: { equals: q, mode: 'insensitive' } },
            { orderNumber: { endsWith: q, mode: 'insensitive' } },
            { invoiceNumber: { equals: q, mode: 'insensitive' } },
            { invoiceNumber: { endsWith: q, mode: 'insensitive' } },
            { customerPhone: { contains: q } }
          ]
        },
        orderBy: { createdAt: 'asc' },
        include
      });
    }
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // A replacement order is a lifecycle/version of the original — searching
    // `49502` OR `REP-49502` must open the SAME underlying order (original
    // details/payment + its replacement cases), never a detached duplicate.
    if (order.replacementCaseId) {
      const repCase = await prisma.returnExchange.findUnique({ where: { id: order.replacementCaseId } });
      if (repCase) {
        const original = await prisma.order.findUnique({ where: { id: repCase.orderId }, include });
        if (original) {
          res.json({
            ...original,
            isReplacementMatch: true,
            matchedReplacement: { id: repCase.id, orderNumber: order.orderNumber, status: repCase.status, replacementOrderId: order.id }
          });
          return;
        }
      }
    }
    res.json(order);
  } catch (error) {
    console.error('Error looking up order:', error);
    res.status(500).json({ message: 'Failed to look up order', error: error.message });
  }
};

const createReturnExchange = async (req, res) => {
  try {
    const { orderId, type, returnReason, replacementItems, notes, specialNote } = req.body;
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // REPLACEMENT requires a mandatory Reason
    if (type === 'REPLACEMENT' && !(returnReason || '').trim()) {
      return res.status(400).json({ message: 'A replacement reason is required.' });
    }

    // Prevent duplicate ACTIVE replacement cases for the same order. The guard
    // is keyed on the REPLACEMENT INSTANCE's live task, never on the original
    // order's status or Store history. Only (a) a sibling still awaiting Faisal
    // review, or (b) a sibling whose replacement ORDER is still genuinely in
    // flight, blocks a fresh replacement — so a replacement whose REP order was
    // completed/cancelled/deleted can never wedge the original forever.
    if (type === 'REPLACEMENT') {
      const siblings = await prisma.returnExchange.findMany({
        where: { orderId, type: 'REPLACEMENT' },
        orderBy: { createdAt: 'desc' }
      });
      for (const sib of siblings) {
        if (sib.routedTo === 'FAISAL' && sib.status === 'PENDING' && !sib.replacementOrderId) {
          return res.status(409).json({
            message: 'This order already has a replacement awaiting your review. Open that case instead of creating a new one.',
            existingCase: sib
          });
        }
        if (sib.replacementOrderId && await isReplacementInFlight(sib)) {
          return res.status(409).json({
            message: 'A replacement for this order is already being processed. It will not be duplicated.',
            existingCase: sib
          });
        }
      }
    }

    // Prevent duplicate ACTIVE return cases for the same order.
    if (type === 'RETURN') {
      const activeReturns = await prisma.returnExchange.findMany({
        where: {
          orderId,
          type: 'RETURN',
          status: { notIn: ['COMPLETED', 'CANCELLED'] }
        },
        orderBy: { createdAt: 'desc' }
      });
      if (activeReturns.length > 0) {
        return res.status(409).json({
          message: 'This order already has an active return case. Process the existing return instead of creating a new one.',
          existingCase: activeReturns[0]
        });
      }

      // Also block if a COMPLETED return already exists for this order
      const completedReturn = await prisma.returnExchange.findFirst({
        where: { orderId, type: 'RETURN', status: 'COMPLETED' },
        orderBy: { updatedAt: 'desc' }
      });
      if (completedReturn) {
        return res.status(409).json({
          message: 'Return Already Completed — this order has already been returned and the return workflow has been completed.',
          existingCase: completedReturn
        });
      }
    }

    // RETURN → Store takes over; REPLACEMENT → Faisal reviews first, then Store
    const routedTo = type === 'REPLACEMENT' ? 'FAISAL' : 'STORE';
    const initialStatus = type === 'REPLACEMENT' ? 'PENDING' : 'PENDING';

    const record = await prisma.returnExchange.create({
      data: {
        orderId,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        type,
        status: initialStatus,
        routedTo,
        returnReason,
        specialNote: type === 'REPLACEMENT' ? specialNote : null,
        originalProducts: order.productDetails,
        replacementItems: replacementItems ? JSON.stringify(replacementItems) : null,
        deliveryAttempts: order.noResponseCount || 0,
        nextDeliveryDate: order.nextDeliveryDate,
        handledBy: req.user?.name || null,
        handledById: req.user?.id || null
      }
    });

    if (type === 'RETURN') {
      await prisma.order.update({
        where: { id: orderId },
        data: { refundStatus: 'REQUESTED', refundReason: returnReason || 'Return initiated by Inventory View' }
      });
    }

    // When creating a REPLACEMENT, close any existing ACCEPTED RETURN case
    // so the Return & Exchange page does not keep showing action buttons.
    if (type === 'REPLACEMENT') {
      await prisma.returnExchange.updateMany({
        where: { orderId, type: 'RETURN', status: 'ACCEPTED' },
        data: { status: 'COMPLETED', handledBy: req.user?.name || null }
      });
    }

    await prisma.auditLog.create({
      data: {
        orderId,
        action: type === 'RETURN' ? 'RETURN_INITIATED' : type === 'REPLACEMENT' ? 'REPLACEMENT_INITIATED' : 'NO_RESPONSE_LOGGED',
        details: `${type} initiated by ${req.user?.name || 'Inventory View'}${type === 'REPLACEMENT' && specialNote ? `. Special Note: ${specialNote}` : ''}. Reason: ${returnReason || 'N/A'}`,
        performedBy: req.user?.id || 'SYSTEM'
      }
    });

    await notify.create(req, {
      type: 'return_exchange',
      moduleName: routedTo === 'FAISAL' ? 'Replacements' : 'Returns',
      path: routedTo === 'FAISAL' ? '/replacements' : '/returns',
      role: routedTo === 'FAISAL' ? 'FAISAL' : 'STORE',
      title: 'New Return/Exchange Request',
      message: `${type} request for ${order?.customerName || 'customer'}`,
      orderId: order?.id,
      customerName: order?.customerName,
      action: `${type} Requested`,
      employeeName: req.user?.name
    }).catch(() => {});

    res.status(201).json(record);
  } catch (error) {
    console.error('Error creating return/exchange:', error);
    res.status(500).json({ message: 'Failed to create record', error: error.message });
  }
};

// Faisal reviews a REPLACEMENT (with its mandatory special note) → routes to Store
const approveFaisal = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body;
    const record = await prisma.returnExchange.findUnique({ where: { id } });
    if (!record) return res.status(404).json({ message: 'Record not found' });
    if (record.type !== 'REPLACEMENT') return res.status(400).json({ message: 'Only replacement cases are reviewed by Faisal' });
    if (record.routedTo !== 'FAISAL') return res.status(400).json({ message: 'This case is not awaiting Faisal review' });

    if (action === 'REJECT') {
      const updated = await prisma.$transaction(async (tx) => {
        await tx.returnExchange.update({
          where: { id },
          data: { status: 'CANCELLED', routedTo: 'FAISAL', faisalApprovedBy: req.user?.name, faisalApprovedAt: new Date() }
        });
        await tx.auditLog.create({
          data: {
            orderId: record.orderId,
            action: 'REPLACEMENT_FAISAL_REJECTED',
            details: `Faisal rejected replacement for ${record.orderNumber}. Notes: ${notes || 'N/A'}`,
          performedBy: req.user?.id || null
          }
        });
        return tx.returnExchange.findUnique({ where: { id } });
      });
      res.json(updated);
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.returnExchange.update({
        where: { id },
        data: {
          status: 'FAISAL_APPROVED',
          routedTo: 'STORE',
          warehouseNotes: notes || null,
          faisalApprovedBy: req.user?.name || 'Faisal',
          faisalApprovedAt: new Date()
        }
      });
      await tx.auditLog.create({
        data: {
          orderId: record.orderId,
          action: 'REPLACEMENT_FAISAL_APPROVED',
          details: `Faisal approved replacement for ${record.orderNumber}. Notes: ${notes || 'N/A'}. Now with Store.`,
          performedBy: req.user?.id || 'SYSTEM'
        }
      });
      return tx.returnExchange.findUnique({ where: { id } });
    });

    await notify.create(req, { type: 'return_exchange', moduleName: 'Returns', path: '/returns', role: 'STORE', title: 'Replacement Approved by Faisal', message: `Replacement for ${record.customerName || 'customer'} approved — ready for Store processing`, orderId: record.orderId, customerName: record.customerName, action: 'Faisal → Store', employeeName: req.user?.name }).catch(() => {});
    res.json(updated);
  } catch (error) {
    console.error('Error in Faisal approval:', error);
    res.status(500).json({ message: 'Failed to process', error: error.message });
  }
};

// Store processes a RETURN (restock returned goods) or REPLACEMENT (deduct new items or route to Production)
const processByStore = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, productAvailability, notes } = req.body;
    const record = await prisma.returnExchange.findUnique({ where: { id } });
    if (!record) return res.status(404).json({ message: 'Record not found' });
    if (record.routedTo !== 'STORE') return res.status(400).json({ message: 'This case is not with the Store' });
    if (!record.storeAcceptedAt) return res.status(400).json({ message: 'This case must be accepted by the Store first' });

    // Validate per-type actions
    if (record.type === 'RETURN' && !['restock', 'route_to_production'].includes(action)) {
      return res.status(400).json({ message: 'Return can be restocked into inventory or routed to Production' });
    }
    if (record.type === 'REPLACEMENT' && !['deduct', 'route_to_production'].includes(action)) {
      return res.status(400).json({ message: 'Replacement can be deducted from stock or routed to Production' });
    }

    let newStatus;
    let actionLabel = record.type === 'RETURN' ? 'RETURN_STORE_PROCESSED' : 'REPLACEMENT_STORE_PROCESSED';
    let actionDetail = '';

    if (action === 'restock') {
      newStatus = 'RESTOCKED';
      // Add original returned goods back into inventory
      const originals = typeof record.originalProducts === 'string' ? JSON.parse(record.originalProducts) : (record.originalProducts || []);
      for (const item of originals) {
        const pd = item.productDetails || item;
        const name = pd.name || pd.productType || '';
        if (!name) continue;
        const invItems = await prisma.inventoryItem.findMany({ where: { name: { contains: name, mode: 'insensitive' } } });
        for (const inv of invItems) {
          const variants = inv.variants || [];
          const color = pd.color || '';
          const size = pd.size || '';
          const updatedVariants = variants.map(v => {
            const colorMatch = color ? v.color === color : true;
            const sizeMatch = size ? v.size === size : true;
            if (colorMatch && sizeMatch) {
              return { ...v, stock: (v.stock || 0) + (item.quantity || 1) };
            }
            return v;
          });
          const newTotal = updatedVariants.reduce((s, v) => s + (v.stock || 0), 0);
          await prisma.inventoryItem.update({
            where: { id: inv.id },
            data: { variants: updatedVariants, stock: newTotal }
          });
        }
      }
      actionDetail = `Returned goods restocked into inventory by ${req.user?.name || 'Store'}.`;
    } else if (action === 'deduct') {
      // Deduct replacement items from inventory (availability-checked per item)
      const replacements = typeof record.replacementItems === 'string' ? JSON.parse(record.replacementItems) : (record.replacementItems || []);
      for (const item of replacements) {
        const name = item.name || item.productName || '';
        if (!name) continue;
        const invItems = await prisma.inventoryItem.findMany({ where: { name: { contains: name, mode: 'insensitive' } } });
        for (const inv of invItems) {
          const variants = inv.variants || [];
          const color = item.color || '';
          const size = item.size || '';
          const updatedVariants = variants.map(v => {
            const colorMatch = color ? v.color === color : true;
            const sizeMatch = size ? v.size === size : true;
            if (colorMatch && sizeMatch) {
              return { ...v, stock: Math.max(0, (v.stock || 0) - (item.quantity || 1)) };
            }
            return v;
          });
          const newTotal = updatedVariants.reduce((s, v) => s + (v.stock || 0), 0);
          await prisma.inventoryItem.update({
            where: { id: inv.id },
            data: { variants: updatedVariants, stock: newTotal }
          });
        }
      }
      newStatus = 'DISPATCH_READY'; // existing dispatch flow completes fulfilment
      actionDetail = `Replacement items deducted from inventory by ${req.user?.name || 'Store'} — ready for dispatch.`;
    } else if (action === 'route_to_production') {
      newStatus = 'ROUTED_TO_PRODUCTION';
      actionLabel = record.type === 'RETURN' ? 'RETURN_ROUTED_TO_PRODUCTION' : 'REPLACEMENT_ROUTED_TO_PRODUCTION';
      actionDetail = `${record.type} for ${record.orderNumber} routed to Production by ${req.user?.name || 'Store'}${notes ? `. Notes: ${notes}` : ''}.`;
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.returnExchange.update({
        where: { id },
        data: {
          status: newStatus,
          routedTo: 'STORE',
          storeProcessedBy: req.user?.name || 'Store',
          storeProcessedById: req.user?.id || null,
          storeProcessedAt: new Date(),
          inventoryAdjusted: action !== 'route_to_production',
          productionRouted: action === 'route_to_production',
          productionRoutedAt: action === 'route_to_production' ? new Date() : null,
          warehouseNotes: notes || record.warehouseNotes
        }
      });
      await tx.auditLog.create({
        data: {
          orderId: record.orderId,
          action: actionLabel,
          details: actionDetail,
          performedBy: req.user?.id || 'SYSTEM'
        }
      });
      return tx.returnExchange.findUnique({ where: { id } });
    });

    if (action === 'restock' || action === 'deduct') {
      try { cache.delPattern('pos:inventory:'); cache.delPattern('warehouse:'); cache.delPattern('products:'); } catch (e) { console.error('processByStore cache invalidation error:', e); }
    }

    const io = req.app?.get('io');
    if (io) io.emit('order-updated', { orderId: record.orderId });
    if (io) io.emit('return-exchange-updated', { caseId: id });
    if (io && (action === 'restock' || action === 'deduct')) {
      io.emit('inventory-updated', { source: 'return-exchange-process', action, orderNumber: record.orderNumber });
    }

    if (action === 'route_to_production') {
      await notify.create(req, { type: 'return_exchange', moduleName: 'My Tasks', path: '/tasks', role: 'PRODUCTION', title: 'New Return/Replacement in Production', message: `${record.type} for ${record.customerName || 'customer'} routed to Production`, orderId: record.orderId, customerName: record.customerName, action: '→ Production', employeeName: req.user?.name }).catch(() => {});
    }

    res.json(updated);
  } catch (error) {
    console.error('Error processing by Store:', error);
    res.status(500).json({ message: 'Failed to process', error: error.message });
  }
};

// POST /api/return-exchange/:id/complete-return
// Final step of the strict Store return-completion workflow. A Store-routed
// return must first be accepted (storeAccept) and then restocked (processByStore
// action 'restock' → status RESTOCKED) before it may be completed here. This
// handler is the ONLY way a return reaches COMPLETED — processByStore no longer
// completes returns. Guards: must be a RETURN with the Store, already restocked
// (status RESTOCKED), and never completed. Idempotent re-submits are blocked.
const completeReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await prisma.returnExchange.findUnique({ where: { id } });
    if (!record) return res.status(404).json({ message: 'Record not found' });
    if (record.type !== 'RETURN') return res.status(400).json({ message: 'Only Return cases can be completed here' });
    if (record.routedTo !== 'STORE') return res.status(400).json({ message: 'This return is not with the Store' });
    if (record.status !== 'RESTOCKED') {
      return res.status(400).json({ message: record.status === 'COMPLETED' ? 'This return has already been completed' : 'Returned goods must be restocked into inventory before completing' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.returnExchange.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedBy: req.user?.name || 'Store',
          completedAt: new Date()
        }
      });
      await tx.auditLog.create({
        data: {
          orderId: record.orderId,
          action: 'RETURN_COMPLETED',
          details: `Return for ${record.orderNumber || ''} completed by ${req.user?.name || 'Store'} — returned goods restocked into inventory. Completed: ${new Date().toLocaleString()}.`,
          performedBy: req.user?.id || 'SYSTEM'
        }
      });
      return tx.returnExchange.findUnique({ where: { id } });
    });

    const io = req.app?.get('io');
    if (io) io.emit('return-exchange-updated', { caseId: id });
    if (io) io.emit('order-updated', { orderId: record.orderId });

    res.json(updated);
  } catch (error) {
    console.error('Error completing return at Store:', error);
    res.status(500).json({ message: 'Failed to complete return', error: error.message });
  }
};

// POST /api/return-exchange/:id/store-accept
// Accept-first step for Store Returns/Replacements: records the accepting Store
// employee + date/time, moves the case from pending (PENDING / FAISAL_APPROVED)
// to ACCEPTED. Processing (restock / deduct / route) stays blocked until accepted.
const storeAccept = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await prisma.returnExchange.findUnique({ where: { id } });
    if (!record) return res.status(404).json({ message: 'Record not found' });
    if (record.routedTo !== 'STORE') return res.status(400).json({ message: 'This case is not with the Store' });
    if (record.storeAcceptedAt) return res.status(400).json({ message: 'This case has already been accepted by the Store' });
    if (!['RETURN', 'REPLACEMENT'].includes(record.type)) return res.status(400).json({ message: 'Only Return and Replacement cases can be accepted by the Store' });

    const actionLabel = record.type === 'RETURN' ? 'RETURN_STORE_ACCEPTED' : 'REPLACEMENT_STORE_ACCEPTED';
    const updated = await prisma.$transaction(async (tx) => {
      await tx.returnExchange.update({
        where: { id },
        data: {
          status: 'ACCEPTED',
          storeAcceptedBy: req.user?.name || 'Store',
          storeAcceptedById: req.user?.id || null,
          storeAcceptedAt: new Date()
        }
      });
      await tx.auditLog.create({
        data: {
          orderId: record.orderId,
          action: actionLabel,
          details: `${record.type} for ${record.orderNumber || ''} accepted by ${req.user?.name || 'Store'} — current phase: Store (Accepted). Performed: ${new Date().toLocaleString()}.`,
          performedBy: req.user?.id || 'SYSTEM'
        }
      });
      return tx.returnExchange.findUnique({ where: { id } });
    });

    const io = req.app?.get('io');
    if (io) io.emit('return-exchange-updated', { caseId: id });

    res.json(updated);
  } catch (error) {
    console.error('Error accepting case at Store:', error);
    res.status(500).json({ message: 'Failed to accept', error: error.message });
  }
};

const rescheduleDelivery = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { notes } = req.body;
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const attempt = (order.noResponseCount || 0) + 1;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          noResponseCount: attempt,
          nextDeliveryDate: tomorrow,
          lastDeliveryAttempt: new Date(),
          dispatchStatus: attempt >= 3 ? 'FAILED' : 'RESCHEDULED',
          status: attempt >= 3 ? 'MAX_ATTEMPTS_REACHED' : order.status
        }
      });

      await tx.noResponseLog.create({
        data: { orderId, attemptNumber: attempt, markedBy: req.user?.name || 'Inventory View', notes }
      });

      await tx.deliveryAttempt.create({
        data: {
          orderId, attemptNumber: attempt, status: 'NO_RESPONSE',
          riderName: order.dispatchOfficer || null,
          notes: notes || `Rescheduled by Inventory View - attempt ${attempt}`,
          rescheduledTo: tomorrow
        }
      });

      if (attempt >= 3) {
        await tx.returnExchange.create({
          data: {
            orderId,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            type: 'RETURN',
            status: 'PENDING',
            returnReason: 'Auto-moved after 3 failed delivery attempts',
            originalProducts: order.productDetails,
            deliveryAttempts: attempt,
            nextDeliveryDate: null,
            handledBy: req.user?.name || 'System (auto)',
            handledById: req.user?.id || null
          }
        });

        await tx.order.update({
          where: { id: orderId },
          data: { refundStatus: 'REQUESTED', refundReason: 'Auto-return after 3 failed delivery attempts' }
        });
      }

      await tx.auditLog.create({
        data: {
          orderId,
          action: attempt >= 3 ? 'AUTO_RETURN_AFTER_3_ATTEMPTS' : 'DELIVERY_RESCHEDULED',
          details: attempt >= 3
            ? `Auto-moved to Return after 3 failed attempts`
            : `Rescheduled for next day. Attempt ${attempt}/3. Notes: ${notes || 'N/A'}`,
          performedBy: req.user?.id || 'SYSTEM'
        }
      });

      return tx.order.findUnique({
        where: { id: orderId },
        include: { stages: { orderBy: { createdAt: 'asc' } }, deliveryAttempts: { orderBy: { attemptNumber: 'desc' } }, noResponseLogs: { orderBy: { createdAt: 'desc' } }, returnExchangeCases: { orderBy: { createdAt: 'desc' } } }
      });
    });

    res.json(updated);
  } catch (error) {
    console.error('Error rescheduling delivery:', error);
    res.status(500).json({ message: 'Failed to reschedule', error: error.message });
  }
};

const approveWarehouse = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, warehouseNotes } = req.body;
    const record = await prisma.returnExchange.findUnique({ where: { id } });
    if (!record) return res.status(404).json({ message: 'Record not found' });

    const newStatus = action === 'APPROVE' ? 'WAREHOUSE_APPROVED' : 'WAREHOUSE_REJECTED';

    // For REPLACEMENT, check stock availability before approving
    if (action === 'APPROVE' && record.type === 'REPLACEMENT') {
      const replacements = typeof record.replacementItems === 'string' ? JSON.parse(record.replacementItems) : (record.replacementItems || []);
      if (Array.isArray(replacements) && replacements.length > 0) {
        for (const item of replacements) {
          const name = item.name || item.productName || '';
          if (!name) continue;
          const invItems = await prisma.inventoryItem.findMany({ where: { name: { contains: name, mode: 'insensitive' } } });
          let found = false;
          for (const inv of invItems) {
            const variants = inv.variants || [];
            const color = item.color || '';
            const size = item.size || '';
            const matchVariant = variants.find(v => {
              const colorMatch = color ? v.color === color : true;
              const sizeMatch = size ? v.size === size : true;
              return colorMatch && sizeMatch;
            });
            if (matchVariant && (matchVariant.stock || 0) >= (item.quantity || 1)) {
              found = true;
              break;
            }
          }
          if (!found) {
            return res.status(400).json({
              message: `"${name}" (${item.color || 'any color'}, ${item.size || 'any size'}) is not available in warehouse inventory.`,
              product: name
            });
          }
        }
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Update status
      const statusData = {
        status: newStatus,
        warehouseNotes,
        warehouseApprovedBy: req.user?.name || 'Warehouse',
        warehouseApprovedAt: new Date()
      };
      await tx.returnExchange.update({ where: { id }, data: statusData });

      if (action === 'APPROVE') {
        const order = await tx.order.findUnique({ where: { id: record.orderId } });

        // Step 1: Add original products back to warehouse inventory (RETURN + REPLACEMENT)
        const originals = typeof record.originalProducts === 'string' ? JSON.parse(record.originalProducts) : (record.originalProducts || []);
        for (const item of originals) {
          const pd = item.productDetails || item;
          const name = pd.name || pd.productType || '';
          if (!name) continue;
          const invItems = await tx.inventoryItem.findMany({ where: { name: { contains: name, mode: 'insensitive' } } });
          for (const inv of invItems) {
            const variants = inv.variants || [];
            const color = pd.color || '';
            const size = pd.size || '';
            const updatedVariants = variants.map(v => {
              const colorMatch = color ? v.color === color : true;
              const sizeMatch = size ? v.size === size : true;
              if (colorMatch && sizeMatch) {
                return { ...v, stock: (v.stock || 0) + (item.quantity || 1) };
              }
              return v;
            });
            const newTotal = updatedVariants.reduce((s, v) => s + (v.stock || 0), 0);
            await tx.inventoryItem.update({
              where: { id: inv.id },
              data: { variants: updatedVariants, totalStock: newTotal }
            });
          }
        }

        // Step 2: For REPLACEMENT, deduct new items from warehouse inventory
        if (record.type === 'REPLACEMENT') {
          const replacements = typeof record.replacementItems === 'string' ? JSON.parse(record.replacementItems) : (record.replacementItems || []);
          for (const item of replacements) {
            const name = item.name || item.productName || '';
            if (!name) continue;
            const invItems = await tx.inventoryItem.findMany({ where: { name: { contains: name, mode: 'insensitive' } } });
            for (const inv of invItems) {
              const variants = inv.variants || [];
              const color = item.color || '';
              const size = item.size || '';
              const updatedVariants = variants.map(v => {
                const colorMatch = color ? v.color === color : true;
                const sizeMatch = size ? v.size === size : true;
                if (colorMatch && sizeMatch) {
                  return { ...v, stock: Math.max(0, (v.stock || 0) - (item.quantity || 1)) };
                }
                return v;
              });
              const newTotal = updatedVariants.reduce((s, v) => s + (v.stock || 0), 0);
              await tx.inventoryItem.update({
                where: { id: inv.id },
                data: { variants: updatedVariants, totalStock: newTotal }
              });
            }
          }

          // Set to DISPATCH_READY so warehouse can dispatch
          await tx.returnExchange.update({
            where: { id },
            data: { status: 'DISPATCH_READY' }
          });
        }
      }

      await tx.auditLog.create({
        data: {
          orderId: record.orderId,
          action: action === 'APPROVE' ? 'WAREHOUSE_RETURN_APPROVED' : 'WAREHOUSE_RETURN_REJECTED',
          details: `Warehouse ${action === 'APPROVE' ? 'approved' : 'rejected'} ${record.type} for ${record.orderNumber}. Notes: ${warehouseNotes || 'N/A'}`,
          performedBy: req.user?.id || 'SYSTEM'
        }
      });

      return tx.returnExchange.findUnique({ where: { id } });
    });

    await notify.create(req, { type: 'return_exchange', moduleName: 'Return & Exchange', path: '/return-exchange', role: 'INVENTORY_VIEW', title: 'Return/Exchange Processed', message: `Request #${record.id} ${newStatus}`, action: `${newStatus}`, employeeName: req.user?.name }).catch(() => {});

    res.json(updated);
  } catch (error) {
    console.error('Error in warehouse approval:', error);
    res.status(500).json({ message: 'Failed to process', error: error.message });
  }
};

const dispatchReplacement = async (req, res) => {
  try {
    const { id } = req.params;
    const { dispatchNotes } = req.body;
    const record = await prisma.returnExchange.findUnique({ where: { id } });
    if (!record) return res.status(404).json({ message: 'Record not found' });
    if (record.status !== 'DISPATCH_READY') return res.status(400).json({ message: 'Not ready for dispatch' });

    const updated = await prisma.$transaction(async (tx) => {
      await tx.returnExchange.update({
        where: { id },
        data: { status: 'COMPLETED', dispatchNotes, dispatchedAt: new Date() }
      });

      await tx.order.update({
        where: { id: record.orderId },
        data: { dispatchStatus: 'DISPATCHED' }
      });

      await tx.auditLog.create({
        data: {
          orderId: record.orderId,
          action: 'REPLACEMENT_DISPATCHED',
          details: `Replacement dispatched for ${record.orderNumber}. Notes: ${dispatchNotes || 'N/A'}`,
          performedBy: req.user?.id || 'SYSTEM'
        }
      });

      return tx.returnExchange.findUnique({ where: { id } });
    });

    res.json(updated);
  } catch (error) {
    console.error('Error dispatching replacement:', error);
    res.status(500).json({ message: 'Failed to dispatch', error: error.message });
  }
};

const getCaseHistory = async (req, res) => {
  try {
    const { orderId } = req.params;
    const cases = await prisma.returnExchange.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(cases);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ message: 'Failed to fetch history', error: error.message });
  }
};

// Faisal finalizes the replacement — creates a real replacement Order (source=REPLACEMENT)
// linked to this case at STORE stage, so it flows through the normal stage/routing machinery.
const sendToStore = async (req, res) => {
  try {
    const { id } = req.params;
    const { replacementItems, replacementSummary, notes, orderType } = req.body;
    const record = await prisma.returnExchange.findUnique({ where: { id } });
    if (!record) return res.status(404).json({ message: 'Record not found' });
    if (record.type !== 'REPLACEMENT') return res.status(400).json({ message: 'Only replacement cases can be sent to Store' });
    // Accept both the one-step flow (PENDING, still routed to FAISAL) and the
    // legacy two-step Approve → Send flow (status FAISAL_APPROVED, routed to
    // STORE, replacement order not yet created) — both must reach Store cleanly.
    const awaitingFaisal = record.routedTo === 'FAISAL';
    const approvedUnsent = record.routedTo === 'STORE' && record.status === 'FAISAL_APPROVED' && !record.replacementOrderId;
    if (!awaitingFaisal && !approvedUnsent) return res.status(400).json({ message: 'This case is not awaiting Faisal' });
    if (record.replacementOrderId) return res.status(400).json({ message: 'Replacement order already created for this case' });

    // Only a sibling whose replacement INSTANCE still has a live task blocks —
    // a different case of this order must not stop a fresh replacement merely
    // because the original previously passed through Store. A case whose REP
    // order was completed/cancelled/deleted is never in flight.
    const inFlightCase = await prisma.returnExchange.findFirst({
      where: {
        orderId: record.orderId,
        type: 'REPLACEMENT',
        replacementOrderId: { not: null },
        id: { not: id },
        status: { notIn: ['CANCELLED', 'COMPLETED', 'REPLACEMENT_COMPLETED', 'WAREHOUSE_REJECTED'] }
      }
    });
    if (inFlightCase && await isReplacementInFlight(inFlightCase)) {
      const inFlightOrder = inFlightCase.replacementOrderId
        ? await prisma.order.findUnique({ where: { id: inFlightCase.replacementOrderId }, select: { orderNumber: true } })
        : null;
      return res.status(409).json({ message: `A replacement order (${inFlightOrder?.orderNumber || 'REP-'}) is already in progress for this order. It will not be duplicated.` });
    }

    let items = replacementItems;
    if (!items || !Array.isArray(items) || items.length === 0) {
      try { items = JSON.parse(record.replacementItems || '[]'); } catch { items = []; }
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Replacement items are required before sending to Store' });
    }

    const originalOrder = await prisma.order.findUnique({ where: { id: record.orderId } });
    if (!originalOrder) return res.status(404).json({ message: 'Original order not found' });

    // Replacement order number is DERIVED from the ORIGINAL order number
    // (e.g. 49502 → REP-49502) so the replacement stays a visible lifecycle of
    // the same order — never an unrelated generated number. If a prior
    // replacement already exists on the same original, append a -2/-3 suffix.
    const baseOriginalNumber = String(record.orderNumber || originalOrder.orderNumber || '').replace(/^#/, '').trim();
    let replacementOrderNumber = '';
    if (baseOriginalNumber) {
      replacementOrderNumber = `REP-${baseOriginalNumber}`;
      let suffix = 2;
      while (await prisma.order.findUnique({ where: { orderNumber: replacementOrderNumber }, select: { id: true } })) {
        replacementOrderNumber = `REP-${baseOriginalNumber}-${suffix}`;
        suffix += 1;
      }
    } else {
      let unique = false;
      while (!unique) {
        const randomNum = Math.floor(100000 + Math.random() * 900000);
        replacementOrderNumber = `REP-${randomNum}`;
        const existing = await prisma.order.findUnique({ where: { orderNumber: replacementOrderNumber }, select: { id: true } });
        if (!existing) unique = true;
      }
    }

    // Persist full per-product details so the replacement Job Sheet renders
    // exactly like a normal order (products table, fabric/color, size/gender,
    // sleeve/length, measurements, per-product engraving, special notes).
    const productDetails = items.map((it, idx) => {
      const qty = parseInt(it.quantity) || 1;
      const unitPrice = parseFloat(it.unitPrice) || 0;
      const name = it.name || it.productName || '';
      const engravingReq = it.engravingRequired === 'yes' || it.engravingRequired === true;
      const eng = it.engraving && typeof it.engraving === 'object' ? it.engraving : {};
      // Per-product MULTI-LINE engravings — each line carries its own
      // Type + Name/Article + Text/Design Notes and persists through Store →
      // Production → Dispatch so the final Job Sheet renders every line.
      const engravingLines = Array.isArray(eng.engravingLines)
        ? eng.engravingLines
            .filter(l => l && (String(l.name || '').trim() || String(l.designNotes || l.text || l.notes || '').trim()))
            .map(l => ({ type: l.type || 'direct', name: String(l.name || '').trim(), designNotes: String(l.designNotes || l.text || l.notes || '').trim() }))
        : [];
      let articleNames = Array.isArray(eng.articleNames) ? eng.articleNames.filter(Boolean) : [];
      if (articleNames.length === 0 && engravingLines.length > 0) {
        articleNames = engravingLines.map(l => l.name).filter(Boolean);
      }
      if (articleNames.length === 0 && eng.nameSpelling) articleNames = [eng.nameSpelling];
      const customization = engravingReq ? {
        engravingType: engravingLines[0]?.type || eng.engravingType || it.engravingType || 'direct',
        nameSpelling: eng.nameSpelling || articleNames[0] || '',
        articleNames,
        engravingLines,
        nameColor: eng.nameColor || '',
        logoColor: eng.logoColor || '',
        logoPlacement: eng.logoPlacement || '',
        logos: Array.isArray(eng.logos) ? eng.logos : [],
        designNotes: eng.designNotes
          || (engravingLines.length > 0 ? engravingLines.map(l => l.designNotes).filter(Boolean).join('\n') : '')
          || it.notes || ''
      } : null;
      const sizeData = it.sizeData && typeof it.sizeData === 'object' ? it.sizeData : null;
      return {
        name,
        productType: it.productType || name,
        color: it.color || '',
        size: it.size || '',
        quantity: qty,
        unitPrice,
        totalPrice: Math.round((unitPrice * qty) * 100) / 100,
        fabricType: it.fabricType || '',
        gender: it.gender || 'Male',
        sleeveLength: it.sleeveLength || '',
        shirtLength: it.shirtLength || '',
        matchingCap: !!it.matchingCap,
        matchingCapQty: parseInt(it.matchingCapQty) || 0,
        notes: it.notes || '',
        measurementSpecialNote: it.measurementSpecialNote || '',
        sizeData,
        customization: customization ? JSON.stringify(customization) : null,
        // Carry the original identity + per-item sequence through Store →
        // Production → Dispatch so job sheets / route numbers keep rendering
        // the original order number and sequence.
        orderNumber: replacementOrderNumber,
        originalNumber: record.orderNumber || originalOrder.orderNumber || '',
        replacementOf: originalOrder.id,
        replaceNo: idx + 1
      };
    });

    // Order-level sizeData map (per-product measurements) + engraving/customization
    const sizeDataMap = {};
    productDetails.forEach((pd) => { if (pd.sizeData) sizeDataMap[pd.productType] = pd.sizeData; });
    const firstCust = productDetails.find(pd => pd.customization);
    const orderCustomization = firstCust ? firstCust.customization : null;
    const anyEngraving = productDetails.some(pd => pd.customization);

    const updated = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          orderNumber: replacementOrderNumber,
          customerName: originalOrder.customerName,
          customerPhone: originalOrder.customerPhone,
          address: originalOrder.address,
          city: originalOrder.city,
          createdById: req.user?.id || null,
          source: 'REPLACEMENT',
          type: orderType || 'STANDARD',
          priority: 'NORMAL',
          quantity: items.length,
          productDetails,
          sizeData: Object.keys(sizeDataMap).length ? JSON.stringify(sizeDataMap) : null,
          customization: orderCustomization,
          engravingRequired: anyEngraving,
          totalPrice: productDetails.reduce((s, p) => s + (p.totalPrice || 0), 0),
          paymentStatus: 'PENDING',
          paymentMethod: 'CASH',
          currentStage: 'STORE',
          status: 'IN_PROGRESS',
          placedBy: req.user?.name || 'Faisal',
          replacementCaseId: id,
          instructionNotes: record.specialNote || null
        }
      });

      await tx.orderStage.create({ data: { orderId: newOrder.id, stageName: 'ORDER_ENTRY', status: 'COMPLETED', completedAt: new Date() } });
      const deadline = calculateDeadline(new Date(), 24);
      await tx.orderStage.create({ data: { orderId: newOrder.id, stageName: 'STORE', status: 'PENDING', deadlineAt: deadline } });

      await tx.routingHistory.create({
        data: {
          orderId: newOrder.id,
          sentByUserId: req.user?.id || null,
          previousStage: 'ORDER_ENTRY',
          newStage: 'STORE',
          sentToStage: 'STORE',
          remarks: 'Replacement order created and routed to Store'
        }
      });

      await tx.auditLog.create({
        data: {
          orderId: originalOrder.id,
          action: 'REPLACEMENT_ORDER_CREATED',
          details: `Replacement order ${replacementOrderNumber} created by ${req.user?.name || 'Faisal'} and routed to Store. Case status: ${record.status} → FAISAL_APPROVED. Performed: ${new Date().toLocaleString()}.`,
          performedBy: req.user?.id || 'SYSTEM'
        }
      });
      await tx.auditLog.create({
        data: {
          orderId: newOrder.id,
          action: 'REPLACEMENT_ORDER_CREATED',
          details: `Replacement order created for original order ${record.orderNumber || ''}. Created by ${req.user?.name || 'Faisal'}. Performed: ${new Date().toLocaleString()}.`,
          performedBy: req.user?.id || 'SYSTEM'
        }
      });

      const caseData = {
        status: 'FAISAL_APPROVED',
        routedTo: 'STORE',
        replacementOrderId: newOrder.id,
        replacementItems: JSON.stringify(items),
        replacementSummary: replacementSummary ? JSON.stringify(replacementSummary) : null,
        faisalApprovedBy: req.user?.name || 'Faisal',
        faisalApprovedAt: new Date(),
        warehouseNotes: notes || record.warehouseNotes,
        orderType: orderType || record.orderType || 'STANDARD'
      };
      await tx.returnExchange.update({ where: { id }, data: caseData });
      return tx.returnExchange.findUnique({ where: { id } });
    });

    await notify.create(req, {
      type: 'return_exchange',
      moduleName: 'Returns',
      path: '/returns',
      role: 'STORE',
      title: 'Replacement Sent to Store',
      message: `Replacement for ${record.customerName || 'customer'} sent to Store — order ${replacementOrderNumber}`,
      orderId: record.orderId,
      customerName: record.customerName,
      action: 'Faisal → Store',
      employeeName: req.user?.name
    }).catch(() => {});

    const io = req.app?.get('io');
    if (io) io.emit('return-exchange-updated', { caseId: id });
    if (io) io.emit('order-updated', { orderId: updated.replacementOrderId });

    res.json(updated);
  } catch (error) {
    console.error('Error sending replacement to Store:', error);
    res.status(500).json({ message: 'Failed to send to Store', error: error.message });
  }
};

const syncCaseStatus = async (caseRecord, linkedOrder) => {
  if (!caseRecord || !linkedOrder) return caseRecord;

  let newStatus = caseRecord.status;

  if (linkedOrder.status === 'CANCELLED') {
    newStatus = 'CANCELLED';
  } else if (linkedOrder.status === 'COMPLETED' || ['DELIVERED', 'COMPLETED'].includes(linkedOrder.currentStage)) {
    newStatus = 'REPLACEMENT_COMPLETED';
  } else if (linkedOrder.currentStage === 'STORE_RECEIVE') {
    newStatus = 'STORE_RECEIVE';
  } else if (['DISPATCH', 'OUT_FOR_DELIVERY'].includes(linkedOrder.currentStage)) {
    newStatus = 'DISPATCH_READY';
  } else if (['PRODUCTION', 'PRODUCTION_ACCEPTANCE', 'LOGO_DESIGN', 'LOGO_DESIGNER', 'WORKERS', 'VERIFICATION'].includes(linkedOrder.currentStage)) {
    newStatus = 'IN_PRODUCTION';
  } else if (linkedOrder.currentStage === 'STORE') {
    // Only revert to FAISAL_APPROVED if store hasn't already accepted.
    // Once storeAcceptedAt is set, the case is in ACCEPTED state while at STORE.
    if (!caseRecord.storeAcceptedAt) {
      newStatus = 'FAISAL_APPROVED';
    }
  }

  if (newStatus !== caseRecord.status) {
    const data = { status: newStatus };
    if (newStatus === 'REPLACEMENT_COMPLETED') {
      data.replacementCompleted = true;
      data.replacementCompletedAt = caseRecord.replacementCompletedAt || new Date();
      data.replacementCompletedBy = caseRecord.replacementCompletedBy || 'SYSTEM';
    }
    const updated = await prisma.returnExchange.update({
      where: { id: caseRecord.id },
      data
    });
    return { ...updated, replacementOrderInfo: linkedOrder };
  }

  return { ...caseRecord, replacementOrderInfo: linkedOrder };
};

const getCase = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await prisma.returnExchange.findUnique({ where: { id } });
    if (!record) return res.status(404).json({ message: 'Record not found' });
    let replacementOrder = null;
    if (record.replacementOrderId) {
      replacementOrder = await prisma.order.findUnique({
        where: { id: record.replacementOrderId },
        include: { stages: { orderBy: { createdAt: 'asc' } } }
      });
    }
    const synced = await syncCaseStatus(record, replacementOrder);
    res.json(synced);
  } catch (error) {
    console.error('Error fetching case:', error);
    res.status(500).json({ message: 'Failed to fetch case', error: error.message });
  }
};

// Store adds the original returned goods back into inventory for a replacement case
const restockOriginal = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await prisma.returnExchange.findUnique({ where: { id } });
    if (!record) return res.status(404).json({ message: 'Record not found' });
    if (record.routedTo !== 'STORE') return res.status(400).json({ message: 'This case is not with the Store' });
    if (!record.storeAcceptedAt) return res.status(400).json({ message: 'This case must be accepted by the Store first' });
    if (record.originalRestocked) return res.status(400).json({ message: 'Returned goods already restocked' });

    const originals = typeof record.originalProducts === 'string' ? JSON.parse(record.originalProducts) : (record.originalProducts || []);
    for (const item of originals) {
      const pd = item.productDetails || item;
      const name = pd.name || pd.productType || '';
      if (!name) continue;
      const invItems = await prisma.inventoryItem.findMany({ where: { name: { contains: name, mode: 'insensitive' } } });
      for (const inv of invItems) {
        const variants = inv.variants || [];
        const color = pd.color || '';
        const size = pd.size || '';
        const updatedVariants = variants.map(v => {
          const colorMatch = color ? v.color === color : true;
          const sizeMatch = size ? v.size === size : true;
          if (colorMatch && sizeMatch) {
            return { ...v, stock: (v.stock || 0) + (item.quantity || 1) };
          }
          return v;
        });
        const newTotal = updatedVariants.reduce((s, v) => s + (v.stock || 0), 0);
        await prisma.inventoryItem.update({
          where: { id: inv.id },
          data: { variants: updatedVariants, stock: newTotal }
        });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.returnExchange.update({
        where: { id },
        data: { originalRestocked: true, originalRestockedAt: new Date(), originalRestockedBy: req.user?.name || 'Store' }
      });
      await tx.auditLog.create({
        data: {
          orderId: record.orderId,
          action: 'RETURN_STORE_PROCESSED',
          details: `Returned goods for ${record.orderNumber || ''} restocked into inventory by ${req.user?.name || 'Store'}. originalRestocked: false → true. Performed: ${new Date().toLocaleString()}.`,
          performedBy: req.user?.id || 'SYSTEM'
        }
      });
      return tx.returnExchange.findUnique({ where: { id } });
    });

    try { cache.delPattern('pos:inventory:'); cache.delPattern('warehouse:'); cache.delPattern('products:'); } catch (e) { console.error('restockOriginal cache invalidation error:', e); }

    const io = req.app?.get('io');
    if (io) io.emit('return-exchange-updated', { caseId: id });
    if (io) io.emit('inventory-updated', { source: 'return-exchange-restock', action: 'restock-original', orderNumber: record.orderNumber });

    res.json(updated);
  } catch (error) {
    console.error('Error restocking original goods:', error);
    res.status(500).json({ message: 'Failed to restock', error: error.message });
  }
};

// Manual case status sync (IN_PRODUCTION / STORE_RECEIVE / REPLACEMENT_COMPLETED / CANCELLED)
const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const allowed = ['IN_PRODUCTION', 'STORE_RECEIVE', 'REPLACEMENT_COMPLETED', 'CANCELLED'];
    if (!allowed.includes(status)) return res.status(400).json({ message: 'Invalid status' });
    const record = await prisma.returnExchange.findUnique({ where: { id } });
    if (!record) return res.status(404).json({ message: 'Record not found' });

    const updated = await prisma.$transaction(async (tx) => {
      const data = { status, warehouseNotes: notes || record.warehouseNotes };
      if (status === 'REPLACEMENT_COMPLETED') {
        data.replacementCompleted = true;
        data.replacementCompletedAt = new Date();
        data.replacementCompletedBy = req.user?.name || 'Store';
      }
      await tx.returnExchange.update({ where: { id }, data });
      await tx.auditLog.create({
        data: {
          orderId: record.orderId,
          action: 'REPLACEMENT_STATUS_UPDATED',
          details: `Replacement case for ${record.orderNumber || ''} status changed from ${record.status} → ${status} by ${req.user?.name || 'Store'}${notes ? `. Notes: ${notes}` : ''}. Performed: ${new Date().toLocaleString()}.`,
          performedBy: req.user?.id || 'SYSTEM'
        }
      });
      return tx.returnExchange.findUnique({ where: { id } });
    });

    const io = req.app?.get('io');
    if (io) io.emit('return-exchange-updated', { caseId: id });

    res.json(updated);
  } catch (error) {
    console.error('Error updating case status:', error);
    res.status(500).json({ message: 'Failed to update status', error: error.message });
  }
};

// ─── Per-product acceptance + restock (partial processing) ────────────────────
// Parse the original products list from a case record.
const parseOriginalProducts = (record) => {
  const raw = typeof record.originalProducts === 'string' ? JSON.parse(record.originalProducts) : (record.originalProducts || []);
  return Array.isArray(raw) ? raw : [];
};

// Compute the acceptedProducts array (or [] if none yet).
const parseAcceptedProducts = (record) => {
  if (!record.acceptedProducts) return [];
  const raw = typeof record.acceptedProducts === 'string' ? JSON.parse(record.acceptedProducts) : record.acceptedProducts;
  return Array.isArray(raw) ? raw : [];
};

// Compute the restockedProducts array (or [] if none yet).
const parseRestockedProducts = (record) => {
  if (!record.restockedProducts) return [];
  const raw = typeof record.restockedProducts === 'string' ? JSON.parse(record.restockedProducts) : record.restockedProducts;
  return Array.isArray(raw) ? raw : [];
};

// Derive the case-level status from per-product acceptance + restock state.
const deriveCaseStatus = (originals, accepted, restocked) => {
  if (!originals.length) return undefined;
  const totalQty = originals.reduce((s, p) => s + (p.quantity || 1), 0);
  const acceptedQty = accepted.reduce((s, p) => s + (p.acceptedQty || 0), 0);
  const restockedQty = restocked.reduce((s, p) => s + (p.restockedQty || 0), 0);
  const acceptedCount = accepted.length;
  const restockedCount = restocked.length;

  // All products fully restocked → completed
  if (restockedQty >= totalQty && acceptedQty >= totalQty) return 'REPLACEMENT_COMPLETED';
  // All products received (even partially) and some restocked
  if (acceptedQty >= totalQty && restockedCount > 0) return 'PARTIALLY_RESTOCKED';
  // Some products received but not all
  if (acceptedCount > 0 && acceptedQty < totalQty) return 'PARTIALLY_RECEIVED';
  // All products received but none restocked yet
  if (acceptedQty >= totalQty) return 'ACCEPTED';
  // Some received
  if (acceptedCount > 0) return 'PARTIALLY_RECEIVED';
  return undefined; // no change
};

// POST /api/return-exchange/:id/accept-product
// Accept a single product by index with quantity received.
// Body: { idx: Number, acceptedQty: Number }
const acceptProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { idx, acceptedQty } = req.body;
    if (idx === undefined || !Number.isInteger(idx) || idx < 0) return res.status(400).json({ message: 'Valid product index (idx) is required' });
    if (acceptedQty === undefined || acceptedQty < 0) return res.status(400).json({ message: 'acceptedQty must be >= 0' });

    const record = await prisma.returnExchange.findUnique({ where: { id } });
    if (!record) return res.status(404).json({ message: 'Record not found' });
    if (record.routedTo !== 'STORE') return res.status(400).json({ message: 'This case is not with the Store' });
    if (!record.storeAcceptedAt && !record.acceptedProducts) return res.status(400).json({ message: 'Case must be accepted by the Store first' });

    const originals = parseOriginalProducts(record);
    if (idx >= originals.length) return res.status(400).json({ message: `Product index ${idx} out of range (0..${originals.length - 1})` });

    const product = originals[idx];
    const maxQty = product.quantity || 1;
    if (acceptedQty > maxQty) return res.status(400).json({ message: `acceptedQty (${acceptedQty}) exceeds ordered quantity (${maxQty})` });

    const accepted = parseAcceptedProducts(record);
    const entry = {
      idx,
      name: product.name || product.productDetails?.name || product.productType || 'Product',
      color: product.color || product.productDetails?.color || '',
      size: product.size || product.productDetails?.size || '',
      quantity: maxQty,
      acceptedQty,
      acceptedBy: req.user?.name || 'Store',
      acceptedById: req.user?.id || null,
      acceptedAt: new Date().toISOString()
    };

    // Upsert: replace existing entry for same idx
    const filtered = accepted.filter(a => a.idx !== idx);
    if (acceptedQty > 0) filtered.push(entry);
    filtered.sort((a, b) => a.idx - b.idx);

    const newStatus = deriveCaseStatus(originals, filtered, parseRestockedProducts(record));

    const updated = await prisma.$transaction(async (tx) => {
      await tx.returnExchange.update({
        where: { id },
        data: {
          acceptedProducts: filtered,
          ...(record.storeAcceptedAt ? {} : {
            status: 'ACCEPTED',
            storeAcceptedBy: req.user?.name || 'Store',
            storeAcceptedById: req.user?.id || null,
            storeAcceptedAt: new Date()
          }),
          ...(newStatus ? { status: newStatus } : {})
        }
      });
      await tx.auditLog.create({
        data: {
          orderId: record.orderId,
          action: 'RETURN_PRODUCT_ACCEPTED',
          details: `${entry.name} (${entry.color || 'any'} ${entry.size || 'any'}) idx=${idx}: ${acceptedQty}/${maxQty} accepted by ${req.user?.name || 'Store'}. Case: ${record.orderNumber || ''}. Performed: ${new Date().toLocaleString()}.`,
          performedBy: req.user?.id || 'SYSTEM'
        }
      });
      return tx.returnExchange.findUnique({ where: { id } });
    });

    const io = req.app?.get('io');
    if (io) io.emit('return-exchange-updated', { caseId: id });

    res.json(updated);
  } catch (error) {
    console.error('Error accepting product:', error);
    res.status(500).json({ message: 'Failed to accept product', error: error.message });
  }
};

// POST /api/return-exchange/:id/restock-product
// Restock a single accepted product by index.
// Body: { idx: Number, restockedQty: Number }
const restockProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { idx, restockedQty } = req.body;
    if (idx === undefined || !Number.isInteger(idx) || idx < 0) return res.status(400).json({ message: 'Valid product index (idx) is required' });
    if (restockedQty === undefined || restockedQty < 0) return res.status(400).json({ message: 'restockedQty must be >= 0' });

    const record = await prisma.returnExchange.findUnique({ where: { id } });
    if (!record) return res.status(404).json({ message: 'Record not found' });
    if (record.routedTo !== 'STORE') return res.status(400).json({ message: 'This case is not with the Store' });

    const originals = parseOriginalProducts(record);
    if (idx >= originals.length) return res.status(400).json({ message: `Product index ${idx} out of range` });

    const accepted = parseAcceptedProducts(record);
    const acceptedEntry = accepted.find(a => a.idx === idx);
    if (!acceptedEntry) return res.status(400).json({ message: 'Product must be accepted before restocking' });
    if (restockedQty > acceptedEntry.acceptedQty) return res.status(400).json({ message: `restockedQty (${restockedQty}) exceeds acceptedQty (${acceptedEntry.acceptedQty})` });

    const product = originals[idx];
    const pd = product.productDetails || product;
    const name = pd.name || pd.productType || '';

    if (restockedQty > 0 && name) {
      const invItems = await prisma.inventoryItem.findMany({ where: { name: { contains: name, mode: 'insensitive' } } });
      for (const inv of invItems) {
        const variants = inv.variants || [];
        const color = pd.color || '';
        const size = pd.size || '';
        const updatedVariants = variants.map(v => {
          const colorMatch = color ? v.color === color : true;
          const sizeMatch = size ? v.size === size : true;
          if (colorMatch && sizeMatch) {
            return { ...v, stock: (v.stock || 0) + restockedQty };
          }
          return v;
        });
        const newTotal = updatedVariants.reduce((s, v) => s + (v.stock || 0), 0);
        await prisma.inventoryItem.update({
          where: { id: inv.id },
          data: { variants: updatedVariants, stock: newTotal }
        });
      }
    }

    const restocked = parseRestockedProducts(record);
    const restockEntry = {
      idx,
      name: acceptedEntry.name,
      color: acceptedEntry.color,
      size: acceptedEntry.size,
      quantity: acceptedEntry.quantity,
      acceptedQty: acceptedEntry.acceptedQty,
      restockedQty,
      restockedBy: req.user?.name || 'Store',
      restockedById: req.user?.id || null,
      restockedAt: new Date().toISOString()
    };
    const filteredRestocked = restocked.filter(r => r.idx !== idx);
    if (restockedQty > 0) filteredRestocked.push(restockEntry);
    filteredRestocked.sort((a, b) => a.idx - b.idx);

    const newStatus = deriveCaseStatus(originals, accepted, filteredRestocked);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.returnExchange.update({
        where: { id },
        data: {
          restockedProducts: filteredRestocked,
          originalRestocked: filteredRestocked.length > 0,
          originalRestockedAt: filteredRestocked.length > 0 ? new Date() : record.originalRestockedAt,
          originalRestockedBy: filteredRestocked.length > 0 ? (req.user?.name || 'Store') : record.originalRestockedBy,
          ...(newStatus ? { status: newStatus } : {})
        }
      });
      await tx.auditLog.create({
        data: {
          orderId: record.orderId,
          action: 'RETURN_PRODUCT_RESTOCKED',
          details: `${restockEntry.name} (${restockEntry.color || 'any'} ${restockEntry.size || 'any'}) idx=${idx}: ${restockedQty}/${restockEntry.acceptedQty} restocked by ${req.user?.name || 'Store'}. Case: ${record.orderNumber || ''}. Performed: ${new Date().toLocaleString()}.`,
          performedBy: req.user?.id || 'SYSTEM'
        }
      });
      return tx.returnExchange.findUnique({ where: { id } });
    });

    try { cache.delPattern('pos:inventory:'); cache.delPattern('warehouse:'); cache.delPattern('products:'); } catch (e) { console.error('restockProduct cache error:', e); }

    const io = req.app?.get('io');
    if (io) io.emit('return-exchange-updated', { caseId: id });
    if (io) io.emit('inventory-updated', { source: 'return-exchange-restock-product', action: 'restock-product', orderNumber: record.orderNumber });

    res.json(updated);
  } catch (error) {
    console.error('Error restocking product:', error);
    res.status(500).json({ message: 'Failed to restock product', error: error.message });
  }
};

// Route the replacement order out of the Store stage to its next phase.
// Per-product availability ticks decide which new replacement items deduct from
// inventory (In Stock) vs flow to Production/Logo (Not Available). The case
// leaves the Store queue once the order leaves STORE.
const routeReplacement = async (req, res) => {
  try {
    const { id } = req.params;
    let { nextStage, productAvailability, notes } = req.body;
    const record = await prisma.returnExchange.findUnique({ where: { id } });
    if (!record) return res.status(404).json({ message: 'Record not found' });
    if (record.type !== 'REPLACEMENT') return res.status(400).json({ message: 'Only replacement cases can be routed' });
    if (record.routedTo !== 'STORE') return res.status(400).json({ message: 'This case is not with the Store' });
    if (!record.storeAcceptedAt) return res.status(400).json({ message: 'This replacement must be accepted by the Store first' });
    if (!record.replacementOrderId) return res.status(400).json({ message: 'Replacement order has not been created yet' });
    // Validate per-product acceptance: at least 1 product must be accepted before routing
    const accepted = parseAcceptedProducts(record);
    if (accepted.length === 0 || accepted.every(a => (a.acceptedQty || 0) <= 0)) {
      return res.status(400).json({ message: 'At least one product must be accepted before routing' });
    }
    if (!nextStage || !REPLACEMENT_ROUTES.includes(nextStage)) {
      return res.status(400).json({ message: `Invalid route. Valid destinations: ${REPLACEMENT_ROUTES.join(', ')}.` });
    }

    // Production In split guard (same as requestStageCompletion / manualRouteOrder):
    // a Store-stage replacement routing to PRODUCTION must land in PRODUCTION_ACCEPTANCE
    // (Production In's stage) so it goes through the acceptance gate before Production Out
    // works on it — never straight to PRODUCTION which bypasses Production In entirely.
    if (nextStage === 'PRODUCTION') {
      nextStage = 'PRODUCTION_ACCEPTANCE';
    }

    const order = await prisma.order.findUnique({
      where: { id: record.replacementOrderId },
      include: { stages: { orderBy: { createdAt: 'asc' } } }
    });
    if (!order) return res.status(404).json({ message: 'Replacement order not found' });
    if (order.currentStage !== 'STORE') {
      return res.status(400).json({ message: `Replacement order is no longer at the Store stage (currently ${order.currentStage})` });
    }
    const storeStage = (order.stages || []).find(s => s.stageName === 'STORE' && ['PENDING', 'IN_PROGRESS'].includes(s.status));
    if (!storeStage) return res.status(400).json({ message: 'Replacement order has no active Store stage' });

    // 1) Availability ticks → persist per-item availability + deduct in-stock items
    const availabilityMap = (productAvailability && typeof productAvailability === 'object') ? productAvailability : {};
    let deductedItems = 0;
    if (Object.keys(availabilityMap).length > 0) {
      const parsed = Array.isArray(order.productDetails) ? order.productDetails : [];
      const updatedItems = parsed.map((item, idx) => {
        if (availabilityMap[idx] === undefined) return item;
        return { ...item, availabilityStatus: availabilityMap[idx] ? 'available' : 'not_available' };
      });
      await prisma.order.update({ where: { id: order.id }, data: { productDetails: updatedItems } });

      const availableIndices = Object.entries(availabilityMap)
        .filter(([, v]) => v === true)
        .map(([k]) => Number(k));
      if (availableIndices.length > 0) {
        const availableItems = parsed
          .filter((_, idx) => availableIndices.includes(idx))
          .map(item => ({ productDetails: item.productDetails || item, quantity: item.quantity || 1 }));
        const { inventoryItems } = await classifyOrderItems(order, availableItems);
        if (inventoryItems.length > 0) {
          await deductInventoryItems(order, req.user.id, inventoryItems);
          deductedItems = availableItems.length;
        }
      }
    }

    // 2) Complete STORE stage, create destination stage, advance the order.
    //    All routing writes (stage close → destination stage → order advance →
    //    routing history → seen reset → audits → case sync) are atomic.
    const newCaseStatus = ['DISPATCH', 'OUT_FOR_DELIVERY'].includes(nextStage) ? 'DISPATCH_READY' : 'IN_PRODUCTION';
    const deadline = calculateDeadline(new Date(), 24);

    await prisma.$transaction(async (tx) => {
      await tx.orderStage.update({
        where: { id: storeStage.id },
        data: { status: 'COMPLETED', completedAt: new Date() }
      });
      if (nextStage === 'DISPATCH') {
        await ensureSingleActiveDispatchStage(order.id, order.priority, tx);
      } else {
        await tx.orderStage.create({
          data: { orderId: order.id, stageName: nextStage, status: 'PENDING', deadlineAt: deadline }
        });
      }

      const orderUpdateData = { currentStage: nextStage, status: 'PENDING' };
      if (nextStage === 'DISPATCH') {
        Object.assign(orderUpdateData, DISPATCH_RESET_FIELDS);
      }
      await tx.order.update({
        where: { id: order.id },
        data: orderUpdateData
      });

      const recipientUsers = await tx.user.findMany({
        where: { role: { in: getRolesForStage(nextStage) } },
        select: { id: true }
      });
      await tx.routingHistory.create({
        data: {
          orderId: order.id,
          sentByUserId: req.user?.id || null,
          sentToStage: nextStage,
          sentToUserIds: JSON.stringify(recipientUsers.map(u => u.id)),
          previousStage: 'STORE',
          newStage: nextStage,
          remarks: notes || `Replacement routed to ${nextStage} by ${req.user?.name || 'Store'}`
        }
      }).catch(e => console.error('Replacement routing history error:', e));
      await tx.seenTask.deleteMany({
        where: { userId: { in: recipientUsers.map(u => u.id) }, orderId: order.id, stageName: nextStage }
      }).catch(() => {});

      const detail = deductedItems > 0
        ? ` — ${deductedItems} item(s) deducted from inventory (In Stock)`
        : ' — no items deducted (all routed onward for production/logo)';
      await tx.auditLog.create({
        data: {
          orderId: order.id,
          action: 'REPLACEMENT_ROUTED',
          details: `Replacement order ${order.orderNumber} routed from STORE → ${nextStage} by ${req.user?.name || 'Store'}${detail}. Performed: ${new Date().toLocaleString()}.`,
          performedBy: req.user?.id || 'SYSTEM'
        }
      });
      await tx.auditLog.create({
        data: {
          orderId: record.orderId,
          action: 'REPLACEMENT_ROUTED',
          details: `Replacement case routed to ${nextStage} — replacement order ${order.orderNumber}. Performed: ${new Date().toLocaleString()}.`,
          performedBy: req.user?.id || 'SYSTEM'
        }
      });

      // 3) Sync the case so it leaves the Store queue and reflects its next phase
      await tx.returnExchange.update({
        where: { id },
        data: {
          status: newCaseStatus,
          storeProcessedBy: req.user?.name || 'Store',
          storeProcessedAt: new Date(),
          inventoryAdjusted: deductedItems > 0,
          productionRoutedAt: newCaseStatus === 'IN_PRODUCTION' ? (record.productionRoutedAt || new Date()) : record.productionRoutedAt
        }
      });
    }, { timeout: 30000 });

    await notify.create(req, {
      type: 'stage_task',
      moduleName: 'My Tasks',
      path: '/tasks',
      role: getRolesForStage(nextStage)[0] || 'STORE',
      title: 'New Task',
      message: `Replacement order ${order.orderNumber} moved to ${nextStage}`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      action: `→ ${nextStage}`,
      employeeName: req.user?.name
    }).catch(() => {});

    const io = req.app?.get('io');
    if (io) io.emit('return-exchange-updated', { caseId: id });
    if (io) io.emit('order-updated', { orderId: order.id });

    const updated = await prisma.returnExchange.findUnique({ where: { id } });
    res.json({
      ...updated,
      replacementOrder: { id: order.id, orderNumber: order.orderNumber, currentStage: nextStage, status: 'PENDING' }
    });
  } catch (error) {
    console.error('Error routing replacement:', error);
    res.status(500).json({ message: 'Failed to route replacement', error: error.message });
  }
};

const getAllCases = async (req, res) => {
  try {
    const { type, status, search, page = 1, limit = 50, dateFrom, dateTo } = req.query;

    // Self-healing: sync active returnExchange cases that have a replacement order
    const inFlightCases = await prisma.returnExchange.findMany({
      where: {
        replacementOrderId: { not: null },
        status: { notIn: ['REPLACEMENT_COMPLETED', 'CANCELLED'] }
      }
    });
    if (inFlightCases.length > 0) {
      const activeRepOrderIds = inFlightCases.map(c => c.replacementOrderId);
      const activeRepOrders = await prisma.order.findMany({
        where: { id: { in: activeRepOrderIds } },
        select: { id: true, orderNumber: true, currentStage: true, status: true, createdAt: true, deliveredAt: true, productDetails: true, quantity: true }
      });
      const activeRepMap = Object.fromEntries(activeRepOrders.map(o => [o.id, o]));
      for (const c of inFlightCases) {
        const o = activeRepMap[c.replacementOrderId];
        if (o) {
          await syncCaseStatus(c, o);
        }
      }
    }

    const where = {};
    if (type) where.type = type;
    if (status) {
      where.status = status;
    } else {
      // By default, exclude terminal statuses so completed/cancelled cases
      // don't reappear in the active workflow views.
      where.status = { notIn: ['COMPLETED', 'CANCELLED', 'REPLACEMENT_COMPLETED'] };
    }
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search } }
      ];
    }
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) { const d = new Date(dateTo); d.setHours(23, 59, 59, 999); where.createdAt.lte = d; }
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [list, total] = await Promise.all([
      prisma.returnExchange.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: parseInt(limit) }),
      prisma.returnExchange.count({ where })
    ]);

    // Enrich with linked replacement order (number + current stage) for at-a-glance tracking
    const replacementOrderIds = list.filter(c => c.replacementOrderId).map(c => c.replacementOrderId);
    let repMap = {};
    if (replacementOrderIds.length) {
      const repOrders = await prisma.order.findMany({
        where: { id: { in: replacementOrderIds } },
        select: { id: true, orderNumber: true, currentStage: true, status: true, createdAt: true, deliveredAt: true, productDetails: true, quantity: true }
      });
      repMap = Object.fromEntries(repOrders.map(o => [o.id, o]));
    }
    const cases = list.map(c => ({
      ...c,
      replacementOrderInfo: c.replacementOrderId ? (repMap[c.replacementOrderId] || null) : null
    }));

    res.json({ cases, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    console.error('Error fetching cases:', error);
    res.status(500).json({ message: 'Failed to fetch cases', error: error.message });
  }
};

const checkStockAvailability = async (req, res) => {
  try {
    const { items } = req.body; // [{ name, color, size, quantity }]
    if (!items || !Array.isArray(items)) return res.status(400).json({ message: 'Items array required' });

    const results = [];
    for (const item of items) {
      const name = item.name || '';
      if (!name) { results.push({ ...item, available: false, stock: 0 }); continue; }
      const invItems = await prisma.inventoryItem.findMany({ where: { name: { contains: name, mode: 'insensitive' } } });
      let availableStock = 0;
      for (const inv of invItems) {
        const variants = inv.variants || [];
        const color = item.color || '';
        const size = item.size || '';
        const matchVariant = variants.find(v => {
          const colorMatch = color ? v.color === color : true;
          const sizeMatch = size ? v.size === size : true;
          return colorMatch && sizeMatch;
        });
        if (matchVariant) availableStock += (matchVariant.stock || 0);
      }
      results.push({
        name, color: item.color, size: item.size, quantity: item.quantity,
        available: availableStock >= (item.quantity || 1),
        stock: availableStock
      });
    }
    res.json(results);
  } catch (error) {
    console.error('Error checking stock:', error);
    res.status(500).json({ message: 'Failed to check stock', error: error.message });
  }
};

// Resolve a replacement case + its linked orders by either the original order
// number (JT-123456 / JL-…) or the replacement order number (REP-123456), and
// build a combined lifecycle timeline.
const trackReplacement = async (req, res) => {
  try {
    const { query } = req.params;
    if (!query) return res.status(400).json({ message: 'Query is required' });
    const q = String(query).trim();

    let caseRecord = null;
    let replacementOrder = null;
    let originalOrder = null;

    if (/^REP-/i.test(q)) {
      replacementOrder = await prisma.order.findFirst({
        where: { source: 'REPLACEMENT', orderNumber: { equals: q, mode: 'insensitive' } },
        include: { stages: { orderBy: { createdAt: 'asc' } } }
      });
      if (replacementOrder) {
        caseRecord = await prisma.returnExchange.findUnique({ where: { id: replacementOrder.replacementCaseId } });
        if (caseRecord) {
          caseRecord = await syncCaseStatus(caseRecord, replacementOrder);
          originalOrder = await prisma.order.findUnique({ where: { id: caseRecord.orderId } });
        }
      }
    } else {
      originalOrder = await prisma.order.findFirst({
        where: {
          OR: [
            { orderNumber: { equals: q, mode: 'insensitive' } },
            { orderNumber: { endsWith: q, mode: 'insensitive' } },
            { invoiceNumber: { equals: q, mode: 'insensitive' } },
            { invoiceNumber: { endsWith: q, mode: 'insensitive' } }
          ]
        }
      });
      if (originalOrder) {
        caseRecord = await prisma.returnExchange.findFirst({
          where: { orderId: originalOrder.id, type: 'REPLACEMENT' },
          orderBy: { createdAt: 'desc' }
        });
        if (caseRecord && caseRecord.replacementOrderId) {
          replacementOrder = await prisma.order.findUnique({
            where: { id: caseRecord.replacementOrderId },
            include: { stages: { orderBy: { createdAt: 'asc' } } }
          });
          caseRecord = await syncCaseStatus(caseRecord, replacementOrder);
        }
      }
    }

    if (!caseRecord || !originalOrder) return res.status(404).json({ message: 'No replacement found for this reference' });

    // Combined lifecycle timeline
    const timeline = [];
    const push = (e) => timeline.push(e);
    if (originalOrder.createdAt) push({ type: 'original', title: 'Original Order Entered', at: originalOrder.createdAt, orderNumber: originalOrder.orderNumber });
    if (caseRecord.createdAt) push({ type: 'request', title: 'Replacement Requested', at: caseRecord.createdAt, orderNumber: caseRecord.orderNumber });
    if (caseRecord.faisalApprovedAt) push({ type: 'faisal', title: 'Faisal Approved & Sent to Store', at: caseRecord.faisalApprovedAt, by: caseRecord.faisalApprovedBy });
    if (caseRecord.originalRestockedAt) push({ type: 'restock', title: 'Original Goods Restocked', at: caseRecord.originalRestockedAt, by: caseRecord.originalRestockedBy });
    if (replacementOrder) {
      const stages = replacementOrder.stages || [];
      for (const st of stages) {
        const stAt = st.completedAt || st.createdAt;
        if (!stAt) continue;
        const label = st.status === 'COMPLETED' ? 'Completed' : (st.status === 'IN_PROGRESS' ? 'In Progress' : 'Pending');
        push({ type: 'stage', title: `${st.stageName} — ${label}`, at: stAt, orderNumber: replacementOrder.orderNumber });
      }
    }
    if (caseRecord.replacementCompletedAt) push({ type: 'complete', title: 'Replacement Completed', at: caseRecord.replacementCompletedAt, by: caseRecord.replacementCompletedBy });
    timeline.sort((a, b) => new Date(a.at) - new Date(b.at));

    res.json({ case: caseRecord, originalOrder, replacementOrder, timeline });
  } catch (error) {
    console.error('Error tracking replacement:', error);
    res.status(500).json({ message: 'Failed to track replacement', error: error.message });
  }
};

// Return the replacement order (with stages) for Job Sheet printing — the
// replacement order is a normal Order carrying productDetails/customization/
// sizeData, so printJobSheet renders it in the standard format.
const getReplacementJobSheetOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await prisma.returnExchange.findUnique({ where: { id } });
    if (!record) return res.status(404).json({ message: 'Record not found' });
    if (!record.replacementOrderId) return res.status(400).json({ message: 'Replacement order has not been created yet' });
    const order = await prisma.order.findUnique({
      where: { id: record.replacementOrderId },
      include: { stages: { orderBy: { createdAt: 'asc' } } }
    });
    if (!order) return res.status(404).json({ message: 'Replacement order not found' });
    res.json({ ...order, replacementCaseId: id, originalOrderNumber: record.orderNumber || null, originalReplacementReason: record.returnReason || record.specialNote || null });
  } catch (error) {
    console.error('Error fetching replacement order:', error);
    res.status(500).json({ message: 'Failed to fetch replacement order', error: error.message });
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

const redispatchOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { notes } = req.body;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { stages: { orderBy: { createdAt: 'asc' } } }
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Gate: redispatch requires the delivery return to be accepted first
    const deliveryReturnCase = await prisma.returnExchange.findFirst({
      where: { orderId: order.id, type: 'RETURN', status: 'PENDING', deliveryReturnedAt: { not: null } }
    });
    if (deliveryReturnCase) {
      return res.status(400).json({ message: 'This order has a pending delivery return that must be accepted before re-dispatch. Go to Return & Exchange → Order Lookup to accept the return first.' });
    }

    // POS/Inventory lock check
    const pendingAudit = await getPendingAudit(prisma, { type: 'OUTLET', outletName: order.outletName });
    if (pendingAudit) {
      return res.status(423).json({
        message: `Inventory audit ${pendingAudit.auditNumber} approval is pending. The POS is temporarily locked until the audit is approved or rejected by the Admin.`,
        auditNumber: pendingAudit.auditNumber
      });
    }

    // 1) Mark any active stages as COMPLETED, create new DISPATCH stage, reset order,
    //    record routing history + audit + clear seen tasks — ALL in one transaction so a
    //    re-dispatch can never leave the order half-routed.
    const durations = await getStageDurations(order.priority);
    const deadline = calculateDeadline(new Date(), durations['DISPATCH'] || 12);

    await prisma.$transaction(async (tx) => {
      // 1) Ensure single active DISPATCH stage and close any previous active stages
      await ensureSingleActiveDispatchStage(orderId, order.priority, tx);

      // 2) Update Order: cleanly reset all dispatch and historical delivery fields
      await tx.order.update({
        where: { id: orderId },
        data: DISPATCH_RESET_FIELDS
      });

      // 4) Add to Routing History
      await tx.routingHistory.create({
        data: {
          orderId,
          sentByUserId: req.user?.id || null,
          previousStage: order.currentStage,
          newStage: 'DISPATCH',
          sentToStage: 'DISPATCH',
          remarks: notes || `Re-dispatch requested by ${req.user?.name || 'Inventory View'}`
        }
      });

      // 5) Add Audit Log for timeline tracking
      await tx.auditLog.create({
        data: {
          orderId,
          action: 'REDISPATCH_REQUESTED',
          details: `Order re-dispatch requested by ${req.user?.name || 'Inventory View'}${notes ? `. Notes: ${notes}` : ''}. Performed: ${new Date().toLocaleString()}.`,
          performedBy: req.user?.id || 'SYSTEM'
        }
      });

      // Delete seen tasks so it appears in unseen for all dispatchers
      const recipientUsers = await tx.user.findMany({
        where: { role: { in: ['DISPATCH', 'STORE_EMPLOYEE'] } },
        select: { id: true }
      });
      await tx.seenTask.deleteMany({
        where: { userId: { in: recipientUsers.map(u => u.id) }, orderId: order.id, stageName: 'DISPATCH' }
      }).catch(() => {});

      // Close any ACCEPTED return case so the Return & Exchange page
      // does not keep showing action buttons after re-dispatch.
      await tx.returnExchange.updateMany({
        where: { orderId: order.id, type: 'RETURN', status: 'ACCEPTED' },
        data: { status: 'COMPLETED', handledBy: req.user?.name || 'Inventory View' }
      });
    }, { timeout: 30000 });

    // Create notifications for dispatchers
    await notify.create(req, {
      type: 'stage_task',
      moduleName: 'My Tasks',
      path: '/tasks',
      role: 'DISPATCH',
      title: 'New Re-Dispatch Task',
      message: `Re-dispatch task for order ${order.orderNumber} is ready`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      action: '→ DISPATCH (Re-Dispatch)',
      employeeName: req.user?.name
    }).catch(() => {});

    const io = req.app?.get('io');
    if (io) io.emit('order-updated', { orderId });

    res.json({ message: 'Order marked for Re-Dispatch and routed to Dispatch Unseen Tasks' });
  } catch (error) {
    console.error('Error in redispatchOrder:', error);
    res.status(500).json({ message: 'Failed to request re-dispatch', error: error.message });
  }
};

// POST /api/return-exchange/:id/accept-return — Inventory View accepts a delivery-returned order
const acceptReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const { orderId } = req.body;
    const now = new Date();

    // Case 1: Existing case record (delivery boy returned → PENDING case exists)
    if (id && id !== 'new') {
      const caseRecord = await prisma.returnExchange.findUnique({ where: { id } });
      if (!caseRecord) return res.status(404).json({ message: 'Return case not found' });
      if (caseRecord.type !== 'RETURN') return res.status(400).json({ message: 'Only RETURN cases can be accepted' });
      if (caseRecord.status !== 'PENDING') return res.status(400).json({ message: `Case is already ${caseRecord.status} — cannot accept` });
      // Block re-acceptance if the case was already sent to Store (routedTo changed from INVENTORY_VIEW to STORE)
      if (caseRecord.routedTo === 'STORE') return res.status(400).json({ message: 'This return has already been sent to Store and cannot be re-accepted.' });

      const updated = await prisma.returnExchange.update({
        where: { id },
        data: {
          status: 'ACCEPTED',
          acceptedBy: req.user?.name || 'Inventory View',
          acceptedById: req.user?.id || null,
          acceptedAt: now
        }
      });

      await prisma.auditLog.create({
        data: {
          orderId: caseRecord.orderId,
          action: 'RETURN_ACCEPTED_BY_INVENTORY',
          details: `Return accepted by ${req.user?.name || 'Inventory View'}. Delivery returned by ${caseRecord.deliveryReturnedBy || 'Unknown'} at ${caseRecord.deliveryReturnedAt ? new Date(caseRecord.deliveryReturnedAt).toLocaleString() : 'N/A'}.`,
          performedBy: req.user?.id || 'SYSTEM'
        }
      });

      const io = req.app?.get('io');
      if (io) io.emit('return-exchange-updated', { caseId: id, orderId: caseRecord.orderId });

      return res.json({ message: 'Return accepted successfully', status: 'ACCEPTED', acceptedAt: now, caseId: id });
    }

    // Case 2: Fresh order (no existing case) — create an ACCEPTED case directly
    if (!orderId) return res.status(400).json({ message: 'orderId is required for new acceptance' });

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Block if an active return case already exists
    const existing = await prisma.returnExchange.findFirst({
      where: { orderId, type: 'RETURN', status: { notIn: ['COMPLETED', 'CANCELLED'] } }
    });
    if (existing) return res.status(409).json({ message: 'This order already has an active return case.', existingCase: existing });

    const record = await prisma.returnExchange.create({
      data: {
        orderId,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        type: 'RETURN',
        status: 'ACCEPTED',
        routedTo: 'INVENTORY_VIEW',
        originalProducts: order.productDetails,
        deliveryAttempts: order.noResponseCount || 0,
        nextDeliveryDate: order.nextDeliveryDate,
        handledBy: req.user?.name || null,
        handledById: req.user?.id || null,
        acceptedBy: req.user?.name || 'Inventory View',
        acceptedById: req.user?.id || null,
        acceptedAt: now
      }
    });

    await prisma.auditLog.create({
      data: {
        orderId,
        action: 'RETURN_ACCEPTED_BY_INVENTORY',
        details: `Return accepted by ${req.user?.name || 'Inventory View'} for order ${order.orderNumber}. Awaiting return reason.`,
        performedBy: req.user?.id || 'SYSTEM'
      }
    });

    const io = req.app?.get('io');
    if (io) io.emit('return-exchange-updated', { caseId: record.id, orderId });

    return res.json({ message: 'Return accepted successfully', status: 'ACCEPTED', acceptedAt: now, caseId: record.id });
  } catch (error) {
    console.error('Error accepting return:', error);
    res.status(500).json({ message: 'Failed to accept return', error: error.message });
  }
};

// POST /api/return-exchange/:id/send-return-to-store — route an ACCEPTED return to Store with a reason
const sendReturnToStore = async (req, res) => {
  try {
    const { id } = req.params;
    const { returnReason, notes } = req.body;
    if (!returnReason || !returnReason.trim()) return res.status(400).json({ message: 'Return reason is required' });

    const caseRecord = await prisma.returnExchange.findUnique({ where: { id } });
    if (!caseRecord) return res.status(404).json({ message: 'Return case not found' });
    if (caseRecord.type !== 'RETURN') return res.status(400).json({ message: 'Only RETURN cases can be sent to Store' });
    if (caseRecord.status !== 'ACCEPTED') return res.status(400).json({ message: `Case must be ACCEPTED to send to Store (current: ${caseRecord.status})` });

    const updated = await prisma.$transaction(async (tx) => {
      const rec = await tx.returnExchange.update({
        where: { id },
        data: {
          status: 'PENDING',
          routedTo: 'STORE',
          returnReason: returnReason.trim(),
          warehouseNotes: notes || null
        }
      });

      await tx.auditLog.create({
        data: {
          orderId: caseRecord.orderId,
          action: 'RETURN_SENT_TO_STORE',
          details: `Return sent to Store by ${req.user?.name || 'Inventory View'}. Reason: ${returnReason.trim()}. ${notes || ''}`.trim(),
          performedBy: req.user?.id || 'SYSTEM'
        }
      });

      return rec;
    });

    await notify.create(req, {
      type: 'return_exchange',
      moduleName: 'Returns',
      path: '/returns',
      role: 'STORE',
      title: 'New Return Request',
      message: `Return request for ${caseRecord.customerName || 'customer'} — ${caseRecord.orderNumber || ''}`,
      orderId: caseRecord.orderId,
      customerName: caseRecord.customerName,
      action: 'Return Requested',
      employeeName: req.user?.name
    }).catch(() => {});

    const io = req.app?.get('io');
    if (io) io.emit('return-exchange-updated', { caseId: id, orderId: caseRecord.orderId });

    res.json({ message: 'Return sent to Store for processing', case: updated });
  } catch (error) {
    console.error('Error sending return to store:', error);
    res.status(500).json({ message: 'Failed to send return to Store', error: error.message });
  }
};

// GET /api/return-exchange/returns/search?orderNumber=XXX — search ReturnExchange cases by order number (Inventory View → Returns only)
const searchReturns = async (req, res) => {
  try {
    const { orderNumber } = req.query;
    if (!orderNumber || !String(orderNumber).trim()) return res.status(400).json({ message: 'orderNumber is required' });
    const q = String(orderNumber).trim();
    const bareNumber = q.replace(/^#/, '');

    const RETURN_TERMINAL = ['COMPLETED', 'CANCELLED'];

    const orderInclude = {
      stages: { orderBy: { createdAt: 'asc' } },
      deliveryAttempts: { orderBy: { attemptNumber: 'desc' } },
      returnExchangeCases: { orderBy: { createdAt: 'desc' } }
    };

    // Priority 1: resolve the exact-number order FIRST so a fuzzy name/phone hit can never win.
    let resolvedOrder = null;
    if (/^REP-/i.test(q)) {
      resolvedOrder = await prisma.order.findFirst({
        where: { source: 'REPLACEMENT', orderNumber: { equals: q, mode: 'insensitive' } },
        include: orderInclude
      });
    } else {
      resolvedOrder = await prisma.order.findFirst({
        where: {
          OR: [
            { orderNumber: { equals: q, mode: 'insensitive' } },
            { orderNumber: { equals: `#${bareNumber}`, mode: 'insensitive' } },
            { invoiceNumber: { equals: q, mode: 'insensitive' } }
          ]
        },
        orderBy: { createdAt: 'desc' },
        include: orderInclude
      });
    }

    // When the exact order exists, return ONLY that order's return cases — never every case
    // whose phone/name merely contains the query.
    let cases = [];
    let completedCases = [];
    if (resolvedOrder) {
      const exactCases = await prisma.returnExchange.findMany({
        where: { orderId: resolvedOrder.id, type: 'RETURN' },
        orderBy: { createdAt: 'desc' },
        take: 25
      });
      cases = exactCases.filter(c => !RETURN_TERMINAL.includes(c.status));
      completedCases = exactCases.filter(c => RETURN_TERMINAL.includes(c.status)).slice(0, 5);
    } else {
      // No exact-number order: fuzzy case search (endsWith / name / phone) as before
      cases = await prisma.returnExchange.findMany({
        where: {
          type: 'RETURN',
          status: { notIn: RETURN_TERMINAL },
          OR: [
            { orderNumber: { equals: q, mode: 'insensitive' } },
            { orderNumber: { endsWith: q, mode: 'insensitive' } },
            { customerName: { contains: q, mode: 'insensitive' } },
            { customerPhone: { contains: q } }
          ]
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      });

      // Also search for COMPLETED return cases so frontend can show "Return Already Completed"
      if (cases.length === 0) {
        completedCases = await prisma.returnExchange.findMany({
          where: {
            type: 'RETURN',
            status: { in: RETURN_TERMINAL },
            OR: [
              { orderNumber: { equals: q, mode: 'insensitive' } },
              { orderNumber: { endsWith: q, mode: 'insensitive' } },
              { customerName: { contains: q, mode: 'insensitive' } },
              { customerPhone: { contains: q } }
            ]
          },
          orderBy: { updatedAt: 'desc' },
          take: 5
        });
      }
    }

    // Enrich with order data
    const allCaseIds = [...cases.map(c => c.id), ...completedCases.map(c => c.id)];
    const orderIds = [...new Set([...cases.map(c => c.orderId), ...completedCases.map(c => c.orderId)].filter(Boolean))];
    let orderMap = {};
    if (orderIds.length) {
      const orders = await prisma.order.findMany({
        where: { id: { in: orderIds } },
        select: {
          id: true, orderNumber: true, customerName: true, customerPhone: true, totalPrice: true, productDetails: true, status: true, currentStage: true,
          returnExchangeCases: {
            orderBy: { createdAt: 'desc' },
            select: { id: true, type: true, status: true, routedTo: true, orderNumber: true, createdAt: true, handledBy: true, replacementOrderId: true, updatedAt: true }
          }
        }
      });
      orderMap = Object.fromEntries(orders.map(o => [o.id, o]));
    }

    const results = cases.map(c => ({
      ...c,
      order: orderMap[c.orderId] || null
    }));

    const completedResults = completedCases.map(c => ({
      ...c,
      order: orderMap[c.orderId] || null
    }));

    // Fallback: if no existing return cases (active or completed), search the Order table directly
    let foundOrder = null;
    if (results.length === 0 && completedResults.length === 0) {
      const orderInclude = {
        stages: { orderBy: { createdAt: 'asc' } },
        deliveryAttempts: { orderBy: { attemptNumber: 'desc' } },
        returnExchangeCases: { orderBy: { createdAt: 'desc' } }
      };

      if (/^REP-/i.test(q)) {
        foundOrder = await prisma.order.findFirst({
          where: { source: 'REPLACEMENT', orderNumber: { equals: q, mode: 'insensitive' } },
          include: orderInclude
        });
      } else {
        // Priority 1: exact order/invoice number match (never a fuzzy hit first)
        foundOrder = await prisma.order.findFirst({
          where: {
            OR: [
              { orderNumber: { equals: q, mode: 'insensitive' } },
              { orderNumber: { equals: `#${bareNumber}`, mode: 'insensitive' } },
              { invoiceNumber: { equals: q, mode: 'insensitive' } }
            ]
          },
          orderBy: { createdAt: 'desc' },
          include: orderInclude
        });

        // Priority 2: fuzzy fallback (endsWith / name / phone) only when no exact match
        if (!foundOrder) {
          foundOrder = await prisma.order.findFirst({
            where: {
              OR: [
                { orderNumber: { endsWith: q, mode: 'insensitive' } },
                { invoiceNumber: { endsWith: q, mode: 'insensitive' } },
                { customerPhone: { contains: q } },
                { customerName: { contains: q, mode: 'insensitive' } }
              ]
            },
            orderBy: { createdAt: 'desc' },
            include: orderInclude
          });
        }
      }

      // Enrich found order with createdBy
      if (foundOrder && !foundOrder.createdBy) {
        try {
          const creator = await prisma.user.findUnique({ where: { id: foundOrder.createdById }, select: { id: true, name: true } });
          if (creator) foundOrder.createdBy = creator;
        } catch {}
      }
    }

    res.json({ cases: results, completedCases: completedResults, total: results.length, order: foundOrder });
  } catch (error) {
    console.error('Error searching returns:', error);
    res.status(500).json({ message: 'Failed to search returns', error: error.message });
  }
};

// GET /api/return-exchange/incoming-returns — centralized auto-populated list of ALL incoming
// RETURN cases from every source (PostEx webhook, Delivery Boy, Dispatch, Online, Outlet).
// Designed for Inventory View's Return & Exchange section as the primary view.
const getIncomingReturns = async (req, res) => {
  try {
    const { status, search, source, page = 1, limit = 100 } = req.query;

    const where = { type: 'RETURN' };

    if (status) {
      where.status = status;
    } else {
      where.status = { notIn: ['COMPLETED', 'CANCELLED'] };
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { orderNumber: { contains: q, mode: 'insensitive' } },
        { customerName: { contains: q, mode: 'insensitive' } },
        { customerPhone: { contains: q } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [cases, total] = await Promise.all([
      prisma.returnExchange.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.returnExchange.count({ where })
    ]);

    // Batch-fetch linked orders for enrichment
    const orderIds = [...new Set(cases.map(c => c.orderId))];
    let orderMap = {};
    if (orderIds.length) {
      const orders = await prisma.order.findMany({
        where: { id: { in: orderIds } },
        select: {
          id: true, orderNumber: true, customerName: true, customerPhone: true,
          totalPrice: true, productDetails: true, status: true, currentStage: true,
          deliveryType: true, deliveryMethod: true, outletName: true, source: true,
          createdAt: true, deliveredAt: true
        }
      });
      orderMap = Object.fromEntries(orders.map(o => [o.id, o]));
    }

    // Batch-fetch PostEx shipments for RETURN cases
    const returnIds = cases.map(c => c.id);
    let shipmentMap = {};
    if (returnIds.length) {
      try {
        const shipments = await prisma.postExShipment.findMany({
          where: { orderId: { in: orderIds } },
          select: { id: true, orderId: true, trackingNumber: true, status: true, totalAmount: true, destinationCity: true },
          orderBy: { createdAt: 'desc' }
        });
        for (const s of shipments) {
          if (!shipmentMap[s.orderId]) shipmentMap[s.orderId] = s;
        }
      } catch {}
    }

    // Enrich and detect source
    const enriched = cases.map(c => {
      const order = orderMap[c.orderId] || null;
      const shipment = shipmentMap[c.orderId] || null;

      // Detect return source from multiple signals
      let returnSource = 'Manual';
      if (shipment) {
        returnSource = 'PostEx';
      } else if (c.deliveryReturnedBy) {
        returnSource = 'Delivery Boy';
      } else if (order?.deliveryType === 'ENAMELS' || order?.deliveryMethod === 'Enamels Delivery') {
        returnSource = 'Enamels Delivery';
      } else if (order?.deliveryType === 'TCS' || order?.deliveryType === 'POST_EX') {
        returnSource = order.deliveryType;
      } else if (order?.source === 'ONLINE ORDER' || order?.source === 'ONLINE') {
        returnSource = 'Online';
      } else if (order?.source === 'OUTLET') {
        returnSource = 'Outlet';
      } else if (order?.source === 'REPLACEMENT') {
        returnSource = 'Replacement';
      } else if (c.handledBy) {
        returnSource = 'Inventory View';
      }

      // Build product summary from original products
      const pd = c.originalProducts || order?.productDetails || [];
      let items = [];
      try {
        const raw = typeof pd === 'string' ? JSON.parse(pd) : pd;
        items = Array.isArray(raw) ? raw : [];
      } catch { items = []; }
      const totalQty = items.reduce((sum, it) => sum + (it.quantity || 1), 0);
      const productNames = items.map(it => {
        const inner = it.productDetails || it;
        return inner.name || inner.productType || 'Product';
      });

      return {
        ...c,
        order,
        postexShipment: shipment || null,
        _returnSource: returnSource,
        _totalQty: totalQty,
        _productNames: productNames,
        _productCount: items.length,
        _orderTotal: order?.totalPrice || 0
      };
    });

    // Client-side source filter (after enrichment since source is derived)
    const filtered = source
      ? enriched.filter(c => c._returnSource.toLowerCase() === source.toLowerCase())
      : enriched;

    // Aggregate stats
    const stats = {
      total: filtered.length,
      pending: filtered.filter(c => c.status === 'PENDING').length,
      accepted: filtered.filter(c => c.status === 'ACCEPTED').length,
      sentToStore: filtered.filter(c => c.routedTo === 'STORE' && c.status === 'PENDING').length,
      sources: {}
    };
    for (const c of filtered) {
      stats.sources[c._returnSource] = (stats.sources[c._returnSource] || 0) + 1;
    }

    res.json({
      cases: filtered,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      stats
    });
  } catch (error) {
    console.error('Error fetching incoming returns:', error);
    res.status(500).json({ message: 'Failed to fetch incoming returns', error: error.message });
  }
};

// POST /api/return-exchange/bulk-complete-stale — mark old/stale PENDING RETURN cases as COMPLETED
// Cases qualify when: handledBy is set (already processed) OR linked order is CANCELLED
const bulkCompleteStaleReturns = async (req, res) => {
  try {
    // Only ADMIN/INVENTORY_VIEW can run this
    const role = req.user?.role;
    if (!['SUPER_ADMIN', 'ADMIN', 'INVENTORY_VIEW'].includes(role)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // 1) Find all unprocessed RETURN cases.
    //    Strict workflow: only PENDING/ACCEPTED that were never actually Store-processed
    //    may be auto-completed as stale. RESTOCKED/ROUTED_TO_PRODUCTION are mid-flow and
    //    must NEVER be auto-completed here — they progress via the strict workflow
    //    (RESTOCKED → Complete Return / ROUTED_TO_PRODUCTION → Production).
    const staleCases = await prisma.returnExchange.findMany({
      where: { type: 'RETURN', status: { in: ['PENDING', 'ACCEPTED'] } },
      select: { id: true, orderId: true, status: true, handledBy: true, createdAt: true }
    });

    if (!staleCases.length) return res.json({ message: 'No pending cases found', completed: 0 });

    // 2) Batch-fetch linked orders to check CANCELLED status
    const orderIds = [...new Set(staleCases.map(c => c.orderId).filter(Boolean))];
    let cancelledOrderIds = new Set();
    if (orderIds.length) {
      const cancelledOrders = await prisma.order.findMany({
        where: { id: { in: orderIds }, status: 'CANCELLED' },
        select: { id: true }
      });
      cancelledOrderIds = new Set(cancelledOrders.map(o => o.id));
    }

    // 3) Identify cases to complete: handledBy set OR order CANCELLED
    const toComplete = staleCases.filter(c => c.handledBy || cancelledOrderIds.has(c.orderId));

    if (!toComplete.length) {
      return res.json({ message: 'No stale cases to complete', completed: 0, totalPending: staleCases.length });
    }

    // 4) Bulk-update to COMPLETED
    const ids = toComplete.map(c => c.id);
    const now = new Date().toISOString();
    await prisma.returnExchange.updateMany({
      where: { id: { in: ids } },
      data: { status: 'COMPLETED' }
    });

    // 5) Emit socket event
    const io = req.app?.get('io');
    if (io) io.emit('return-exchange-updated', { action: 'bulk-complete', count: ids.length });

    res.json({
      message: `${ids.length} stale return case(s) marked as COMPLETED`,
      completed: ids.length,
      totalPending: staleCases.length,
      remaining: staleCases.length - ids.length
    });
  } catch (error) {
    console.error('Error in bulkCompleteStaleReturns:', error);
    res.status(500).json({ message: 'Failed to complete stale returns', error: error.message });
  }
};

// GET /api/return-exchange/completed-returns — return history of completed RETURN cases
const getCompletedReturns = async (req, res) => {
  try {
    const { search, page = 1, limit = 100 } = req.query;

    const where = { type: 'RETURN', status: { in: ['COMPLETED', 'CANCELLED'] } };

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { orderNumber: { contains: q, mode: 'insensitive' } },
        { customerName: { contains: q, mode: 'insensitive' } },
        { customerPhone: { contains: q } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [cases, total] = await Promise.all([
      prisma.returnExchange.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.returnExchange.count({ where })
    ]);

    // Enrich with order data
    const orderIds = [...new Set(cases.map(c => c.orderId).filter(Boolean))];
    let orderMap = {};
    if (orderIds.length) {
      const orders = await prisma.order.findMany({
        where: { id: { in: orderIds } },
        select: { id: true, orderNumber: true, customerName: true, customerPhone: true, totalPrice: true, status: true }
      });
      orderMap = Object.fromEntries(orders.map(o => [o.id, o]));
    }

    const enriched = cases.map(c => ({ ...c, order: orderMap[c.orderId] || null }));

    res.json({
      cases: enriched,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching completed returns:', error);
    res.status(500).json({ message: 'Failed to fetch completed returns', error: error.message });
  }
};

module.exports = { lookupOrder, createReturnExchange, rescheduleDelivery, approveWarehouse, approveFaisal, storeAccept, processByStore, completeReturn, dispatchReplacement, getCaseHistory, getAllCases, checkStockAvailability, sendToStore, getCase, restockOriginal, updateStatus, trackReplacement, getReplacementJobSheetOrder, routeReplacement, redispatchOrder, acceptReturn, searchReturns, sendReturnToStore, getIncomingReturns, acceptProduct, restockProduct, bulkCompleteStaleReturns, getCompletedReturns };
