const prisma = require('../prisma');
const cache = require('../utils/cache');

const generateOrderNumber = async () => {
  const prefix = 'OUT-';
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
    const { clientNumber, customerName, customerPhone, address, city, notes, products, engravingRequired, engravingText, engravingInstructions, sizeData, advanceAmount, orderDestination } = req.body;

    if (!customerName) return res.status(400).json({ message: 'Customer name is required' });
    if (!products || !Array.isArray(products) || products.length === 0) return res.status(400).json({ message: 'At least one product is required' });
    if (!orderDestination || !DESTINATION_STAGES[orderDestination]) return res.status(400).json({ message: 'Order destination is required: STORE, LOGO_DESIGN, or PRODUCTION' });

    const outletName = req.user?.name || 'Unknown Outlet';
    const orderNumber = await generateOrderNumber();
    const productDetails = JSON.stringify(products);
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
          engravingInstructions: engravingInstructions || null,
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
        data: { orderId: created.id, stageName: destStage, status: 'PENDING', startedAt: new Date() }
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
          userId: req.user?.id
        }
      });

      return tx.order.findUnique({
        where: { id: created.id },
        include: { stages: { orderBy: { createdAt: 'asc' } } }
      });
    });

    if (req.app.get('io')) req.app.get('io').emit('new-order', { orderId: order.id, orderNumber: order.orderNumber, source: 'OUTLET', outletName });

    res.status(201).json(order);
  } catch (error) {
    console.error('Create outlet order error:', error);
    res.status(500).json({ message: 'Error creating outlet order', error: error.message });
  }
};

const lookupClientByNumber = async (req, res) => {
  try {
    const { number } = req.query;
    if (!number) return res.status(400).json({ message: 'Client number is required' });
    const client = await prisma.client.findFirst({ where: { clientNumber: number, isActive: true } });
    if (!client) return res.status(404).json({ message: 'Client not found' });
    const recentOrders = await prisma.order.findMany({
      where: { customerPhone: client.phone, source: 'OUTLET' },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { id: true, orderNumber: true, createdAt: true, productDetails: true, totalPrice: true, advanceAmount: true, currentStage: true, engravingRequired: true, engravingText: true, engravingInstructions: true, instructionNotes: true, orderDestination: true }
    });
    res.json({ client, recentOrders });
  } catch (error) {
    res.status(500).json({ message: 'Error looking up client', error: error.message });
  }
};

const saveUnregisteredClient = async (req, res) => {
  try {
    const { clientNumber, customerName, customerPhone, address, city, notes } = req.body;
    if (!customerName || !customerPhone) return res.status(400).json({ message: 'Name and phone are required' });
    const outletName = req.user?.name || 'Unknown Outlet';
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
      data: { clientNumber: number, name: customerName, gender: 'Other', phone: customerPhone, permanentAddress: address || null, outletName, deliveryAddresses: city ? [city] : [], createdById: req.user?.id }
    });
    res.status(201).json(client);
  } catch (error) {
    res.status(500).json({ message: 'Error saving client', error: error.message });
  }
};

const getOutletOrders = async (req, res) => {
  try {
    const outletName = req.user?.name || 'Unknown Outlet';
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

module.exports = { createOutletOrder, lookupClientByNumber, saveUnregisteredClient, getOutletOrders };