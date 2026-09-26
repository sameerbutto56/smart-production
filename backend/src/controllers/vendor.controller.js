const prisma = require('../prisma');
const notify = require('../utils/notify');

// ════════════════════════════════════════════════════════════════════════════
// SEQUENCE HELPERS (atomic — safe against double-click / concurrent calls)
// ════════════════════════════════════════════════════════════════════════════

async function nextSequence(prefix, year, client) {
  const db = client || prisma;
  const row = await db.vendorOrderSequence.upsert({
    where: { prefix_year: { prefix, year } },
    create: { prefix, year, nextValue: 1 },
    update: { nextValue: { increment: 1 } },
  });
  // The upsert returns the row AFTER update; fetch the value used.
  // Because upsert returns the new value, request the specific value via a re-read.
  const current = await db.vendorOrderSequence.findUnique({
    where: { prefix_year: { prefix, year } },
  });
  return String(year).padStart(4, '0') + '-' + String(current.nextValue - 1).padStart(5, '0');
}

// Order number VO-YYYY-##### (own prefix, independent of quotation/invoice)
async function nextOrderNumber(client) {
  const db = client || prisma;
  const year = new Date().getFullYear();
  const seq = await db.vendorOrderSequence.upsert({
    where: { prefix_year: { prefix: 'VO', year } },
    create: { prefix: 'VO', year, nextValue: 1 },
    update: { nextValue: { increment: 1 } },
  });
  const current = await db.vendorOrderSequence.findUnique({
    where: { prefix_year: { prefix: 'VO', year } },
  });
  return 'VO-' + String(year).padStart(4, '0') + '-' + String(current.nextValue - 1).padStart(5, '0');
}

// ════════════════════════════════════════════════════════════════════════════
// READ-ONLY CATALOG (from warehouse InventoryItem — never mutates inventory)
// ════════════════════════════════════════════════════════════════════════════

// GET /api/vendors/catalog?search=...
const getCatalog = async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const where = search
      ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { category: { contains: search, mode: 'insensitive' } }] }
      : {};
    const items = await prisma.inventoryItem.findMany({
      where,
      select: { id: true, name: true, category: true, color: true, size: true, price: true, stock: true, variants: true },
      orderBy: { name: 'asc' },
      take: 100,
    });
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch catalog', error: error.message });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// VENDOR CRUD
// ════════════════════════════════════════════════════════════════════════════

// GET /api/vendors
const listVendors = async (req, res) => {
  try {
    const vendors = await prisma.vendor.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { orders: true } } },
    });
    res.json({ vendors });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch vendors', error: error.message });
  }
};

// POST /api/vendors
const createVendor = async (req, res) => {
  try {
    const { name, companyName, contactPerson, phone, email, address, city, notes } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Vendor name is required.' });
    }
    const cleanName = String(name).trim();
    const duplicate = await prisma.vendor.findFirst({
      where: {
        OR: [
          { name: { equals: cleanName, mode: 'insensitive' } },
          ...(phone && String(phone).trim()
            ? [{ phone: String(phone).trim() }]
            : []),
        ],
      },
      select: { id: true, name: true, companyName: true, phone: true },
    });
    if (duplicate) {
      if (duplicate.name && duplicate.name.toLowerCase() === cleanName.toLowerCase()) {
        return res.status(409).json({ message: `A vendor named "${duplicate.name}" already exists.`, vendor: duplicate });
      }
      return res.status(409).json({ message: `A vendor with phone number "${phone}" already exists (${duplicate.name}).`, vendor: duplicate });
    }
    const vendor = await prisma.vendor.create({
      data: {
        name: cleanName,
        companyName: companyName || null,
        contactPerson: contactPerson || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
        city: city || null,
        notes: notes || null,
        createdById: req.user?.id || null,
        createdBy: req.user?.name || null,
      },
    });
    res.status(201).json({ vendor });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create vendor', error: error.message });
  }
};

// PUT /api/vendors/:id
const updateVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, companyName, contactPerson, phone, email, address, city, notes, isActive } = req.body || {};
    const existing = await prisma.vendor.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Vendor not found.' });
    await prisma.vendor.update({
      where: { id },
      data: {
        name: name != null ? String(name).trim() : undefined,
        companyName: companyName !== undefined ? companyName : undefined,
        contactPerson: contactPerson !== undefined ? contactPerson : undefined,
        phone: phone !== undefined ? phone : undefined,
        email: email !== undefined ? email : undefined,
        address: address !== undefined ? address : undefined,
        city: city !== undefined ? city : undefined,
        notes: notes !== undefined ? notes : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
      },
    });
    const vendor = await prisma.vendor.findUnique({ where: { id } });
    res.json({ vendor });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update vendor', error: error.message });
  }
};

// GET /api/vendors/:id  (full history: orders, deliveries, payments, outstanding)
const getVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: {
        orders: {
          orderBy: { createdAt: 'desc' },
          include: {
            items: true,
            payments: true,
            statusHistory: { orderBy: { createdAt: 'asc' } },
            deliveries: true,
            asm: { select: { id: true, name: true, email: true } },
          },
        },
        deliveries: { orderBy: { deliveredAt: 'desc' } },
      },
    });
    if (!vendor) return res.status(404).json({ message: 'Vendor not found.' });

    let totalOrderValue = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    let totalUnits = 0;
    const statusCounts = {};
    const orderCount = vendor.orders.length;
    for (const o of vendor.orders) {
      totalOrderValue += o.grandTotal || 0;
      const paid = (o.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
      totalPaid += paid;
      totalOutstanding += Math.max(0, (o.grandTotal || 0) - paid);
      for (const it of o.items || []) totalUnits += it.quantity || 0;
      const key = o.currentStage || o.status || 'CREATED';
      statusCounts[key] = (statusCounts[key] || 0) + 1;
    }

    const summary = {
      totalOrders: orderCount,
      totalOrderValue,
      totalPaid,
      totalOutstanding,
      totalUnits,
      statusCounts,
    };

    if (req.user?.role !== 'ASM') {
      res.json({ vendor, summary });
      return;
    }

    // ASM sees operational data only — no revenue / profit figures.
    const operationalSummary = {
      totalOrders: summary.totalOrders,
      totalUnits: summary.totalUnits,
      statusCounts: summary.statusCounts,
    };
    res.json({ vendor, summary: operationalSummary });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch vendor', error: error.message });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// VENDOR ORDER WORKFLOW
// ════════════════════════════════════════════════════════════════════════════

// POST /api/vendors/orders  (create vendor order — items snapshot from catalog + payments)
// Roles: ASM, SUPER_ADMIN, ADMIN
const createVendorOrder = async (req, res) => {
  try {
    const {
      vendorId,
      items,          // [{ catalogItemId, productName, productType, color, size, articleName, articleNumber, unit, variant, quantity, unitPrice, notes }]
      payments,       // [{ amount, paymentType, paymentMethod, reference, paymentDate, notes }]
      deliveryCharges = 0,
      discount = 0,
      notes,
      deliveryAddress,
      deliveryCity,
      deliveryDate,
      deliveryType,
      assignedAsmId,
    } = req.body || {};

    if (!vendorId) return res.status(400).json({ message: 'Vendor is required.' });
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) return res.status(404).json({ message: 'Vendor not found.' });

    const lineItems = (Array.isArray(items) ? items : [])
      .filter((i) => i && (i.productName || i.catalogItemId))
      .map((i) => ({
        catalogItemId: i.catalogItemId || null,
        productName: (i.productName || '').trim(),
        productType: i.productType || null,
        color: i.color || null,
        size: i.size || null,
        articleName: i.articleName || null,
        articleNumber: i.articleNumber || null,
        unit: i.unit || null,
        variant: i.variant || null,
        quantity: Math.max(1, parseInt(i.quantity, 10) || 1),
        unitPrice: parseFloat(i.unitPrice) || 0,
        notes: i.notes || null,
      }))
      .map((i) => {
        i.lineTotal = i.quantity * i.unitPrice;
        return i;
      });
    if (lineItems.length === 0) {
      return res.status(400).json({ message: 'At least one product line is required.' });
    }

    const dc = parseFloat(deliveryCharges) || 0;
    const disc = parseFloat(discount) || 0;
    const subtotal = lineItems.reduce((s, i) => s + i.lineTotal, 0);
    const grandTotal = Math.max(0, subtotal + dc - disc);

    const paymentInputs = (Array.isArray(payments) ? payments : [])
      .filter((p) => p && parseFloat(p.amount) > 0)
      .map((p) => ({
        amount: parseFloat(p.amount),
        paymentType: p.paymentType || 'ADVANCE',
        paymentMethod: p.paymentMethod || 'CASH',
        reference: p.reference || null,
        paymentDate: p.paymentDate ? new Date(p.paymentDate) : new Date(),
        recordedBy: req.user?.name || null,
        recordedById: req.user?.id || null,
        notes: p.notes || null,
      }));
    const totalPaid = paymentInputs.reduce((s, p) => s + p.amount, 0);

    const asmId = assignedAsmId || (req.user?.role === 'ASM' ? req.user.id : null);

    const order = await prisma.$transaction(
      async (tx) => {
        const orderNumber = await nextOrderNumber(tx);
        const quotationNumber = await nextSequence('QUO', new Date().getFullYear(), tx);
        const invoiceNumber = await nextSequence('INV', new Date().getFullYear(), tx);

        const created = await tx.vendorOrder.create({
          data: {
            vendorId,
            orderNumber,
            quotationNumber,
            invoiceNumber,
            items: { create: lineItems },
            deliveryCharges: dc,
            discount: disc,
            totalOrderValue: subtotal,
            grandTotal,
            remainingBalance: Math.max(0, grandTotal - totalPaid),
            status: 'CREATED',
            currentStage: 'CREATED',
            asmId,
            assignedAt: asmId ? new Date() : null,
            notes: notes || null,
            deliveryAddress: deliveryAddress || null,
            deliveryCity: deliveryCity || null,
            deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
            createdByName: req.user?.name || null,
            payments: paymentInputs.length ? { create: paymentInputs } : undefined,
            statusHistory: {
              create: {
                status: 'CREATED',
                fromStage: null,
                toStage: 'CREATED',
                changedBy: req.user?.name || null,
                changedById: req.user?.id || null,
                remarks: 'Vendor order created',
              },
            },
          },
          include: { items: true, payments: true },
        });

        // If stock was given up-front, move straight to GIVE_STOCK.
        // Otherwise, auto-submit so it appears for Admin approval.
        const submitted = await tx.vendorOrder.update({
          where: { id: created.id },
          data: {
            status: 'SUBMITTED',
            currentStage: 'SUBMITTED',
            submittedAt: new Date(),
            submittedByName: req.user?.name || null,
          },
          include: { items: true, payments: true, statusHistory: true },
        });

        await tx.vendorOrderStatus.create({
          data: {
            orderId: created.id,
            status: 'SUBMITTED',
            fromStage: 'CREATED',
            toStage: 'SUBMITTED',
            changedBy: req.user?.name || null,
            changedById: req.user?.id || null,
            remarks: 'Order submitted for admin approval',
          },
        });

        return { order: submitted, quotationNumber, invoiceNumber };
      },
      { timeout: 30000 }
    );

    try {
      await notify.create(req, {
        type: 'vendor_order',
        moduleName: 'Vendors',
        path: '/vendors',
        role: ['SUPER_ADMIN', 'ADMIN'],
        title: 'New Vendor Order',
        message: `Vendor order ${order.order.orderNumber} (${vendor.name}) submitted. Total: ${order.order.grandTotal}`,
        orderNumber: order.order.orderNumber,
        customerName: vendor.name,
        action: 'NOTIFY',
        employeeName: req.user?.name || null,
      });
    } catch (e) {}

    res.status(201).json({ order: order.order, quotationNumber: order.quotationNumber, invoiceNumber: order.invoiceNumber });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create vendor order', error: error.message });
  }
};

// GET /api/vendors/orders?status=&asmId=&search=
const listVendorOrders = async (req, res) => {
  try {
    const { status, asmId, search } = req.query;
    const where = {};
    if (status) {
      if (status === 'SUBMITTED' || status === 'AWAITED_ADMIN') {
        where.OR = [
          { status: { in: ['SUBMITTED', 'AWAITED_ADMIN'] } },
          { currentStage: { in: ['SUBMITTED', 'AWAITED_ADMIN'] } },
        ];
      } else if (status === 'ADMIN_APPROVED' || status === 'APPROVED') {
        where.OR = [
          { status: { in: ['ADMIN_APPROVED', 'APPROVED'] } },
          { currentStage: { in: ['ADMIN_APPROVED', 'APPROVED'] } },
        ];
      } else {
        where.status = status;
      }
    }
    if (asmId) where.asmId = asmId;
    else if (req.user?.role === 'ASM') where.asmId = req.user.id;
    if (search) {
      const s = String(search).trim();
      const searchConditions = [
        { orderNumber: { contains: s, mode: 'insensitive' } },
        { vendor: { name: { contains: s, mode: 'insensitive' } } },
      ];
      if (where.OR) {
        where.AND = [
          { OR: where.OR },
          { OR: searchConditions },
        ];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
    }
    const orders = await prisma.vendorOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        vendor: true,
        items: true,
        payments: { orderBy: { createdAt: 'asc' } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
        deliveries: true,
        allocations: true,
        asm: { select: { id: true, name: true, email: true } },
      },
    });

    const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';

    const enrichedOrders = orders.map((order) => {
      const cur = order.currentStage || order.status;
      const isAwaited = ['SUBMITTED', 'AWAITED_ADMIN', 'CREATED'].includes(cur);
      const isApproved = ['ADMIN_APPROVED', 'APPROVED'].includes(cur);

      const clearedPayments = (order.payments || []).filter(p => p.status === 'CLEARED' || !p.status);
      const totalPaid = clearedPayments.reduce((s, p) => s + (p.amount || 0), 0);
      const remaining = Math.max(0, (order.grandTotal || 0) - totalPaid);
      let paymentStatus = 'UNPAID';
      if (totalPaid >= (order.grandTotal || 0) && (order.grandTotal || 0) > 0) paymentStatus = 'PAID';
      else if (totalPaid > 0) paymentStatus = 'PARTIALLY_PAID';

      return {
        ...order,
        totalPaid,
        remainingBalance: remaining,
        paymentStatus,
        canApprove: isAdmin && isAwaited,
        canSendToStore: isAdmin && isApproved,
        canBuyItself: isAdmin && isApproved,
        canReject: isAdmin && isAwaited,
      };
    });

    res.json({ orders: enrichedOrders });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch vendor orders', error: error.message });
  }
};

// GET /api/vendors/orders/:id
const getVendorOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await prisma.vendorOrder.findUnique({
      where: { id },
      include: {
        vendor: true,
        items: true,
        payments: { orderBy: { createdAt: 'asc' } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
        deliveries: true,
        allocations: true,
        routingItems: true,
        inventoryAudits: { orderBy: { createdAt: 'desc' } },
        asm: { select: { id: true, name: true, email: true } },
        documents: { orderBy: { generatedAt: 'asc' } },
        documentRevisions: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!order) return res.status(404).json({ message: 'Vendor order not found.' });

    const clearedPayments = (order.payments || []).filter(p => p.status === 'CLEARED' || !p.status);
    const totalPaid = clearedPayments.reduce((s, p) => s + (p.amount || 0), 0);
    order._totalPaid = totalPaid;
    order._remainingBalance = Math.max(0, order.grandTotal - totalPaid);

    let paymentStatus = 'UNPAID';
    if (totalPaid >= (order.grandTotal || 0) && (order.grandTotal || 0) > 0) paymentStatus = 'PAID';
    else if (totalPaid > 0) paymentStatus = 'PARTIALLY_PAID';
    order.paymentStatus = paymentStatus;

    const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
    const cur = order.currentStage || order.status;
    const isAwaited = ['SUBMITTED', 'AWAITED_ADMIN', 'CREATED'].includes(cur);
    const isApproved = ['ADMIN_APPROVED', 'APPROVED'].includes(cur);
    order.canApprove = isAdmin && isAwaited;
    order.canSendToStore = isAdmin && isApproved;
    order.canBuyItself = isAdmin && isApproved;
    order.canReject = isAdmin && isAwaited;

    res.json({ order });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch vendor order', error: error.message });
  }
};

// ────────────────────────────────────────────────────────────────────────────
// Idempotent status transition helper.
// Each handler checks the current stage so a double-click / retry returns
// "Already <stage>" instead of repeating the mutation.
// ────────────────────────────────────────────────────────────────────────────

async function transition({ orderId, from, to, req, db, set, remarks, auditAction }) {
  // `from` may be an array of allowed prior stages.
  const fromArr = Array.isArray(from) ? from : [from];
  // Atomic claim: only proceed if the order is currently in an allowed stage and
  // the target timestamp is not already set (idempotency guard).
  const existing = await db.vendorOrder.findUnique({ where: { id: orderId } });
  if (!existing) return { error: 'Order not found', status: 404 };
  if (!fromArr.includes(existing.currentStage) && !fromArr.includes(existing.status)) {
    return { error: `Already ${existing.currentStage}`, status: 400, current: existing };
  }
  const claim = await db.vendorOrder.updateMany({
    where: { id: orderId },
    data: { ...set, currentStage: to, status: to, updatedAt: new Date() },
  });
  if (claim.count === 0) {
    const now = await db.vendorOrder.findUnique({ where: { id: orderId } });
    return { error: `Already ${now ? now.currentStage : to}`, status: 400, current: now };
  }
  await db.vendorOrderStatus.create({
    data: {
      orderId,
      status: to,
      fromStage: existing.currentStage || existing.status,
      toStage: to,
      changedBy: req.user?.name || 'Admin',
      changedById: req.user?.id || null,
      remarks,
    },
  });
  const order = await db.vendorOrder.findUnique({
    where: { id: orderId },
    include: { vendor: true, statusHistory: { orderBy: { createdAt: 'asc' } } },
  });
  return { order };
}

// POST /api/vendors/orders/:id/submit  — ASM submits created order for admin review
const submitVendorOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await transition({
      orderId: id,
      from: ['CREATED', 'REJECTED'],
      to: 'SUBMITTED',
      req,
      db: prisma,
      set: { submittedAt: new Date(), submittedByName: req.user?.name || null },
      remarks: 'Order submitted for approval',
    });
    if (result.error) return res.status(result.status || 400).json({ message: result.error });
    res.json({ order: result.order, message: 'Order submitted for approval.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to submit order', error: error.message });
  }
};

// POST /api/vendors/orders/:id/approve — Admin approves
const approveVendorOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await transition({
      orderId: id,
      from: ['SUBMITTED', 'AWAITED_ADMIN', 'CREATED'],
      to: 'ADMIN_APPROVED',
      req,
      db: prisma,
      set: { adminApprovedAt: new Date(), approvedByName: req.user?.name || 'Admin' },
      remarks: 'Order approved by admin',
    });
    if (result.error) return res.status(result.status || 400).json({ message: result.error });
    try {
      await notify.create(req, {
        type: 'vendor_order',
        moduleName: 'Vendors',
        path: '/asm',
        role: ['ASM', 'SUPER_ADMIN', 'ADMIN'],
        title: 'Vendor Order Approved',
        message: `Vendor order ${result.order.orderNumber} approved.`,
        orderNumber: result.order.orderNumber,
        customerName: result.order.vendor?.name,
        action: 'NOTIFY',
        employeeName: req.user?.name || null,
      });
    } catch (e) {}
    res.json({ order: result.order, message: 'Order approved.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to approve order', error: error.message });
  }
};

// POST /api/vendors/orders/:id/reject — Admin rejects
const rejectVendorOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    const existing = await prisma.vendorOrder.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Order not found.' });
    const allowed = ['SUBMITTED', 'AWAITED_ADMIN', 'CREATED'];
    if (!allowed.includes(existing.currentStage) && !allowed.includes(existing.status)) {
      return res.status(400).json({ message: `Cannot reject order in stage ${existing.currentStage}` });
    }
    const claim = await prisma.vendorOrder.updateMany({
      where: { id },
      data: { currentStage: 'REJECTED', status: 'REJECTED', rejectedAt: new Date(), rejectionReason: reason || 'Rejected by admin', updatedAt: new Date() },
    });
    if (claim.count === 0) return res.status(400).json({ message: 'Already rejected.' });
    await prisma.vendorOrderStatus.create({
      data: { orderId: id, status: 'REJECTED', fromStage: existing.currentStage || existing.status, toStage: 'REJECTED', changedBy: req.user?.name || 'Admin', changedById: req.user?.id || null, remarks: reason || 'Rejected by admin' },
    });
    const order = await prisma.vendorOrder.findUnique({ where: { id }, include: { vendor: true, statusHistory: true } });
    res.json({ order, message: 'Order rejected.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to reject order', error: error.message });
  }
};

// POST /api/vendors/orders/:id/production-ready — Admin marks production ready
const markProductionReady = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await transition({
      orderId: id,
      from: ['ADMIN_APPROVED', 'APPROVED'],
      to: 'PRODUCTION_READY',
      req,
      db: prisma,
      set: { productionReadyAt: new Date() },
      remarks: 'Order marked production ready',
    });
    if (result.error) return res.status(result.status || 400).json({ message: result.error });
    res.json({ order: result.order, message: 'Order marked production ready.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to mark production ready', error: error.message });
  }
};

// POST /api/vendors/orders/:id/give-stock — Admin gives stock
const giveStock = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await transition({
      orderId: id,
      from: ['ADMIN_APPROVED', 'APPROVED', 'PRODUCTION_READY'],
      to: 'GIVE_STOCK',
      req,
      db: prisma,
      set: { giveStockAt: new Date(), stockGivenByName: req.user?.name || null },
      remarks: 'Stock given to ASM',
    });
    if (result.error) return res.status(result.status || 400).json({ message: result.error });
    try {
      await notify.create(req, {
        type: 'vendor_order',
        moduleName: 'Vendors',
        path: '/asm',
        role: ['ASM', 'SUPER_ADMIN', 'ADMIN'],
        title: 'Stock Given',
        message: `Stock given for vendor order ${result.order.orderNumber}.`,
        orderNumber: result.order.orderNumber,
        customerName: result.order.vendor?.name,
        action: 'NOTIFY',
        employeeName: req.user?.name || null,
      });
    } catch (e) {}
    res.json({ order: result.order, message: 'Stock given.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to give stock', error: error.message });
  }
};

// POST /api/vendors/orders/:id/send-to-store — Admin sends approved order to Store for allocation
const sendToStore = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await transition({
      orderId: id,
      from: ['ADMIN_APPROVED', 'APPROVED'],
      to: 'SENT_TO_STORE',
      req,
      db: prisma,
      set: {
        fulfillmentMethod: 'SEND_TO_STORE',
        sentToStoreAt: new Date(),
        sentToStoreByName: req.user?.name || null,
      },
      remarks: 'Order sent to Store for Warehouse inventory allocation',
    });
    if (result.error) return res.status(result.status || 400).json({ message: result.error });
    try {
      await notify.create(req, {
        type: 'vendor_order',
        moduleName: 'Store',
        path: '/asm-allowed',
        role: ['STORE', 'SUPER_ADMIN', 'ADMIN'],
        title: 'New ASM Allocation Request',
        message: `ASM Bulk Order ${result.order.orderNumber} sent to Store for inventory allocation.`,
        orderNumber: result.order.orderNumber,
        customerName: result.order.vendor?.name,
        action: 'NOTIFY',
        employeeName: req.user?.name || null,
      });
    } catch (e) {}
    res.json({ order: result.order, message: 'Order sent to Store for ASM Allocation.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to send order to store', error: error.message });
  }
};

// POST /api/vendors/orders/:id/buy-itself — Admin marks fulfillment as Buy Itself
const buyItself = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await transition({
      orderId: id,
      from: ['ADMIN_APPROVED', 'APPROVED'],
      to: 'BUY_ITSELF',
      req,
      db: prisma,
      set: {
        fulfillmentMethod: 'BUY_ITSELF',
      },
      remarks: 'Fulfillment method set to Buy Itself by Admin',
    });
    if (result.error) return res.status(result.status || 400).json({ message: result.error });
    res.json({ order: result.order, message: 'Order marked as Buy Itself.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update order', error: error.message });
  }
};

// GET /api/vendors/orders/store-allocation — List orders sent to store with live warehouse inventory checks
const getStoreAllocationOrders = async (req, res) => {
  try {
    const { status, search } = req.query;
    const where = {};
    if (status) {
      where.currentStage = status;
    } else {
      where.currentStage = {
        in: [
          'SENT_TO_STORE',
          'SENT_TO_ASM',
          'GIVE_STOCK',
          'ASM_ACCEPTED',
          'STORE_TO_LOGO',
          'LOGO',
          'LOGO_ACCEPTED',
          'PRODUCTION_ACCEPTANCE',
          'PRODUCTION',
          'PRODUCTION_OUT',
          'RETURN_FROM_PRODUCTION',
          'STORE_RECEIVED',
          'ASM_RECEIVED'
        ]
      };
    }
    if (search) {
      where.OR = [
        { orderNumber: { contains: String(search).trim(), mode: 'insensitive' } },
        { vendor: { name: { contains: String(search).trim(), mode: 'insensitive' } } },
      ];
    }
    const orders = await prisma.vendorOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        vendor: true,
        items: true,
        payments: { orderBy: { createdAt: 'asc' } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
        asm: { select: { id: true, name: true, email: true } },
        routingItems: true,
        inventoryAudits: { orderBy: { createdAt: 'desc' } },
        allocations: true,
      }
    });

    // Enrich each item with actual warehouse stock (Product + Color + Size)
    const enrichedOrders = await Promise.all(orders.map(async (ord) => {
      const enrichedItems = await Promise.all(ord.items.map(async (item) => {
        let warehouseStock = 0;
        let matchedInventoryItem = null;

        // Try lookup by catalogItemId first
        if (item.catalogItemId) {
          matchedInventoryItem = await prisma.inventoryItem.findUnique({
            where: { id: item.catalogItemId }
          });
        }
        // Fallback by product name
        if (!matchedInventoryItem && item.productName) {
          matchedInventoryItem = await prisma.inventoryItem.findFirst({
            where: {
              name: { equals: item.productName.trim(), mode: 'insensitive' }
            }
          });
        }

        if (matchedInventoryItem) {
          let variants = typeof matchedInventoryItem.variants === 'string'
            ? JSON.parse(matchedInventoryItem.variants)
            : (Array.isArray(matchedInventoryItem.variants) ? matchedInventoryItem.variants : []);

          if (variants && variants.length > 0) {
            const v = variants.find(vr =>
              String(vr.color || '').trim().toLowerCase() === String(item.color || '').trim().toLowerCase() &&
              String(vr.size || '').trim().toLowerCase() === String(item.size || '').trim().toLowerCase()
            );
            if (v) {
              warehouseStock = parseInt(v.stock, 10) || 0;
            } else {
              // Try matching color only if size is empty, or size only if color is empty
              const vColor = variants.filter(vr => String(vr.color || '').trim().toLowerCase() === String(item.color || '').trim().toLowerCase());
              if (vColor.length === 1) {
                warehouseStock = parseInt(vColor[0].stock, 10) || 0;
              } else {
                warehouseStock = parseInt(matchedInventoryItem.stock, 10) || 0;
              }
            }
          } else {
            warehouseStock = parseInt(matchedInventoryItem.stock, 10) || 0;
          }
        }

        const requestedQuantity = item.quantity || 0;
        const allocatedQuantity = item.allocatedQuantity || 0;
        const remainingQuantity = Math.max(0, requestedQuantity - allocatedQuantity);

        return {
          ...item,
          availableWarehouseStock: warehouseStock,
          remainingQuantity,
        };
      }));

      const canAllProductsAvailable = enrichedItems.length > 0 && enrichedItems.every(it => (it.availableWarehouseStock || 0) >= (it.quantity || 0));

      return {
        ...ord,
        canAllProductsAvailable,
        items: enrichedItems
      };
    }));

    res.json({ orders: enrichedOrders });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch store allocation orders', error: error.message });
  }
};

// ── HELPER: Deduct Inventory Variant & Record Audit ─────────────────────────
async function deductWarehouseInventory({ tx, item, deductQty, order, req, actionId }) {
  if (deductQty <= 0) return { deducted: 0, prevStock: 0, newStock: 0 };
  let inv = null;
  if (item.catalogItemId) {
    inv = await tx.inventoryItem.findUnique({ where: { id: item.catalogItemId } });
  }
  if (!inv && item.productName) {
    inv = await tx.inventoryItem.findFirst({
      where: { name: { equals: item.productName.trim(), mode: 'insensitive' } }
    });
  }
  if (!inv) {
    throw new Error(`Inventory item not found for product "${item.productName}"`);
  }

  let variants = typeof inv.variants === 'string'
    ? JSON.parse(inv.variants)
    : (Array.isArray(inv.variants) ? inv.variants : []);

  let prevStock = 0;
  let newStock = 0;

  if (variants && variants.length > 0) {
    const vIdx = variants.findIndex(vr =>
      String(vr.color || '').trim().toLowerCase() === String(item.color || '').trim().toLowerCase() &&
      String(vr.size || '').trim().toLowerCase() === String(item.size || '').trim().toLowerCase()
    );

    if (vIdx !== -1) {
      prevStock = parseInt(variants[vIdx].stock, 10) || 0;
      if (prevStock < deductQty) {
        throw new Error(`Insufficient warehouse stock for ${inv.name} (${item.color || ''} / ${item.size || ''}). Available: ${prevStock}, Requested: ${deductQty}`);
      }
      newStock = prevStock - deductQty;
      variants[vIdx] = { ...variants[vIdx], stock: newStock };
      const newTotal = Math.max(0, variants.reduce((s, v) => s + (parseInt(v.stock, 10) || 0), 0));
      await tx.inventoryItem.update({
        where: { id: inv.id },
        data: { stock: newTotal, variants }
      });
    } else {
      prevStock = parseInt(inv.stock, 10) || 0;
      if (prevStock < deductQty) {
        throw new Error(`Insufficient warehouse stock for ${inv.name}. Available: ${prevStock}, Requested: ${deductQty}`);
      }
      newStock = prevStock - deductQty;
      await tx.inventoryItem.update({
        where: { id: inv.id },
        data: { stock: { decrement: deductQty } }
      });
    }
  } else {
    prevStock = parseInt(inv.stock, 10) || 0;
    if (prevStock < deductQty) {
      throw new Error(`Insufficient warehouse stock for ${inv.name}. Available: ${prevStock}, Requested: ${deductQty}`);
    }
    newStock = prevStock - deductQty;
    await tx.inventoryItem.update({
      where: { id: inv.id },
      data: { stock: { decrement: deductQty } }
    });
  }

  // Create authoritative VendorOrderInventoryAudit record (Requirement 12)
  await tx.vendorOrderInventoryAudit.create({
    data: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderItemId: item.id,
      vendorId: order.vendorId || null,
      vendorName: order.vendor?.name || null,
      asmId: order.asmId || null,
      asmName: order.asm?.name || null,
      inventoryItemId: inv.id,
      productName: item.productName,
      color: item.color || null,
      size: item.size || null,
      requiredQuantity: item.quantity,
      availableQuantity: deductQty,
      allocatedQuantity: deductQty,
      remainingQuantity: Math.max(0, item.quantity - deductQty),
      previousInventory: prevStock,
      newInventory: newStock,
      storeUser: req.user?.name || 'Main Store',
      storeUserId: req.user?.id || null,
      source: 'ASM Store Allocation',
      actionId: actionId || 'STORE_ALLOCATION',
    }
  });

  return { deducted: deductQty, prevStock, newStock };
}

// POST /api/vendors/orders/:id/store-allocate — Store allocates warehouse inventory and sends/marks to ASM
const storeAllocate = async (req, res) => {
  try {
    const { id } = req.params;
    const { allocations } = req.body || {}; // [{ itemId, allocatedQuantity }]

    if (!Array.isArray(allocations) || allocations.length === 0) {
      return res.status(400).json({ message: 'Allocations array is required.' });
    }

    const order = await prisma.vendorOrder.findUnique({
      where: { id },
      include: { items: true, vendor: true, asm: true }
    });

    if (!order) return res.status(404).json({ message: 'Order not found.' });
    if (!['SENT_TO_STORE', 'ADMIN_APPROVED'].includes(order.currentStage)) {
      return res.status(400).json({ message: `Order cannot be allocated in stage ${order.currentStage}.` });
    }

    // Atomic transaction for inventory deduction and allocation finalization
    const updatedOrder = await prisma.$transaction(async (tx) => {
      let totalAllocatedUnits = 0;
      const now = new Date();

      // Clean up any existing allocations for this order to ensure single source of truth
      await tx.vendorOrderAllocation.deleteMany({ where: { orderId: id } });

      for (const alloc of allocations) {
        const item = order.items.find(it => it.id === alloc.itemId);
        if (!item) continue;

        const allocQty = parseInt(alloc.allocatedQuantity, 10) || 0;
        if (allocQty < 0) {
          throw new Error(`Allocated quantity cannot be negative for ${item.productName}`);
        }
        if (allocQty > item.quantity) {
          throw new Error(`Allocated quantity (${allocQty}) cannot exceed requested quantity (${item.quantity}) for ${item.productName}`);
        }

        // Deduct inventory only if allocQty > 0
        if (allocQty > 0) {
          await deductWarehouseInventory({
            tx,
            item,
            deductQty: allocQty,
            order,
            req,
            actionId: 'STORE_ALLOCATION',
          });
        }

        // Update allocatedQuantity on VendorOrderItem
        await tx.vendorOrderItem.update({
          where: { id: item.id },
          data: { allocatedQuantity: allocQty }
        });

        // Upsert Routing Item
        const existingRouting = await tx.vendorOrderRoutingItem.findFirst({
          where: { orderId: id, orderItemId: item.id }
        });
        const checkStatus = allocQty === item.quantity ? 'FULLY_AVAILABLE' : (allocQty > 0 ? 'PARTIALLY_AVAILABLE' : 'NOT_AVAILABLE');
        if (existingRouting) {
          await tx.vendorOrderRoutingItem.update({
            where: { id: existingRouting.id },
            data: {
              storeAvailableQuantity: allocQty,
              remainingQuantity: Math.max(0, item.quantity - allocQty),
              storeCheckStatus: checkStatus,
              storeCheckedAt: now,
              storeCheckedByName: req.user?.name || 'Main Store',
              availableRoute: 'ASM',
              availableAllocatedQty: allocQty,
              availableSentToAsmAt: now,
            }
          });
        } else {
          await tx.vendorOrderRoutingItem.create({
            data: {
              orderId: id,
              orderItemId: item.id,
              catalogItemId: item.catalogItemId || null,
              productName: item.productName,
              color: item.color || null,
              size: item.size || null,
              requiredQuantity: item.quantity,
              storeAvailableQuantity: allocQty,
              remainingQuantity: Math.max(0, item.quantity - allocQty),
              storeCheckStatus: checkStatus,
              storeCheckedAt: now,
              storeCheckedByName: req.user?.name || 'Main Store',
              availableRoute: 'ASM',
              availableAllocatedQty: allocQty,
              availableSentToAsmAt: now,
            }
          });
        }

        // Create authoritative VendorOrderAllocation record
        await tx.vendorOrderAllocation.create({
          data: {
            allocationNumber: `ALC-${order.orderNumber}-${item.id.slice(0, 6)}`,
            orderId: id,
            orderItemId: item.id,
            vendorId: order.vendorId,
            asmId: order.asmId,
            storeName: 'Main Store / Warehouse',
            catalogItemId: item.catalogItemId || null,
            productName: item.productName,
            color: item.color || null,
            size: item.size || null,
            requestedQuantity: item.quantity,
            allocatedQuantity: allocQty,
            remainingQuantity: Math.max(0, item.quantity - allocQty),
            sentBy: req.user?.name || 'Main Store',
            sentById: req.user?.id || null,
            sentAt: now,
            handoverStatus: 'SENT_TO_ASM',
          }
        });

        totalAllocatedUnits += allocQty;
      }

      // Finalize order status to SENT_TO_ASM
      const updated = await tx.vendorOrder.update({
        where: { id },
        data: {
          currentStage: 'SENT_TO_ASM',
          status: 'SENT_TO_ASM',
          allocatedAt: now,
          allocatedByName: req.user?.name || null,
          storeName: 'Main Store / Warehouse',
          giveStockAt: now,
          stockGivenByName: req.user?.name || null,
          updatedAt: now
        },
        include: {
          vendor: true,
          items: true,
          statusHistory: { orderBy: { createdAt: 'asc' } },
          asm: { select: { id: true, name: true, email: true } },
          payments: true,
          allocations: true,
          routingItems: true,
          inventoryAudits: { orderBy: { createdAt: 'desc' } },
        }
      });

      await tx.vendorOrderStatus.create({
        data: {
          orderId: id,
          status: 'SENT_TO_ASM',
          fromStage: order.currentStage,
          toStage: 'SENT_TO_ASM',
          changedBy: req.user?.name || null,
          changedById: req.user?.id || null,
          remarks: `Store verified warehouse inventory and allocated ${totalAllocatedUnits} units. Marked to ASM.`,
        }
      });

      return updated;
    }, { timeout: 30000 });

    try {
      await notify.create(req, {
        type: 'vendor_order',
        moduleName: 'ASM',
        path: '/asm',
        role: ['ASM', 'SUPER_ADMIN', 'ADMIN'],
        title: 'Stock Allocated to ASM',
        message: `Store allocated inventory for Bulk Order ${updatedOrder.orderNumber} (${updatedOrder.vendor?.name}). Ready for ASM Acceptance.`,
        orderNumber: updatedOrder.orderNumber,
        customerName: updatedOrder.vendor?.name,
        action: 'NOTIFY',
        employeeName: req.user?.name || null,
      });
    } catch (e) {}

    res.json({ order: updatedOrder, message: 'Stock allocated from Warehouse and marked to ASM successfully.' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to allocate stock', error: error.message });
  }
};

// POST /api/vendors/orders/:id/store-check-availability — Item-by-item availability confirmation & deduction
const storeCheckAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { items: checkedItems } = req.body || {}; // [{ itemId, availableQuantity }]

    if (!Array.isArray(checkedItems) || checkedItems.length === 0) {
      return res.status(400).json({ message: 'Items array is required for availability check.' });
    }

    const order = await prisma.vendorOrder.findUnique({
      where: { id },
      include: { items: true, vendor: true, asm: true, routingItems: true }
    });

    if (!order) return res.status(404).json({ message: 'Order not found.' });

    const updated = await prisma.$transaction(async (tx) => {
      const now = new Date();
      let totalDeducted = 0;

      for (const chk of checkedItems) {
        const item = order.items.find(it => it.id === chk.itemId);
        if (!item) continue;

        const availQty = parseInt(chk.availableQuantity, 10) || 0;
        if (availQty < 0 || availQty > item.quantity) {
          throw new Error(`Invalid available quantity (${availQty}) for ${item.productName}`);
        }

        const existingRouting = order.routingItems?.find(r => r.orderItemId === item.id);
        const alreadyAllocated = existingRouting ? existingRouting.storeAvailableQuantity : (item.allocatedQuantity || 0);

        // Deduct the net new available quantity if greater than already allocated
        const netDeduct = Math.max(0, availQty - alreadyAllocated);
        if (netDeduct > 0) {
          await deductWarehouseInventory({
            tx,
            item,
            deductQty: netDeduct,
            order,
            req,
            actionId: 'STORE_CHECK_AVAILABILITY',
          });
          totalDeducted += netDeduct;
        }

        // Update allocatedQuantity on line item
        await tx.vendorOrderItem.update({
          where: { id: item.id },
          data: { allocatedQuantity: availQty }
        });

        // Upsert routing item
        const remQty = Math.max(0, item.quantity - availQty);
        const checkStatus = availQty === item.quantity ? 'FULLY_AVAILABLE' : (availQty > 0 ? 'PARTIALLY_AVAILABLE' : 'NOT_AVAILABLE');

        if (existingRouting) {
          await tx.vendorOrderRoutingItem.update({
            where: { id: existingRouting.id },
            data: {
              storeAvailableQuantity: availQty,
              remainingQuantity: remQty,
              storeCheckStatus: checkStatus,
              storeCheckedAt: now,
              storeCheckedByName: req.user?.name || 'Main Store',
            }
          });
        } else {
          await tx.vendorOrderRoutingItem.create({
            data: {
              orderId: id,
              orderItemId: item.id,
              catalogItemId: item.catalogItemId || null,
              productName: item.productName,
              color: item.color || null,
              size: item.size || null,
              requiredQuantity: item.quantity,
              storeAvailableQuantity: availQty,
              remainingQuantity: remQty,
              storeCheckStatus: checkStatus,
              storeCheckedAt: now,
              storeCheckedByName: req.user?.name || 'Main Store',
            }
          });
        }
      }

      await tx.vendorOrderStatus.create({
        data: {
          orderId: id,
          status: order.currentStage,
          fromStage: order.currentStage,
          toStage: order.currentStage,
          changedBy: req.user?.name || 'Main Store',
          changedById: req.user?.id || null,
          remarks: `Store confirmed availability check. Deducted ${totalDeducted} units from warehouse inventory.`,
        }
      });

      return await tx.vendorOrder.findUnique({
        where: { id },
        include: {
          vendor: true,
          items: true,
          statusHistory: { orderBy: { createdAt: 'asc' } },
          asm: { select: { id: true, name: true, email: true } },
          routingItems: true,
          inventoryAudits: { orderBy: { createdAt: 'desc' } },
          allocations: true,
        }
      });
    }, { timeout: 30000 });

    res.json({ order: updated, message: 'Store availability confirmed and inventory deducted.' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to check store availability', error: error.message });
  }
};

// POST /api/vendors/orders/:id/all-products-available — Single click action when all items are available
const allProductsAvailable = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.vendorOrder.findUnique({
      where: { id },
      include: { items: true, vendor: true, asm: true, routingItems: true }
    });

    if (!order) return res.status(404).json({ message: 'Order not found.' });

    // Validate that all items can be fulfilled from warehouse
    for (const item of order.items) {
      let inv = null;
      if (item.catalogItemId) {
        inv = await prisma.inventoryItem.findUnique({ where: { id: item.catalogItemId } });
      }
      if (!inv && item.productName) {
        inv = await prisma.inventoryItem.findFirst({
          where: { name: { equals: item.productName.trim(), mode: 'insensitive' } }
        });
      }
      if (!inv) {
        return res.status(400).json({ message: `Inventory item not found for product "${item.productName}".` });
      }

      let stock = 0;
      let variants = typeof inv.variants === 'string'
        ? JSON.parse(inv.variants)
        : (Array.isArray(inv.variants) ? inv.variants : []);

      if (variants && variants.length > 0) {
        const v = variants.find(vr =>
          String(vr.color || '').trim().toLowerCase() === String(item.color || '').trim().toLowerCase() &&
          String(vr.size || '').trim().toLowerCase() === String(item.size || '').trim().toLowerCase()
        );
        stock = v ? (parseInt(v.stock, 10) || 0) : (parseInt(inv.stock, 10) || 0);
      } else {
        stock = parseInt(inv.stock, 10) || 0;
      }

      const existingRouting = order.routingItems?.find(r => r.orderItemId === item.id);
      const alreadyAllocated = existingRouting ? existingRouting.storeAvailableQuantity : (item.allocatedQuantity || 0);
      const needed = Math.max(0, item.quantity - alreadyAllocated);

      if (stock < needed) {
        return res.status(400).json({
          message: `Cannot mark all available: insufficient warehouse stock for "${item.productName}" (${item.color || ''} / ${item.size || ''}). Required: ${item.quantity}, Available: ${stock}.`
        });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const now = new Date();
      let totalUnits = 0;

      for (const item of order.items) {
        const existingRouting = order.routingItems?.find(r => r.orderItemId === item.id);
        const alreadyAllocated = existingRouting ? existingRouting.storeAvailableQuantity : (item.allocatedQuantity || 0);
        const needed = Math.max(0, item.quantity - alreadyAllocated);

        if (needed > 0) {
          await deductWarehouseInventory({
            tx,
            item,
            deductQty: needed,
            order,
            req,
            actionId: 'ALL_PRODUCTS_AVAILABLE',
          });
        }

        // Update allocatedQuantity on line item to 100%
        await tx.vendorOrderItem.update({
          where: { id: item.id },
          data: { allocatedQuantity: item.quantity }
        });

        // Upsert routing item to ALL_AVAILABLE
        if (existingRouting) {
          await tx.vendorOrderRoutingItem.update({
            where: { id: existingRouting.id },
            data: {
              storeAvailableQuantity: item.quantity,
              remainingQuantity: 0,
              storeCheckStatus: 'ALL_AVAILABLE',
              storeCheckedAt: now,
              storeCheckedByName: req.user?.name || 'Main Store',
            }
          });
        } else {
          await tx.vendorOrderRoutingItem.create({
            data: {
              orderId: id,
              orderItemId: item.id,
              catalogItemId: item.catalogItemId || null,
              productName: item.productName,
              color: item.color || null,
              size: item.size || null,
              requiredQuantity: item.quantity,
              storeAvailableQuantity: item.quantity,
              remainingQuantity: 0,
              storeCheckStatus: 'ALL_AVAILABLE',
              storeCheckedAt: now,
              storeCheckedByName: req.user?.name || 'Main Store',
            }
          });
        }

        totalUnits += item.quantity;
      }

      await tx.vendorOrderStatus.create({
        data: {
          orderId: id,
          status: order.currentStage,
          fromStage: order.currentStage,
          toStage: order.currentStage,
          changedBy: req.user?.name || 'Main Store',
          changedById: req.user?.id || null,
          remarks: `Store confirmed ALL PRODUCTS AVAILABLE. Verified and allocated ${totalUnits} units across all items.`,
        }
      });

      return await tx.vendorOrder.findUnique({
        where: { id },
        include: {
          vendor: true,
          items: true,
          statusHistory: { orderBy: { createdAt: 'asc' } },
          asm: { select: { id: true, name: true, email: true } },
          routingItems: true,
          inventoryAudits: { orderBy: { createdAt: 'desc' } },
          allocations: true,
        }
      });
    }, { timeout: 30000 });

    res.json({ order: updated, message: 'All products marked available and warehouse inventory deducted.' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to execute all products available', error: error.message });
  }
};

// POST /api/vendors/orders/:id/store-route — Store routes available items to ASM, or processing items to LOGO / PRODUCTION
const storeRoute = async (req, res) => {
  try {
    const { id } = req.params;
    const { routes } = req.body || {};
    // routes: [{ itemId, availableRoute: 'ASM', processingRoute: 'LOGO'|'PRODUCTION', processingQuantity, logoNotes, productionNotes }]

    if (!Array.isArray(routes) || routes.length === 0) {
      return res.status(400).json({ message: 'Routes array is required.' });
    }

    const order = await prisma.vendorOrder.findUnique({
      where: { id },
      include: { items: true, vendor: true, asm: true, routingItems: true }
    });

    if (!order) return res.status(404).json({ message: 'Order not found.' });

    const updated = await prisma.$transaction(async (tx) => {
      const now = new Date();
      let hasLogo = false;
      let hasProd = false;
      let hasAsm = false;

      for (const r of routes) {
        const item = order.items.find(it => it.id === r.itemId);
        if (!item) continue;

        let routing = await tx.vendorOrderRoutingItem.findFirst({
          where: { orderId: id, orderItemId: item.id }
        });

        if (!routing) {
          routing = await tx.vendorOrderRoutingItem.create({
            data: {
              orderId: id,
              orderItemId: item.id,
              catalogItemId: item.catalogItemId || null,
              productName: item.productName,
              color: item.color || null,
              size: item.size || null,
              requiredQuantity: item.quantity,
              storeAvailableQuantity: item.allocatedQuantity || 0,
              remainingQuantity: Math.max(0, item.quantity - (item.allocatedQuantity || 0)),
              storeCheckStatus: 'CHECKED',
            }
          });
        }

        const updateData = {};

        // Available Route handling (to ASM)
        if (r.availableRoute === 'ASM' && routing.storeAvailableQuantity > 0) {
          hasAsm = true;
          updateData.availableRoute = 'ASM';
          updateData.availableAllocatedQty = routing.storeAvailableQuantity;
          updateData.availableSentToAsmAt = now;

          // Upsert authoritative VendorOrderAllocation record
          const existingAlloc = await tx.vendorOrderAllocation.findFirst({
            where: { orderId: id, orderItemId: item.id }
          });
          if (existingAlloc) {
            await tx.vendorOrderAllocation.update({
              where: { id: existingAlloc.id },
              data: {
                allocatedQuantity: routing.storeAvailableQuantity,
                remainingQuantity: Math.max(0, item.quantity - routing.storeAvailableQuantity),
                handoverStatus: 'SENT_TO_ASM',
                sentAt: now,
                sentBy: req.user?.name || 'Main Store',
              }
            });
          } else {
            await tx.vendorOrderAllocation.create({
              data: {
                allocationNumber: `ALC-${order.orderNumber}-${item.id.slice(0, 6)}`,
                orderId: id,
                orderItemId: item.id,
                vendorId: order.vendorId,
                asmId: order.asmId,
                storeName: 'Main Store / Warehouse',
                catalogItemId: item.catalogItemId || null,
                productName: item.productName,
                color: item.color || null,
                size: item.size || null,
                requestedQuantity: item.quantity,
                allocatedQuantity: routing.storeAvailableQuantity,
                remainingQuantity: Math.max(0, item.quantity - routing.storeAvailableQuantity),
                sentBy: req.user?.name || 'Main Store',
                sentById: req.user?.id || null,
                sentAt: now,
                handoverStatus: 'SENT_TO_ASM',
              }
            });
          }
        }

        // Processing Route handling (LOGO or PRODUCTION)
        if (r.processingRoute === 'LOGO') {
          hasLogo = true;
          const procQty = parseInt(r.processingQuantity, 10) || routing.remainingQuantity || item.quantity;
          const jsNum = `JS-LOGO-${order.orderNumber}-${item.id.slice(0, 6).toUpperCase()}`;
          updateData.processingRoute = 'LOGO';
          updateData.processingQuantity = procQty;
          updateData.currentProcessingStage = 'STORE_TO_LOGO';
          updateData.logoNotes = r.logoNotes || null;
          updateData.jobSheetNumber = jsNum;
          updateData.sentToLogoAt = now;
        } else if (r.processingRoute === 'PRODUCTION') {
          hasProd = true;
          const procQty = parseInt(r.processingQuantity, 10) || routing.remainingQuantity || item.quantity;
          const jsNum = `JS-PROD-${order.orderNumber}-${item.id.slice(0, 6).toUpperCase()}`;
          updateData.processingRoute = 'PRODUCTION';
          updateData.processingQuantity = procQty;
          updateData.currentProcessingStage = 'PRODUCTION_ACCEPTANCE';
          updateData.productionNotes = r.productionNotes || null;
          updateData.jobSheetNumber = jsNum;
          updateData.sentToProductionAt = now;
        }

        await tx.vendorOrderRoutingItem.update({
          where: { id: routing.id },
          data: updateData,
        });
      }

      // Determine order-level stage progression
      let newStage = order.currentStage;
      if (hasLogo) {
        newStage = 'LOGO';
      } else if (hasProd) {
        newStage = 'PRODUCTION';
      } else if (hasAsm) {
        newStage = 'SENT_TO_ASM';
      }

      const ord = await tx.vendorOrder.update({
        where: { id },
        data: {
          currentStage: newStage,
          status: newStage,
          storeName: 'Main Store / Warehouse',
          giveStockAt: hasAsm ? now : order.giveStockAt,
          stockGivenByName: hasAsm ? (req.user?.name || 'Main Store') : order.stockGivenByName,
          updatedAt: now,
        },
        include: {
          vendor: true,
          items: true,
          statusHistory: { orderBy: { createdAt: 'asc' } },
          asm: { select: { id: true, name: true, email: true } },
          routingItems: true,
          inventoryAudits: { orderBy: { createdAt: 'desc' } },
          allocations: true,
        }
      });

      await tx.vendorOrderStatus.create({
        data: {
          orderId: id,
          status: newStage,
          fromStage: order.currentStage,
          toStage: newStage,
          changedBy: req.user?.name || 'Main Store',
          changedById: req.user?.id || null,
          remarks: `Store routed items: ${hasLogo ? 'LOGO ' : ''}${hasProd ? 'PRODUCTION ' : ''}${hasAsm ? 'ASM ' : ''}`.trim(),
        }
      });

      return ord;
    }, { timeout: 30000 });

    res.json({ order: updated, message: 'Items routed successfully.' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to route items', error: error.message });
  }
};

// ── LOGO DEPARTMENT QUEUE & ACTIONS ─────────────────────────────────────────

// GET /api/vendors/orders/logo-queue
const getLogoQueue = async (req, res) => {
  try {
    const items = await prisma.vendorOrderRoutingItem.findMany({
      where: {
        processingRoute: 'LOGO',
        currentProcessingStage: { in: ['STORE_TO_LOGO', 'LOGO', 'LOGO_ACCEPTED'] },
      },
      include: {
        order: {
          include: {
            vendor: true,
            asm: { select: { id: true, name: true, email: true } },
            items: true,
          }
        },
        orderItem: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch logo queue', error: error.message });
  }
};

// POST /api/vendors/orders/:id/logo-accept — Logo team accepts work
const logoAccept = async (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date();

    const order = await prisma.vendorOrder.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    await prisma.$transaction(async (tx) => {
      await tx.vendorOrderRoutingItem.updateMany({
        where: {
          orderId: id,
          processingRoute: 'LOGO',
          currentProcessingStage: { in: ['STORE_TO_LOGO', 'LOGO'] },
        },
        data: {
          currentProcessingStage: 'LOGO_ACCEPTED',
          logoAcceptedAt: now,
        }
      });

      await tx.vendorOrderStatus.create({
        data: {
          orderId: id,
          status: 'LOGO_ACCEPTED',
          fromStage: order.currentStage,
          toStage: 'LOGO_ACCEPTED',
          changedBy: req.user?.name || 'Logo Dept',
          changedById: req.user?.id || null,
          remarks: 'Logo department accepted order for printing/embroidery',
        }
      });
    });

    res.json({ message: 'Logo department accepted work.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to accept logo work', error: error.message });
  }
};

// POST /api/vendors/orders/:id/logo-complete — Logo team finishes work, forwards to Production
const logoComplete = async (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date();

    const order = await prisma.vendorOrder.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    const updated = await prisma.$transaction(async (tx) => {
      await tx.vendorOrderRoutingItem.updateMany({
        where: {
          orderId: id,
          processingRoute: 'LOGO',
          currentProcessingStage: { in: ['STORE_TO_LOGO', 'LOGO', 'LOGO_ACCEPTED'] },
        },
        data: {
          currentProcessingStage: 'PRODUCTION_ACCEPTANCE',
          logoCompletedAt: now,
          sentToProductionAt: now,
        }
      });

      const ord = await tx.vendorOrder.update({
        where: { id },
        data: {
          currentStage: 'PRODUCTION',
          status: 'PRODUCTION',
          updatedAt: now,
        }
      });

      await tx.vendorOrderStatus.create({
        data: {
          orderId: id,
          status: 'PRODUCTION_ACCEPTANCE',
          fromStage: order.currentStage,
          toStage: 'PRODUCTION',
          changedBy: req.user?.name || 'Logo Dept',
          changedById: req.user?.id || null,
          remarks: 'Logo completed. Forwarded to Production Acceptance.',
        }
      });

      return ord;
    });

    res.json({ order: updated, message: 'Logo complete. Order forwarded to Production.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to complete logo work', error: error.message });
  }
};

// ── PRODUCTION DEPARTMENT QUEUE & ACTIONS ───────────────────────────────────

// GET /api/vendors/orders/production-queue
const getProductionQueue = async (req, res) => {
  try {
    const items = await prisma.vendorOrderRoutingItem.findMany({
      where: {
        currentProcessingStage: { in: ['PRODUCTION_ACCEPTANCE', 'PRODUCTION'] },
      },
      include: {
        order: {
          include: {
            vendor: true,
            asm: { select: { id: true, name: true, email: true } },
            items: true,
          }
        },
        orderItem: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch production queue', error: error.message });
  }
};

// POST /api/vendors/orders/:id/production-accept — Production accepts work
const productionAccept = async (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date();

    const order = await prisma.vendorOrder.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    await prisma.$transaction(async (tx) => {
      await tx.vendorOrderRoutingItem.updateMany({
        where: {
          orderId: id,
          currentProcessingStage: 'PRODUCTION_ACCEPTANCE',
        },
        data: {
          currentProcessingStage: 'PRODUCTION',
          productionAcceptedAt: now,
        }
      });

      await tx.vendorOrderStatus.create({
        data: {
          orderId: id,
          status: 'PRODUCTION',
          fromStage: order.currentStage,
          toStage: 'PRODUCTION',
          changedBy: req.user?.name || 'Production',
          changedById: req.user?.id || null,
          remarks: 'Production accepted order manufacturing',
        }
      });
    });

    res.json({ message: 'Production department accepted order.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to accept production work', error: error.message });
  }
};

// POST /api/vendors/orders/:id/production-out — Production finishes work and returns to Store
const productionOut = async (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date();

    const order = await prisma.vendorOrder.findUnique({
      where: { id },
      include: { routingItems: true }
    });
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    const updated = await prisma.$transaction(async (tx) => {
      for (const r of order.routingItems) {
        if (['PRODUCTION', 'PRODUCTION_ACCEPTANCE'].includes(r.currentProcessingStage)) {
          await tx.vendorOrderRoutingItem.update({
            where: { id: r.id },
            data: {
              currentProcessingStage: 'RETURN_FROM_PRODUCTION',
              productionOutAt: now,
              returnedFromProductionAt: now,
              productionOutQuantity: r.processingQuantity,
            }
          });
        }
      }

      const ord = await tx.vendorOrder.update({
        where: { id },
        data: {
          currentStage: 'RETURN_FROM_PRODUCTION',
          status: 'RETURN_FROM_PRODUCTION',
          updatedAt: now,
        }
      });

      await tx.vendorOrderStatus.create({
        data: {
          orderId: id,
          status: 'RETURN_FROM_PRODUCTION',
          fromStage: order.currentStage,
          toStage: 'RETURN_FROM_PRODUCTION',
          changedBy: req.user?.name || 'Production',
          changedById: req.user?.id || null,
          remarks: 'Production completed. Returned to Store for receipt and ASM handover.',
        }
      });

      return ord;
    });

    res.json({ order: updated, message: 'Production complete. Returned to Store.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to complete production out', error: error.message });
  }
};

// ── STORE RETURN FROM PRODUCTION & SECONDARY ASM ROUTING ────────────────────

// GET /api/vendors/orders/production-returns — Store inspects items returned from production
const getProductionReturns = async (req, res) => {
  try {
    const items = await prisma.vendorOrderRoutingItem.findMany({
      where: {
        currentProcessingStage: { in: ['RETURN_FROM_PRODUCTION', 'STORE_RECEIVED'] },
      },
      include: {
        order: {
          include: {
            vendor: true,
            asm: { select: { id: true, name: true, email: true } },
            items: true,
          }
        },
        orderItem: true,
      },
      orderBy: { returnedFromProductionAt: 'desc' },
    });
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch production returns', error: error.message });
  }
};

// POST /api/vendors/orders/:id/receive-production-return — Store verifies and receives returned items
// ZERO SECONDARY INVENTORY DEDUCTION!
const receiveProductionReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const { items: receivedList } = req.body || {}; // [{ routingItemId, receivedQuantity }]
    const now = new Date();

    const order = await prisma.vendorOrder.findUnique({
      where: { id },
      include: { routingItems: true, items: true }
    });
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    const updated = await prisma.$transaction(async (tx) => {
      let totalReceived = 0;

      for (const r of order.routingItems) {
        if (r.currentProcessingStage === 'RETURN_FROM_PRODUCTION') {
          const matchInput = Array.isArray(receivedList) ? receivedList.find(x => x.routingItemId === r.id) : null;
          const recQty = matchInput ? (parseInt(matchInput.receivedQuantity, 10) || r.productionOutQuantity || r.processingQuantity) : (r.productionOutQuantity || r.processingQuantity);

          await tx.vendorOrderRoutingItem.update({
            where: { id: r.id },
            data: {
              currentProcessingStage: 'STORE_RECEIVED',
              storeReceivedReturnAt: now,
              storeReceivedReturnQty: recQty,
              storeReceivedByName: req.user?.name || 'Main Store',
            }
          });
          totalReceived += recQty;
        }
      }

      const ord = await tx.vendorOrder.update({
        where: { id },
        data: {
          currentStage: 'STORE_RECEIVED',
          status: 'STORE_RECEIVED',
          updatedAt: now,
        }
      });

      await tx.vendorOrderStatus.create({
        data: {
          orderId: id,
          status: 'STORE_RECEIVED',
          fromStage: order.currentStage,
          toStage: 'STORE_RECEIVED',
          changedBy: req.user?.name || 'Main Store',
          changedById: req.user?.id || null,
          remarks: `Store verified and received ${totalReceived} units returned from Production. Zero inventory deducted.`,
        }
      });

      return ord;
    });

    res.json({ order: updated, message: 'Returned stock received in store without secondary inventory deduction.' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to receive returned stock', error: error.message });
  }
};

// POST /api/vendors/orders/:id/return-to-asm — Store sends returned production items to ASM
const returnToAsm = async (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date();

    const order = await prisma.vendorOrder.findUnique({
      where: { id },
      include: { routingItems: true, items: true, vendor: true, asm: true }
    });
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    const updated = await prisma.$transaction(async (tx) => {
      let totalSent = 0;

      for (const r of order.routingItems) {
        if (['STORE_RECEIVED', 'RETURN_FROM_PRODUCTION'].includes(r.currentProcessingStage)) {
          const handoverQty = r.storeReceivedReturnQty || r.productionOutQuantity || r.processingQuantity;

          await tx.vendorOrderRoutingItem.update({
            where: { id: r.id },
            data: {
              currentProcessingStage: 'SENT_TO_ASM',
              returnSentToAsmAt: now,
            }
          });

          // Create/update allocation record for ASM handover
          const existingAlloc = await tx.vendorOrderAllocation.findFirst({
            where: { orderId: id, orderItemId: r.orderItemId }
          });

          if (existingAlloc) {
            await tx.vendorOrderAllocation.update({
              where: { id: existingAlloc.id },
              data: {
                allocatedQuantity: (existingAlloc.allocatedQuantity || 0) + handoverQty,
                handoverStatus: 'SENT_TO_ASM',
                sentAt: now,
                sentBy: req.user?.name || 'Main Store',
              }
            });
          } else {
            await tx.vendorOrderAllocation.create({
              data: {
                allocationNumber: `ALC-RET-${order.orderNumber}-${r.orderItemId.slice(0, 6)}`,
                orderId: id,
                orderItemId: r.orderItemId,
                vendorId: order.vendorId,
                asmId: order.asmId,
                storeName: 'Main Store / Warehouse',
                catalogItemId: r.catalogItemId || null,
                productName: r.productName,
                color: r.color || null,
                size: r.size || null,
                requestedQuantity: r.requiredQuantity,
                allocatedQuantity: handoverQty,
                remainingQuantity: 0,
                sentBy: req.user?.name || 'Main Store',
                sentById: req.user?.id || null,
                sentAt: now,
                handoverStatus: 'SENT_TO_ASM',
              }
            });
          }

          totalSent += handoverQty;
        }
      }

      const ord = await tx.vendorOrder.update({
        where: { id },
        data: {
          currentStage: 'SENT_TO_ASM',
          status: 'SENT_TO_ASM',
          giveStockAt: now,
          stockGivenByName: req.user?.name || 'Main Store',
          updatedAt: now,
        },
        include: {
          vendor: true,
          items: true,
          statusHistory: { orderBy: { createdAt: 'asc' } },
          asm: { select: { id: true, name: true, email: true } },
          allocations: true,
          routingItems: true,
        }
      });

      await tx.vendorOrderStatus.create({
        data: {
          orderId: id,
          status: 'SENT_TO_ASM',
          fromStage: order.currentStage,
          toStage: 'SENT_TO_ASM',
          changedBy: req.user?.name || 'Main Store',
          changedById: req.user?.id || null,
          remarks: `Store marked ${totalSent} units of returned production items to ASM. Delivery Sheet ready.`,
        }
      });

      return ord;
    });

    try {
      await notify.create(req, {
        type: 'vendor_order',
        moduleName: 'ASM',
        path: '/asm',
        role: ['ASM', 'SUPER_ADMIN', 'ADMIN'],
        title: 'Returned Stock Sent to ASM',
        message: `Returned production stock for Bulk Order ${order.orderNumber} (${order.vendor?.name}) marked to ASM. Ready for Acceptance.`,
        orderNumber: order.orderNumber,
        customerName: order.vendor?.name,
        action: 'NOTIFY',
        employeeName: req.user?.name || null,
      });
    } catch (e) {}

    res.json({ order: updated, message: 'Returned stock sent to ASM successfully. Delivery Sheet ready.' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to send returned stock to ASM', error: error.message });
  }
};

// POST /api/vendors/orders/:id/accept — ASM accepts / receives stock
// ZERO SECONDARY INVENTORY DEDUCTION!
const asmAccept = async (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date();
    const order = await prisma.vendorOrder.findUnique({
      where: { id },
      include: { routingItems: true, allocations: true }
    });
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    const validStages = ['GIVE_STOCK', 'SENT_TO_ASM', 'STORE_RECEIVED', 'RETURN_FROM_PRODUCTION'];
    if (!validStages.includes(order.currentStage) && !validStages.includes(order.status) && (order.allocations?.length === 0)) {
      return res.status(400).json({ message: `Cannot accept order in stage ${order.currentStage}` });
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Update allocation records to ASM_RECEIVED
      await tx.vendorOrderAllocation.updateMany({
        where: { orderId: id },
        data: {
          handoverStatus: 'ASM_RECEIVED',
          receivedBy: req.user?.name || 'ASM',
          receivedById: req.user?.id || null,
          receivedAt: now,
        }
      });

      // Update routing items
      for (const r of order.routingItems || []) {
        const updateR = {};
        if (r.availableRoute === 'ASM') {
          updateR.availableAsmReceivedAt = now;
        }
        if (r.returnSentToAsmAt || r.currentProcessingStage === 'SENT_TO_ASM') {
          updateR.returnAsmReceivedAt = now;
          updateR.returnAsmReceivedQty = r.storeReceivedReturnQty || r.processingQuantity;
          updateR.currentProcessingStage = 'ASM_RECEIVED';
        }
        if (Object.keys(updateR).length > 0) {
          await tx.vendorOrderRoutingItem.update({
            where: { id: r.id },
            data: updateR,
          });
        }
      }

      // Update order to ASM_RECEIVED (and ASM_ACCEPTED for backward compatibility)
      const ord = await tx.vendorOrder.update({
        where: { id },
        data: {
          currentStage: 'ASM_RECEIVED',
          status: 'ASM_RECEIVED',
          asmAcceptedAt: now,
          acceptedByName: req.user?.name || null,
          asmReceivedAt: now,
          asmReceivedByName: req.user?.name || null,
          updatedAt: now,
        },
        include: {
          vendor: true,
          items: true,
          payments: { orderBy: { createdAt: 'asc' } },
          statusHistory: { orderBy: { createdAt: 'asc' } },
          allocations: true,
          routingItems: true,
          inventoryAudits: { orderBy: { createdAt: 'desc' } },
          asm: { select: { id: true, name: true, email: true } },
        }
      });

      // Audit status history
      await tx.vendorOrderStatus.create({
        data: {
          orderId: id,
          status: 'ASM_RECEIVED',
          fromStage: order.currentStage,
          toStage: 'ASM_RECEIVED',
          changedBy: req.user?.name || null,
          changedById: req.user?.id || null,
          remarks: 'ASM received and accepted stock. Zero secondary inventory deduction.',
        }
      });

      return ord;
    });

    res.json({ order: updated, message: 'Stock received and accepted by ASM successfully.' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to accept order', error: error.message });
  }
};

// POST /api/vendors/orders/:id/deliver — ASM delivers to vendor (records delivery, sets DELIVERED)
const deliverOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { carrier, notes, address, city } = req.body || {};
    const existing = await prisma.vendorOrder.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Order not found.' });
    if (!['ASM_ACCEPTED', 'ASM_RECEIVED', 'DELIVER'].includes(existing.currentStage)) {
      return res.status(400).json({ message: `Cannot deliver order in stage ${existing.currentStage}` });
    }
    const claim = await prisma.vendorOrder.updateMany({
      where: { id, currentStage: { in: ['ASM_ACCEPTED', 'ASM_RECEIVED', 'DELIVER'] } },
      data: { currentStage: 'DELIVERED', status: 'DELIVERED', deliveredAt: new Date(), deliveredByName: req.user?.name || null, updatedAt: new Date() },
    });
    if (claim.count === 0) {
      const now = await prisma.vendorOrder.findUnique({ where: { id } });
      return res.status(400).json({ message: `Already ${now ? now.currentStage : 'DELIVERED'}` });
    }
    await prisma.vendorOrderStatus.create({
      data: { orderId: id, status: 'DELIVERED', fromStage: existing.currentStage, toStage: 'DELIVERED', changedBy: req.user?.name || null, changedById: req.user?.id || null, remarks: 'Delivered to vendor' },
    });
    await prisma.vendorDelivery.create({
      data: {
        vendorId: existing.vendorId,
        orderId: id,
        orderNumber: existing.orderNumber,
        address: address || existing.deliveryAddress,
        city: city || existing.deliveryCity,
        carrier,
        deliveredBy: req.user?.name || null,
        deliveredById: req.user?.id || null,
        notes,
      },
    });
    const order = await prisma.vendorOrder.findUnique({ where: { id }, include: { vendor: true, statusHistory: true, allocations: true } });
    res.json({ order, message: 'Order delivered.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to deliver order', error: error.message });
  }
};

// POST /api/vendors/orders/:id/complete — mark completed
const completeOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await transition({
      orderId: id,
      from: ['DELIVERED'],
      to: 'COMPLETED',
      req,
      db: prisma,
      set: { completedAt: new Date(), completedByName: req.user?.name || null },
      remarks: 'Order completed',
    });
    if (result.error) return res.status(result.status || 400).json({ message: result.error });
    res.json({ order: result.order, message: 'Order completed.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to complete order', error: error.message });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// PAYMENTS & FINANCIAL LEDGER
// ════════════════════════════════════════════════════════════════════════════

// POST /api/vendors/orders/:id/pay — record a payment (idempotent per request)
const recordPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      amount,
      paymentType,
      paymentMethod,
      reference,
      chequeNumber,
      bankName,
      chequeDate,
      status,
      paymentDate,
      notes,
    } = req.body || {};
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return res.status(400).json({ message: 'A positive payment amount is required.' });

    const order = await prisma.vendorOrder.findUnique({ where: { id }, include: { payments: true } });
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    if (['CANCELLED', 'REJECTED'].includes(order.currentStage)) {
      return res.status(400).json({ message: 'Cannot add payment to a cancelled/rejected order.' });
    }

    const finalMethod = String(paymentMethod || 'CASH').toUpperCase();
    const finalType = String(paymentType || 'ADDITIONAL').toUpperCase();
    const finalStatus = status ? String(status).toUpperCase() : (finalMethod === 'CHEQUE' ? 'PENDING' : 'CLEARED');

    const payment = await prisma.vendorPayment.create({
      data: {
        orderId: id,
        vendorId: order.vendorId,
        amount: amt,
        paymentType: finalType,
        paymentMethod: finalMethod,
        reference: reference || null,
        chequeNumber: chequeNumber || null,
        bankName: bankName || null,
        chequeDate: chequeDate ? new Date(chequeDate) : null,
        status: finalStatus,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        recordedBy: req.user?.name || null,
        recordedById: req.user?.id || null,
        notes: notes || null,
      },
    });

    // Recompute total valid paid amount (only CLEARED payments count)
    const validPayments = await prisma.vendorPayment.findMany({
      where: { orderId: id, status: 'CLEARED' },
    });
    const totalPaid = validPayments.reduce((s, p) => s + (p.amount || 0), 0);
    const advancePaid = validPayments
      .filter((p) => p.paymentType === 'ADVANCE')
      .reduce((s, p) => s + (p.amount || 0), 0);
    const remaining = Math.max(0, order.grandTotal - totalPaid);

    await prisma.vendorOrder.update({
      where: { id },
      data: {
        advancePaid,
        remainingBalance: remaining,
        updatedAt: new Date(),
      },
    });

    await prisma.vendorOrderStatus.create({
      data: {
        orderId: id,
        status: order.currentStage,
        fromStage: order.currentStage,
        toStage: order.currentStage,
        changedBy: req.user?.name || null,
        changedById: req.user?.id || null,
        remarks: `Payment recorded: Rs. ${amt.toLocaleString()} (${finalType} via ${finalMethod}${finalMethod === 'CHEQUE' ? ` - Cheque #${chequeNumber || 'N/A'}, Status: ${finalStatus}` : ''})`,
      },
    });

    const updated = await prisma.vendorOrder.findUnique({
      where: { id },
      include: {
        vendor: true,
        payments: { orderBy: { createdAt: 'asc' } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
        allocations: true,
      },
    });
    res.status(201).json({ payment, order: updated, remainingBalance: remaining, totalPaid });
  } catch (error) {
    res.status(500).json({ message: 'Failed to record payment', error: error.message });
  }
};

// PUT /api/vendors/payments/:paymentId — edit/correct payment with audit log
const updatePayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const {
      amount,
      paymentType,
      paymentMethod,
      reference,
      chequeNumber,
      bankName,
      chequeDate,
      status,
      paymentDate,
      notes,
      reason,
    } = req.body || {};

    const existingPayment = await prisma.vendorPayment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });
    if (!existingPayment) return res.status(404).json({ message: 'Payment record not found.' });

    const newAmount = amount !== undefined ? parseFloat(amount) : existingPayment.amount;
    if (isNaN(newAmount) || newAmount <= 0) {
      return res.status(400).json({ message: 'A valid positive payment amount is required.' });
    }

    const prevAmount = existingPayment.amount;
    const diff = newAmount - prevAmount;

    // Create immutable audit log
    await prisma.vendorPaymentAudit.create({
      data: {
        paymentId,
        orderId: existingPayment.orderId,
        previousAmount: prevAmount,
        newAmount: newAmount,
        difference: diff,
        editedBy: req.user?.name || 'Admin',
        editedById: req.user?.id || null,
        reason: reason || 'Payment details corrected by admin',
      },
    });

    const finalMethod = paymentMethod ? String(paymentMethod).toUpperCase() : existingPayment.paymentMethod;
    const finalType = paymentType ? String(paymentType).toUpperCase() : existingPayment.paymentType;
    const finalStatus = status ? String(status).toUpperCase() : existingPayment.status;

    const updatedPayment = await prisma.vendorPayment.update({
      where: { id: paymentId },
      data: {
        amount: newAmount,
        paymentType: finalType,
        paymentMethod: finalMethod,
        reference: reference !== undefined ? reference : existingPayment.reference,
        chequeNumber: chequeNumber !== undefined ? chequeNumber : existingPayment.chequeNumber,
        bankName: bankName !== undefined ? bankName : existingPayment.bankName,
        chequeDate: chequeDate !== undefined ? (chequeDate ? new Date(chequeDate) : null) : existingPayment.chequeDate,
        status: finalStatus,
        paymentDate: paymentDate ? new Date(paymentDate) : existingPayment.paymentDate,
        notes: notes !== undefined ? notes : existingPayment.notes,
        updatedAt: new Date(),
      },
    });

    // Recompute order totals
    const validPayments = await prisma.vendorPayment.findMany({
      where: { orderId: existingPayment.orderId, status: 'CLEARED' },
    });
    const totalPaid = validPayments.reduce((s, p) => s + (p.amount || 0), 0);
    const advancePaid = validPayments
      .filter((p) => p.paymentType === 'ADVANCE')
      .reduce((s, p) => s + (p.amount || 0), 0);
    const remaining = Math.max(0, existingPayment.order.grandTotal - totalPaid);

    await prisma.vendorOrder.update({
      where: { id: existingPayment.orderId },
      data: {
        advancePaid,
        remainingBalance: remaining,
        updatedAt: new Date(),
      },
    });

    res.json({
      payment: updatedPayment,
      message: 'Payment updated and audit recorded successfully.',
      totalPaid,
      remainingBalance: remaining,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update payment', error: error.message });
  }
};

// GET /api/vendors/payments — all payments with filters
const listPayments = async (req, res) => {
  try {
    const { vendorId, orderId, paymentMethod, paymentType, status } = req.query;
    const where = {};
    if (vendorId) where.vendorId = vendorId;
    if (orderId) where.orderId = orderId;
    if (paymentMethod) where.paymentMethod = paymentMethod;
    if (paymentType) where.paymentType = paymentType;
    if (status) where.status = status;

    const payments = await prisma.vendorPayment.findMany({
      where,
      orderBy: { paymentDate: 'desc' },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            currentStage: true,
            grandTotal: true,
            vendor: { select: { id: true, name: true, companyName: true, phone: true } },
          },
        },
      },
      take: 500,
    });
    res.json({ payments });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch payments', error: error.message });
  }
};

// GET /api/vendors/financial-summary — comprehensive ASM financial overview (Admin)
const getFinancialSummary = async (req, res) => {
  try {
    const orders = await prisma.vendorOrder.findMany({
      include: {
        vendor: true,
        payments: true,
        items: true,
        allocations: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const allPayments = await prisma.vendorPayment.findMany({
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            currentStage: true,
            status: true,
            vendor: { select: { id: true, name: true, companyName: true, phone: true } },
          },
        },
      },
      orderBy: { paymentDate: 'desc' },
    });

    // Valid orders (exclude rejected/cancelled for active value calculations)
    const validOrders = orders.filter((o) => !['REJECTED', 'CANCELLED'].includes(o.currentStage));

    // Summary calculation
    const totalOrders = orders.length;
    const totalOrderValue = validOrders.reduce((s, o) => s + (o.grandTotal || 0), 0);

    // Cleared payments sum
    const clearedPayments = allPayments.filter((p) => p.status === 'CLEARED' || !p.status);
    const totalPaid = clearedPayments.reduce((s, p) => s + (p.amount || 0), 0);

    // Advance received
    const totalAdvanceReceived = clearedPayments
      .filter((p) => p.paymentType === 'ADVANCE')
      .reduce((s, p) => s + (p.amount || 0), 0);

    // Remaining
    const totalRemaining = Math.max(0, totalOrderValue - totalPaid);

    // Total spent/fulfilled (orders that are in fulfillment or completed)
    const fulfilledStages = ['ALLOCATED', 'SENT_TO_ASM', 'ASM_ACCEPTED', 'ASM_RECEIVED', 'DELIVER', 'DELIVERED', 'COMPLETED'];
    const totalSpentFulfilled = orders
      .filter((o) => fulfilledStages.includes(o.currentStage))
      .reduce((s, o) => s + (o.grandTotal || 0), 0);

    const totalOutstanding = validOrders
      .filter((o) => o.currentStage !== 'COMPLETED')
      .reduce((s, o) => {
        const orderPaid = o.payments
          .filter((p) => p.status === 'CLEARED' || !p.status)
          .reduce((sum, p) => sum + (p.amount || 0), 0);
        return s + Math.max(0, (o.grandTotal || 0) - orderPaid);
      }, 0);

    // Method Breakdown (reconciles with totalPaid)
    const methods = {
      CASH: { amount: 0, count: 0 },
      ONLINE: { amount: 0, count: 0 },
      BANK_TRANSFER: { amount: 0, count: 0 },
      CHEQUE: { amount: 0, count: 0, pendingAmount: 0, pendingCount: 0 },
      CARD: { amount: 0, count: 0 },
      OTHER: { amount: 0, count: 0 },
    };

    allPayments.forEach((p) => {
      const m = String(p.paymentMethod || 'OTHER').toUpperCase();
      const amt = p.amount || 0;
      const isCleared = p.status === 'CLEARED' || !p.status;

      if (m === 'CHEQUE') {
        if (isCleared) {
          methods.CHEQUE.amount += amt;
          methods.CHEQUE.count += 1;
        } else if (p.status === 'PENDING') {
          methods.CHEQUE.pendingAmount += amt;
          methods.CHEQUE.pendingCount += 1;
        }
      } else {
        const target = methods[m] || methods.OTHER;
        if (isCleared) {
          target.amount += amt;
          target.count += 1;
        }
      }
    });

    // Vendor-wise financial breakdown
    const vendorMap = {};
    const vendors = await prisma.vendor.findMany({
      orderBy: { name: 'asc' },
    });

    vendors.forEach((v) => {
      vendorMap[v.id] = {
        vendorId: v.id,
        vendorName: v.name,
        companyName: v.companyName,
        phone: v.phone,
        ordersCount: 0,
        totalOrderValue: 0,
        advancePaid: 0,
        totalPaid: 0,
        remaining: 0,
      };
    });

    orders.forEach((o) => {
      if (['REJECTED', 'CANCELLED'].includes(o.currentStage)) return;
      if (!vendorMap[o.vendorId]) {
        vendorMap[o.vendorId] = {
          vendorId: o.vendorId,
          vendorName: o.vendor?.name || 'Unknown',
          companyName: o.vendor?.companyName || null,
          phone: o.vendor?.phone || null,
          ordersCount: 0,
          totalOrderValue: 0,
          advancePaid: 0,
          totalPaid: 0,
          remaining: 0,
        };
      }
      const entry = vendorMap[o.vendorId];
      entry.ordersCount += 1;
      entry.totalOrderValue += (o.grandTotal || 0);

      const orderCleared = (o.payments || []).filter((p) => p.status === 'CLEARED' || !p.status);
      const paid = orderCleared.reduce((sum, p) => sum + (p.amount || 0), 0);
      const adv = orderCleared.filter((p) => p.paymentType === 'ADVANCE').reduce((sum, p) => sum + (p.amount || 0), 0);
      entry.totalPaid += paid;
      entry.advancePaid += adv;
    });

    Object.values(vendorMap).forEach((v) => {
      v.remaining = Math.max(0, v.totalOrderValue - v.totalPaid);
    });

    const vendorSummary = Object.values(vendorMap).filter((v) => v.ordersCount > 0);

    res.json({
      summary: {
        totalOrders,
        totalOrderValue,
        totalAdvanceReceived,
        totalPaid,
        totalRemaining,
        totalSpentFulfilled,
        totalOutstanding,
      },
      methodBreakdown: methods,
      vendorSummary,
      recentPayments: allPayments.slice(0, 100),
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch financial summary', error: error.message });
  }
};

// GET /api/vendors/:id/financials — vendor financial detail (Admin)
const getVendorFinancialDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: {
        orders: {
          include: {
            items: true,
            payments: { orderBy: { paymentDate: 'desc' } },
            allocations: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!vendor) return res.status(404).json({ message: 'Vendor not found.' });

    const validOrders = vendor.orders.filter((o) => !['REJECTED', 'CANCELLED'].includes(o.currentStage));
    const totalOrderValue = validOrders.reduce((s, o) => s + (o.grandTotal || 0), 0);

    let allPayments = [];
    vendor.orders.forEach((o) => {
      (o.payments || []).forEach((p) => {
        allPayments.push({
          ...p,
          orderNumber: o.orderNumber,
          orderStage: o.currentStage,
        });
      });
    });

    allPayments.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));

    const clearedPayments = allPayments.filter((p) => p.status === 'CLEARED' || !p.status);
    const totalPaid = clearedPayments.reduce((s, p) => s + (p.amount || 0), 0);
    const totalAdvance = clearedPayments.filter((p) => p.paymentType === 'ADVANCE').reduce((s, p) => s + (p.amount || 0), 0);
    const totalRemaining = Math.max(0, totalOrderValue - totalPaid);

    const paymentAudits = await prisma.vendorPaymentAudit.findMany({
      where: { orderId: { in: vendor.orders.map((o) => o.id) } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      vendor: {
        id: vendor.id,
        name: vendor.name,
        companyName: vendor.companyName,
        phone: vendor.phone,
        email: vendor.email,
        address: vendor.address,
        city: vendor.city,
      },
      totals: {
        totalOrders: validOrders.length,
        totalOrderValue,
        totalAdvance,
        totalPaid,
        totalRemaining,
      },
      orders: vendor.orders.map((o) => {
        const orderCleared = (o.payments || []).filter((p) => p.status === 'CLEARED' || !p.status);
        const paid = orderCleared.reduce((sum, p) => sum + (p.amount || 0), 0);
        const rem = Math.max(0, (o.grandTotal || 0) - paid);
        let paymentStatus = 'UNPAID';
        if (paid >= (o.grandTotal || 0) && (o.grandTotal || 0) > 0) paymentStatus = 'PAID';
        else if (paid > 0) paymentStatus = 'PARTIALLY_PAID';

        return {
          id: o.id,
          orderNumber: o.orderNumber,
          createdAt: o.createdAt,
          currentStage: o.currentStage,
          grandTotal: o.grandTotal,
          paidAmount: paid,
          remainingBalance: rem,
          paymentStatus,
          fulfillmentStatus: o.currentStage,
          itemsCount: o.items.length,
          totalUnits: o.items.reduce((s, it) => s + (it.quantity || 0), 0),
          allocatedUnits: o.items.reduce((s, it) => s + (it.allocatedQuantity || 0), 0),
          items: o.items,
        };
      }),
      payments: allPayments,
      audits: paymentAudits,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch vendor financial details', error: error.message });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// DOCUMENT GENERATION (Quotation / Invoice)
// ════════════════════════════════════════════════════════════════════════════

// POST /api/vendors/orders/:id/generate-documents — (re)generate quotation + invoice records
const generateDocuments = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await prisma.vendorOrder.findUnique({
      where: { id },
      include: { vendor: true, items: true, payments: true, documents: true },
    });
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    const itemsSnapshot = order.items.map((i) => ({
      productName: i.productName,
      productType: i.productType,
      color: i.color,
      size: i.size,
      articleName: i.articleName,
      articleNumber: i.articleNumber,
      unit: i.unit,
      variant: i.variant,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
    }));

    const totalPaid = order.payments.reduce((s, p) => s + p.amount, 0);
    const remaining = Math.max(0, order.grandTotal - totalPaid);

    // Idempotent: quote + invoice numbers are fixed on the order; upsert documents.
    if (!order.documents.some((d) => d.docType === 'QUOTATION')) {
      await prisma.quotation.upsert({
        where: { quotationNumber: order.quotationNumber },
        create: { quotationNumber: order.quotationNumber, orderId: id, vendorId: order.vendorId, vendorName: order.vendor.name, items: itemsSnapshot, total: order.grandTotal, status: 'DRAFT', generatedBy: req.user?.name || null, generatedById: req.user?.id || null },
        update: {},
      });
      await prisma.vendorDocument.create({
        data: { orderId: id, docType: 'QUOTATION', docNumber: order.quotationNumber, items: itemsSnapshot, total: order.grandTotal, generatedBy: req.user?.name || null, generatedById: req.user?.id || null },
      });
    }
    if (!order.documents.some((d) => d.docType === 'INVOICE')) {
      await prisma.invoice.upsert({
        where: { invoiceNumber: order.invoiceNumber },
        create: { invoiceNumber: order.invoiceNumber, orderId: id, vendorId: order.vendorId, vendorName: order.vendor.name, items: itemsSnapshot, total: order.grandTotal, paidAmount: totalPaid, remainingBalance: remaining, status: remaining <= 0 ? 'PAID' : totalPaid > 0 ? 'PARTIAL' : 'UNPAID', generatedBy: req.user?.name || null, generatedById: req.user?.id || null },
        update: { paidAmount: totalPaid, remainingBalance: remaining, status: remaining <= 0 ? 'PAID' : totalPaid > 0 ? 'PARTIAL' : 'UNPAID' },
      });
      await prisma.vendorDocument.create({
        data: { orderId: id, docType: 'INVOICE', docNumber: order.invoiceNumber, items: itemsSnapshot, total: order.grandTotal, generatedBy: req.user?.name || null, generatedById: req.user?.id || null },
      });
    }

    const updated = await prisma.vendorOrder.findUnique({
      where: { id },
      include: { vendor: true, items: true, payments: true, documents: { orderBy: { generatedAt: 'asc' } }, statusHistory: true },
    });
    res.json({ order: updated, quotationNumber: order.quotationNumber, invoiceNumber: order.invoiceNumber });
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate documents', error: error.message });
  }
};

// GET /api/vendors/orders/:id/documents — document records for the order
const getOrderDocuments = async (req, res) => {
  try {
    const { id } = req.params;
    const documents = await prisma.vendorDocument.findMany({ where: { orderId: id }, orderBy: { generatedAt: 'asc' } });
    res.json({ documents });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch documents', error: error.message });
  }
};

// POST /api/vendors/orders/:id/document-revision
// Saves document customizations (Save & Print workflow) and records an immutable audit revision
const saveDocumentRevision = async (req, res) => {
  try {
    const { id } = req.params;
    const { documentType, documentNumber, customFields = {}, changesMade } = req.body;
    if (!documentType) {
      return res.status(400).json({ message: 'documentType is required (DELIVERY_SHEET, QUOTATION, INVOICE, JOB_SHEET)' });
    }

    const order = await prisma.vendorOrder.findUnique({
      where: { id },
      include: { vendor: true, asm: true },
    });
    if (!order) return res.status(404).json({ message: 'Vendor order not found.' });

    // Calculate version
    const revisionCount = await prisma.vendorDocumentRevision.count({
      where: { orderId: id, documentType },
    });
    const previousVersion = revisionCount;
    const updatedVersion = revisionCount + 1;

    // Build changes summary if not explicitly provided
    let summary = changesMade;
    if (!summary) {
      const fieldNames = Object.keys(customFields).filter((k) => customFields[k]);
      summary = fieldNames.length > 0
        ? `Updated fields: ${fieldNames.join(', ')}`
        : 'Saved document custom settings';
    }

    // Update savedDocumentCustomData on order
    const existingCustomData = (order.savedDocumentCustomData && typeof order.savedDocumentCustomData === 'object')
      ? { ...order.savedDocumentCustomData }
      : {};
    existingCustomData[documentType] = {
      ...(existingCustomData[documentType] || {}),
      ...customFields,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.name || req.user?.email || 'User',
      version: updatedVersion,
    };

    const updateData = {
      savedDocumentCustomData: existingCustomData,
    };

    const revision = await prisma.$transaction(async (tx) => {
      await tx.vendorOrder.update({
        where: { id },
        data: updateData,
      });

      return await tx.vendorDocumentRevision.create({
        data: {
          orderId: id,
          documentType,
          documentNumber: documentNumber || order.orderNumber,
          previousVersion,
          updatedVersion,
          changesMade: summary,
          customFields,
          editedById: req.user?.id || null,
          editedByName: req.user?.name || req.user?.email || 'Authorized User',
        },
      });
    });

    res.json({
      success: true,
      revision,
      savedCustomData: existingCustomData,
      message: `Document revision v${updatedVersion} saved successfully`,
    });
  } catch (error) {
    console.error('saveDocumentRevision error:', error);
    res.status(500).json({ message: 'Failed to save document revision', error: error.message });
  }
};

// GET /api/vendors/orders/:id/document-revisions
const getDocumentRevisions = async (req, res) => {
  try {
    const { id } = req.params;
    const { documentType } = req.query;
    const where = { orderId: id };
    if (documentType) where.documentType = documentType;

    const revisions = await prisma.vendorDocumentRevision.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    res.json({ revisions });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch document revisions', error: error.message });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// ASM + ADMIN ANALYTICS (operational only — NO "revenue generated for ASM")
// ════════════════════════════════════════════════════════════════════════════

// GET /api/vendors/analytics?asmId=  — overall operational stats
const getAnalytics = async (req, res) => {
  try {
    const { asmId } = req.query;
    const orAsm = asmId ? { asmId } : {};
    const where = req.user?.role === 'ASM' ? { asmId: req.user.id } : orAsm;

    const [statusCounts, totalUnits, vendors, payments] = await Promise.all([
      prisma.vendorOrder.groupBy({ by: ['status'], where, _count: { _all: true } }),
      prisma.vendorOrderItem.aggregate({ where: { order: where }, _sum: { quantity: true } }),
      prisma.vendor.count(),
      prisma.vendorPayment.aggregate({ where: { order: where }, _sum: { amount: true } }),
    ]);

    const stats = { CREATED: 0, SUBMITTED: 0, ADMIN_APPROVED: 0, PRODUCTION_READY: 0, GIVE_STOCK: 0, ASM_ACCEPTED: 0, DELIVER: 0, DELIVERED: 0, COMPLETED: 0, CANCELLED: 0, REJECTED: 0 };
    for (const row of statusCounts) stats[row.status] = row._count._all;

    res.json({
      stats,
      totalUnits: totalUnits._sum.quantity || 0,
      vendorCount: vendors,
      totalPayments: payments._sum.amount || 0,
      active: stats.SUBMITTED + stats.ADMIN_APPROVED + stats.PRODUCTION_READY + stats.GIVE_STOCK + stats.ASM_ACCEPTED + stats.DELIVER,
      pending: stats.SUBMITTED + stats.ADMIN_APPROVED + stats.PRODUCTION_READY + stats.GIVE_STOCK,
      completed: stats.COMPLETED,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch analytics', error: error.message });
  }
};

// GET /api/vendors/asm-stats  — per-ASM operational breakdown (Admin only)
const getAsmStats = async (req, res) => {
  try {
    const asms = await prisma.user.findMany({
      where: { role: 'ASM', isActive: true },
      select: {
        id: true, name: true, email: true,
        _count: { select: { vendorOrdersAsm: true } },
      },
    });
    const withStats = await Promise.all(
      asms.map(async (a) => {
        const [orders, completed, delivered, units, paid] = await Promise.all([
          prisma.vendorOrder.count({ where: { asmId: a.id } }),
          prisma.vendorOrder.count({ where: { asmId: a.id, status: 'COMPLETED' } }),
          prisma.vendorOrder.count({ where: { asmId: a.id, status: 'DELIVERED' } }),
          prisma.vendorOrderItem.aggregate({ where: { order: { asmId: a.id } }, _sum: { quantity: true } }),
          prisma.vendorPayment.aggregate({ where: { order: { asmId: a.id } }, _sum: { amount: true } }),
        ]);
        return {
          id: a.id, name: a.name, email: a.email,
          created: orders,
          completed,
          delivered,
          totalUnitsHandled: units._sum.quantity || 0,
          totalPaymentsRecorded: paid._sum.amount || 0,
        };
      })
    );
    res.json({ asms: withStats });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch ASM stats', error: error.message });
  }
};

// GET /api/vendors/asm-active-workers — list ASM users (for assignment dropdown)
const listAsm = async (req, res) => {
  try {
    const asms = await prisma.user.findMany({
      where: { role: 'ASM', isActive: true },
      select: { id: true, name: true, email: true, isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json({ asms });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch ASM users', error: error.message });
  }
};

module.exports = {
  getCatalog,
  listVendors,
  createVendor,
  updateVendor,
  getVendor,
  createVendorOrder,
  listVendorOrders,
  getVendorOrder,
  submitVendorOrder,
  approveVendorOrder,
  rejectVendorOrder,
  markProductionReady,
  giveStock,
  sendToStore,
  buyItself,
  getStoreAllocationOrders,
  storeAllocate,
  storeCheckAvailability,
  allProductsAvailable,
  storeRoute,
  getLogoQueue,
  logoAccept,
  logoComplete,
  getProductionQueue,
  productionAccept,
  productionOut,
  getProductionReturns,
  receiveProductionReturn,
  returnToAsm,
  asmAccept,
  deliverOrder,
  completeOrder,
  recordPayment,
  updatePayment,
  listPayments,
  getFinancialSummary,
  getVendorFinancialDetail,
  generateDocuments,
  getOrderDocuments,
  saveDocumentRevision,
  getDocumentRevisions,
  getAnalytics,
  getAsmStats,
  listAsm,
};
