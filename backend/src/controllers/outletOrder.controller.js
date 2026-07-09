const prisma = require('../prisma');
const cache = require('../utils/cache');
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

const DESTINATION_STAGES = {
  STORE: 'STORE',
  LOGO_DESIGN: 'LOGO_DESIGN',
  PRODUCTION: 'PRODUCTION_ACCEPTANCE'
};

const createOutletOrder = async (req, res) => {
  try {
    const { clientNumber, customerName, customerPhone, address, city, notes, products, engravingRequired, engravingText, engravingType, engravingInstructions, logoRequired, engravingNames, engravingLogos, sizeData, advanceAmount, orderDestination } = req.body;

    if (!customerName) return res.status(400).json({ message: 'Customer name is required' });
    if (!products || !Array.isArray(products) || products.length === 0) return res.status(400).json({ message: 'At least one product is required' });
    if (!orderDestination || !DESTINATION_STAGES[orderDestination]) return res.status(400).json({ message: 'Order destination is required: STORE, LOGO_DESIGN, or PRODUCTION' });

    const outletName = getOutletName(req) || 'Unknown Outlet';
    const orderNumber = await generateOrderNumber(outletName);
    // Add productType alias for backward compat with job sheet display
    const enriched = products.map(p => ({ ...p, productType: p.name }));
    const productDetails = JSON.stringify(enriched);
    const sizeDataStr = sizeData ? JSON.stringify(sizeData) : null;
    const totalPrice = products.reduce((sum, p) => sum + (parseFloat(p.unitPrice) || 0) * (p.quantity || 1), 0);
    const adv = parseFloat(advanceAmount) || 0;

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber,
          customerName,
          customerPhone: customerPhone || null,
          address: address || null,
          city: city || null,
          type: 'FULL_CUSTOM',
          source: 'OUTLET',
          outletName,
          createdById: req.user?.id,
          productDetails,
          sizeData: sizeDataStr,
          instructionNotes: notes || null,
          engravingRequired: engravingRequired || false,
          engravingText: engravingText || null,
          engravingType: engravingType || null,
          engravingInstructions: engravingInstructions || null,
          logoRequired: logoRequired || false,
          engravingNames: engravingNames ? JSON.stringify(engravingNames) : null,
          engravingLogos: engravingLogos ? JSON.stringify(engravingLogos) : null,
          orderDestination,
          advanceAmount: adv,
          totalPrice,
          paymentStatus: adv > 0 ? 'PAID' : 'PENDING',
          currentStage: 'ORDER_ENTRY'
        }
      });

      await tx.orderStage.create({
        data: { orderId: created.id, stageName: 'ORDER_ENTRY', status: 'COMPLETED', completedAt: new Date() }
      });

      const destStage = DESTINATION_STAGES[orderDestination];
      await tx.orderStage.create({
        data: { orderId: created.id, stageName: destStage, status: 'IN_PROGRESS', startedAt: new Date() }
      });

      await tx.order.update({
        where: { id: created.id },
        data: { currentStage: destStage }
      });

      await tx.auditLog.create({
        data: {
          orderId: created.id,
          action: 'OUTLET_ORDER_CREATED',
          details: `Outlet order created, routed to ${orderDestination}`,
          performedBy: req.user?.id || 'SYSTEM'
        }
      });

      return tx.order.findUnique({
        where: { id: created.id },
        include: { stages: { orderBy: { createdAt: 'asc' } } }
      });
    });

    // Save sizeData to client profile if matched (best-effort, don't block response)
    if (clientNumber && sizeData) {
      try {
        const existingClient = await prisma.client.findUnique({ where: { clientNumber } });
        if (existingClient) {
          await prisma.client.update({
            where: { clientNumber },
            data: { sizeDetails: sizeData }
          });
        }
      } catch (sdErr) {
        console.error('Failed to save sizeDetails to client:', sdErr);
      }
    }

    if (req.app.get('io')) req.app.get('io').emit('new-order', { orderId: order.id, orderNumber: order.orderNumber, source: 'OUTLET', outletName });

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
          select: { id: true, orderNumber: true, createdAt: true, productDetails: true, totalPrice: true, advanceAmount: true, currentStage: true, sizeData: true, engravingRequired: true, engravingText: true, engravingInstructions: true, logoRequired: true, engravingNames: true, engravingLogos: true, instructionNotes: true, orderDestination: true }
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
        select: { id: true, orderNumber: true, createdAt: true, productDetails: true, totalPrice: true, advanceAmount: true, currentStage: true, sizeData: true, engravingRequired: true, engravingText: true, engravingInstructions: true, logoRequired: true, engravingNames: true, engravingLogos: true, instructionNotes: true, orderDestination: true }
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
      where: { source: 'OUTLET', outletName, currentStage: { not: 'ORDER_ENTRY' } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, orderNumber: true, customerName: true, customerPhone: true, totalPrice: true, advanceAmount: true, currentStage: true, orderDestination: true, createdAt: true, engravingRequired: true, status: true }
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
      select: { id: true, orderNumber: true, customerName: true, customerPhone: true, productDetails: true, totalPrice: true, advanceAmount: true, currentStage: true, orderDestination: true, createdAt: true, engravingRequired: true, status: true, sizeData: true, instructionNotes: true }
    });
    const parsed = orders.map(o => ({ ...o, productDetails: (() => { try { return JSON.parse(o.productDetails); } catch { return []; } })() }));
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

    const io = req.app.get('io');
    if (io) io.emit('order-updated', { orderId });

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

    const io = req.app.get('io');
    if (io) io.emit('order-updated', { orderId });

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
      productDetails: (() => { try { return JSON.parse(o.productDetails); } catch { return []; } })()
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

    const io = req.app.get('io');
    if (io) io.emit('order-updated', { orderId });

    res.json({ message: 'Order delivered in-house' });
  } catch (error) {
    res.status(500).json({ message: 'Error delivering order', error: error.message });
  }
};

module.exports = { createOutletOrder, lookupClientByNumber, saveUnregisteredClient, getOutletOrders, getOutletReturns, receiveOutletReturn, getOutletDashboardStats, customerTaken, sendOutletForDelivery, getOutletTasks, inHouseDelivery };