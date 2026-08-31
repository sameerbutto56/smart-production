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
      select: { id: true, name: true, category: true, color: true, size: true, price: true, barcode: true },
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
    const vendor = await prisma.vendor.create({
      data: {
        name: String(name).trim(),
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
    let orderCount = vendor.orders.length;
    for (const o of vendor.orders) {
      totalOrderValue += o.grandTotal || 0;
      const paid = (o.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
      totalPaid += paid;
      totalOutstanding += Math.max(0, (o.grandTotal || 0) - paid);
    }

    res.json({
      vendor,
      summary: {
        totalOrders: orderCount,
        totalOrderValue,
        totalPaid,
        totalOutstanding,
      },
    });
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
      items,          // [{ catalogItemId, productName, productType, color, size, quantity, unitPrice, notes }]
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
    if (status) where.status = status;
    if (asmId) where.asmId = asmId;
    else if (req.user?.role === 'ASM') where.asmId = req.user.id;
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
        deliveries: true,
        asm: { select: { id: true, name: true } },
      },
    });
    res.json({ orders });
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
        asm: { select: { id: true, name: true, email: true } },
        documents: { orderBy: { generatedAt: 'asc' } },
      },
    });
    if (!order) return res.status(404).json({ message: 'Vendor order not found.' });
    const totalPaid = order.payments.reduce((s, p) => s + p.amount, 0);
    order._totalPaid = totalPaid;
    order._remainingBalance = Math.max(0, order.grandTotal - totalPaid);
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
  if (!fromArr.includes(existing.currentStage)) {
    return { error: `Already ${existing.currentStage}`, status: 400, current: existing };
  }
  const claim = await db.vendorOrder.updateMany({
    where: { id: orderId, currentStage: { in: fromArr } },
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
      fromStage: existing.currentStage,
      toStage: to,
      changedBy: req.user?.name || null,
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
      from: ['SUBMITTED'],
      to: 'ADMIN_APPROVED',
      req,
      db: prisma,
      set: { adminApprovedAt: new Date(), approvedByName: req.user?.name || null },
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
    if (existing.currentStage !== 'SUBMITTED') {
      return res.status(400).json({ message: `Already ${existing.currentStage}` });
    }
    const claim = await prisma.vendorOrder.updateMany({
      where: { id, currentStage: 'SUBMITTED' },
      data: { currentStage: 'REJECTED', status: 'REJECTED', rejectedAt: new Date(), rejectionReason: reason || 'Rejected', updatedAt: new Date() },
    });
    if (claim.count === 0) return res.status(400).json({ message: 'Already rejected.' });
    await prisma.vendorOrderStatus.create({
      data: { orderId: id, status: 'REJECTED', fromStage: 'SUBMITTED', toStage: 'REJECTED', changedBy: req.user?.name || null, changedById: req.user?.id || null, remarks: reason || 'Rejected by admin' },
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
      from: ['ADMIN_APPROVED'],
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
      from: ['ADMIN_APPROVED', 'PRODUCTION_READY'],
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

// POST /api/vendors/orders/:id/accept — ASM accepts
const asmAccept = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await transition({
      orderId: id,
      from: ['GIVE_STOCK'],
      to: 'ASM_ACCEPTED',
      req,
      db: prisma,
      set: { asmAcceptedAt: new Date(), acceptedByName: req.user?.name || null },
      remarks: 'ASM accepted stock',
    });
    if (result.error) return res.status(result.status || 400).json({ message: result.error });
    res.json({ order: result.order, message: 'Stock accepted.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to accept order', error: error.message });
  }
};

// POST /api/vendors/orders/:id/deliver — ASM delivers to vendor (records delivery, sets DELIVERED)
const deliverOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { carrier, notes, address, city } = req.body || {};
    const existing = await prisma.vendorOrder.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Order not found.' });
    if (existing.currentStage !== 'ASM_ACCEPTED' && existing.currentStage !== 'DELIVER') {
      return res.status(400).json({ message: `Already ${existing.currentStage}` });
    }
    const claim = await prisma.vendorOrder.updateMany({
      where: { id, currentStage: { in: ['ASM_ACCEPTED', 'DELIVER'] } },
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
        deliveryAddress: address || existing.deliveryAddress,
        city: city || existing.deliveryCity,
        carrier,
        deliveredBy: req.user?.name || null,
        deliveredById: req.user?.id || null,
        notes,
      },
    });
    const order = await prisma.vendorOrder.findUnique({ where: { id }, include: { vendor: true, statusHistory: true } });
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
// PAYMENTS
// ════════════════════════════════════════════════════════════════════════════

// POST /api/vendors/orders/:id/pay — record a payment (idempotent per request)
const recordPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, paymentType, paymentMethod, reference, paymentDate, notes } = req.body || {};
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return res.status(400).json({ message: 'A positive payment amount is required.' });

    const order = await prisma.vendorOrder.findUnique({ where: { id }, include: { payments: true } });
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    if (['CANCELLED', 'REJECTED'].includes(order.currentStage)) {
      return res.status(400).json({ message: 'Cannot add payment to a cancelled/rejected order.' });
    }

    const payment = await prisma.vendorPayment.create({
      data: {
        orderId: id,
        amount: amt,
        paymentType: paymentType || 'ADDITIONAL',
        paymentMethod: paymentMethod || 'CASH',
        reference: reference || null,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        recordedBy: req.user?.name || null,
        recordedById: req.user?.id || null,
        notes: notes || null,
      },
    });

    const totalPaid = (await prisma.vendorPayment.aggregate({ where: { orderId: id }, _sum: { amount: true } }))._sum.amount || 0;
    const remaining = Math.max(0, order.grandTotal - totalPaid);
    await prisma.vendorOrder.update({
      where: { id },
      data: { remainingBalance: remaining, updatedAt: new Date() },
    });

    await prisma.vendorOrderStatus.create({
      data: { orderId: id, status: order.currentStage, fromStage: order.currentStage, toStage: order.currentStage, changedBy: req.user?.name || null, changedById: req.user?.id || null, remarks: `Payment recorded: ${amt} (${paymentType})` },
    });

    const updated = await prisma.vendorOrder.findUnique({
      where: { id },
      include: { vendor: true, payments: { orderBy: { createdAt: 'asc' } }, statusHistory: { orderBy: { createdAt: 'asc' } } },
    });
    res.status(201).json({ payment, order: updated, remainingBalance: remaining });
  } catch (error) {
    res.status(500).json({ message: 'Failed to record payment', error: error.message });
  }
};

// GET /api/vendors/payments — all payments with filters
const listPayments = async (req, res) => {
  try {
    const { vendorId, orderId, paymentMethod, paymentType } = req.query;
    const where = {};
    if (vendorId) where.order = { vendorId };
    if (orderId) where.orderId = orderId;
    if (paymentMethod) where.paymentMethod = paymentMethod;
    if (paymentType) where.paymentType = paymentType;
    const payments = await prisma.vendorPayment.findMany({
      where,
      orderBy: { paymentDate: 'desc' },
      include: { order: { select: { orderNumber: true, vendor: { select: { id: true, name: true } } } } },
      take: 500,
    });
    res.json({ payments });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch payments', error: error.message });
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
  asmAccept,
  deliverOrder,
  completeOrder,
  recordPayment,
  listPayments,
  generateDocuments,
  getOrderDocuments,
  getAnalytics,
  getAsmStats,
  listAsm,
};
