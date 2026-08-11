const prisma = require('../prisma');
const cache = require('../utils/cache');
const notify = require('../utils/notify');
const bcrypt = require('bcryptjs');
const { computeUnifiedSalesSummary } = require('../utils/posUnified');
const { createAuditLog } = require('./order-helpers');

const getOutletName = (req) => {
  let name = req.user?.name || req.query.outlet || '';
  if (!name) return null;
  const n = name.toLowerCase();
  if (n.includes('johar')) return 'Johar Town';
  if (n.includes('jail')) return 'Jail Road';
  if (n.includes('abbottabad')) return 'Abbottabad';
  return name;
};

const generateOrderNumber = async (outletName) => {
  const prefix = outletName === 'Johar Town' ? 'JT-' : outletName === 'Jail Road' ? 'JL-' : 'OUT-';
  let isUnique = false;
  let orderNumber;
  while (!isUnique) {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    orderNumber = `${prefix}${randomNum}`;
    const existing = await prisma.order.findUnique({ where: { orderNumber }, select: { id: true } });
    if (!existing) isUnique = true;
  }
  return orderNumber;
};

const generateInvoiceNumber = async (outletName) => {
  const prefix = outletName === 'Johar Town' ? 'JT' : outletName === 'Jail Road' ? 'JL' : 'OUT';
  const seq = await prisma.invoiceSequence.upsert({
    where: { outletName },
    update: { nextValue: { increment: 1 } },
    create: { outletName, nextValue: 1 }
  });
  return `INV-${prefix}-${String(seq.nextValue).padStart(5, '0')}`;
};

const createOutletOrder = async (req, res) => {
  try {
    const { orderNumber: customOrderNumber, invoiceNumber: customInvoiceNumber, clientNumber, isNewCustomer, customerName, customerPhone, address, city, notes, measurementSpecialNote, products, engravingRequired, engravingText, engravingType, engravingInstructions, logoRequired, logoDesign, engravingNames, engravingLogos, sizeData, standardSize, measurementChart, advanceAmount, orderDestination, placedBy, priority, customization, engravingThreadColor, engravingPlacement, deliveryType, placedByEmployeeId, placedByEmployeeName } = req.body;

    if (!customerName) return res.status(400).json({ message: 'Customer name is required' });
    if (!products || !Array.isArray(products) || products.length === 0) return res.status(400).json({ message: 'At least one product is required' });

    const outletName = getOutletName(req) || 'Unknown Outlet';

    // Resolve authenticated employee (server-side, tied to this outlet)
    let resolvedEmployee = null;
    const empIdInput = (placedByEmployeeId || '').toString().trim();
    const empNameInput = (placedByEmployeeName || placedBy || '').toString().trim();
    if (empIdInput || empNameInput) {
      try {
        resolvedEmployee = await prisma.outletEmployee.findFirst({
          where: {
            outletName,
            isActive: true,
            OR: [
              ...(empIdInput ? [{ id: empIdInput }] : []),
              ...(empNameInput ? [{ name: empNameInput }] : [])
            ]
          },
          select: { id: true, name: true }
        });
      } catch (empErr) {
        console.error('Outlet employee resolve failed:', empErr.message);
      }
    }

    // Auto-generate order number if not provided
    let orderNumber;
    if (customOrderNumber && customOrderNumber.trim()) {
      const trimmedOrder = customOrderNumber.trim();
      const existingOrder = await prisma.order.findUnique({ where: { orderNumber: trimmedOrder }, select: { id: true } });
      if (existingOrder) return res.status(400).json({ message: `Order number ${trimmedOrder} already exists` });
      orderNumber = trimmedOrder;
    } else {
      orderNumber = await generateOrderNumber(outletName);
    }

    // Enrich productDetails with backward-compat aliases and per-product fields for Job Sheet
    const enriched = products.map(p => ({
      ...p,
      productType: p.name,
      fabricType: p.fabric || '',
      gender: p.gender || 'Male',
      matchingCap: p.matchingCap || false,
      matchingCapQty: p.matchingCapQty || 0,
      capCharges: p.matchingCap ? (parseInt(p.matchingCapQty) || 0) * 500 : 0,
      sleeveLength: p.sleeveLength || '',
      shirtLength: p.shirtLength || '',
      femaleOptions: p.femaleOptions || null,
      alteration: p.alteration || null
    }));
    const productDetails = enriched;
    const sizeDataStr = sizeData ? JSON.stringify(sizeData) : null;
    const totalPrice = products.reduce((sum, p) => {
      const line = (parseFloat(p.unitPrice) || 0) * (p.quantity || 1);
      const cap = p.matchingCap ? (parseInt(p.matchingCapQty) || 0) * 500 : 0;
      return sum + line + cap;
    }, 0);
    const adv = parseFloat(advanceAmount) || 0;

    // Aggregate per-product measurement notes into order-level field as fallback
    const aggregatedNote = measurementSpecialNote || products
      .filter(p => p.measurementSpecialNote)
      .map(p => `${p.name}${p.color ? ' (' + p.color + ')' : ''}: ${p.measurementSpecialNote}`)
      .join('\n') || null;

    const order = await prisma.$transaction(async (tx) => {
      // Generate invoice number atomically inside the transaction
      let invoiceNumber;
      if (customInvoiceNumber && customInvoiceNumber.trim()) {
        const trimmedInv = customInvoiceNumber.trim();
        const existingInv = await tx.order.findUnique({ where: { invoiceNumber: trimmedInv }, select: { id: true } });
        if (existingInv) throw new Error(`Invoice number ${trimmedInv} already exists`);
        invoiceNumber = trimmedInv;
      } else {
        const invPrefix = outletName === 'Johar Town' ? 'JT' : outletName === 'Jail Road' ? 'JL' : 'OUT';
        const seq = await tx.invoiceSequence.upsert({
          where: { outletName },
          update: { nextValue: { increment: 1 } },
          create: { outletName, nextValue: 1 }
        });
        invoiceNumber = `INV-${invPrefix}-${String(seq.nextValue).padStart(5, '0')}`;
      }

      const created = await tx.order.create({
        data: {
          orderNumber,
          invoiceNumber,
          customerName,
          customerPhone: customerPhone || null,
          address: address || null,
          city: city || null,
          type: 'FULL_CUSTOM',
          priority: priority || 'NORMAL',
          urgent: (priority === 'URGENT' || priority === 'SUPER_URGENT'),
          source: 'OUTLET',
          outletName,
          createdById: req.user?.id,
          productDetails,
          sizeData: sizeDataStr,
          customization: customization ? (typeof customization === 'string' ? customization : JSON.stringify(customization)) : null,
          instructionNotes: notes || null,
          measurementSpecialNote: aggregatedNote,
          engravingRequired: engravingRequired || false,
          engravingText: engravingText || null,
          engravingType: engravingType || null,
          engravingInstructions: engravingInstructions || null,
          logoRequired: logoRequired || false,
          logoDesign: logoDesign || null,
          engravingNames: engravingNames ? (typeof engravingNames === 'string' ? engravingNames : JSON.stringify(engravingNames)) : null,
          engravingLogos: engravingLogos ? (typeof engravingLogos === 'string' ? engravingLogos : JSON.stringify(engravingLogos)) : null,
          orderDestination: orderDestination || null,
          placedBy: resolvedEmployee?.name || placedBy || null,
          placedByEmployeeId: resolvedEmployee?.id || null,
          deliveryType: deliveryType || 'DELIVERY',
          advanceAmount: adv,
          totalPrice,
          paymentStatus: adv > 0 ? 'PAID' : 'PENDING',
          currentStage: 'ORDER_ENTRY'
        }
      });

      // Create PENDING ORDER_ENTRY stage — order stays in Outlet's Unseen Tasks until accepted
      await tx.orderStage.create({
        data: { orderId: created.id, stageName: 'ORDER_ENTRY', status: 'PENDING' }
      });

      await tx.auditLog.create({
        data: {
          orderId: created.id,
          action: 'OUTLET_ORDER_CREATED',
          details: `Outlet order created, pending acceptance at ${outletName}${resolvedEmployee ? ` — entered by ${resolvedEmployee.name}` : ''}`,
          performedBy: req.user?.id || 'SYSTEM'
        }
      });

      return tx.order.findUnique({
        where: { id: created.id },
        include: { stages: { orderBy: { createdAt: 'asc' } } }
      });
    });

    // Auto-create new customer in Client Registration
    if (isNewCustomer && customerPhone && customerName) {
      try {
        // Check if a client with this phone already exists
        const existingClient = await prisma.client.findFirst({
          where: { phone: { contains: customerPhone }, isActive: true },
          select: { id: true }
        });
        if (!existingClient) {
          // Generate client number — fetch all numeric clientNumbers and sort numerically
          const allClients = await prisma.client.findMany({
            where: { clientNumber: { not: null } },
            select: { clientNumber: true }
          });
          let nextNum = 1000;
          if (allClients.length > 0) {
            const maxNum = Math.max(...allClients.map(c => parseInt(c.clientNumber, 10)).filter(n => !isNaN(n)));
            nextNum = maxNum + 1;
          }
          if (nextNum > 99999) nextNum = 1000;

          // Build sizeDetails for new client
          let clientSizeDetails = null;
          if (sizeData && typeof sizeData === 'object' && Object.keys(sizeData).length > 0) {
            clientSizeDetails = JSON.stringify(sizeData);
          } else if (standardSize) {
            clientSizeDetails = standardSize;
          }

          // Retry on unique constraint violation (race condition)
          let clientCreated = false;
          for (let attempt = 0; attempt < 5 && !clientCreated; attempt++) {
            try {
              await prisma.client.create({
                data: {
                  clientNumber: String(nextNum + attempt),
                  name: customerName,
                  phone: customerPhone,
                  gender: 'Other',
                  permanentAddress: address || null,
                  city: city || null,
                  outletName,
                  deliveryAddresses: city ? [city] : [],
                  sizeDetails: clientSizeDetails,
                  measurementChart: measurementChart || null,
                  standardSizes: standardSize ? [standardSize] : [],
                  createdById: req.user?.id
                }
              });
              clientCreated = true;
              console.log(`Auto-created client ${nextNum + attempt} for new customer ${customerName}`);
            } catch (createErr) {
              if (createErr.code === 'P2002' && attempt < 4) {
                console.log(`Client number ${nextNum + attempt} already exists, retrying...`);
                continue;
              }
              throw createErr;
            }
          }
          if (!clientCreated) {
            console.error('Failed to auto-create client after 5 attempts');
          }
        } else {
          console.log(`Client with phone ${customerPhone} already exists — skipping auto-create`);
        }
      } catch (clientErr) {
        // Non-critical: log but don't fail the order
        console.error('Failed to auto-create client:', clientErr.message);
      }
    }

    // For existing clients: save sizeData to client if provided
    if (clientNumber && sizeData && typeof sizeData === 'object' && Object.keys(sizeData).length > 0) {
      try {
        const client = await prisma.client.findUnique({ where: { clientNumber } });
        if (client) {
          const existingSize = client.sizeDetails;
          const hasExisting = existingSize && (
            (typeof existingSize === 'string' && existingSize.trim()) ||
            (typeof existingSize === 'object' && Object.keys(existingSize).length > 0)
          );
          // Only write back if client has no existing sizeDetails
          if (!hasExisting) {
            await prisma.client.update({
              where: { clientNumber },
              data: { sizeDetails: JSON.stringify(sizeData) }
            });
          }
        }
      } catch (sizeErr) {
        console.error('Failed to save sizeData to client:', sizeErr.message);
      }
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('new-order', { orderId: order.id, orderNumber: order.orderNumber, source: 'OUTLET', outletName });
      io.emit('order-updated', { orderId: order.id });
    }

    await notify.create(req, {
      type: 'outlet_task',
      moduleName: 'My Tasks',
      path: '/tasks',
      role: 'OUTLET',
      title: 'New Order',
      message: `Order #${order.orderNumber} created, pending acceptance`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName,
      action: 'New → Outlet Task',
      employeeName: req.user?.name
    }).catch(() => {});

    res.status(201).json(order);
  } catch (error) {
    console.error('Create outlet order error:', JSON.stringify({ message: error.message, stack: error.stack }, null, 2));
    res.status(500).json({ message: 'Error creating outlet order', error: error.message });
  }
};

const lookupClientByNumber = async (req, res) => {
  try {
    const { number, phone, name, orderNumber } = req.query;

    // Support order number lookup: find the order, then look up client by phone
    if (orderNumber) {
      const order = await prisma.order.findUnique({
        where: { orderNumber },
        select: { customerPhone: true, customerName: true, sizeData: true, id: true, orderNumber: true, createdAt: true, productDetails: true, totalPrice: true, advanceAmount: true, currentStage: true }
      });
      if (!order) return res.status(404).json({ message: 'Order not found' });

      // Find client by phone
      const clients = order.customerPhone ? await prisma.client.findMany({
        where: { phone: { contains: order.customerPhone }, isActive: true },
        orderBy: { createdAt: 'desc' },
        take: 20
      }) : [];

      // Build result with sizeData from the found order
      const result = clients.length > 0 ? clients.map(client => ({
        client,
        recentOrders: [],
        sizeData: order.sizeData
      })) : [];

      // If no client found, return order info as fallback
      if (result.length === 0) {
        return res.json({
          clients: [{
            client: {
              name: order.customerName,
              phone: order.customerPhone || '',
              permanentAddress: '',
              city: '',
              clientNumber: null,
              isActive: true,
              standardSizes: [],
              sizeDetails: order.sizeData
            },
            recentOrders: [order],
            sizeData: order.sizeData
          }]
        });
      }

      // Fetch recent orders for found clients
      for (const entry of result) {
        const orders = await prisma.order.findMany({
          where: { customerPhone: entry.client.phone, source: 'OUTLET' },
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: { id: true, orderNumber: true, createdAt: true, productDetails: true, totalPrice: true, advanceAmount: true, currentStage: true, sizeData: true, engravingRequired: true, engravingText: true, engravingInstructions: true, logoRequired: true, engravingNames: true, engravingLogos: true, instructionNotes: true, measurementSpecialNote: true, orderDestination: true }
        });
        entry.recentOrders = orders || [];
      }

      return res.json({ clients: result });
    }

    let where = { isActive: true };
    if (number) where.clientNumber = number;
    else if (phone) where.phone = { contains: phone };
    else if (name) where.name = { contains: name, mode: 'insensitive' };
    else return res.status(400).json({ message: 'Provide client number, phone, name, or orderNumber' });

    const clients = await prisma.client.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    if (clients.length === 0) return res.status(404).json({ message: 'Client not found' });

    const result = clients.map(client => ({
      client,
      recentOrders: []
    }));

    for (const entry of result) {
      const orders = await prisma.order.findMany({
        where: { customerPhone: entry.client.phone, source: 'OUTLET' },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { id: true, orderNumber: true, createdAt: true, productDetails: true, totalPrice: true, advanceAmount: true, currentStage: true, sizeData: true, engravingRequired: true, engravingText: true, engravingInstructions: true, logoRequired: true, engravingNames: true, engravingLogos: true, instructionNotes: true, measurementSpecialNote: true, orderDestination: true }
      });
      entry.recentOrders = orders || [];
    }

    res.json({ clients: result });
  } catch (error) {
    console.error('Lookup client error:', error);
    res.status(500).json({ message: 'Error looking up client', error: error.message });
  }
};

const saveUnregisteredClient = async (req, res) => {
  try {
    const { clientNumber, customerName, customerPhone, address, city, notes } = req.body;
    if (!customerName || !customerPhone) return res.status(400).json({ message: 'Name and phone are required' });
    const outletName = getOutletName(req) || 'Unknown Outlet';
    let number = clientNumber;
    if (!number) {
      const last = await prisma.client.findFirst({ where: { clientNumber: { not: null } }, orderBy: { clientNumber: 'desc' }, select: { clientNumber: true } });
      let next = last?.clientNumber ? parseInt(last.clientNumber, 10) + 1 : 1000;
      if (next > 99999) next = 1000;
      number = String(next);
    }
    const existing = await prisma.client.findUnique({ where: { clientNumber: number } });
    if (existing) return res.status(409).json({ message: 'Client number already exists' });
    const client = await prisma.client.create({
      data: { clientNumber: number, name: customerName, gender: 'Other', phone: customerPhone, permanentAddress: address || null, city: city || null, outletName, deliveryAddresses: city ? [city] : [], createdById: req.user?.id }
    });
    res.status(201).json(client);
  } catch (error) {
    res.status(500).json({ message: 'Error saving client', error: error.message });
  }
};

const getOutletOrders = async (req, res) => {
  try {
    const outletName = getOutletName(req) || 'Unknown Outlet';
    const orders = await prisma.order.findMany({
      where: { source: 'OUTLET', outletName },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, orderNumber: true, invoiceNumber: true, customerName: true, customerPhone: true, totalPrice: true, advanceAmount: true, currentStage: true, orderDestination: true, createdAt: true, engravingRequired: true, status: true }
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching outlet orders', error: error.message });
  }
};

const getOutletReturns = async (req, res) => {
  try {
    const outletName = getOutletName(req) || 'Unknown Outlet';
    const orders = await prisma.order.findMany({
      where: { source: 'OUTLET', outletName, currentStage: 'OUTLET_RECEIVE', status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED'] } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, orderNumber: true, customerName: true, customerPhone: true, productDetails: true, totalPrice: true, advanceAmount: true, currentStage: true, orderDestination: true, createdAt: true, engravingRequired: true, status: true, sizeData: true, instructionNotes: true, measurementSpecialNote: true }
    });
    const parsed = orders.map(o => ({ ...o, productDetails: o.productDetails || [] }));
    res.json(parsed);
  } catch (error) {
    console.error('Get outlet returns error:', error);
    res.status(500).json({ message: 'Error fetching outlet returns', error: error.message });
  }
};

const receiveOutletReturn = async (req, res) => {
  const { orderId } = req.params;
  try {
    const outletName = getOutletName(req) || 'Unknown Outlet';
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.currentStage !== 'OUTLET_RECEIVE') return res.status(400).json({ message: 'Order is not in OUTLET_RECEIVE stage' });
    if (order.outletName !== outletName) return res.status(403).json({ message: 'This order belongs to a different outlet' });

    const activeStage = await prisma.orderStage.findFirst({
      where: { orderId, stageName: 'OUTLET_RECEIVE', status: { in: ['PENDING', 'IN_PROGRESS'] } }
    });
    if (activeStage) {
      await prisma.orderStage.update({
        where: { id: activeStage.id },
        data: { status: 'COMPLETED', completedAt: new Date() }
      });
    } else {
      return res.status(400).json({ message: 'No active OUTLET_RECEIVE stage found' });
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { currentStage: 'ORDER_ENTRY', status: 'COMPLETED', storeAcceptedAt: null }
    });

    await createAuditLog(orderId, 'OUTLET_RECEIVED', `Order received by outlet ${outletName}`, req.user?.id || 'SYSTEM');

    await prisma.routingHistory.create({
      data: { orderId, sentByUserId: req.user?.id || null, previousStage: 'OUTLET_RECEIVE', newStage: 'ORDER_ENTRY', sentToStage: 'ORDER_ENTRY', remarks: 'Outlet received order' }
    });

    const io = req.app.get('io');
    if (io) io.emit('order-updated', { orderId });

    res.json({ message: 'Order received successfully' });
  } catch (error) {
    console.error('Receive outlet return error:', error);
    res.status(500).json({ message: 'Error receiving order', error: error.message });
  }
};

// Outlet Dashboard: total/pending/completed with date range
const getOutletDashboardStats = async (req, res) => {
  try {
    const outletName = getOutletName(req) || 'Unknown Outlet';
    const { dateFrom, dateTo } = req.query;

    const dateFilter = {};
    if (dateFrom) dateFilter.createdAt = { ...dateFilter.createdAt, gte: new Date(dateFrom) };
    if (dateTo) dateFilter.createdAt = { ...dateFilter.createdAt, lte: new Date(dateTo) };

    const where = { source: 'OUTLET', outletName, ...dateFilter };

    const [totalOrders, pendingOrders, completedOrders, cancelledOrders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.count({ where: { ...where, status: { in: ['PENDING', 'IN_PROGRESS', 'WAITING_PAYMENT'] } } }),
      prisma.order.count({ where: { ...where, status: 'COMPLETED' } }),
      prisma.order.count({ where: { ...where, status: { in: ['CANCELLED', 'REJECTED'] } } })
    ]);

    res.json({ totalOrders, pendingOrders, completedOrders, cancelledOrders });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching dashboard stats', error: error.message });
  }
};

// Mark outlet order as customer taken (final action)
const customerTaken = async (req, res) => {
  const { orderId } = req.params;
  try {
    const outletName = getOutletName(req) || 'Unknown Outlet';
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { stages: true } });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.outletName !== outletName) return res.status(403).json({ message: 'Order belongs to a different outlet' });
    if (order.currentStage !== 'OUTLET_RECEIVE') return res.status(400).json({ message: 'Order must be in OUTLET_RECEIVE stage' });

    const activeStage = order.stages.find(s => s.stageName === 'OUTLET_RECEIVE' && ['PENDING', 'IN_PROGRESS'].includes(s.status));
    if (activeStage) {
      await prisma.orderStage.update({
        where: { id: activeStage.id },
        data: { status: 'COMPLETED', completedAt: new Date() }
      });
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        currentStage: 'ORDER_ENTRY',
        status: 'COMPLETED',
        customerTakenAt: new Date(),
        orderTakenBy: req.user?.name || 'Outlet Staff'
      }
    });

    await createAuditLog(orderId, 'CUSTOMER_TAKEN', `Customer taken by outlet ${outletName}`, req.user?.id || 'SYSTEM');

    await prisma.routingHistory.create({
      data: { orderId, sentByUserId: req.user?.id || null, previousStage: 'OUTLET_RECEIVE', newStage: 'ORDER_ENTRY', sentToStage: 'ORDER_ENTRY', remarks: 'Customer picked up order' }
    });

    const io = req.app.get('io');
    if (io) io.emit('order-updated', { orderId });

    await notify.create(req, { type: 'order_completed', moduleName: 'Orders', path: '/orders', role: 'FAISAL', title: 'Order Completed', message: `Order #${order.orderNumber} taken by customer`, orderId: order.id, orderNumber: order.orderNumber, customerName: order.customerName, action: 'Customer Taken', employeeName: req.user?.name }).catch(() => {});

    res.json({ message: 'Order marked as customer taken' });
  } catch (error) {
    res.status(500).json({ message: 'Error marking customer taken', error: error.message });
  }
};

// Send outlet order for delivery (from Outlet final actions)
const sendOutletForDelivery = async (req, res) => {
  const { orderId } = req.params;
  try {
    const outletName = getOutletName(req) || 'Unknown Outlet';
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { stages: true } });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.outletName !== outletName) return res.status(403).json({ message: 'Order belongs to a different outlet' });
    if (order.currentStage !== 'OUTLET_RECEIVE') return res.status(400).json({ message: 'Order must be in OUTLET_RECEIVE stage' });

    const activeStage = order.stages.find(s => s.stageName === 'OUTLET_RECEIVE' && ['PENDING', 'IN_PROGRESS'].includes(s.status));
    if (activeStage) {
      await prisma.orderStage.update({
        where: { id: activeStage.id },
        data: { status: 'COMPLETED', completedAt: new Date() }
      });
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { deliveryType: 'IN_CITY', currentStage: 'OUT_FOR_DELIVERY', status: 'IN_PROGRESS' }
    });

    await prisma.orderStage.create({
      data: { orderId, stageName: 'OUT_FOR_DELIVERY', status: 'PENDING' }
    });

    await createAuditLog(orderId, 'SENT_FOR_DELIVERY', `Outlet order sent for delivery from ${outletName}`, req.user?.id || 'SYSTEM');

    await prisma.routingHistory.create({
      data: { orderId, sentByUserId: req.user?.id || null, previousStage: 'OUTLET_RECEIVE', newStage: 'OUT_FOR_DELIVERY', sentToStage: 'OUT_FOR_DELIVERY', remarks: 'Outlet sent for delivery' }
    });

    const io = req.app.get('io');
    if (io) io.emit('order-updated', { orderId });

    await notify.create(req, { type: 'delivery_task', moduleName: 'Deliveries', path: '/delivery', role: 'DELIVERY_BOY', title: 'New Delivery from Outlet', message: `Order #${order.orderNumber} sent for delivery`, orderId: order.id, orderNumber: order.orderNumber, customerName: order.customerName, action: 'Outlet → Delivery', employeeName: req.user?.name }).catch(() => {});

    res.json({ message: 'Order sent for delivery' });
  } catch (error) {
    res.status(500).json({ message: 'Error sending for delivery', error: error.message });
  }
};

// Get outlet tasks: orders in OUTLET_RECEIVE stage with full info
const getOutletTasks = async (req, res) => {
  try {
    const outletName = getOutletName(req) || 'Unknown Outlet';
    const orders = await prisma.order.findMany({
      where: { source: 'OUTLET', outletName, currentStage: 'OUTLET_RECEIVE', status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED'] } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true, orderNumber: true, customerName: true, customerPhone: true,
        productDetails: true, totalPrice: true, advanceAmount: true,
        currentStage: true, orderDestination: true, createdAt: true,
        engravingRequired: true, status: true, sizeData: true, instructionNotes: true
      }
    });
    const parsed = orders.map(o => ({
      ...o,
      productDetails: o.productDetails || []
    }));
    res.json(parsed);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching tasks', error: error.message });
  }
};

// In-House Delivery (mark as delivered without dispatch workflow)
const inHouseDelivery = async (req, res) => {
  const { orderId } = req.params;
  try {
    const outletName = getOutletName(req) || 'Unknown Outlet';
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { stages: true } });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.outletName !== outletName) return res.status(403).json({ message: 'Order belongs to a different outlet' });
    if (order.currentStage !== 'OUTLET_RECEIVE') return res.status(400).json({ message: 'Order must be in OUTLET_RECEIVE stage' });

    const activeStage = order.stages.find(s => s.stageName === 'OUTLET_RECEIVE' && ['PENDING', 'IN_PROGRESS'].includes(s.status));
    if (activeStage) {
      await prisma.orderStage.update({
        where: { id: activeStage.id },
        data: { status: 'COMPLETED', completedAt: new Date() }
      });
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { currentStage: 'ORDER_ENTRY', status: 'COMPLETED', deliveryType: 'IN_CITY', deliveredAt: new Date() }
    });

    await createAuditLog(orderId, 'IN_HOUSE_DELIVERED', `In-house delivery completed by outlet ${outletName}`, req.user?.id || 'SYSTEM');

    await prisma.routingHistory.create({
      data: { orderId, sentByUserId: req.user?.id || null, previousStage: 'OUTLET_RECEIVE', newStage: 'DELIVERED', sentToStage: 'DELIVERED', remarks: 'In-house delivery completed' }
    });

    const io = req.app.get('io');
    if (io) io.emit('order-updated', { orderId });

    await notify.create(req, { type: 'order_completed', moduleName: 'Orders', path: '/orders', role: 'FAISAL', title: 'Order Delivered (In-House)', message: `Order #${order.orderNumber} delivered in-house`, orderId: order.id, orderNumber: order.orderNumber, customerName: order.customerName, action: 'In-House Delivered', employeeName: req.user?.name }).catch(() => {});

    res.json({ message: 'Order delivered in-house' });
  } catch (error) {
    res.status(500).json({ message: 'Error delivering order', error: error.message });
  }
};

const generateOrderNumberEndpoint = async (req, res) => {
  try {
    const outletName = getOutletName(req) || 'Unknown Outlet';
    const orderNumber = await generateOrderNumber(outletName);
    res.json({ orderNumber });
  } catch (error) {
    res.status(500).json({ message: 'Error generating order number', error: error.message });
  }
};

const generateInvoiceNumberEndpoint = async (req, res) => {
  try {
    const outletName = getOutletName(req) || 'Unknown Outlet';
    const invoiceNumber = await generateInvoiceNumber(outletName);
    res.json({ invoiceNumber });
  } catch (error) {
    res.status(500).json({ message: 'Error generating invoice number', error: error.message });
  }
};

const trackOrder = async (req, res) => {
  try {
    const query = (req.params.query || '').trim();
    if (!query) return res.status(400).json({ message: 'Order number or invoice number is required' });

    // Try exact match on orderNumber first
    let order = await prisma.order.findUnique({
      where: { orderNumber: query },
      include: { stages: { orderBy: { createdAt: 'asc' } }, createdBy: { select: { id: true, name: true } } }
    });

    // Try exact match on invoiceNumber
    if (!order) {
      order = await prisma.order.findUnique({
        where: { invoiceNumber: query },
        include: { stages: { orderBy: { createdAt: 'asc' } }, createdBy: { select: { id: true, name: true } } }
      });
    }

    // Fallback: contains search on orderNumber
    if (!order) {
      const matches = await prisma.order.findMany({
        where: { orderNumber: { contains: query } },
        include: { stages: { orderBy: { createdAt: 'asc' } }, createdBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 1
      });
      order = matches[0] || null;
    }

    // Fallback: contains search on invoiceNumber
    if (!order) {
      const matches = await prisma.order.findMany({
        where: { invoiceNumber: { contains: query } },
        include: { stages: { orderBy: { createdAt: 'asc' } }, createdBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 1
      });
      order = matches[0] || null;
    }

    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (error) {
    console.error('[trackOrder] error:', error.message);
    res.status(500).json({ message: 'Error tracking order' });
  }
};

const getOutletAnalytics = async (req, res) => {
  try {
    const outletName = getOutletName(req) || 'Unknown Outlet';
    const { range = 'all', dateFrom, dateTo } = req.query;

    const cacheKey = `outlet:analytics:${outletName}:${range}:${dateFrom || ''}:${dateTo || ''}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const now = new Date();
    let startDate = null;
    let endDate = null;
    if (dateFrom) startDate = new Date(dateFrom);
    if (dateTo) { endDate = new Date(dateTo); endDate.setHours(23, 59, 59, 999); }
    if (!startDate && !endDate) {
      if (range === 'today') { startDate = new Date(now); startDate.setHours(0, 0, 0, 0); }
      else if (range === 'yesterday') { startDate = new Date(now); startDate.setDate(startDate.getDate() - 1); startDate.setHours(0, 0, 0, 0); endDate = new Date(startDate); endDate.setHours(23, 59, 59, 999); }
      else if (range === 'week') { startDate = new Date(now); startDate.setDate(startDate.getDate() - 7); startDate.setHours(0, 0, 0, 0); }
      else if (range === 'month') { startDate = new Date(now); startDate.setMonth(startDate.getMonth() - 1); startDate.setHours(0, 0, 0, 0); }
      else if (range === 'year') { startDate = new Date(now); startDate.setFullYear(startDate.getFullYear() - 1); startDate.setHours(0, 0, 0, 0); }
    }

    const dateFilter = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;

    const orderWhere = { source: 'OUTLET', outletName };
    if (startDate || endDate) orderWhere.createdAt = { ...dateFilter };

    // 1. Order KPIs
    const [totalOrders, pendingOrders, inProgressOrders, completedOrders, cancelledOrders] = await Promise.all([
      prisma.order.count({ where: orderWhere }),
      prisma.order.count({ where: { ...orderWhere, status: 'PENDING' } }),
      prisma.order.count({ where: { ...orderWhere, status: 'IN_PROGRESS' } }),
      prisma.order.count({ where: { ...orderWhere, status: 'COMPLETED' } }),
      prisma.order.count({ where: { ...orderWhere, status: { in: ['CANCELLED', 'REJECTED'] } } })
    ]);

    // 2. Payment status breakdown — use real data from linked PosSales
    const orderIds = (await prisma.order.findMany({
      where: orderWhere,
      select: { id: true, paymentStatus: true, totalPrice: true }
    }));

    const linkedPosSales = await prisma.posSale.findMany({
      where: { orderId: { in: orderIds.map(o => o.id).filter(Boolean) } },
      select: { id: true, orderId: true, grandTotal: true, advanceAmount: true }
    });
    const linkedPosMap = {};
    linkedPosSales.forEach(ps => { linkedPosMap[ps.orderId] = ps; });

    // Also fetch balance payments for linked PosSales
    const bpSales = await prisma.posBalancePayment.findMany({
      where: { posSaleId: { in: linkedPosSales.map(ps => ps.id) } },
      select: { posSaleId: true, amountPaidNow: true }
    });
    const bpMap = {};
    bpSales.forEach(bp => {
      if (!bpMap[bp.posSaleId]) bpMap[bp.posSaleId] = 0;
      bpMap[bp.posSaleId] += Number(bp.amountPaidNow || 0);
    });

    let paidOrders = 0;
    let pendingPaymentOrders = 0;
    let totalRevenue = 0;

    orderIds.forEach(o => {
      const ps = linkedPosMap[o.id];
      const totalPaid = (ps ? Number(ps.advanceAmount || 0) + (bpMap[ps.id] || 0) : 0);
      const isPaid = ['PAID', 'FULL_PAID'].includes(o.paymentStatus) ||
        (ps && totalPaid >= Number(o.totalPrice || 0));
      const isPending = ['PENDING', 'PARTIAL_PAID'].includes(o.paymentStatus) &&
        !(ps && totalPaid >= Number(o.totalPrice || 0));

      if (isPaid) {
        paidOrders++;
        totalRevenue += Number(o.totalPrice || 0);
      } else {
        pendingPaymentOrders++;
      }
    });

    // 3. Order type distribution
    const orders = await prisma.order.findMany({
      where: orderWhere,
      select: { createdAt: true, totalPrice: true, paymentStatus: true, type: true }
    });

    // Order type distribution
    const typeDist = {};
    orders.forEach(o => {
      const t = o.type || 'STANDARD';
      typeDist[t] = (typeDist[t] || 0) + 1;
    });
    const orderTypeDistribution = Object.entries(typeDist).map(([name, count]) => ({ name, count }));

    // 4. Daily revenue + order trends
    const paymentStatusMap = {};
    orderIds.forEach(o => {
      const ps = linkedPosMap[o.id];
      const totalPaid = (ps ? Number(ps.advanceAmount || 0) + (bpMap[ps.id] || 0) : 0);
      paymentStatusMap[o.id] = ['PAID', 'FULL_PAID'].includes(o.paymentStatus) ||
        (ps && totalPaid >= Number(o.totalPrice || 0));
    });

    const dailyTrend = {};
    const orderTrend = {};
    orders.forEach(o => {
      if (o.totalPrice && paymentStatusMap[o.id]) {
        const day = o.createdAt.toISOString().split('T')[0];
        dailyTrend[day] = (dailyTrend[day] || 0) + Number(o.totalPrice);
      }
      const day = o.createdAt.toISOString().split('T')[0];
      orderTrend[day] = (orderTrend[day] || 0) + 1;
    });

    const salesTrend = Object.entries(dailyTrend)
      .map(([date, revenue]) => ({ date, revenue: Math.round(revenue) }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const ordersTrend = Object.entries(orderTrend)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 5. Top products from outlet orders (productDetails JSON)
    const ordersWithProducts = await prisma.order.findMany({
      where: { ...orderWhere, productDetails: { not: null } },
      select: { productDetails: true }
    });
    const productCounts = {};
    ordersWithProducts.forEach(o => {
      try {
        const details = o.productDetails;
        (Array.isArray(details) ? details : [details]).forEach(p => {
          const name = p.name || p.productName || 'Unknown';
          productCounts[name] = (productCounts[name] || 0) + (parseInt(p.quantity) || 1);
        });
      } catch (e) { /* skip malformed */ }
    });
    const topProducts = Object.entries(productCounts)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);

    // 6. POS summary — UNIFIED calculation (same source as POS Dashboard + Admin
    //    Outlet Detailed). Faisal Takes excluded, balance payments on paidAt.
    const posUnified = await computeUnifiedSalesSummary(prisma, {
      outlet: outletName,
      start: startDate,
      end: endDate,
    });
    const posTotal = posUnified.totalSales;
    const posCount = posUnified.totalOrders;

    // 7. Inventory overview
    const invWhere = outletName ? { outletName } : {};
    const inventory = await prisma.outletInventory.findMany({
      where: invWhere,
      select: { stock: true, name: true }
    });
    const inStock = inventory.filter(i => i.stock > 5).length;
    const lowStock = inventory.filter(i => i.stock > 0 && i.stock <= 5).length;
    const outOfStock = inventory.filter(i => i.stock === 0).length;

    // Cache — longer for 'all' since aggregate data rarely changes
    const ttl = range === 'all' ? 600000 : 120000;
    cache.set(cacheKey, {
      orderStats: { totalOrders, pendingOrders, inProgressOrders, completedOrders, cancelledOrders, totalRevenue },
      paymentBreakdown: { paidOrders, pendingPaymentOrders },
      orderTypeDistribution,
      salesTrend,
      ordersTrend,
      topProducts,
      posSummary: { totalSales: posTotal, orderCount: posCount },
      inventoryOverview: { inStock, lowStock, outOfStock, total: inventory.length }
    }, ttl);

    res.json({
      orderStats: { totalOrders, pendingOrders, inProgressOrders, completedOrders, cancelledOrders, totalRevenue },
      paymentBreakdown: { paidOrders, pendingPaymentOrders },
      orderTypeDistribution,
      salesTrend,
      ordersTrend,
      topProducts,
      posSummary: { totalSales: posTotal, orderCount: posCount },
      inventoryOverview: { inStock, lowStock, outOfStock, total: inventory.length }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching outlet analytics', error: error.message });
  }
};

// Outlet Route Order — handles all outlet routing actions
const outletRouteOrder = async (req, res) => {
  const { orderId } = req.params;
  const { action, targetOutlet, remarks } = req.body;
  // action: 'sendToLogo' | 'sendToProduction' | 'sendToEnamelsDelivery' | 'sendToOutlet' | 'customerTakeDeliver'

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { stages: true }
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.source !== 'OUTLET') return res.status(400).json({ message: 'Only outlet orders can be routed' });

    const outletName = getOutletName(req) || 'Unknown Outlet';
    const isDeliveryBoy = req.user?.role === 'DELIVERY_BOY';
    const orderOutlet = order.outletName;
    const isSameOutlet = orderOutlet && (outletName.includes(orderOutlet) || orderOutlet.includes(outletName));
    // Johar Town can also route Jail Road and Abbottabad orders (they appear in JT tasks via auto-routing)
    const joharTownRoutsOtherOutlet = outletName === 'Johar Town' && ['Jail Road', 'Abbottabad'].includes(orderOutlet);
    if (!isSameOutlet && !joharTownRoutsOtherOutlet && !isDeliveryBoy) {
      return res.status(403).json({ message: `This order belongs to ${order.outletName}` });
    }

    const validActions = ['sendToLogo', 'sendToProduction', 'sendToEnamelsDelivery', 'sendToOutlet', 'sendToInDispatch', 'customerTakeDeliver'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ message: `Invalid action. Valid: ${validActions.join(', ')}` });
    }

    // Stage mappings
    const actionStageMap = {
      sendToLogo: 'LOGO_DESIGN',
      sendToProduction: 'PRODUCTION_ACCEPTANCE',
      sendToEnamelsDelivery: 'ENAMELS_DELIVERY',
      sendToOutlet: 'OUTLET_RECEIVE',
      sendToInDispatch: 'IN_DISPATCH',
      customerTakeDeliver: null // no next stage — marks complete
    };

    const destinationStage = actionStageMap[action];
    const currentStage = order.stages.find(s =>
      ['PENDING', 'IN_PROGRESS'].includes(s.status) &&
      ['ORDER_ENTRY', 'OUTLET_RECEIVE', 'IN_DISPATCH', 'ENAMELS_DELIVERY'].includes(s.stageName)
    );
    if (!currentStage) return res.status(400).json({ message: 'No active stage found for routing' });

    // Complete current stage
    await prisma.orderStage.update({
      where: { id: currentStage.id },
      data: { status: 'COMPLETED', completedAt: new Date() }
    });

    if (action === 'customerTakeDeliver') {
      // Customer Take & Deliver — mark order DELIVERED
      await prisma.order.update({
        where: { id: orderId },
        data: {
          currentStage: 'ORDER_ENTRY',
          status: 'COMPLETED',
          customerTakenAt: new Date(),
          orderTakenBy: req.user?.name || 'Outlet Staff',
          deliveredAt: new Date()
        }
      });

      await createAuditLog(orderId, 'CUSTOMER_TAKEN',
        `Customer taken by ${outletName}`,
        req.user?.id || 'SYSTEM');

      await prisma.routingHistory.create({
        data: {
          orderId, sentByUserId: req.user?.id || null,
          previousStage: currentStage.stageName, newStage: 'DELIVERED',
          sentToStage: 'DELIVERED',
          remarks: remarks || 'Customer picked up order'
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

      const io = req.app.get('io');
      if (io) io.emit('order-updated', { orderId });

      return res.json({ message: 'Order completed: Customer Take & Deliver' });
    }

    // For sendToOutlet, validate target outlet
    let targetOutletName = null;
    if (action === 'sendToOutlet') {
      if (!targetOutlet) return res.status(400).json({ message: 'Target outlet is required' });
      targetOutletName = targetOutlet;
    }

    // Create destination stage
    const durations = await require('./order-helpers').getStageDurations?.() || {};
    const deadline = new Date(Date.now() + ((durations[destinationStage] || 48) * 60 * 60 * 1000));
    await prisma.orderStage.create({
      data: { orderId, stageName: destinationStage, status: 'PENDING', deadlineAt: deadline }
    });

    // Update order's currentStage
    const orderUpdateData = { currentStage: destinationStage, status: 'PENDING' };
    if (destinationStage === 'ENAMELS_DELIVERY') {
      orderUpdateData.deliveryType = 'ENAMELS';
      orderUpdateData.deliveryMethod = 'Enamels Delivery';
    }
    await prisma.order.update({
      where: { id: orderId },
      data: orderUpdateData
    });

    // Find recipient users
    const recipientRoles = {
      LOGO_DESIGN: ['LOGO_DESIGN', 'LOGO_DESIGN_EMPLOYEE', 'LOGO_DESIGNER'],
      PRODUCTION_ACCEPTANCE: ['PRODUCTION', 'PRODUCTION_IN', 'PRODUCTION_OUT'],
      ENAMELS_DELIVERY: ['DELIVERY_BOY'],
      IN_DISPATCH: ['OUTLET'],
      OUTLET_RECEIVE: ['OUTLET']
    };
    const roles = recipientRoles[destinationStage] || ['OUTLET'];
    const whereUsers = { role: { in: roles } };
    // For outlet-to-outlet routing, filter by target outlet name
    if (action === 'sendToOutlet' && targetOutletName) {
      const searchName = String(targetOutletName).replace(/\s*Outlet\s*$/i, '').trim();
      whereUsers.name = { contains: searchName, mode: 'insensitive' };
    }
    const recipientUsers = await prisma.user.findMany({
      where: whereUsers,
      select: { id: true }
    });

    // Routing history
    await prisma.routingHistory.create({
      data: {
        orderId, sentByUserId: req.user?.id,
        sentToStage: destinationStage,
        sentToUserIds: JSON.stringify(recipientUsers.map(u => u.id)),
        previousStage: currentStage.stageName,
        newStage: destinationStage,
        remarks: remarks || `Outlet routed to ${destinationStage}${targetOutletName ? ` (${targetOutletName})` : ''}`,
        createdAt: new Date()
      }
    });

    // Reset seen status
    await prisma.seenTask.deleteMany({
      where: { userId: { in: recipientUsers.map(u => u.id) }, orderId, stageName: destinationStage }
    }).catch(() => {});

    const auditAction = action === 'sendToOutlet' ? 'OUTLET_ROUTED' : 'MANUAL_ROUTE';
    await createAuditLog(orderId, auditAction,
      `Routed from ${currentStage.stageName} to ${destinationStage}${targetOutletName ? ` (${targetOutletName})` : ''} by ${req.user?.name}`,
      req.user?.id || 'SYSTEM');

    const io = req.app.get('io');
    if (io) io.emit('order-updated', { orderId });

    // Notify destination role
    const destRole = action === 'sendToOutlet' ? 'OUTLET' : (action === 'sendToEnamelsDelivery' ? 'DELIVERY_BOY' : (action === 'sendToLogo' ? 'LOGO_DESIGN' : 'PRODUCTION'));
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
    console.error('outletRouteOrder error:', error);
    res.status(500).json({ message: 'Error routing outlet order', error: error.message });
  }
};

// GET /api/outlet-orders/in-dispatch — fetch IN_DISPATCH orders for a given outlet
const getInDispatchOrders = async (req, res) => {
  try {
    const outletName = getOutletName(req);
    if (!outletName) return res.status(400).json({ message: 'Outlet name required' });

    const orders = await prisma.order.findMany({
      where: {
        currentStage: 'IN_DISPATCH',
        outletName: { contains: outletName, mode: 'insensitive' },
        status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED'] },
        stages: { some: { stageName: 'IN_DISPATCH', status: { in: ['PENDING', 'IN_PROGRESS'] } } }
      },
      include: {
        stages: { orderBy: { createdAt: 'desc' }, select: { id: true, stageName: true, status: true, deadlineAt: true, completedAt: true, startedAt: true, createdAt: true } },
        createdBy: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(orders);
  } catch (error) {
    console.error('getInDispatchOrders error:', error);
    res.status(500).json({ message: 'Error fetching In Dispatch orders', error: error.message });
  }
};

// GET /api/outlet-orders/come-from-production — orders that completed Production and
// returned to the outlet (OUTLET_RECEIVE stage). Split into unseen/seen for the user.
// Johar Town users see Johar Town, Jail Road, and Abbottabad orders (JT is the production-return hub).
const getComeFromProduction = async (req, res) => {
  try {
    const userId = req.user.id;
    const rawName = String(req.user?.name || '').toLowerCase();
    let normalizedName = 'Unknown';
    if (rawName.includes('johar')) normalizedName = 'Johar Town';
    else if (rawName.includes('jail')) normalizedName = 'Jail Road';
    else if (rawName.includes('abbottabad')) normalizedName = 'Abbottabad';
    else normalizedName = req.user.name;

    // Johar Town is the central dispatch hub — it sees EVERY production-returned order
    // (Johar Town, Jail Road, Abbottabad, or any other origin). Jail Road / Abbottabad see
    // only orders routed TO them (e.g. from In Dispatch / delivery boy), never production returns.
    const isJT = normalizedName === 'Johar Town';
    const outletFilter = isJT ? undefined : { contains: normalizedName, mode: 'insensitive' };

    const orders = await prisma.order.findMany({
      where: {
        source: 'OUTLET',
        ...(outletFilter ? { outletName: outletFilter } : {}),
        currentStage: 'OUTLET_RECEIVE',
        status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED'] },
        stages: {
          some: {
            stageName: 'OUTLET_RECEIVE',
            status: { in: ['PENDING', 'IN_PROGRESS'] },
            ...(isJT ? {} : {
              OR: [
                { returnReason: null },
                { returnReason: { not: { contains: 'Production' } } }
              ]
            })
          }
        }
      },
      include: {
        stages: { orderBy: { createdAt: 'desc' }, select: { id: true, stageName: true, status: true, deadlineAt: true, completedAt: true, startedAt: true, rejectionReason: true, returnedFrom: true, returnReason: true, createdAt: true, updatedAt: true, requestNextStep: true } },
        auditLogs: { orderBy: { timestamp: 'desc' }, take: 5, select: { action: true, timestamp: true, details: true, performedBy: true } },
        createdBy: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 250
    });

    const seenRecords = await prisma.seenTask.findMany({
      where: { userId, orderId: { in: orders.map(o => o.id) }, stageName: 'OUTLET_RECEIVE' }
    });
    const seenOrderIds = new Set(seenRecords.map(r => r.orderId));

    res.json({
      unseen: orders.filter(o => !seenOrderIds.has(o.id)),
      seen: orders.filter(o => seenOrderIds.has(o.id))
    });
  } catch (error) {
    console.error('getComeFromProduction error:', error);
    res.status(500).json({ message: 'Error fetching production-returned orders', error: error.message });
  }
};

const getOutletEmployees = async (req, res) => {
  try {
    const outlet = req.query.outlet || getOutletName(req) || 'Johar Town';
    const profile = req.query.profile;
    const emps = await prisma.outletEmployee.findMany({
      where: {
        outletName: outlet,
        isActive: true,
        ...(profile ? { profiles: { array_contains: profile } } : {}),
      },
      select: { id: true, name: true, profiles: true },
      orderBy: { name: 'asc' }
    });
    res.json({ employees: emps.map(e => ({ id: e.id, name: e.name })) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch employees', error: error.message });
  }
};

const verifyOutletEmployee = async (req, res) => {
  try {
    const { name, password, outlet } = req.body || {};
    const outletName = outlet || getOutletName(req) || 'Johar Town';
    const empName = (name || '').toString().trim();
    const empPass = (password || '').toString();

    if (!empName) return res.status(400).json({ message: 'Employee name is required' });
    if (!empPass) return res.status(400).json({ message: 'Password is required' });

    const employee = await prisma.outletEmployee.findFirst({
      where: { name: empName, outletName }
    });

    if (!employee) {
      return res.status(401).json({ message: `No employee "${empName}" found at ${outletName}` });
    }
    if (!employee.isActive) {
      return res.status(403).json({ message: `Employee "${empName}" is not active. Contact Admin.` });
    }
    const match = await bcrypt.compare(empPass, employee.password);
    if (!match) {
      return res.status(401).json({ message: 'Incorrect password. Please try again.' });
    }

    res.json({ ok: true, employee: { id: employee.id, name: employee.name, outletName: employee.outletName } });
  } catch (error) {
    res.status(500).json({ message: 'Failed to verify employee', error: error.message });
  }
};

module.exports = { createOutletOrder, lookupClientByNumber, saveUnregisteredClient, getOutletOrders, getOutletReturns, receiveOutletReturn, getOutletDashboardStats, customerTaken, sendOutletForDelivery, getOutletTasks, inHouseDelivery, generateOrderNumberEndpoint, generateInvoiceNumberEndpoint, trackOrder, getOutletAnalytics, outletRouteOrder, getInDispatchOrders, getComeFromProduction, getOutletEmployees, verifyOutletEmployee };